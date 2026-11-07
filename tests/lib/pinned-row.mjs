// A retired assertion names the live row that pins the same behaviour, and this proves the row exists.
//
// A check that used to read the retired run script's source cannot be kept: the script is gone. What
// the check protected survives as a branch of `probe next`, pinned by a named row in the state-machine
// suite (tests/structural/122-probe-next.mjs) or the end-to-end drive (123). Saying so in a comment is
// a claim; this makes it checkable — each cited row is looked up by the start of its name, and a row
// that was renamed or deleted fails the citing module instead of leaving it citing nothing.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SUITES = ["tests/structural/122-probe-next.mjs", "tests/structural/123-next-drives-a-run.mjs"];

/**
 * Assert that each cited prefix starts the name of a `row("…")` in the state-machine suites.
 *
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @param {string[]} prefixes - The start of each row name the retired assertion's behaviour lives in.
 * @param {string} behaviour - What the retired assertion protected, in a clause.
 * @returns {void}
 */
export function pinnedBy(ctx, prefixes, behaviour) {
  const { ROOT, ok, fail } = ctx;
  const text = SUITES.map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n");
  const missing = prefixes.filter((p) => !text.includes(`row("${p}`) && !text.includes(`"${p}`) && !text.includes(`next: ${p}`));
  if (missing.length) fail(`${behaviour}: the state-machine suite no longer carries the row(s) this behaviour was ported to — ${missing.map((m) => `"${m}…"`).join(", ")}`);
  else ok(`${behaviour} — pinned in the state-machine suite by ${prefixes.length} named row(s)`);
}
