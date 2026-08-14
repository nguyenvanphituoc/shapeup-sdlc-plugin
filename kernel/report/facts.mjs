// facts — the harness's records, projected into fact tables. Pure: no I/O, no clock, no grading.
//
// WHY THIS FILE EXISTS.
//
// The pipeline already writes JSON at every boundary — an order in, a result out, a journal row
// per agent call, a decision row per hook evaluation, a trial row per T0 run. What it never had
// was a way to READ them together. Each record answers a question about itself; none of them
// answers "what did this run do, and what did it cost", because that question needs a join and
// nothing on disk was joinable (see `lib/run-id.mjs` for why).
//
// This module is the projection half. It takes parsed records and returns flat rows — a star
// schema whose grain is the DISPATCH, which is the finest unit the harness actually plans in:
// one compiled order, one worker, one result. Everything else either rolls up to it
// (`agent_call`, via the join below) or hangs off it as a child table (`ac_result`,
// `discovery`, `file_touched`).
//
// TWO RULES, INHERITED, AND NEITHER IS STYLISTIC.
//
//   1. FACTS ONLY — the rule ``harness probe stats`` states in its own header. Every field below is a count,
//      a duration, a copied enum or an id. No field here is a score, a rate of quality, or a
//      judgement, because a computed grade in the read plane is a second judge behind
//      spec-evaluator and the architecture forbids one. `n_ac_fail` is a fact; "AC health" is not.
//
//   2. NEVER FABRICATE A JOIN. The agent-call join (below) is real but partial, so every dispatch
//      row carries `agent_join` naming HOW it was joined — or `null` when it wasn't. An analyst
//      summing `cost_usd` must be able to see what share of dispatches had no cost row at all,
//      because the alternative is a total that silently under-reports and looks authoritative.
//      This is the same defect shape as `allow` with no receipt: an absent value and a zero value
//      must not share a signature.
//
// THE AGENT-CALL JOIN, stated exactly. `journal.jsonl` is the only record carrying `cost_usd` and
// wall-clock, and its rows name no order — the launcher is generic and never parsed the prompt it
// was given. But the workflow's dispatch prompt asks the worker for a `result_path`, and that path
// is `<run root>/results/<stem>.json`, whose stem is the order id's suffix. So a journal row whose
// returned object carries `result_path` joins to exactly one order, deterministically, with no
// heuristics. Rows without it — the mechanical `set-active-order` couriers, a failed dispatch that
// returned nothing — join to no order and are counted as unattributed rather than dropped.

/** Every fact table this module can produce, in dependency order. Exported so the writer, the
 * manifest and the tests enumerate one list instead of three. */
