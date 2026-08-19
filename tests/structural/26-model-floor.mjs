// 26 — THE MODEL FLOOR, EXECUTED AGAINST REAL MODEL IDS.
//
// THE DEFECT THIS CLOSES. `belowFloor()` used to be an ALLOWLIST — exact spelling against
// `{"sonnet","opus"}` — which is backwards from "fail-open": every real model id this repo
// actually ships with (`claude-opus-5`, `claude-sonnet-4-5`, `opusplan`) failed the exact-spelling
// test and `validateArgs` aborted the run before Preflight. Following this repo's own shipped
// documentation — which tells an operator to pass a real model id — killed the run every time.
//
// THE FIX, proved here rather than trusted from a diff: `belowFloor()` is now a DENYLIST of tiers
// this repo never certifies eval or build with. Anything NOT provably below the floor passes — an
// unrecognized model string is evidence this repo hasn't seen it yet, not evidence it is too cheap.
// Only an empty/absent model string is rejected outright, because that is a missing model, not an
// unrecognized one.
//
// WHY THIS EXECUTES THE SHIPPED BYTES RATHER THAN A REIMPLEMENTATION. `shapeup-run.js` is a
// Workflow script — no module resolution, `args` arrives as a runtime global, and the file closes
// with a top-level `return`, so it cannot be `import()`-ed as ordinary ESM. A hand-kept copy of
// `belowFloor()` here would drift from the shipped predicate silently and pass forever regardless —
// the exact class of defect this whole phase exists to close. tests/lib/model-floor-region.mjs
// reads the shipped file and evaluates the delimited region directly, the same technique
// tests/lib/scheduler-region.mjs already uses for the BUILD scheduler in the same file.

import { loadBelowFloor } from "../lib/model-floor-region.mjs";

/**
 * Run the structural checks for the model floor.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("72. Model floor — the shipped belowFloor() predicate, executed against real ids");
  // =============================================================================

  let belowFloor;
  try {
    belowFloor = loadBelowFloor(ROOT);
  } catch (e) {
    fail(`could not load the shipped model-floor region: ${e.message}`);
    return;
  }
  ok("the shipped model-floor region loads and defines belowFloor()");

  // (a) real model ids this repo ships with must pass — the false positive this stage closes.
  const mustPass = ["claude-opus-5", "claude-sonnet-4-5", "opusplan", "sonnet", "opus"];
  for (const m of mustPass) {
    if (belowFloor(m)) fail(`belowFloor(${JSON.stringify(m)}) is truthy — a real model id is rejected before Preflight`);
    else ok(`belowFloor(${JSON.stringify(m)}) is falsy — accepted, not aborted`);
  }

  // (b) genuinely below-floor tiers, and a missing model, must still be rejected — fail-open does
  // not mean "accept everything."
  const mustReject = ["claude-haiku-4-5", "haiku", "", undefined];
  for (const m of mustReject) {
    if (!belowFloor(m)) fail(`belowFloor(${JSON.stringify(m)}) is falsy — should be rejected (below floor or missing)`);
    else ok(`belowFloor(${JSON.stringify(m)}) is truthy — correctly rejected`);
  }

  // (c) THE GUARD HAS BITE: re-run the SAME assertion from (a) against the OLD allowlist shape, to
  // prove this check would actually have failed against the defect it closes — a check that cannot
  // distinguish the fix from the bug it fixes is decorative.
  const { REGION_START, REGION_END } = await import("../lib/model-floor-region.mjs");
  const OLD_ALLOWLIST_SOURCE = [
    REGION_START,
    'const MODEL_FLOOR = new Set(["sonnet", "opus"]);',
    "const belowFloor = (m) => !MODEL_FLOOR.has(String(m || \"\").toLowerCase());",
    REGION_END,
  ].join("\n");
  let oldBelowFloor;
  try {
    oldBelowFloor = loadBelowFloor(ROOT, { source: OLD_ALLOWLIST_SOURCE });
  } catch (e) {
    fail(`could not evaluate the old allowlist shape as a regression fixture: ${e.message}`);
    oldBelowFloor = null;
  }
  if (oldBelowFloor) {
    const oldFalselyRejects = mustPass.some((m) => oldBelowFloor(m));
    if (oldFalselyRejects) {
      ok("the old exact-spelling allowlist shape falsely rejects a real model id — confirms this module's checks would have caught the defect it closes (watched red before the fix landed)");
    } else {
      fail("the old allowlist shape did not falsely reject any real model id — the regression fixture is not representative of the defect this stage closes");
    }
  }
}
