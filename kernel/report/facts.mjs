// facts — the harness's records, projected into fact tables. Pure: no I/O, no clock, no grading.
//
// WHY THIS FILE EXISTS.
//
// The pipeline already writes JSON at every boundary — an order in, a result out, a decision row
// per hook evaluation, a trial row per T0 run. What it never had was a way to READ them together.
// Each record answers a question about itself; none of them answers "what did this run do",
// because that question needs a join and nothing on disk was joinable (see `mintRunId` in
// `lib/paths.mjs` for why).
//
// This module is the projection half. It takes parsed records and returns flat rows — a star
// schema whose grain is the DISPATCH, which is the finest unit the harness actually plans in:
// one compiled order, one worker, one result. Everything else hangs off it as a child table
// (`ac_result`, `discovery`, `file_touched`).
//
// FACTS ONLY — the rule ``harness probe stats`` states in its own header. Every field below is a
// count, a duration, a copied enum or an id. No field here is a score, a rate of quality, or a
// judgement, because a computed grade in the read plane is a second judge behind spec-evaluator
// and the architecture forbids one. `n_ac_fail` is a fact; "AC health" is not.
//
// A dispatch with no matching result is not dropped: `answered: false` says so, because an absent
// value and a zero value must not share a signature. This module carries no cost or wall-clock
// instrumentation — there is no run-scoped record of either to project.

/** Every fact table this module can produce, in dependency order. Exported so the writer, the
 * manifest and the tests enumerate one list instead of three. */
export const TABLES = [
  "run", "dispatch", "ac_result", "discovery", "file_touched",
  "trial", "t0_verdict", "criterion_verdict", "hook_decision",
];

/** Coerce anything to a finite number, or null. Keeps `0` and rejects `NaN`/`""`/undefined. */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Sum a list of numbers, returning null when NOTHING in it was a number — an absent total and a
 * zero total are different facts and must not share a representation. */
function sumOrNull(values) {
  let seen = false, total = 0;
  for (const v of values) { const n = num(v); if (n !== null) { seen = true; total += n; } }
  return seen ? total : null;
}

/**
 * The order id's file stem — the name its order and result files share.
 * @param {string} orderId - e.g. `checkout/sc-01-r1-a2`.
 * @returns {(string|null)} e.g. `sc-01-r1-a2`, or null when the id has no `/`.
 */
export function orderStem(orderId) {
  const s = String(orderId ?? "");
  const i = s.indexOf("/");
  return i === -1 ? null : s.slice(i + 1) || null;
}

/**
 * The round/attempt/scope an order's stem encodes, parsed back out.
 *
 * Read from the id rather than from the payload deliberately: the id is what every other record
 * references, so a fact table keyed on it must agree with it even if a payload disagrees.
 *
 * @param {string} orderId - The order id.
 * @returns {{scope_id:(string|null), round:(number|null), attempt:(number|null)}} Nulls where the
 *   stem carries no such term (a non-build operation has no round or attempt).
 */
export function parseOrderStem(orderId) {
  const stem = orderStem(orderId) || "";
  const m = stem.match(/^(?:(.*)-)?r(\d+)-a(\d+)$/);
  if (m) return { scope_id: m[1] || null, round: Number(m[2]), attempt: Number(m[3]) };
  const opRound = stem.match(/^(.*)-r(\d+)$/);
  if (opRound) return { scope_id: null, round: Number(opRound[2]), attempt: null };
  return { scope_id: null, round: null, attempt: null };
}

/**
 * Project the run dimension — one row, the thing every fact table's `run_id` points at.
 * @param {object} o - Sources (destructured):
 * @param {(object|null)} o.receipt - Parsed `receipt.json`.
 * @param {(object|null)} [o.ledger] - Parsed `harness-run.md` frontmatter (a flat scalar map).
 * @param {(string|null)} [o.runId] - The run key, when already resolved.
 * @returns {(object|null)} The run row, or null when there is no receipt to describe.
 */
export function runRow({ receipt, ledger = null, runId = null }) {
  if (!receipt) return null;
  const c = receipt.config || {};
  const fm = ledger || {};
  return {
    run_id: runId ?? receipt.run_id ?? null,
    slug: receipt.slug ?? null,
    started_at: receipt.started_at ?? null,
    closed_at: fm.closed_at && fm.closed_at !== "~" ? fm.closed_at : null,
    intake_sha256: receipt.intake_sha256 ?? null,
    intake_chars: num(receipt.intake_chars),
    intake_lines: num(receipt.intake_lines),
    auto_level: c.auto_level ?? null,
    lens: c.lens ?? null,
    lane: c.fit?.lane ?? null,
    lane_overridden_from: c.fit?.overridden_from ?? null,
    max_rounds: num(c.max_rounds),
    attempt_budget: num(c.attempt_budget),
    wall_clock_budget_s: num(c.wall_clock_budget_s),
    eval_dimensions: Array.isArray(c.eval_dimensions) ? c.eval_dimensions.join(" ") : null,
    // Copied from the ledger, never re-derived: the run's own status line is the harness's answer,
    // and a read plane that recomputed it would be asserting a second one.
    status: fm.status ?? null,
    final_verdict: fm.final_verdict && fm.final_verdict !== "~" ? fm.final_verdict : null,
    rounds_used: num(Number(fm.rounds_used)),
  };
}

