// probe attempts — "how many of this scope's attempts are ATTESTED work, not writable artifacts?"
//
// CONTRACT. A bounded, read-only query over one scope's attested channels for one round: dispatch
// receipts (`receipts/dispatch.jsonl`), leg-completion rows (`legs.jsonl`) and WorkResults
// (`results/`). Prints `{scope_id, round, attempt_budget, spent, in_flight, unattested, green,
// tripped, attempts}` on stdout; exits 0 when the breaker holds, 1 when it has tripped, 2 on a bad
// argv. Writes nothing.
//
// WHY IT EXISTS. Measured on a real run: attempt 2 of a scope was compiled and T0-verified
// several minutes BEFORE attempt 1 ingested — while attempt 1 was still in flight. No worker was
// ever dispatched for attempt 2:
// `receipts/dispatch.jsonl`, `legs.jsonl` and `results/` carried no row for it. A derivation keyed
// off the order set (`orders/`) or the T0 verdict set (`t0/verdicts/`) alone counts a compiled
// order or a green trial as a spent attempt regardless of whether a worker ever ran — both are
// WRITABLE by the very leg whose exhaustion is being judged. This module counts an attempt as
// SPENT only when a dispatch receipt attests it started AND either a leg-completion row or a
// WorkResult on disk attests it closed. Neither channel alone is enough: a receipt with no result
// is a leg still in flight (open, not spent — the breaker must not trip on unanswered work), and a
// result or verdict with no receipt is unattested — no worker ran, which is the shape that
// produced this module.
//
// WHY THE SAME FUNCTION SERVES THE BREAKER AND THE CENSUS. Before this module, the round loop's
// inner breaker and `scope-hammer`'s GATE H0 census read different evidence for the same question
// — the loop trusted the worker's own self-reported `attempts_used`/`breaker` (schema-shaped, not
// re-verified), the census read `t0/verdicts/*.json` directly — and disagreed on the measured run.
// One shared, attested derivation is what makes "the census and the breaker agree" true by
// construction rather than by coincidence: `skills/scope-hammer/SKILL.md` cites this same probe
// the way it already cites `probe owner` for ownership claims.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { dispatchReceipts, legLedger, resultsDir, readRunId } from "../lib/paths.mjs";
import { readLegs } from "./leg.mjs";
import { greenVerdict } from "./t0.mjs";

/**
 * Every dispatch-receipt row on disk, tolerant of a torn last line (mirrors {@link readLegs}).
 * @param {string} path - `receipts/dispatch.jsonl`.
 * @returns {object[]} Parsed rows; an unparsable line is skipped rather than fatal.
 */
