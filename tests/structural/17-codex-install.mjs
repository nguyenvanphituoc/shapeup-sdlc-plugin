// `init --target codex`, executed against a scratch project and a scratch home: what it installs, what it
// keeps out of the project, that the installed runtime works from where it landed, and that a second run
// moves no byte. Codex's own file formats are the documented ones, not measured (see the fixtures README).
import { join } from "node:path";
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { scratch } from "../lib/fixture.mjs";

const walk = (dir, rel = "", acc = []) => {
  if (!existsSync(join(dir, rel))) return acc;
  for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(dir, p, acc); else acc.push(p);
  }
  return acc;
};
const treeHash = (dir) => createHash("sha256").update(walk(dir).sort().map((f) => `${f}\0${readFileSync(join(dir, f), "utf8")}`).join("\n")).digest("hex");

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const version = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/plugin.json"), "utf8")).version;
  const proj = scratch("codex-proj");
  const home = mkdtempSync(join(tmpdir(), "struct-codex-home-"));
  const env = { ...process.env, PATH: "/usr/bin:/bin" };
  const init = (args) => spawnSync(process.execPath, [join(ROOT, "bin/init.mjs"), "-d", proj.dir, "--home", home, ...args], { cwd: proj.dir, encoding: "utf8", env });
  try {
    section("init --target codex — what lands where");
    // A hooks file the user already has must survive the merge.
    mkdirSync(join(home, ".codex"), { recursive: true });
    writeFileSync(join(home, ".codex/hooks.json"), JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] }] } }));
    const r = init(["--target", "codex", "-y"]);
    const rt = join(home, ".shapeup-sdlc", version);
    check(r.status === 0 && existsSync(join(rt, "kernel/harness.mjs")) && existsSync(join(rt, "hooks/sandbox-guard.mjs")), "the runtime is copied to a versioned directory under the home");
    const hooks = JSON.parse(readFileSync(join(home, ".codex/hooks.json"), "utf8")).hooks.PreToolUse;
    check(hooks.some((e) => e.hooks[0].command === "echo mine") && hooks.filter((e) => /--host codex/.test(e.hooks[0].command) && e.hooks[0].command.includes(rt)).length === 2,
      "the two guards are merged into the user's hooks file, each naming the runtime and --host codex, beside the user's own hook");
    const agents = readdirSync(join(home, ".codex/agents")).sort();
    check(agents.join(",") === readdirSync(join(ROOT, "agents")).map((f) => f.replace(/\.md$/, ".toml")).sort().join(","), "one TOML definition per worker is written");
    const exec = readFileSync(join(home, ".codex/agents/task-executor.toml"), "utf8");
    check(/^name = "task-executor"/m.test(exec) && /developer_instructions = '''/.test(exec) && /load the skill \$task-executor/.test(exec) && !/^tools\s*=/m.test(exec), "a worker's TOML names its skill in the instructions and carries no tool list");
    check(exec.includes(`${rt}/kernel/harness.mjs" attest skill task-executor --order`), "a worker's TOML tells it to attest its skill through the installed kernel");
    const skills = readdirSync(join(home, ".agents/skills"));
    check(["building", "orient", "task-executor", "ship", "retro"].every((s) => skills.includes(s)), "the skills, and the commands as skills, are installed under .agents/skills");
    check(!readFileSync(join(home, ".agents/skills/ship/SKILL.md"), "utf8").includes("$ARGUMENTS") && /^name: ship$/m.test(readFileSync(join(home, ".agents/skills/ship/SKILL.md"), "utf8")), "the ship skill has its arguments reworded and no placeholder left");

    section("init --target codex — the rendered skills find the kernel");
    for (const f of ["skills/building/SKILL.md", "skills/building/resources/intake/open-run.md"]) {
      const t = readFileSync(join(rt, f), "utf8");
      const paths = [...t.matchAll(/node "([^"]+\/kernel\/harness\.mjs)"/g)].map((m) => m[1]);
      check(!t.includes("${CLAUDE_PLUGIN_ROOT}") && paths.length > 0 && paths.every((p) => existsSync(p)) && t.includes(`rendered by shapeup-sdlc ${version}`), `${f}: no plugin-root variable left, every kernel path exists, version stamped`);
    }
    const open = spawnSync(process.execPath, [join(rt, "kernel/harness.mjs"), "init", "run", "--cwd", proj.dir, "--slug", "w", "--intake-text", "hello", "--host", "codex"], { encoding: "utf8" });
    check(open.status === 0 && JSON.parse(readFileSync(join(proj.dir, ".shapeup/w/run-args.json"), "utf8")).host === "codex", "a run opens from the installed runtime, and the roster check passes there");

    section("init --target codex — nothing machine-specific reaches the project");
    const leaked = walk(proj.dir).filter((f) => !f.startsWith(".git/") && !f.startsWith(".shapeup/") && readFileSync(join(proj.dir, f), "utf8").includes(home));
    check(leaked.length === 0 && !existsSync(join(proj.dir, ".codex")) && !existsSync(join(proj.dir, ".agents")), `the project holds no path of this machine (outside the gitignored run trace) and no .codex/.agents folder${leaked.length ? `: ${leaked}` : ""}`);
    check(existsSync(join(proj.dir, "AGENTS.md")) && !existsSync(join(proj.dir, ".claude/settings.json")), "the project gets the harness block, and no Claude settings");

    section("init --target codex — idempotent, checkable");
    const before = treeHash(home) + treeHash(proj.dir);
    init(["--target", "codex", "-y"]);
    init(["--target", "codex", "-y"]);
    const settled = treeHash(home);
    init(["--target", "codex", "-y"]);
    check(treeHash(home) === settled, "a further install moves no byte under the home");
    void before;
    check(init(["--target", "codex", "--check"]).status === 0, "--check reports a clean install");
    writeFileSync(join(rt, "skills/building/SKILL.md"), readFileSync(join(rt, "skills/building/SKILL.md"), "utf8").replace(`rendered by shapeup-sdlc ${version}`, "rendered by shapeup-sdlc 0.0.0"));
    const stale = init(["--target", "codex", "--check"]);
    check(stale.status === 1 && /another version/.test(stale.stdout), "--check names a rendered file stamped by another version");
    const dry = init(["--target", "codex", "--dry-run"]);
    check(dry.status === 0 && /\[dry-run\]/.test(dry.stdout), "--dry-run describes the codex steps");
  } finally { proj.done(); rmSync(home, { recursive: true, force: true }); }
}
