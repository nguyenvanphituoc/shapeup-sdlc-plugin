// probe t0 — "has this scope already reached T0-green in this round?"
//
// CONTRACT. A bounded, read-only query over the verdict artifacts on disk. Prints
// `{green, path, round, scope_id}` on stdout; exits 0 when green, 1 when not, 2 on a bad argv.
// Writes nothing.
//
// WHY IT IS A SUBCOMMAND AND NOT AN INLINE SNIPPET. The control plane has no filesystem of its
// own, so the alternative is a `node -e` blob assembled inside the workflow script. Such a blob is
// untestable (a workflow script cannot be imported), and it is the one command shape no permission
// rule can match — the grant covers this entry point, not arbitrary evaluated source.
//
// WHY IT READS ARTIFACTS AND NOT A LEDGER. It answers the question a RESUMED round asks: an
// attempt loop that was killed mid-round must not re-do a scope whose T0 already went green, and
// the only durable evidence of that is the verdict artifact the evaluator is required to cite.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { verdictsDir } from "../lib/paths.mjs";

/**
 * The newest green T0 verdict for one scope in one round.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} scopeId - Scope contract id.
 * @param {number} round - Build round.
 * @returns {{green: boolean, path: (string|null)}} `path` is the artifact a later EVAL can cite.
 */
export function greenVerdict(cwd, slug, scopeId, round) {
  const dir = verdictsDir(cwd, slug);
  if (!existsSync(dir)) return { green: false, path: null };
  // Newest first: an attempt retried after a red one writes a higher trial ordinal at the same
  // (round, attempt) address, and the LAST verdict is the one that stands.
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort().reverse()) {
    const p = join(dir, f);
    try {
      const b = JSON.parse(readFileSync(p, "utf8"));
      if (b.scope_id === scopeId && b.round === round && b.overall === "green") return { green: true, path: p };
    } catch { /* a torn artifact proves nothing; keep looking */ }
  }
  return { green: false, path: null };
}

export const ARGV_SPEC = {
  usage: "harness.mjs probe t0 --slug <slug> --scope <scope-id> --round N [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  scope: { type: "str", required: true },
  round: { type: "int", min: 1, required: true },
  cwd: { type: "path" },
};

/**
 * Report whether one scope is already T0-green for one round.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0 when green, 1 when not — the shape a caller can branch on without parsing.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const { green, path } = greenVerdict(cwd, args.slug, args.scope, args.round);
  console.log(JSON.stringify({ green, path, scope_id: args.scope, round: args.round }));
  process.exit(green ? 0 : 1);
}
