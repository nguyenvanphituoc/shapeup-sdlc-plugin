// Load the shipped `RESUME` schema OUT OF THE WORKFLOW SCRIPT, so the guard compares the exact
// bytes a real run validates its resume state against — the same reason tests/lib/model-floor-region.mjs
// and tests/lib/scheduler-region.mjs exist and do this for the model floor and the BUILD scheduler.
//
// WHY IT HAS TO BE DONE THIS WAY. A Workflow script has no module resolution — no `import`, no
// `require`, `args` arrives as a runtime global, and `shapeup-run.js` closes with a top-level
// `return`, which is a SyntaxError for any normal ESM `import()` of the file. So the declaration
// cannot be imported, and a hand-kept copy in the suite would agree with itself forever while the
// shipped schema drifted — which is the defect class the guard exists to close, one level up.
//
// WHAT THE GUARD DOES WITH IT. A schema here is one half of a contract whose other half is a kernel
// subcommand's stdout, and nothing compares them: the runtime validates the courier sub-agent's
// report against this declaration, not against what the kernel printed, so the sub-agent silently
// coerces one shape into the other and both halves stay green while disagreeing.
//
// AN ABSENCE IS REPORTED, NEVER SKIPPED. A missing file, a missing marker, or a missing binding
// throws — a loader that returns "nothing to check" on a file it could not find is a green row that
// means the opposite of what it reads.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const REGION_START = "// ---- SCHEMA REGION START";
export const REGION_END = "// ---- SCHEMA REGION END";
export const WORKFLOW = "skills/tech-lead/workflows/shapeup-run.js";

/**
 * Read and evaluate the shipped schema region.
 *
 * @param {string} ROOT - Repository root.
 * @param {object} [opts] - Options.
 * @param {string} [opts.source] - Override the source text (used to re-introduce a defect and
 *   confirm the guard actually catches it).
 * @returns {object} The shipped `RESUME` JSON Schema, as the workflow declares it.
 * @throws {Error} When the file, either marker, or the `RESUME` binding is absent.
 */
export function loadResumeSchema(ROOT, opts = {}) {
  const src = opts.source ?? readFileSync(join(ROOT, WORKFLOW), "utf8");
  const a = src.indexOf(REGION_START);
  const b = src.indexOf(REGION_END);
  if (a === -1 || b === -1 || b < a) {
    throw new Error(`${WORKFLOW} carries no delimited schema region (${REGION_START} … ${REGION_END}); `
      + "the guard below executes that region, so its absence is a failure, not a skip");
  }
  const region = src.slice(a, b);
  // eslint-disable-next-line no-new-func -- the region is repo source, read from disk, not input.
  const factory = new Function(`${region}\nreturn { RESUME };`);
  const bound = factory();
  if (!bound.RESUME || typeof bound.RESUME !== "object") {
    throw new Error("the schema region defines no RESUME object — the resume state has no declared shape");
  }
  return bound.RESUME;
}
