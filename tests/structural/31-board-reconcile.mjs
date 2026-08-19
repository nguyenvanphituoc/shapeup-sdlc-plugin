// 31 — RECONCILE THE BOARD AGAINST CONTRACTS AND ORDERS ON DISK (Phase 3.5 / S6).
//
// THE DEFECT THIS CLOSES. The defect that motivated this whole phase: a whole scope was cut, never
// dispatched, and the board still read `✅ done` because nothing compared the board's rows to what
// was actually on disk — a scope contract and dispatched orders/results both already exist there,
// unread by any check. `kernel/reduce/board.mjs` already computed one drift class ("board-vs-T0
// drift": a FINISHED scope whose tasks still read `ready`) but nothing checked the OPPOSITE
// direction: a task the board marks `done` for a scope that was never dispatched at all.
//
// THE FIX adds `undispatchedCheck()` to `board.mjs`, wired into `derive()`'s report as a new
// `undispatched` field, sibling to the existing `drift` field — neither replaces the other. For
// every scope contract on disk with at least one `done`-marked task (per the parsed board), it
// confirms at least one order under `orders/` names that scope (`payload.scope_contract.scope_id`)
// AND has a same-named file under `results/` (the same filename-presence completion signal
// `hooks/sandbox-guard.mjs`'s `liveOrders()` already uses). No match → a `BOARD-UNDISPATCHED`
// finding, in this codebase's standing `{rule, level, detail}` finding shape.
//
// WHAT THIS MODULE PROVES, against the shipped `derive()` (not a hand-kept copy of the rule):
//   (1) a scope contract with a done-marked task and NOTHING under `orders/`/`results/` for it →
//       the new finding fires, naming that scope — the exact "cut, never dispatched, board still
//       reads done" fixture.
//   (2) the same scope, but with a real order+result pair on disk whose payload names it → the
//       finding does NOT fire, so the check does not false-positive on the ordinary dispatched case.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const SLUG = "board-reconcile-demo";
const SCOPE_ID = "SC-BOARD";

/** Write a file (JSON object or raw string), creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

/**
 * Build one fixture project root: a single scope contract naming one task, and that task's file on
 * the board hand-set to `done`. `withDispatch` controls whether a matching order+result pair is
 * also written under `orders/`/`results/`.
 * @param {boolean} withDispatch - When true, also write a dispatched-and-answered order for the scope.
 * @returns {string} The fixture's project root (`cwd`).
 */
function buildFixture(withDispatch) {
  const cwd = mkdtempSync(join(tmpdir(), "struct-board-reconcile-"));
  w(cwd, `shapeup/${SLUG}/scopes/${SCOPE_ID}.json`, {
    schema_version: 1, scope_id: SCOPE_ID,
    allowed_file_substrate: ["src/board-demo/**"],
    tasks: ["TASK-001"],
  });
  w(cwd, `.shapeup/${SLUG}/tasks/TASK-001.md`,
    `---\nid: TASK-001\nstatus: done\nestimated_hours: 1\n---\n\n# TASK-001 — demo task\n`);
  if (withDispatch) {
    const orderId = "sc-board-r1-a1";
    w(cwd, `.shapeup/${SLUG}/orders/${orderId}.json`, {
      schema_version: 1, order_id: `${SLUG}/${orderId}`, worker: "task-executor", mode: "orchestrated",
      substrate: { allowed_file_substrate: ["src/board-demo/**"] },
      payload: { scope_contract: { schema_version: 1, scope_id: SCOPE_ID, allowed_file_substrate: ["src/board-demo/**"] } },
    });
    w(cwd, `.shapeup/${SLUG}/results/${orderId}.json`, {
      schema_version: 1, order_id: `${SLUG}/${orderId}`, worker: "task-executor",
      task_results: [{ task_id: "TASK-001", status: "done" }],
    });
  }
  return cwd;
}

/**
 * Run the board-reconciliation checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("71. The board is reconciled against contracts and orders on disk (Phase 3.5 / S6)");
  // =============================================================================

  const { derive } = await import(join(ROOT, "kernel/reduce/board.mjs"));

  // --- (1) done-marked task, no order/result anywhere for the scope: must fire -------------------
  {
    const cwd = buildFixture(false);
    try {
      const report = derive({ cwd, slug: SLUG });
      const finding = (report.undispatched || []).find((f) => f.scope_id === SCOPE_ID);
      if (!finding) {
        fail("derive() reported no BOARD-UNDISPATCHED finding for a scope with a done task and no dispatched order — the exact defect this stage closes: a cut, never-dispatched scope reads done unnoticed");
      } else if (finding.rule !== "BOARD-UNDISPATCHED") {
        fail(`finding fired for ${SCOPE_ID} but under rule ${JSON.stringify(finding.rule)}, expected "BOARD-UNDISPATCHED"`);
      } else {
        ok(`BOARD-UNDISPATCHED fires for ${SCOPE_ID}: a done-marked task with no dispatched-and-answered order on disk is flagged`);
      }
      // The existing drift check (a different defect: FINISHED scope, tasks NOT done) must survive
      // untouched alongside the new one — assert the report still carries it as its own field.
      if (!Array.isArray(report.drift)) fail("derive()'s report no longer carries `drift` — the board-vs-T0 drift check must not be removed while adding this stage's check");
      else ok("the existing board-vs-T0 `drift` check still runs alongside the new `undispatched` check");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (2) same scope, with a real dispatched-and-answered order: must NOT fire (no false positive)
  {
    const cwd = buildFixture(true);
    try {
      const report = derive({ cwd, slug: SLUG });
      const finding = (report.undispatched || []).find((f) => f.scope_id === SCOPE_ID);
      if (finding) {
        fail(`BOARD-UNDISPATCHED fired for ${SCOPE_ID} even though a real order+result pair names it on disk — false positive on the ordinary dispatched case`);
      } else {
        ok(`BOARD-UNDISPATCHED does not fire for ${SCOPE_ID} once a real dispatched-and-answered order names it — no false positive on the normal case`);
      }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
}
