// Fixtures shared by the structural modules: a scratch project, a way to write files into it, and the
// two ways the plugin is invoked in production — a hook (stdin JSON in, stdout JSON out) and the kernel.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** A scratch project directory with a git repo in it; `done()` removes it. */
export function scratch(tag, { git = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), `struct-${tag}-`));
  if (git) {
    const g = (a) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
    g(["init", "-q", "-b", "main"]);
    g(["config", "user.email", "t@example.invalid"]);
    g(["config", "user.name", "t"]);
  }
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Write a file (an object is written as JSON), creating its directory. Returns the absolute path. */
export function put(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

export const slurp = (p) => readFileSync(p, "utf8");
export const json = (p) => JSON.parse(readFileSync(p, "utf8"));
export { existsSync };

/**
 * Fire a hook the way the host does: the script, stdin JSON, cwd = the project.
 * `ledger` redirects the decision ledger so the suite never writes into a developer's own.
 * @returns {{status:number, out:(object|null), raw:string, rows:object[]}} The exit code, the parsed
 *   stdout (null when empty), and the decision rows the hook appended.
 */
export function fire(root, script, payload, { cwd, env = {} } = {}) {
  const ledger = join(mkdtempSync(join(tmpdir(), "struct-ledger-")), "decisions.jsonl");
  const r = spawnSync("node", [join(root, script)], {
    cwd: cwd ?? root, input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8", env: { ...process.env, SHAPEUP_DECISIONS_PATH: ledger, ...env },
  });
  const rows = existsSync(ledger) ? readFileSync(ledger, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  rmSync(dirname(ledger), { recursive: true, force: true });
  let out = null;
  try { out = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* not JSON */ }
  return { status: r.status, out, raw: r.stdout, rows, err: r.stderr };
}

/** Whether a hook's stdout is the host's deny answer. */
export const denied = (r) => r.out?.hookSpecificOutput?.permissionDecision === "deny";

/** Run the kernel: `kernel(root, ["gate", "--resolve", …], {cwd})`. */
export function kernel(root, args, { cwd, input, env = {} } = {}) {
  const r = spawnSync("node", [join(root, "kernel/harness.mjs"), ...args], {
    cwd: cwd ?? root, input, encoding: "utf8", env: { ...process.env, ...env },
  });
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { /* not JSON */ }
  return { status: r.status, out, raw: r.stdout, err: r.stderr };
}
