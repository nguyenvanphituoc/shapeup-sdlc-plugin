// The installer's steps, executed: the layering of `bin/lib`, byte parity with the installer before it
// was split into steps, and the two read-only modes (`--dry-run`, `--check`).
import { join } from "node:path";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { scratch, put } from "../lib/fixture.mjs";

const BEFORE = "70e1818";

const walk = (dir, rel = "", acc = []) => {
  for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(dir, p, acc); else acc.push(p);
  }
  return acc;
};
const treeHash = (dir) => createHash("sha256").update(walk(dir).sort().map((f) => `${f}\0${readFileSync(join(dir, f), "utf8")}`).join("\n")).digest("hex");
const imports = (text) => [...text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/g)].map((m) => m[1]);

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

  section("init — the layers inside bin/lib");
  const files = walk(join(ROOT, "bin/lib")).filter((f) => f.endsWith(".mjs"));
  const bad = [];
  for (const f of files) {
    for (const spec of imports(readFileSync(join(ROOT, "bin/lib", f), "utf8")).filter((s) => s.startsWith("."))) {
      const dst = join("bin/lib", f, "..", spec).replace(/\\/g, "/");
      const norm = dst.split("/").reduce((a, p) => (p === ".." ? (a.pop(), a) : p === "." ? a : (a.push(p), a)), []).join("/");
      if (f.startsWith("steps/") && norm.includes("/targets/")) bad.push(`${f} -> ${norm} (a common step imports a target)`);
      const mine = f.match(/^targets\/([^/]+)\//)?.[1];
      const theirs = norm.match(/bin\/lib\/targets\/([^/]+)\//)?.[1];
      if (mine && theirs && mine !== theirs) bad.push(`${f} -> ${norm} (a target imports another target)`);
      if (f.startsWith("targets/") && norm.startsWith("hooks/")) bad.push(`${f} -> ${norm} (a target imports a hook)`);
    }
  }
  check(bad.length === 0 && files.length > 6, `steps/ never import targets, a target never imports another, none import hooks (${files.length} files read)${bad.length ? `: ${bad.join("; ")}` : ""}`);

  section("init — dry-run and check");
  const t = scratch("init-steps");
  const env = { ...process.env, PATH: "/usr/bin:/bin" };
  const init = (args, dir = t.dir) => spawnSync(process.execPath, [join(ROOT, "bin/init.mjs"), "-d", dir, ...args], { cwd: dir, encoding: "utf8", env });
  try {
    const dry = init(["--dry-run"]);
    check(dry.status === 0 && walk(t.dir).length === 0 && /\[dry-run\]/.test(dry.stdout), "--dry-run prints the plan and writes no file");
    const missing = init(["--check"]);
    check(missing.status === 1 && /MISSING agents-md/.test(missing.stdout), "--check on an empty project reports what is missing");
    init(["-y"]);
    const clean = init(["--check"]);
    check(clean.status === 0 && !/MISSING/.test(clean.stdout), "--check on an installed project reports clean");
    put(t.dir, "AGENTS.md", "# only ours\n");
    check(init(["--check"]).status === 1, "--check notices a project whose AGENTS.md lost the harness block");
    check(init(["--target", "nope", "-y"]).status === 1, "an unknown target is refused");
  } finally { t.done(); }

  // The plugin's own init command exists for one difference: it must not register the plugin again.
  // A fake `claude` on PATH records every call, so the test sees the registration attempt itself, not
  // only its trace in the settings file — and the npx entry point, run against the same fake, proves
  // the fake is reached at all.
  section("init — the plugin's own command does not register the plugin");
  const bin = mkdtempSync(join(tmpdir(), "struct-fake-claude-"));
  const marker = join(bin, "called");
  writeFileSync(join(bin, "claude"), `#!/bin/sh\necho "$@" >> "${marker}"\nexit 0\n`, { mode: 0o755 });
  const fakeEnv = { ...process.env, PATH: `${bin}:/usr/bin:/bin` };
  const p = scratch("init-plugin"), n = scratch("init-npx");
  try {
    const go = (entry, d) => spawnSync(process.execPath, [join(ROOT, entry), "-d", d, "-y"], { cwd: d, encoding: "utf8", env: fakeEnv });
    const viaPlugin = go("bin/init-plugin.mjs", p.dir);
    const settings = JSON.parse(readFileSync(join(p.dir, ".claude/settings.json"), "utf8"));
    const grant = ['Bash(node "*/kernel/harness.mjs" *)', 'Bash(node "*/kernel/harness.mjs")'];
    check(viaPlugin.status === 0 && !existsSync(marker) && !settings.enabledPlugins && !settings.extraKnownMarketplaces
      && grant.every((r) => settings.permissions.allow.includes(r)),
      "bin/init-plugin.mjs writes the grant, calls no claude CLI and writes no plugin registration");
    const plain = spawnSync(process.execPath, [join(ROOT, "bin/init-plugin.mjs"), "--check"], { cwd: p.dir, encoding: "utf8", env: fakeEnv });
    check(plain.status === 0 && /ok {3}claude-grant/.test(plain.stdout), "…and its --check reports the project clean");
    go("bin/init.mjs", n.dir);
    check(existsSync(marker) && /plugin install --scope project/.test(readFileSync(marker, "utf8")),
      "bin/init.mjs, against the same fake, does register the plugin at project scope");
  } finally { p.done(); n.done(); rmSync(bin, { recursive: true, force: true }); }

  // The command and the script it runs are two files; the command's line and its allowed-tools rule
  // must both name the script, or the command either runs nothing or asks for approval every time.
  const cmd = readFileSync(join(ROOT, "commands/init.md"), "utf8");
  const allowed = cmd.match(/^allowed-tools:\s*(.+)$/m)?.[1] ?? "";
  check(existsSync(join(ROOT, "bin/init-plugin.mjs")) && cmd.includes('node "${CLAUDE_PLUGIN_ROOT}/bin/init-plugin.mjs"') && allowed.includes('"*/bin/init-plugin.mjs"'),
    "commands/init.md runs bin/init-plugin.mjs and its allowed-tools rule names the same script");

  section(`init — the installed tree matches ${BEFORE}, byte for byte`);
  const old = mkdtempSync(join(tmpdir(), "struct-init-old-"));
  const tar = spawnSync("sh", ["-c", `git -C "${ROOT}" archive ${BEFORE} | tar -x -C "${old}"`]);
  if (tar.status !== 0 || !existsSync(join(old, "bin/init.mjs"))) {
    ok(`parity with ${BEFORE} skipped: that commit is not in this checkout's history`);
  } else {
    // The harness block is content, not installer logic: give the old installer today's AGENTS.md so the
    // comparison is about what the installer does with it.
    writeFileSync(join(old, "AGENTS.md"), readFileSync(join(ROOT, "AGENTS.md")));
    for (const [label, seed] of [["an empty project", false], ["a project with its own AGENTS.md and .gitignore", true]]) {
      const a = scratch("init-a"), b = scratch("init-b");
      try {
        if (seed) for (const d of [a.dir, b.dir]) { put(d, "AGENTS.md", "# Our own rules\n\nKeep them.\n"); put(d, ".gitignore", "node_modules/\n"); put(d, "CLAUDE.md", "# ours\n"); }
        const go = (root, d) => spawnSync(process.execPath, [join(root, "bin/init.mjs"), "-d", d, "-y"], { cwd: d, encoding: "utf8", env });
        go(old, a.dir); go(ROOT, b.dir);
        check(treeHash(a.dir) === treeHash(b.dir), `${label}: same file tree after install`);
        // Until the harness block has been through one update it sits after the project's own text; the
        // update moves it to the top, as the installer always has, and from then on nothing moves.
        go(old, a.dir); go(ROOT, b.dir);
        check(treeHash(a.dir) === treeHash(b.dir), `${label}: the second install also matches ${BEFORE}`);
        const settled = treeHash(b.dir);
        go(ROOT, b.dir);
        check(treeHash(b.dir) === settled, `${label}: from then on a further install changes no byte`);
      } finally { a.done(); b.done(); }
    }
  }
  rmSync(old, { recursive: true, force: true });
}
