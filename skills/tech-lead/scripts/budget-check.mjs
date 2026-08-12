#!/usr/bin/env node
// THE THIRD BREAKER — wall clock. Derived, never claimed; checked at every round boundary.
//
// WHY THIS EXISTS (and it corrects an earlier diagnosis).
//
// A run killed at an external time cap produces nothing scoreable, and the obvious reading is that
// it stalled at a gate with no human to sign off.
//
// Reading the transcript with transcript-level metrics often says otherwise, and not narrowly:
// steady turns, steady tool calls, steady file writes, gate markers advancing, a low narration
// ratio and zero stall signals — a run killed mid-loop at GATE L3, Verdict & Loop. It was not
// waiting. It ran out of clock while genuinely working.
//
// That makes the defect specific: **both existing breakers count events, not time.**
// `round_budget` decrements once per round; `attempt_budget` decrements once per T0 attempt.
// Neither can observe that round 1 has been running for twenty-nine minutes. A run can burn its
// entire wall-clock budget without either breaker moving a single tick, and when the harness is
// killed from outside, it ships nothing — not even the scopes that were already green.
//
// So the fix is not more gate automation (there was no stall to automate away). It is a third
// breaker on the axis nobody was watching:
//
//     OUTER    round_budget     — rounds, the six-week-timebox analog
//     INNER    attempt_budget   — T0 attempts per scope
//     DEADLINE wall_clock_budget — elapsed seconds, this file
//
// Tripping the deadline breaker does NOT kill the run. It routes to GATE H (scope-hammer): the
// census runs, the cut list is compared against the baseline, and whatever is green ships. That
// is the entire difference between an external SIGTERM and a circuit breaker — one produces a
// dash in every column, the other produces a smaller feature that works.
//
// Non-regression by construction: with no `wall_clock_budget_s` in the run config this reports
// `off` and nothing changes. Existing runs behave exactly as before.
//
// USAGE
//   node budget-check.mjs [--slug <slug>] [--cwd <root>] [--at <ISO>]   # status, exit 0
//   node budget-check.mjs --strict …    # exit 6 when the breaker has tripped
//
// Output: { status, elapsed_s, budget_s, remaining_s, used_fraction, action }
//   status ∈ off | ok | warn | trip
//   action = the sentence the orchestrator must act on at the round boundary.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isMain } from "./lib/is-main.mjs";
import { runArgs } from "./lib/argv.mjs";
import { localDir } from "./lib/paths.mjs";

/** Fraction of the budget at which the run should stop STARTING work it cannot finish. */
export const WARN_AT = 0.75;

/**
 * Decide the breaker state from elapsed time against a budget. Pure, so the structural tests can
 * assert every boundary without waiting for a clock.
 *
 * @param {number} elapsedS - Seconds since the run receipt was written.
 * @param {number|null} budgetS - Configured wall-clock budget, or null/0 when the breaker is off.
 * @returns {{status: string, elapsed_s: number, budget_s: number|null, remaining_s: number|null,
 *            used_fraction: number|null, action: string}}
 */
export function evaluateBudget(elapsedS, budgetS) {
  const elapsed = Math.max(0, Math.round(elapsedS));
  if (!budgetS || budgetS <= 0) {
    return {
      status: "off", elapsed_s: elapsed, budget_s: null, remaining_s: null, used_fraction: null,
      action: "No wall-clock budget configured — the deadline breaker is off. Round and attempt budgets still apply.",
    };
  }
  const remaining = Math.round(budgetS - elapsed);
  const used = Number((elapsed / budgetS).toFixed(3));

  if (remaining <= 0) {
    return {
      status: "trip", elapsed_s: elapsed, budget_s: budgetS, remaining_s: remaining, used_fraction: used,
      action:
        "DEADLINE BREAKER TRIPPED. Do not start another build round or another scope. Go straight to " +
        "GATE H (delegate scope-hammer with --breaker deadline): run the census, compare the shippable " +
        "subset against the baseline, and ship what is green. A run killed from outside ships nothing; " +
        "a run that trips its own breaker ships the part that works.",
    };
  }
  if (used >= WARN_AT) {
    return {
      status: "warn", elapsed_s: elapsed, budget_s: budgetS, remaining_s: remaining, used_fraction: used,
      action:
        `${remaining}s of ${budgetS}s remain (${Math.round(used * 100)}% spent). Finish and T0-verify the ` +
        "scope in flight; do NOT open a new scope or a new build round. The next boundary is where the " +
        "breaker trips, and work started now will be cut at GATE H rather than shipped.",
    };
  }
  return {
    status: "ok", elapsed_s: elapsed, budget_s: budgetS, remaining_s: remaining, used_fraction: used,
    action: `${remaining}s remain of ${budgetS}s. Proceed.`,
  };
}

/** Locate the active run's receipt — the only place `started_at` is recorded. */
export function findRun(cwd, slug = null) {
  const root = localDir(cwd);
  if (!existsSync(root)) return null;
  if (!slug) {
    try {
      const ptr = JSON.parse(readFileSync(join(root, "active-scope"), "utf8"));
      slug = ptr?.slug || null;
    } catch { /* no pointer — fall through to a scan */ }
  }
  const candidates = slug ? [slug] : (() => { try { return readdirSync(root); } catch { return []; } })();
  for (const entry of candidates) {
    const p = join(root, entry, "receipt.json");
    if (!existsSync(p)) continue;
    try { return { slug: entry, receipt: JSON.parse(readFileSync(p, "utf8")) }; }
    catch { /* unreadable receipt is not a run */ }
  }
  return null;
}

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "budget-check.mjs [--slug <slug>] [--cwd <dir>] [--at <iso8601>] [--strict]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str" },
  cwd: { type: "path" },
  at: { type: "str" },
  strict: { type: "flag" },
};

export function main() {
  const args = runArgs(ARGV_SPEC);
  const cwd = args.cwd || process.cwd();
  const run = findRun(cwd, args.slug ?? null);
  if (!run) {
    console.error("no run receipt found — open the run with init-run.mjs first (GATE L0.1).");
    process.exit(2);
  }
  const startedAt = Date.parse(run.receipt.started_at || "");
  if (Number.isNaN(startedAt)) {
    console.error(`receipt for "${run.slug}" has no parseable started_at — cannot derive elapsed time.`);
    process.exit(2);
  }
  const now = args.at ? Date.parse(args.at) : Date.now();
  const budget = Number(run.receipt.config?.wall_clock_budget_s || 0) || null;
  const result = evaluateBudget((now - startedAt) / 1000, budget);

  console.log(JSON.stringify({ slug: run.slug, started_at: run.receipt.started_at, ...result }, null, 2));
  process.exit(args.strict && result.status === "trip" ? 6 : 0);
}

if (isMain(import.meta.url)) {
  main();
}
