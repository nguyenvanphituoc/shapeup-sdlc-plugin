// rounds — how many BUILD/EVAL rounds a run actually reached, derived from disk.
//
// WHY THIS EXISTS (measured, not theorized).
//
// `harness-run.md`'s `rounds_used` frontmatter is written ONCE, at GATE L0.1 (`init run`), as `0`,
// and nothing in the round loop ever rewrites it — the orchestrator's own RunReturn carries the
// real count, but that value lives in a JS variable a relaunch loses, and it never reached the
// ledger. `reduce ship`'s own derivation partly compensated by counting the highest
// `evaluate-r<N>.json` result on disk, which is right for "rounds the judge saw" and wrong for
// "rounds the run built": measured after two full BUILD rounds with neither reaching EVAL,
// `round_count: 0` and `rounds_used: 0` both — a run that did real work reported having done none.
//
// TWO NUMBERS, NOT ONE. A round can be built and die before EVAL ever sees it (a circuit breaker,
// a kill mid-round), so "rounds built" and "rounds judged" are different facts and collapsing them
// into a single field is exactly what made the fallback silently wrong. Both are returned here, and
// both are meant to survive to wherever a run's numbers are read — the ship report and the export.
//
// PURE. Reads the run's own trace, writes nothing — the same discipline as `reduce ship`'s other
// derivations (`t0Summary`, `boardCensus`, …). A run before any of these artifacts existed, or a
// lane with no round concept at all (`--tiny`), falls back to the caller-supplied ledger value,
// non-regression with the earlier, EVAL-only behaviour.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ordersDir, verdictsDir, roundBuildDir, resultsDir } from "../lib/paths.mjs";

/** Parse a JSON file, returning null rather than throwing — every reader here is best-effort. */
function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/**
 * The round a build-addressed order id encodes, e.g. `checkout/sc-01-r2-a1` → 2.
 * @param {*} orderId - The order's own id, whatever shape it happens to be.
 * @returns {(number|null)} The round, or null when the id carries none (`orient`, `wire`, `hammer`, …).
 */
export function orderRound(orderId) {
  const suffix = String(orderId ?? "").split("/").slice(1).join("/");
  const m = suffix.match(/-r(\d+)(?:-a\d+)?$/);
  return m ? Number(m[1]) : null;
}

const maxOf = (nums) => (nums.length ? Math.max(...nums) : null);

/**
 * How many rounds this run actually reached — built, and separately, judged.
 *
 * `rounds_used` is the highest round carrying ANY build evidence: a compiled order, a T0 verdict
 * artifact, a round build-gate artifact, or an EVAL result — the brief's own list, plus EVAL results
 * because a judged round is, by construction, a round that was also built. `rounds_judged` is the
 * highest round EVAL actually returned a verdict for (`evaluate-r<N>.json` on disk), kept as its own
 * field rather than folded into the only number a reader can see.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {*} [fallback] - What to report for `rounds_used` when nothing on disk is derivable — the
 *   caller's own ledger value, passed through untouched (some callers hand this on already coerced
 *   to a number, some as the raw frontmatter string; this function does not care which).
 * @returns {{rounds_used:*, rounds_judged:(number|null)}} Both counts.
 */
export function deriveRounds(cwd, slug, fallback) {
  const orderRounds = [];
  const oDir = ordersDir(cwd, slug);
  if (existsSync(oDir)) {
    for (const f of readdirSync(oDir)) {
      if (!f.endsWith(".json")) continue;
      const r = orderRound(readJson(join(oDir, f))?.order_id);
      if (r !== null) orderRounds.push(r);
    }
  }

  const verdictRounds = [];
  const vDir = verdictsDir(cwd, slug);
  if (existsSync(vDir)) {
    for (const f of readdirSync(vDir).filter((x) => x.endsWith(".json"))) {
      const v = readJson(join(vDir, f));
      if (typeof v?.round === "number") verdictRounds.push(v.round);
    }
  }

  const buildGateRounds = [];
  const bDir = roundBuildDir(cwd, slug);
  if (existsSync(bDir)) {
    for (const f of readdirSync(bDir)) {
      const m = f.match(/^r(\d+)-t\d+\.json$/);
      if (m) buildGateRounds.push(Number(m[1]));
    }
  }

  const evalRounds = [];
  const rDir = resultsDir(cwd, slug);
  if (existsSync(rDir)) {
    for (const f of readdirSync(rDir)) {
      const m = f.match(/^evaluate-r(\d+)\.json$/);
      if (m) evalRounds.push(Number(m[1]));
    }
  }

  const built = maxOf([...orderRounds, ...verdictRounds, ...buildGateRounds, ...evalRounds]);
  return {
    rounds_used: built !== null ? built : fallback,
    rounds_judged: maxOf(evalRounds),
  };
}
