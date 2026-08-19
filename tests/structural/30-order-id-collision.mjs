// 30 — FIX THE ORDER-ID COLLISION FOR NON-BUILD OPERATIONS (Phase 3.5 / S5).
//
// THE DEFECT THIS CLOSES. `compileOrder()`'s suffix was unique per scope only for BUILD orders
// (`scopeId-r{round}-a{attempt}`); every other operation fell back to `{operation}-r{round}` or bare
// `{operation}`, with no per-leg discriminator at all. Two concurrent non-BUILD legs of the SAME
// operation and round — dispatched for different scopes (e.g. two scopes both running `evaluate` in
// round 1) — compiled to the identical suffix, so the second `compile` call's write clobbered the
// first order file on disk while the run kept reading green (the order that "disappeared" was never
// missing from a caller's point of view — it just never existed as its own file).
//
// THE FIX folds the already-derived `scopeId` into the non-BUILD branch too, but ONLY when a scope
// was actually passed — `operation-scopeId-r{round}` (or `operation-scopeId` with no round) — leaving
// every operation-level (no-scope) dispatch's suffix shape byte-for-byte unchanged.
//
// WHAT THIS MODULE PROVES, by calling the shipped `compileOrder()` directly:
//   (1) two non-BUILD calls, same operation + round, no attempt, DIFFERENT scope objects, now
//       compile to two DIFFERENT `order_id`s — the collision this stage exists to close.
//   (2) every operation-level dispatch this repo actually makes (orient, analyze, wire, map-scopes,
//       evaluate, hunt, hammer — none of which ever pass `scope`, confirmed by reading every
//       `compile` call site in `skills/tech-lead/workflows/shapeup-run.js`) produces the EXACT SAME
//       suffix shape as before this fix — a non-regression proof, not just a new-behavior proof.

import { join } from "node:path";

/**
 * Run the order-id collision checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("30. Non-BUILD orders get a per-leg discriminator, same as BUILD (Phase 3.5 / S5)");
  // =============================================================================

  const { compileOrder } = await import(join(ROOT, "kernel/compile.mjs"));

  const baseArgs = {
    slug: "collision-demo",
    worker: "spec-evaluator",
    operation: "evaluate",
    round: 1,
  };

  // --- (1) two concurrent non-BUILD legs of the SAME operation+round, different scopes, must no
  //         longer collide on the same order_id -------------------------------------------------
  {
    const orderA = compileOrder({ ...baseArgs, scope: { scope_id: "SC-ALPHA", allowed_file_substrate: [] } });
    const orderB = compileOrder({ ...baseArgs, scope: { scope_id: "SC-BETA", allowed_file_substrate: [] } });
    if (orderA.order_id === orderB.order_id) {
      fail(`two non-BUILD orders for different scopes (SC-ALPHA, SC-BETA) compiled to the SAME order_id ${JSON.stringify(orderA.order_id)} — the second write would clobber the first on disk`);
    } else {
      ok(`two non-BUILD orders for different scopes compile to distinct order_ids: ${orderA.order_id} vs ${orderB.order_id}`);
    }
    if (!orderA.order_id.includes("sc-alpha") || !orderB.order_id.includes("sc-beta")) {
      fail(`expected each order_id to carry its own scope id — got ${orderA.order_id} / ${orderB.order_id}`);
    } else {
      ok("each scoped non-BUILD order_id carries its own scope id as the discriminator");
    }
  }

  // --- (2) every real operation-level (no-scope) call site in this repo must keep its EXACT
  //         pre-fix suffix shape ------------------------------------------------------------------
  const operationLevelOps = ["orient", "analyze", "wire", "map-scopes", "evaluate", "hunt", "hammer"];
  for (const operation of operationLevelOps) {
    const withRound = compileOrder({ slug: "collision-demo", worker: "orient", operation, round: 3 });
    const expectedWithRound = `collision-demo/${operation}-r3`;
    if (withRound.order_id !== expectedWithRound) {
      fail(`operation-level "${operation}" with round=3 and no scope: expected order_id ${expectedWithRound}, got ${withRound.order_id} — this stage must not change the no-scope suffix shape`);
    } else {
      ok(`operation-level "${operation}" (round=3, no scope) keeps its pre-fix suffix: ${withRound.order_id}`);
    }

    const noRound = compileOrder({ slug: "collision-demo", worker: "orient", operation });
    const expectedNoRound = `collision-demo/${operation}`;
    if (noRound.order_id !== expectedNoRound) {
      fail(`operation-level "${operation}" with no round and no scope: expected order_id ${expectedNoRound}, got ${noRound.order_id} — this stage must not change the no-scope suffix shape`);
    } else {
      ok(`operation-level "${operation}" (no round, no scope) keeps its pre-fix suffix: ${noRound.order_id}`);
    }
  }

  // --- (3) BUILD orders (round+attempt) must be untouched by this stage — same scopeId-r{r}-a{a}
  //         shape as before, proving the fix is additive to the non-BUILD branch only -------------
  {
    const build = compileOrder({
      slug: "collision-demo", worker: "task-executor", operation: "execute", round: 2, attempt: 1,
      scope: { scope_id: "SC-ALPHA", allowed_file_substrate: [] },
    });
    const expected = "collision-demo/sc-alpha-r2-a1";
    if (build.order_id !== expected) {
      fail(`BUILD order_id changed shape: expected ${expected}, got ${build.order_id} — this stage must not touch the BUILD suffix`);
    } else {
      ok(`BUILD order_id shape is unchanged by this stage: ${build.order_id}`);
    }
  }
}
