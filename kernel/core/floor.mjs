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
 * @param {{patterns:RegExp[], roles:string[], skip?:string[], label?:string, exempt?:RegExp, known?:RegExp[], acceptUnranked?:boolean}} floor -
 *   The denylist, the roles it applies to, the roles skipped on this launch, and what the floor is called in the
 *   sentence. With `known`, an id matching neither `exempt` (the family the denylist covers) nor a `known`
 *   pattern is refused unless `acceptUnranked`.
 * @returns {string[]} One sentence per offending role; empty when the matrix clears the floor.
 */
export function floorProblems(models, { patterns, roles, skip = [], label = "the model floor", exempt, known, acceptUnranked = false }) {
  const out = [];
  for (const role of roles) {
    if (skip.includes(role)) continue;
    const m = String(models?.[role] ?? "").trim();
    if (belowFloor(m, patterns)) {
      out.push(`models.${role} ${m ? `"${m}" ` : ""}is below ${label}`);
    } else if (known && !acceptUnranked && !exempt.test(m) && !known.some((re) => re.test(m))) {
      // An id outside the family the denylist was written for tells the denylist nothing: passing it
      // would be no check at all, so it must be ranked here or accepted on the record.
      out.push(`models.${role} "${m}" is not a ranked model for ${label}`);
    }
  }
  return out;
}
