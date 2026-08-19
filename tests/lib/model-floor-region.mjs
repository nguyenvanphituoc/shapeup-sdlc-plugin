// Load `belowFloor` OUT OF THE SHIPPED WORKFLOW SCRIPT, so a fixture exercises the exact bytes
// that gate every real run — the same reason tests/lib/scheduler-region.mjs exists and does this
// for the BUILD scheduler a little further down the same file.
//
// WHY IT HAS TO BE DONE THIS WAY. A Workflow script has no module resolution — no `import`, no
// `require`, `args` arrives as a runtime global, and `shapeup-run.js` closes with a top-level
// `return`, which is a SyntaxError for any normal ESM `import()` of the file — so `belowFloor`
// cannot live in a file the suite imports and the script imports too, and cannot be exercised by
// importing the workflow script directly either. The region between the two markers is read off
// disk and evaluated instead, which is what makes this both possible and honest: a hand-kept
// reimplementation here would pass forever while the shipped predicate drifts — the exact shape of
// defect this stage exists to close in the first place (a plausible-looking copy standing in for
// the real gate).
//
// AN ABSENCE IS REPORTED, NEVER SKIPPED. A missing file, a missing marker, or a missing binding
// throws — a loader that returns "nothing to check" on a file it could not find is a green row
// that means the opposite of what it reads.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const REGION_START = "// ---- MODEL FLOOR REGION START";
export const REGION_END = "// ---- MODEL FLOOR REGION END";
export const WORKFLOW = "skills/tech-lead/workflows/shapeup-run.js";

/**
 * Read and evaluate the shipped model-floor region.
 *
 * @param {string} ROOT - Repository root.
 * @param {object} [opts] - Options.
 * @param {string} [opts.source] - Override the source text (used to re-introduce the old
 *   allowlist defect and confirm a guard actually catches it).
 * @returns {function(*):boolean} The shipped `belowFloor` predicate, bound to the region it was
 *   read from.
 * @throws {Error} When the file, either marker, or the `belowFloor` binding is absent.
 */
export function loadBelowFloor(ROOT, opts = {}) {
  const src = opts.source ?? readFileSync(join(ROOT, WORKFLOW), "utf8");
  const a = src.indexOf(REGION_START);
  const b = src.indexOf(REGION_END);
  if (a === -1 || b === -1 || b < a) {
    throw new Error(`${WORKFLOW} carries no delimited model-floor region (${REGION_START} … ${REGION_END}); `
      + "the guard below executes that region, so its absence is a failure, not a skip");
  }
  const region = src.slice(a, b);
  // eslint-disable-next-line no-new-func -- the region is repo source, read from disk, not input.
  const factory = new Function(`${region}\nreturn { belowFloor };`);
  const bound = factory();
  if (typeof bound.belowFloor !== "function") throw new Error("the model-floor region defines no belowFloor()");
  return bound.belowFloor;
}
