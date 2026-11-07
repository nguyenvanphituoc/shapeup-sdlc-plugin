// Ratchet report — the T0 trial ledger reduced to ~10 scalars: does the build loop actually ratchet?
//
// Pure: no I/O. `reduce ship` calls it over a run's trial rows and freezes the result into the ship
// report, so a reader of the report can tell a loop that improves from one that is a budgeted retry.
// It costs zero model tokens — it reduces over a ledger the harness writes in the ordinary course of
// building — and it states facts, never a grade.

/**
 * @param {number} n - A number.
 * @returns {number} `n` rounded to two decimal places.
 */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Does the build loop actually ratchet?
 *
 * The question harness-versus-bare-agent is already answered elsewhere. This one is THE LOOP
 * VERSUS ITS OWN FIRST ATTEMPT, and it cannot be
 * won by a one-sentence control, because a one-sentence control has no second attempt to compare.
 *
 * A monotone series is a ratchet working. A flat or sawtooth series says the loop is still a
 * budgeted retry loop, and that widening `inspect()` is load-bearing rather than tidy.
 *
 * @param {Array<object>} trials - TrialRow records (from one run's `trials.jsonl`, or many).
 * @returns {{trials:number, scopes:number, scopes_multi_trial:number, improvement_rate:number,
 *   monotone_rate:number, sawtooth_count:number, mean_trials_to_green:(number|null),
 *   status_histogram:Object<string,number>, per_scope:Array<object>}} The ratchet report.
 */
export function ratchetReport(trials) {
  const byScope = new Map();
  const status_histogram = {};
  for (const t of trials || []) {
    status_histogram[t.status] = (status_histogram[t.status] || 0) + 1;
    if (!byScope.has(t.scope_id)) byScope.set(t.scope_id, []);
    byScope.get(t.scope_id).push(t);
  }

  let afterFirst = 0, kept = 0, sawtooth_count = 0, monotone = 0, multi = 0;
  const toGreen = [];
  const per_scope = [];

  for (const [scope_id, rows] of [...byScope.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))) {
    const seq = rows.slice().sort((a, b) => a.trial - b.trial);
    // "Improvement rate" is measured over trials AFTER the first: the first trial is the baseline
    // by construction and counting it as an improvement would inflate every run to ≥ 1/1.
    const later = seq.slice(1);
    afterFirst += later.length;
    kept += later.filter((t) => t.status === "kept").length;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].status === "reverted" && seq[i - 1].status === "kept") sawtooth_count++;
    }
    let scopeMonotone = true;
    if (seq.length >= 2) {
      multi++;
      for (let i = 1; i < seq.length; i++) {
        // A `rebased` step changed the denominator, so it is not a decrease — it is a new series.
        if (seq[i].status === "reverted" || seq[i].status === "crash") { scopeMonotone = false; break; }
      }
      if (scopeMonotone) monotone++;
    }
    // A score with no `regressions` field was not measured for regressions — T0 writes one only when
    // it has a baseline to regress against — which is not the same as having some. Requiring an
    // explicit 0 reported "no scope reached green" over a run whose every scope was green.
    const greenAt = seq.findIndex((t) => t.score && t.score.fixtures_total > 0 && t.score.fixtures_passed === t.score.fixtures_total && (t.score.regressions ?? 0) === 0);
    if (greenAt !== -1) toGreen.push(greenAt + 1);
    per_scope.push({
      scope_id, trials: seq.length,
      first_score: seq[0]?.score ?? null,
      last_score: seq[seq.length - 1]?.score ?? null,
      monotone: seq.length >= 2 ? scopeMonotone : null,
      reached_green_at_trial: greenAt === -1 ? null : greenAt + 1,
    });
  }

  return {
    trials: (trials || []).length,
    scopes: byScope.size,
    scopes_multi_trial: multi,
    improvement_rate: afterFirst > 0 ? round2(kept / afterFirst) : 0,
    monotone_rate: multi > 0 ? round2(monotone / multi) : 0,
    sawtooth_count,
    mean_trials_to_green: toGreen.length ? round2(toGreen.reduce((s, n) => s + n, 0) / toGreen.length) : null,
    status_histogram,
    per_scope,
  };
}
