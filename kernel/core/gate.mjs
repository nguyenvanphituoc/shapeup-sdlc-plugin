// gate — the resolver, free of any workflow's gates: a table of the gates and the answers each allows,
// and a list of evidence rules that narrow an answer to what the run's own files support.
//
// An answer chooses among the answers a gate allows; it never supplies the evidence that makes one
// allowed. `resolveGate` checks an answer against the table; `narrow` runs it through the rules, each
// of which may replace it with a refusal. Pure: nothing here reads a file or exits — the caller turns
// a `status` into an exit code.

/**
 * One gate's answer as a result. Returns { gate, decision, source, note, status } where status ∈ ok | abort | error.
 * `table` is `{ids: string[], valid: {gate: string[]}}`. Pure: the CLI turns `status` into the exit code, nothing here exits.
 */
export function resolveGate(table, gate, decision, source, note) {
  if (!table.ids.includes(gate)) {
    return { gate, status: "error", reason: `unknown gate "${gate}" — known: ${table.ids.join(", ")}` };
  }
  if (!table.valid[gate].includes(decision)) {
    return { gate, status: "error", reason: `"${decision}" is not a decision GATE ${gate} takes — valid: ${table.valid[gate].join(", ")}` };
  }
  if (decision === "abort") return { gate, status: "abort", source, decision, note, reason: `GATE ${gate} is answered "abort".` };
  return { gate, status: "ok", decision, source, note };
}


/**
 * Narrow a resolved answer to the evidence. Each rule is `(result, ctx) => (refusal|result|undefined)`:
 * undefined means the rule has nothing to say about this answer; anything else is the final answer.
 * @param {object} r - A resolved gate result from {@link resolveGate}.
 * @param {Array<function(object, object): (object|undefined)>} rules - The workflow's evidence rules, in order.
 * @param {object} ctx - Whatever the rules read (project root, slug, …); opaque to the core.
 * @returns {object} The first rule's answer, or `r` when none had anything to say.
 */
export function narrow(r, rules, ctx) {
  for (const rule of rules) {
    const out = rule(r, ctx);
    if (out !== undefined) return out;
  }
  return r;
}
