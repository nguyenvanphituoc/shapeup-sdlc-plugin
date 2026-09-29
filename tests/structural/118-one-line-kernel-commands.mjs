// A KERNEL COMMAND THE MODEL COPIES IS ONE LINE.
//
// The orchestrator's own instructions showed `init run` split across lines with `\`. A launch that
// retyped it on one line opened the run; a relaunch that copied it as shown came back "requires
// approval" over a grant that covers it, and an unattended run stopped before writing a receipt. A
// permission rule matches a single-line command, so every kernel command a shipped instruction shows
// stays on one line.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Run the one-line-command checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("172. No shipped instruction continues a kernel command across lines");
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".md")) files.push(p); } };
  for (const d of ["skills", "commands"]) walk(join(ROOT, d));
  files.push(join(ROOT, "AGENTS.md"));
  const hits = [];
  for (const f of files) {
    readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (/kernel\/harness\.mjs.*\\\s*$/.test(l)) hits.push(`${f.slice(ROOT.length + 1)}:${i + 1}`); });
  }
  if (!hits.length) ok(`every kernel command in ${files.length} shipped instruction files is one line`);
  else fail(`a kernel command continues across lines, which a grant does not match: ${hits.join(", ")}`);
}
