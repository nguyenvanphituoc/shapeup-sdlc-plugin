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
// WHERE THE PREDICATE LIVES NOW. It used to sit inside the launch script, which has no module resolution, so
// this module had to slice a delimited region out of the script and evaluate it. The kernel owns it —
// `kernel/lib/floor.mjs` — and `init run` (which refuses a launch below it) and `probe next` (which refuses
// to drive a record below it) both import the one function, so this module imports it too and runs it.

import { join } from "node:path";

/**
 * Run the structural checks for the model floor.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("72. Model floor — the kernel's belowFloor() predicate, executed against real ids");
  // =============================================================================

  let floor;
  try {
    floor = await import(join(ROOT, "kernel/lib/floor.mjs"));
  } catch (e) {
    fail(`could not load kernel/lib/floor.mjs: ${e.message}`);
    return;
  }
  const { belowFloor, floorProblems } = floor;
  if (typeof belowFloor !== "function" || typeof floorProblems !== "function") { fail("kernel/lib/floor.mjs does not export belowFloor() and floorProblems()"); return; }
  ok("kernel/lib/floor.mjs defines belowFloor() and floorProblems()");

  // (a) real model ids this repo ships with must pass — the false positive this stage closes.
  const mustPass = ["claude-opus-5", "claude-sonnet-4-5", "opusplan", "sonnet", "opus"];
  for (const m of mustPass) {
    if (belowFloor(m)) fail(`belowFloor(${JSON.stringify(m)}) is truthy — a real model id is rejected before a run can open`);
    else ok(`belowFloor(${JSON.stringify(m)}) is falsy — accepted, not aborted`);
  }

  // (b) genuinely below-floor tiers, and a missing model, must still be rejected — fail-open does
  // not mean "accept everything."
  const mustReject = ["claude-haiku-4-5", "haiku", "", undefined];
  for (const m of mustReject) {
    if (!belowFloor(m)) fail(`belowFloor(${JSON.stringify(m)}) is falsy — should be rejected (below floor or missing)`);
    else ok(`belowFloor(${JSON.stringify(m)}) is truthy — correctly rejected`);
  }

  // (c) THE GUARD HAS BITE: the SAME assertion from (a), run against the OLD allowlist shape, shows this check
  // would have failed against the defect it closes — a check that cannot distinguish the fix from the bug it
  // fixes is decorative. The old shape is a self-contained expression, so it is written here and executed.
  const oldBelowFloor = (m) => !new Set(["sonnet", "opus"]).has(String(m || "").toLowerCase());
  if (mustPass.some((m) => oldBelowFloor(m))) {
    ok("the old exact-spelling allowlist shape falsely rejects a real model id — confirms this module's checks would have caught the defect it closes");
  } else {
    fail("the old allowlist shape did not falsely reject any real model id — the regression fixture is not representative of the defect this stage closes");
  }

  // (d) The roles the floor applies to: exec and eval, with eval released by --no-eval and qa never checked.
  const names = (models, opts) => floorProblems(models, opts).map((p) => p.split(" ")[0]).join(",");
  if (names({ exec: "haiku", eval: "haiku", qa: "haiku" }) === "models.exec,models.eval") ok("floorProblems names exec and eval when both are below the floor, and never qa");
  else fail(`floorProblems(all three haiku) named ${names({ exec: "haiku", eval: "haiku", qa: "haiku" })}`);
  if (names({ exec: "sonnet", eval: "haiku" }, { noEval: true }) === "") ok("floorProblems does not check eval under --no-eval");
  else fail("floorProblems checked eval for a run that skips evaluation");
}
