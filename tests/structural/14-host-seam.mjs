// The host seam, executed: the hooks answer exactly as they did before the seam existed when they
// are handed a Claude Code payload, and a payload from another harness leaves a ledger row instead
// of silently switching the guard off.
//
// The "before" copy is the tree at the last commit that predates the seam, exported with `git
// archive`; when that history is not present (a shallow or packed copy) the parity half is skipped
// on the record rather than passed.
import { join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { floorProblems } from "../../kernel/shapeup/floor.mjs";
import { resolveModels } from "../../kernel/init/run.mjs";
import { hostFrom, withoutHost, hostMismatch, denyPayload } from "../../kernel/core/host.mjs";

const BEFORE = "70e1818";

function fireWith(root, script, args, payload, cwd) {
  const dir = mkdtempSync(join(tmpdir(), "struct-host-"));
  const ledger = join(dir, "decisions.jsonl");
  const r = spawnSync("node", [join(root, script), ...args], {
    cwd, input: JSON.stringify(payload), encoding: "utf8",
    env: { ...process.env, SHAPEUP_DECISIONS_PATH: ledger },
  });
  const rows = existsSync(ledger) ? readFileSync(ledger, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, stdout: r.stdout, rows };
}
const strip = (rows) => rows.map(({ ts, at, time, timestamp, pid, ...rest }) => rest);

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

  section("host seam — the pure functions");
  check(hostFrom([]) === "claude" && hostFrom(["--host", "codex"]) === "codex" && hostFrom(["--host=codex"]) === "codex", "the host is read from --host, defaulting to claude");
  check(hostFrom(["--host", "nonsense"]) === "claude", "an unknown host name falls back to the default rather than inventing one");
  check(withoutHost(["a", "--host", "claude", "b", "--host=codex"]).join(",") === "a,b", "--host is removed before a subcommand parses its own arguments");
  check(hostMismatch({ tool_name: "apply_patch" }, "claude")?.includes("codex") && hostMismatch({ tool_name: "Write" }, "claude") === null, "a payload naming another host's tool is a mismatch; the host's own tools are not");
  check(denyPayload("PreToolUse", "why").hookSpecificOutput.permissionDecision === "deny", "the deny answer is the permissionDecision shape");

  section("model floor — ranked per family, not just denylisted");
  const fp = (m, o) => floorProblems({ exec: m, eval: m }, o).length;
  check(fp("sonnet") === 0 && fp("claude-opus-4-1") === 0 && fp("claude-sonnet-5-5") === 0 && fp("fable") === 0, "a Claude id keeps today's behaviour");
  check(fp("claude-haiku-4-5") > 0 && fp("gpt-5-mini") > 0 && fp("deepseek-lite") > 0, "a cheap tier is refused whatever the family");
  check(fp("deepseek-v4-pro") === 0 && fp("gpt-5") === 0, "a ranked model of another family passes");
  check(fp("deepseek-flash") > 0 && fp("totally-new-model") > 0, "an id outside every ranked family is refused");
  check(fp("deepseek-flash", { acceptUnranked: true }) === 0 && fp("gpt-5-mini", { acceptUnranked: true }) > 0, "naming unranked ids at launch passes them but never a denylisted tier");
  check(fp("totally-new-model", { acceptUnranked: true }) === 0, "…and an unknown id passes once accepted");
  check(resolveModels({ host: "codex" }, {}).exec === "gpt-5" && resolveModels({}, {}).exec === "sonnet", "the default model follows the host");

  section("host seam — a payload from another harness is recorded, not ignored");
  const proj = mkdtempSync(join(tmpdir(), "struct-host-proj-"));
  mkdirSync(join(proj, ".git"));
  try {
    for (const script of ["hooks/sandbox-guard.mjs", "hooks/safety-spine.mjs"]) {
      const r = fireWith(ROOT, script, ["--host", "claude"], { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch" }, cwd: proj }, proj);
      check(r.status === 0 && r.stdout.trim() === "" && r.rows.some((x) => x.verdict === "allow" && x.rule === "host-mismatch"),
        `${script} stays fail-open on a Codex payload but writes a host-mismatch row`);
    }
    const r = fireWith(ROOT, "hooks/dispatch-receipt.mjs", ["--host", "claude"], { tool_name: "spawn_agent", tool_input: {}, cwd: proj }, proj);
    check(r.rows.some((x) => x.rule === "host-mismatch"), "dispatch-receipt records a host-mismatch row too");

    section("host seam — Claude payloads answer exactly as before");
    const old = mkdtempSync(join(tmpdir(), "struct-host-old-"));
    const tar = spawnSync("sh", ["-c", `git -C "${ROOT}" archive ${BEFORE} | tar -x -C "${old}"`]);
    if (tar.status !== 0 || !existsSync(join(old, "hooks/sandbox-guard.mjs"))) {
      ok(`parity with ${BEFORE} skipped: that commit is not in this checkout's history`);
    } else {
      const cases = [
        ["hooks/sandbox-guard.mjs", { tool_name: "Write", tool_input: { file_path: join(proj, "shapeup/f/spec.md"), content: "see .shapeup/f/board.json and TASK-001" }, cwd: proj }],
        ["hooks/sandbox-guard.mjs", { tool_name: "Write", tool_input: { file_path: join(proj, "src/a.js"), content: "x" }, cwd: proj }],
        ["hooks/sandbox-guard.mjs", { tool_name: "Read", tool_input: { file_path: "a" }, cwd: proj }],
        ["hooks/safety-spine.mjs", { tool_name: "Bash", tool_input: { command: "rm -rf /" }, cwd: proj }],
        ["hooks/safety-spine.mjs", { tool_name: "Bash", tool_input: { command: "ls" }, cwd: proj }],
        ["hooks/dispatch-receipt.mjs", { tool_name: "Bash", tool_input: {}, cwd: proj }],
        ["hooks/dispatch-receipt.mjs", { tool_name: "Agent", tool_input: { subagent_type: "x" }, tool_response: { status: "completed" }, cwd: proj }],
      ];
      for (const [script, payload] of cases) {
        const a = fireWith(old, script, [], payload, proj);
        const b = fireWith(ROOT, script, ["--host", "claude"], payload, proj);
        const same = a.status === b.status && a.stdout === b.stdout && JSON.stringify(strip(a.rows)) === JSON.stringify(strip(b.rows));
        check(same, `${script} ${payload.tool_name}: same exit, stdout and ledger rows as ${BEFORE}`);
      }
      const e = [{ tool_name: "Skill", tool_input: { skill: "x", skill_args: "--order /nope.json" }, cwd: proj }];
      const a = spawnSync("node", [join(old, "kernel/harness.mjs"), "verify", "envelope"], { cwd: proj, input: JSON.stringify(e[0]), encoding: "utf8" });
      const b = spawnSync("node", [join(ROOT, "kernel/harness.mjs"), "verify", "envelope", "--host", "claude"], { cwd: proj, input: JSON.stringify(e[0]), encoding: "utf8" });
      check(a.status === b.status && a.stdout === b.stdout, "the envelope gate denies the same way with --host claude as without");
      rmSync(old, { recursive: true, force: true });
    }
  } finally {
    rmSync(proj, { recursive: true, force: true });
  }
}
