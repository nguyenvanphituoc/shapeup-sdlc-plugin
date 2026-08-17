// probe leg — "did this scope's work actually reach the board?"
//
// CONTRACT. A bounded, read-only query over one scope's orders, results and leg-completion rows for
// one round. Prints `{closed, scope_id, round, orders: [...], unapplied: [...]}` on stdout; exits 0
// when every order that produced a result has been ingested, 1 when at least one has not, 2 on a bad
// argv. Writes nothing.
//
// WHY IT EXISTS. `probe t0` answers "is the T0 verdict green", and the BUILD round's confirm stage
// asked only that. A green T0 says the worker's fixtures ran and passed; it says nothing about
// whether the WorkResult was applied — and this is a state a real run reaches. A build leg can write
// its code, a green T0 verdict, a kept trial row and its WorkResult to disk, and never run step 3 of
// its own script, `reduce ingest`. It reports green; a confirm stage that re-verifies only the T0
// artifact agrees, and the round walks on. That scope's task is left `pending` with zero acceptance
// criteria ticked while its code sits finished on disk, beside a sibling scope whose task is `done`.
//
// Nothing has to be wrong with the order, the receipt or the result for this to happen — ingesting the
// same file afterwards succeeds and ticks the criteria. The single writer of shared state simply never
// ran, and the board GATE L2 reads as "100% ✅" silently disagrees with a scope that is genuinely
// finished. Under fan-out it gets worse rather than better: N legs can each drop the step
// independently, and the only symptom is a board that lags reality.
//
// WHY A LEG ROW IS THE RIGHT EVIDENCE. The row is appended BY `reduce ingest`. Its presence is
// therefore proof the writer ran, and it is not something the leg can assert about itself — the same
// reason the dispatch receipt is written by the hook layer rather than by the sub-agent making the
// call. "The worker says it ingested" is exactly the class of claim this pipeline does not accept.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { ordersDir, resultsDir, legLedger } from "../lib/paths.mjs";

/** `<scope>-r<round>-a<attempt>.json` — the only address a build order is written under. */
const BUILD_ORDER = /^(.+)-r(\d+)-a(\d+)\.json$/;

/**
 * Every leg-completion row on disk, tolerant of a torn last line.
 * @param {string} path - The leg ledger.
 * @returns {object[]} Parsed rows; an unparsable line is skipped rather than fatal.
 */
export function readLegs(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

/**
 * Which of one scope's orders in one round produced a result, and which of those were applied.
 *
 * An order with no result has not finished and is not a finding — the leg may still be running, or
 * may have died, which the round already treats as a spent attempt. What this reports is the
 * narrower and stranger case: a result on disk that the single writer never applied.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} scopeId - Scope contract id.
 * @param {number} round - Build round.
 * @returns {{closed: boolean, orders: object[], unapplied: object[]}} `closed` is false only when a
 *   result exists that was never ingested; a scope with no results at all reports `closed: false`
 *   with an empty `orders` list, so a caller can tell "nothing ran" from "nothing was applied".
 */
export function legState(cwd, slug, scopeId, round) {
  const oDir = ordersDir(cwd, slug);
  const rDir = resultsDir(cwd, slug);
  const legs = readLegs(legLedger(cwd, slug));
  const ingested = new Set(legs
    .filter((r) => Number(r.round) === round && r.scope_id === scopeId && r.ingested_at)
    .map((r) => String(r.order_id)));

  const orders = [];
  for (const f of (existsSync(oDir) ? readdirSync(oDir) : []).sort()) {
    const m = f.match(BUILD_ORDER);
    if (!m || m[1] !== scopeId || Number(m[2]) !== round) continue;
    // The order id is read off the order rather than rebuilt from the filename: the filename is the
    // path the round knows, and the id is the key every record joins on, and they are allowed to be
    // written by different steps.
    let orderId = null;
    try { orderId = JSON.parse(readFileSync(join(oDir, f), "utf8")).order_id ?? null; } catch { /* unreadable — reported below */ }
    orders.push({
      order: join(oDir, f),
      order_id: orderId,
      attempt: Number(m[3]),
      has_result: existsSync(join(rDir, f)),
      applied: orderId !== null && ingested.has(orderId),
    });
  }
  const unapplied = orders.filter((o) => o.has_result && !o.applied);
  return { closed: orders.some((o) => o.applied) && unapplied.length === 0, orders, unapplied };
}

export const ARGV_SPEC = {
  usage: "harness.mjs probe leg --slug <slug> --scope <scope-id> --round N [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  scope: { type: "str", required: true },
  round: { type: "int", min: 1, required: true },
  cwd: { type: "path" },
};

/**
 * Report whether one scope's results for one round reached the board.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0 when closed, 1 when a result was never applied — the shape a caller can
 *   branch on without parsing prose.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const s = legState(cwd, args.slug, args.scope, args.round);
  console.log(JSON.stringify({
    closed: s.closed,
    scope_id: args.scope,
    round: args.round,
    // The counts travel with the verdict: `closed: false` over zero orders means the leg has not run,
    // and over three orders means its work is on disk and unapplied. Those need different answers
    // from the caller, so they must not read the same.
    orders_total: s.orders.length,
    results_total: s.orders.filter((o) => o.has_result).length,
    applied_total: s.orders.filter((o) => o.applied).length,
    orders: s.orders,
    unapplied: s.unapplied.map((o) => o.order),
  }));
  process.exit(s.closed ? 0 : 1);
}
