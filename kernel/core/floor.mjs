// MODEL FLOOR — what a run may be launched with, decided in code.
//
// The model floor is a denylist of cheap tiers refused for the roles that write code and grade it
// (`exec`, `eval`). It is a denylist on purpose, and fails open: an id this list has never heard of
// is allowed, because refusing an unknown future model would stop a run for a reason nobody can
// act on. `qa` is not checked — a hunt discovers and never decides.
//
// WHY THE KERNEL OWNS IT. A rule that only a launch script applied was a rule a different launch
// path never met. Here it is one function, read by whoever opens the run and by the loop that
// drives it, so the two cannot disagree about what is below the floor.

/**
 * Whether a model id names a tier below the floor.
 * @param {*} m - A model id or alias.
 * @param {RegExp[]} patterns - The denylisted tiers.
 * @returns {boolean} True for an empty value or a denylisted tier.
 */
export function belowFloor(m, patterns) {
  const s = String(m ?? "").trim();
  return s === "" || patterns.some((re) => re.test(s));
}

/**
 * The roles whose model sits below the floor, as sentences naming the role.
 *
 * @param {object} models - The role -> model matrix.
 * @param {{patterns:RegExp[], roles:string[], skip?:string[], label?:string}} floor - The denylist, the roles it
 *   applies to, the roles skipped on this launch, and what the floor is called in the sentence.
 * @returns {string[]} One sentence per offending role; empty when the matrix clears the floor.
 */
export function floorProblems(models, { patterns, roles, skip = [], label = "the model floor" }) {
  const out = [];
  for (const role of roles) {
    if (skip.includes(role)) continue;
    if (belowFloor(models?.[role], patterns)) {
      const m = String(models?.[role] ?? "").trim();
      out.push(`models.${role} ${m ? `"${m}" ` : ""}is below ${label}`);
    }
  }
  return out;
}