export function readReceipts(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

/**
 * One attempt's evidence across the three attested channels, and the state it derives to.
 *
 * `unattested` (no receipt at all) counts as though the attempt never happened — the order and any
 * T0 verdict may still be sitting on disk, written by something other than a dispatched worker, and
 * neither is asked here. `in-flight` (a receipt, but no leg row and no result) is a real dispatch
 * whose leg has not yet closed: open, not spent. `spent` is closed either way a leg closes — via
 * `reduce ingest`'s own leg-completion row, or a WorkResult already on disk pending ingest.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} scopeId - Scope contract id (the order id's own address, e.g. `shell-r1-a2`).
 * @param {number} round - Build round.
 * @param {number} attempt - Attempt number within the round.
 * @param {object[]} receipts - Pre-read `receipts/dispatch.jsonl` rows (avoids re-reading per attempt).
 * @param {object[]} legs - Pre-read `legs.jsonl` rows.
 * @returns {{orderId:string, hasReceipt:boolean, hasResult:boolean, hasLeg:boolean, state:("unattested"|"in-flight"|"spent")}}
 */
export function attemptEvidence(cwd, slug, scopeId, round, attempt, receipts, legs, runId = null) {
  const orderId = `${slug}/${scopeId}-r${round}-a${attempt}`;
  // SCOPED TO THIS RUN, and that qualifier is the whole correction. `receipts/dispatch.jsonl` and
  // `legs.jsonl` are per-slug and append-only, so they accumulate across every run of a pitch,
  // while `order_id` repeats — the run key is the only thing that separates two runs of one
  // feature. Matching on `order_id` alone answered "was this attempt spent?" with a PREVIOUS run's
  // receipt: measured on a consumer, a run that dispatched nothing was told its first attempt was
  // spent, complete with leg and result, by rows two launches old.
  //
  // A row carrying no run key belongs to NO run rather than to this one, and an unresolvable
  // current run (no receipt on disk) matches nothing. Both directions under-count rather than
  // over-count, which is the safe way to be wrong here: an under-count leaves a breaker un-tripped
  // and the round continues, where an over-count stops work that was never done.
  const mine = (r) => r?.order_id === orderId && runId != null && r?.run_id === runId;
  const hasReceipt = receipts.some(mine);
  const hasLeg = legs.some(mine);
  // A WorkResult carries no run key and reaches one only through its `order_id`, which repeats —
  // so this stays a file check and is deliberately NOT sufficient on its own. It can only turn an
  // already run-scoped receipt into `spent`; a result left behind by an earlier run cannot attest
  // an attempt this run never dispatched.
  const hasResult = existsSync(join(resultsDir(cwd, slug), `${scopeId}-r${round}-a${attempt}.json`));
  const state = !hasReceipt ? "unattested" : (hasResult || hasLeg) ? "spent" : "in-flight";
  return { orderId, hasReceipt, hasResult, hasLeg, state };
}

/**
 * A scope's attempt census for one round, derived ONLY from attested channels — the function both
 * the round loop's inner breaker and scope-hammer's GATE H0 census call, so they cannot drift apart
 * again the way a measured run found them.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} scopeId - Scope contract id.
 * @param {number} round - Build round.
 * @param {number} attemptBudget - The scope's configured `attempt_budget`.
 * @returns {{scope_id:string, round:number, attempt_budget:number, spent:number, in_flight:number,
 *   unattested:number, green:boolean, tripped:boolean, attempts:object[]}} `tripped` is true only
 *   when every attempt within budget is genuinely SPENT and none produced a green T0 — an attempt
 *   still in flight holds the breaker open regardless of how many slots are nominally used.
 */
export function scopeAttempts(cwd, slug, scopeId, round, attemptBudget) {
  const receipts = readReceipts(dispatchReceipts(cwd, slug));
  const legs = readLegs(legLedger(cwd, slug));
  const runId = readRunId(cwd, slug);
  const attempts = [];
  let spent = 0, inFlight = 0, unattested = 0;
  for (let a = 1; a <= attemptBudget; a++) {
    const ev = attemptEvidence(cwd, slug, scopeId, round, a, receipts, legs, runId);
    if (ev.state === "spent") spent++;
    else if (ev.state === "in-flight") inFlight++;
    else unattested++;
    attempts.push({ attempt: a, ...ev });
  }
  const { green } = greenVerdict(cwd, slug, scopeId, round);
  return {
    scope_id: scopeId, round, attempt_budget: attemptBudget,
    spent, in_flight: inFlight, unattested, green,
    tripped: !green && spent >= attemptBudget,
    attempts,
  };
}

export const ARGV_SPEC = {
  usage: "harness.mjs probe attempts --slug <slug> --scope <scope-id> --round N --attempt-budget N [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  scope: { type: "str", required: true },
  round: { type: "int", min: 1, required: true },
  "attempt-budget": { type: "int", min: 1, required: true },
  cwd: { type: "path" },
};

/**
 * Report one scope's attested attempt census for one round.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0 when the breaker holds, 1 when it has tripped — the shape a caller (or a
 *   census citing this row) can branch on without parsing prose.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const r = scopeAttempts(cwd, args.slug, args.scope, args.round, args.attemptBudget);
  console.log(JSON.stringify(r));
  process.exit(r.tripped ? 1 : 0);
}
