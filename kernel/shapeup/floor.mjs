// floor — Shape Up's model floor and launch-record check: the denylist and roles the core applies.
//
// The floor is a denylist of cheap tiers refused for the roles that write code and grade it (`exec`,
// `eval`). It fails open: an id this list has never heard of is allowed, because refusing an unknown
// future model would stop a run for a reason nobody can act on. `qa` is not checked — a hunt discovers
// and never decides — and `eval` is not under `--no-eval`, since a run that skips evaluation never resolves a judge.
import { belowFloor as below, floorProblems as problems } from "../core/floor.mjs";

export const FLOOR = {
  patterns: [/ha[i1]ku/i, /\binstant\b/i, /\bmini\b/i, /\bnano\b/i, /\blite\b/i, /\bsmall\b/i],
  roles: ["exec", "eval"],
  label: "the model floor (sonnet or above)",
};

/** Whether a model id names a tier below the floor. */
export const belowFloor = (m) => below(m, FLOOR.patterns);

/** The roles whose model sits below the floor, as sentences; `eval` is skipped under `noEval`. */
export const floorProblems = (models, { noEval = false } = {}) => problems(models, { ...FLOOR, skip: noEval ? ["eval"] : [] });

/**
 * Everything wrong with a launch record, as sentences. Empty means launchable.
 *
 * @param {object} a - The parsed launch record (`run-args.json`).
 * @returns {string[]} Problems, empty when the record may run.
 */
export function launchProblems(a) {
  const out = [];
  for (const k of ["slug", "models", "budgets"]) {
    if (!a || a[k] === undefined || a[k] === null || a[k] === "") out.push(`launch record is missing "${k}"`);
  }
  if (a?.budgets && !(a.budgets.maxRounds && a.budgets.attemptBudget)) {
    out.push("budgets must carry maxRounds and attemptBudget");
  }
  if (a?.models) out.push(...floorProblems(a.models, { noEval: Boolean(a.noEval) }));
  return out;
}