/**
 * Project the dispatch fact table and its three child tables.
 *
 * One row per ORDER — orders are the spine, because an order with no result is the fact you most
 * need (a dispatch that never came back), and a result with no order cannot exist by construction.
 *
 * @param {object} o - Sources (destructured):
 * @param {Array<object>} o.orders - Parsed WorkOrders.
 * @param {Array<object>} [o.results] - Parsed WorkResults; joined on `order_id`.
 * @param {(string|null)} [o.runId] - Run key for orders that carry none (pre-v1.8 traces).
 * @returns {{dispatch:Array<object>, ac_result:Array<object>, discovery:Array<object>,
 *   file_touched:Array<object>}} The fact table and its children, each row already carrying
 *   `run_id` + `order_id` so every table stands alone in the warehouse.
 */
export function dispatchFacts({ orders, results = [], runId = null }) {
  const byOrderId = new Map();
  for (const r of results) if (r?.order_id) byOrderId.set(r.order_id, r);

  const dispatch = [], ac_result = [], discovery = [], file_touched = [];

  for (const order of orders) {
    if (!order?.order_id) continue;
    const id = order.order_id;
    const rid = order.run_id ?? runId ?? null;
    const stem = orderStem(id);
    const { scope_id, round, attempt } = parseOrderStem(id);
    const result = byOrderId.get(id) || null;
    const taskResults = Array.isArray(result?.task_results) ? result.task_results : [];
    const discoveries = Array.isArray(result?.discoveries) ? result.discoveries : [];
    const filesTouched = Array.isArray(result?.files_touched) ? result.files_touched : [];

    let acPass = 0, acFail = 0, acSkip = 0;
    for (const tr of taskResults) {
      for (const ac of Array.isArray(tr?.ac_results) ? tr.ac_results : []) {
        if (ac?.result === "pass") acPass++;
        else if (ac?.result === "fail") acFail++;
        else acSkip++;
        ac_result.push({
          run_id: rid, order_id: id,
          task_id: tr?.task_id ?? null,
          ac: ac?.ac ?? null,
          result: ac?.result ?? null,
          // The evidence TEXT is the worker's prose and belongs in the result file, not in a fact
          // table. Whether it exists at all is the fact — "no evidence = fail by the worker's own
          // hand" is a contract the warehouse can then check without re-reading every envelope.
          has_evidence: !!(ac?.evidence && String(ac.evidence).trim()),
        });
      }
    }
    for (const d of discoveries) {
      discovery.push({
        run_id: rid, order_id: id,
        marker: d?.marker ?? null,
        lens: d?.lens ?? null,
        severity_hint: d?.severity_hint ?? null,
        test_gap: d?.test_gap ?? null,
        contradicts: d?.contradicts ?? null,
        has_repro: !!(d?.repro && String(d.repro).trim()),
        line: d?.line ?? null,
      });
    }
    for (const f of filesTouched) {
      file_touched.push({
        run_id: rid, order_id: id,
        path: f?.path ?? null,
        change: f?.change ?? null,
        lines: num(f?.lines),
      });
    }

    dispatch.push({
      run_id: rid,
      order_id: id,
      slug: id.split("/")[0] || null,
      stem,
      worker: order.worker ?? null,
      operation: order.operation ?? null,
      mode: order.mode ?? null,
      scope_id: scope_id ?? order.payload?.scope_contract?.scope_id ?? null,
      round, attempt,
      compiled_at: order.compiled_at ?? null,
      tasks_ordered: Array.isArray(order.payload?.tasks) ? order.payload.tasks.length : 0,
      digested_errors: Array.isArray(order.payload?.digested_errors) ? order.payload.digested_errors.length : 0,
      // `null`, not `"missing"`: a dispatch with no result file is the single most important row
      // in this table, and it must be filterable as an absence rather than as a status value that
      // sorts alongside real ones.
      result_status: result?.status ?? null,
      answered: !!result,
      task_results: taskResults.length,
      ac_pass: acPass, ac_fail: acFail, ac_skipped: acSkip,
      discoveries: discoveries.length,
      files_touched: filesTouched.length,
      lines_touched: sumOrNull(filesTouched.map((f) => f?.lines)),
      has_verdict: !!result?.verdict,
      verdict_overall: result?.verdict?.overall ?? null,
      assumptions: Array.isArray(result?.assumptions) ? result.assumptions.length : 0,
      deviations: Array.isArray(result?.deviations) ? result.deviations.length : 0,
    });
  }
  return { dispatch, ac_result, discovery, file_touched };
}
