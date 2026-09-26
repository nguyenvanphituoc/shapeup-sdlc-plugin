// A WORKER'S KERNEL COMMAND IS A PATH, NOT A VARIABLE.
//
// Worker skills told the sub-agent to run `node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" …`. In a
// headless session the variable is not expanded for the sub-agent, and a Bash command carrying an
// unexpanded variable is refused before any permission rule is read — measured on a live consumer:
// "Contains expansion". The same command with the absolute path ran under the same grant. Every
// kernel query a worker's contract requires (ownership, the requirements matrix, T0) was therefore
// refused, and the workers reported it as "not permitted". Orders now carry the absolute kernel path,
// and worker skills run `node "<kernel>" …`.
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";

const WORKERS = ["task-executor", "ba-pitch-analyzer", "spec-evaluator", "solution-architect", "scope-architect", "scope-hammer"];

/**
 * Run the kernel-path checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("159. Orders carry the absolute kernel path, and no worker skill runs the kernel through a variable");

  const d = mkdtempSync(join(tmpdir(), "order-kernel-"));
  try {
    const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "compile", "--operation", "evaluate", "--slug", "demo",
      "--payload", JSON.stringify({ dimensions: ["spec-conformance"] }), "--cwd", d], { encoding: "utf8" });
    let order = null;
    try { order = JSON.parse(readFileSync(r.stdout.trim(), "utf8")); } catch { /* reported below */ }
    const k = order?.kernel;
    if (typeof k === "string" && isAbsolute(k) && k.endsWith("/kernel/harness.mjs") && existsSync(k)) ok("a compiled order names an absolute kernel path that exists");
    else fail(`order.kernel = ${JSON.stringify(k)} (exit ${r.status}: ${r.stderr.trim().slice(0, 160)})`);
    if (k && !/\$/.test(k)) ok("the kernel path carries no variable for a shell to expand");
    else fail(`the kernel path carries a variable: ${k}`);
    const v = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "verify", "envelope", r.stdout.trim(), join(ROOT, "kernel/schemas/work-order.schema.json")], { encoding: "utf8", input: "" });
    if (v.status === 0) ok("the order with its kernel field still validates against the envelope schema");
    else fail(`verify envelope refused the order: ${(v.stdout + v.stderr).trim().slice(0, 200)}`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }

  const offenders = [];
  for (const w of WORKERS) {
    const text = readFileSync(join(ROOT, "skills", w, "SKILL.md"), "utf8");
    // The one sanctioned mention is the definition that says never to use the variable.
    const commands = text.split("\n").filter((l) => /node\s+"\$\{CLAUDE_PLUGIN_ROOT\}/.test(l));
    if (commands.length) offenders.push(`${w}: ${commands[0].trim().slice(0, 80)}`);
    if (!/order's `kernel` field/.test(text)) offenders.push(`${w}: never says where <kernel> comes from`);
  }
  if (!offenders.length) ok(`no dispatched worker's skill (${WORKERS.length}) runs the kernel through \${CLAUDE_PLUGIN_ROOT}, and each defines <kernel>`);
  else fail(`worker skills still run the kernel through a variable: ${offenders.join("; ")}`);
}