export const TABLES = [
  "run", "dispatch", "ac_result", "discovery", "file_touched",
  "agent_call", "trial", "t0_verdict", "criterion_verdict", "hook_decision",
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
 * The order stem a journal row refers to, via the `result_path` its schema'd reply carries.
 * @param {object} row - One `journal.jsonl` row.
 * @returns {(string|null)} The stem, or null when the row named no result path.
 */
export function journalOrderStem(row) {
  const p = row?.result?.result_path;
  if (typeof p !== "string" || !p) return null;
  const base = p.split(/[/\\]/).pop() || "";
  return base.replace(/\.json$/i, "") || null;
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
 * Project one agent-call row from a journal row.
 * @param {object} row - One `journal.jsonl` row.
 * @param {(string|null)} runId - The run key to stamp when the row itself carries none.
 * @returns {object} A flat `agent_call` fact row.
 */
export function agentCallRow(row, runId = null) {
  const sessions = Array.isArray(row?.sessions) ? row.sessions : [];
  return {
    run_id: row?.run_id ?? runId ?? null,
    seq: num(row?.seq),
    phase: row?.phase ?? null,
    label: row?.label ?? null,
    model: row?.model ?? null,
    permission_mode: row?.permission_mode ?? null,
    started_at: row?.started_at ?? null,
    wall_ms: num(row?.wall_ms),
    // The launcher retries a schema-invalid reply once, so `attempts` > 1 is a fact about the
    // WORKER's compliance and is kept distinct from `ok`, which is about the final outcome.
    attempts: num(row?.attempts),
    ok: typeof row?.ok === "boolean" ? row.ok : null,
    cost_usd: sumOrNull(sessions.map((s) => s?.cost_usd)),
    sessions: sessions.length,
    errored: sessions.some((s) => s?.is_error === true),
    killed: sessions.some((s) => s?.killed === true),
    order_stem: journalOrderStem(row),
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
 * @param {Array<object>} [o.journal] - Parsed journal rows; joined on the result-path stem.
 * @param {(string|null)} [o.runId] - Run key for orders that carry none (pre-v1.8 traces).
 * @returns {{dispatch:Array<object>, ac_result:Array<object>, discovery:Array<object>,
 *   file_touched:Array<object>}} The fact table and its children, each row already carrying
 *   `run_id` + `order_id` so every table stands alone in the warehouse.
 */
export function dispatchFacts({ orders, results = [], journal = [], runId = null }) {
  const byOrderId = new Map();
  for (const r of results) if (r?.order_id) byOrderId.set(r.order_id, r);
  const byStem = new Map();
  for (const j of journal) {
    const stem = journalOrderStem(j);
    // Last write wins: a dispatch retried after a failure legitimately produces two journal rows
    // for one order, and the one that finished it is the one whose cost the dispatch carries. The
    // discarded row is NOT lost — it remains its own `agent_call` row, so the retry is still
    // visible and the two totals differ by exactly the retries.
    if (stem) byStem.set(stem, j);
  }

  const dispatch = [], ac_result = [], discovery = [], file_touched = [];

  for (const order of orders) {
    if (!order?.order_id) continue;
    const id = order.order_id;
    const rid = order.run_id ?? runId ?? null;
    const stem = orderStem(id);
    const { scope_id, round, attempt } = parseOrderStem(id);
    const result = byOrderId.get(id) || null;
    const call = stem ? byStem.get(stem) || null : null;
    const agent = call ? agentCallRow(call, rid) : null;
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
      // The agent-call leg. Present only where the join held; `agent_join` says which.
      agent_seq: agent?.seq ?? null,
      model: agent?.model ?? null,
      wall_ms: agent?.wall_ms ?? null,
      cost_usd: agent?.cost_usd ?? null,
      agent_attempts: agent?.attempts ?? null,
      agent_ok: agent?.ok ?? null,
      agent_join: agent ? "result_path" : null,
    });
  }
  return { dispatch, ac_result, discovery, file_touched };
}

/**
 * The run-economics projection — measurement-table row 4, computed from records the harness
 * already writes.
 *
 * Every field is a count, a sum or a duration over recorded rows. Nothing here is normalised
 * against a baseline, because no baseline dataset exists: this reports what a run cost, never
 * whether that was good, which would be a grade.
 *
 * @param {object} o - Sources (destructured):
 * @param {Array<object>} o.agent_call - Rows from {@link agentCallRow}.
 * @param {Array<object>} [o.dispatch] - Rows from {@link dispatchFacts}; supplies the first write.
 * @param {(object|null)} [o.run] - The run row; supplies `started_at` for the latency measures.
 * @returns {object} `{agent_calls, cost_usd, cost_attributed_usd, cost_unattributed_usd,
 *   wall_ms_total, calls_to_first_write, seconds_to_first_write, by_model[], retried_calls,
 *   failed_calls, dispatches, dispatches_answered, dispatches_costed}` — with nulls, never zeros,
 *   wherever the underlying record was absent.
 */
export function economics({ agent_call, dispatch = [], run = null }) {
  const calls = Array.isArray(agent_call) ? agent_call : [];
  const wroteBy = new Set(dispatch.filter((d) => (d.files_touched || 0) > 0).map((d) => d.stem));

  // "Turns to first write" — the harness's own definition of the metric the design doc names but
  // has never had an instrument for. Measured in AGENT CALLS, because a call is the unit that
  // costs money; the seconds figure is reported beside it so a run that is slow and a run that is
  // chatty stay distinguishable.
  const ordered = [...calls].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const firstWriteIdx = ordered.findIndex((c) => c.order_stem && wroteBy.has(c.order_stem));
  const firstWrite = firstWriteIdx === -1 ? null : ordered[firstWriteIdx];
  const startMs = run?.started_at ? Date.parse(run.started_at) : NaN;
  const firstMs = firstWrite?.started_at ? Date.parse(firstWrite.started_at) : NaN;

  const byModel = new Map();
  for (const c of calls) {
    const k = c.model || "(unnamed)";
    const m = byModel.get(k) || { model: k, calls: 0, cost_usd: null, wall_ms: null };
    m.calls++;
    if (num(c.cost_usd) !== null) m.cost_usd = (m.cost_usd ?? 0) + c.cost_usd;
    if (num(c.wall_ms) !== null) m.wall_ms = (m.wall_ms ?? 0) + c.wall_ms;
    byModel.set(k, m);
  }

  const costed = new Set(dispatch.filter((d) => num(d.cost_usd) !== null).map((d) => d.order_id));
  return {
    agent_calls: calls.length,
    cost_usd: sumOrNull(calls.map((c) => c.cost_usd)),
    // The unattributed share is reported, never hidden: it is what the dispatch table's cost
    // column is MISSING, and an analyst who cannot see it will read a partial total as a full one.
    cost_attributed_usd: sumOrNull(calls.filter((c) => c.order_stem).map((c) => c.cost_usd)),
    cost_unattributed_usd: sumOrNull(calls.filter((c) => !c.order_stem).map((c) => c.cost_usd)),
    wall_ms_total: sumOrNull(calls.map((c) => c.wall_ms)),
    calls_to_first_write: firstWriteIdx === -1 ? null : firstWriteIdx + 1,
    seconds_to_first_write: Number.isFinite(startMs) && Number.isFinite(firstMs)
      ? Math.round((firstMs - startMs) / 1000) : null,
    retried_calls: calls.filter((c) => (c.attempts ?? 0) > 1).length,
    failed_calls: calls.filter((c) => c.ok === false).length,
    killed_calls: calls.filter((c) => c.killed).length,
    dispatches: dispatch.length,
    dispatches_answered: dispatch.filter((d) => d.answered).length,
    dispatches_costed: costed.size,
    by_model: [...byModel.values()].sort((a, b) => a.model.localeCompare(b.model)),
  };
}
