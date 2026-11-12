// MODEL FLOOR AND LAUNCH-RECORD CHECK — what a run may be launched with, decided in code.
//
// The model floor is a denylist of cheap tiers refused for the roles that write code and grade it
// (`exec`, `eval`). It is a denylist on purpose, and fails open: an id this list has never heard of
// is allowed, because refusing an unknown future model would stop a run for a reason nobody can
// act on. `qa` is not checked — a hunt discovers and never decides.
//
// WHY THE KERNEL OWNS IT. A rule that only a launch script applied was a rule a different launch
// path never met. Here it is one function, read by whoever opens the run and by the loop that
// drives it, so the two cannot disagree about what is below the floor.

const BELOW_FLOOR = [/ha[i1]ku/i, /\binstant\b/i, /\bmini\b/i, /\bnano\b/i, /\blite\b/i, /\bsmall\b/i];

/**
 * Whether a model id names a tier below the floor.
 * @param {*} m - A model id or alias.
 * @returns {boolean} True for an empty value or a denylisted tier.
 */
export function belowFloor(m) {
  const s = String(m ?? "").trim();
  return s === "" || BELOW_FLOOR.some((re) => re.test(s));
}

/**
 * The roles whose model sits below the floor, as sentences naming the role. `qa` is never checked, and
 * `eval` is not under `--no-eval`: a run that skips evaluation never resolves a judge.
 *
 * @param {object} models - The role -> model matrix (`exec`, `eval`, `qa`).
 * @param {{noEval?: boolean}} [opts] - Whether evaluation is skipped.
 * @returns {string[]} One sentence per offending role; empty when the matrix clears the floor.
 */
export function floorProblems(models, { noEval = false } = {}) {
  const out = [];
  for (const role of ["exec", "eval"]) {
    if (role === "eval" && noEval) continue;
    if (belowFloor(models?.[role])) {
      const m = String(models?.[role] ?? "").trim();
      out.push(`models.${role} ${m ? `"${m}" ` : ""}is below the model floor (sonnet or above)`);
    }
  }
  return out;
}

/**
 * Everything wrong with a launch record, as sentences. Empty means launchable.
 *
 * @param {object} a - The parsed launch record (`run-args.json`).
 * @returns {string[]} Problems, empty when the record may run.
 */
export function launchProblems(a) {
  const problems = [];
  for (const k of ["slug", "models", "budgets"]) {
    if (!a || a[k] === undefined || a[k] === null || a[k] === "") problems.push(`launch record is missing "${k}"`);
  }
  if (a?.budgets && !(a.budgets.maxRounds && a.budgets.attemptBudget)) {
    problems.push("budgets must carry maxRounds and attemptBudget");
  }
  if (a?.models) problems.push(...floorProblems(a.models, { noEval: Boolean(a.noEval) }));
  return problems;
}
