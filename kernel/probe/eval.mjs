// probe eval — "what did round N's EVAL WorkResult actually say?"
//
// CONTRACT. A bounded, read-only query over the evaluate WorkResult ingest already wrote. Prints
// `{ok, overall, bug_count, report_path}` on stdout; exits 0 when found and readable, 1 when the
// result is missing (nothing ran, or ingest hasn't landed yet), 2 on a bad argv. Writes nothing.
//
// WHY THIS EXISTS. `shapeup-run.js` cannot read a file itself (a Workflow script has no filesystem
// of its own — see this repo's own note on why it may not call `Date.now()`), so every fact it
// branches on has to cross an `agent()`/`query()` boundary. Before this command existed, the EVAL
// round-loop branch (`verdict = e.overall === "PASS" ? "pass" : "fail"`) trusted the DISPATCHING
// sub-agent's own end-of-turn summary — a value composed from memory/judgment after three other
// steps (compile, dispatch, ingest), schema-checked for SHAPE only. Nothing re-verified that
// summary against the WorkResult `reduce ingest` had just written to disk. Measured live
// (2026-08-19, todo-cli): `results/evaluate-r1.json`'s `verdict.overall` was `"FAIL"` (2 cited
// bugs, `spec-evaluator` correctly failing `SC-ERR`), and the run proceeded straight to QA and
// GATE H anyway — the exact shape `verdict = e.overall === "PASS"` allows when `e.overall` is a
// self-report that drifted from the artifact it was supposed to summarize. This command closes
// that gap the same way `probe t0` already closes it for the T0 ratchet: a narrow, single-purpose
// "transcribe this JSON verbatim" query over the artifact itself, not a multi-step summary.
//
// WHY IT READS `results/evaluate-r<N>.json` AND NOT THE `.md` REPORT. The WorkResult is the
// machine-checked envelope `reduce ingest` validated against `EVAL`'s schema before ever touching
// shared state; the `.md` report is prose for a human. Reading the prose to re-derive a verdict a
// schema already carries structurally is the paraphrase channel this repo's hooks exist to close
// everywhere else.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { resultsDir } from "../lib/paths.mjs";

/**
 * Read one round's EVAL verdict straight from the WorkResult `reduce ingest` wrote.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {number} round - The EVAL round (`evaluate-r<N>.json`).
 * @returns {{found: boolean, overall: (string|null), bug_count: (number|null),
 *   report_path: (string|null)}} `found: false` when no result exists yet — a fact, not a guess.
 */
export function evalVerdict(cwd, slug, round) {
  const path = join(resultsDir(cwd, slug), `evaluate-r${round}.json`);
  if (!existsSync(path)) return { found: false, overall: null, bug_count: null, report_path: null };
  let doc;
  try { doc = JSON.parse(readFileSync(path, "utf8")); }
  catch { return { found: false, overall: null, bug_count: null, report_path: null }; }
  const v = doc?.verdict || {};
  const overall = v.overall === "PASS" || v.overall === "FAIL" ? v.overall : null;
  return {
    found: overall !== null,
    overall,
    bug_count: Array.isArray(v.bugs) ? v.bugs.length : null,
    report_path: typeof v.report_path === "string" ? v.report_path : null,
  };
}

export const ARGV_SPEC = {
  usage: "harness.mjs probe eval --slug <slug> --round N [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  round: { type: "int", min: 1, required: true },
  cwd: { type: "path" },
};

/**
 * Report round N's EVAL verdict, mechanically, from the WorkResult on disk.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0 when a verdict was found, 1 when none exists yet for this round.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const { found, overall, bug_count, report_path } = evalVerdict(cwd, args.slug, args.round);
  console.log(JSON.stringify({ ok: found, overall, bug_count, report_path, round: args.round }));
  process.exit(found ? 0 : 1);
}
