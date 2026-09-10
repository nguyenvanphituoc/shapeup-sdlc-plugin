// probe eval — "what did round N's EVAL WorkResult actually say?"
//
// CONTRACT. A bounded, read-only query over the evaluate WorkResult ingest already wrote. Prints
// `{ok, overall, bug_count, report_path, round, status, reason}` on stdout; exits 0 when the round
// holds a verdict the run may act on, 1 when it does not — nothing ran, ingest hasn't landed, the
// evaluator refused the round, or the verdict is structurally invalid; `reason` says which — and 2
// on a bad argv. Writes nothing.
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
//
// WHY "NO VERDICT" CARRIES A REASON. An evaluator that refuses a round — a structural precondition
// it cannot meet — still writes `evaluate-r<N>.json`, with `status: failed`, no verdict, and the
// cause as its first deviation. A bare `ok: false` reached the operator as a sub-agent that died
// after retries, while the one sentence naming the actual cause sat in a file nobody was pointed at.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { resultsDir, scopesDir } from "../lib/paths.mjs";

/** Longest `reason` reported. A deviation is prose written by a worker and can run to paragraphs. */
const REASON_MAX = 400;

/**
 * Bound a reason to {@link REASON_MAX} characters.
 * @param {string} s - The reason.
 * @returns {string} `s`, or its first REASON_MAX − 1 characters and an ellipsis.
 */
const clip = (s) => (s.length > REASON_MAX ? `${s.slice(0, REASON_MAX - 1)}…` : s);

/**
 * Whether a feature's spec is SCOPED — has scope contracts, the case in which every verdict must
 * cite the T0 artifacts it re-hashed.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {boolean} True when `scopes/` holds at least one contract (`.md`, or a legacy `.json`).
 */
export function isScoped(cwd, slug) {
  try { return readdirSync(scopesDir(cwd, slug)).some((f) => /\.(md|json)$/.test(f)); }
  catch { return false; }
}

/**
 * Why a verdict cannot stand as its round's judgement on T0 grounds, or null when it can.
 *
 * A PASS or FAIL on a scoped spec that cites no T0 artifact is structurally invalid — the
 * evaluator's own contract says so, because T0 is the machine fact a generator cannot fabricate.
 * That rule used to live only in the contract, so a verdict citing nothing was ingested, ledgered
 * and branched on like any other. It is checked here so the round loop, the resume derivation, the
 * hill and ingest all refuse the same verdict for the same reason.
 *
 * PRESENCE, NOT HASHES. The evaluator re-hashes what it cites; a slip transcribing a digest is not
 * evidence the verdict is wrong, and refusing a round over one would cost a whole re-evaluation.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {object} verdict - The WorkResult's `verdict` block.
 * @returns {(string|null)} The problem, phrased for an operator; null for a cited verdict, an
 *   unscoped spec, or a block with no PASS/FAIL in it (there is no judgement to invalidate).
 */
export function citationProblem(cwd, slug, verdict) {
  if (verdict?.overall !== "PASS" && verdict?.overall !== "FAIL") return null;
  if (Array.isArray(verdict.t0_citations) && verdict.t0_citations.length) return null;
  if (!isScoped(cwd, slug)) return null;
  return `the ${verdict.overall} verdict cites no T0 artifact, and a verdict on a scoped spec must ` +
    "cite the T0 verdict it re-hashed (the order lists them under payload.t0_artifacts)";
}

/**
 * Read one round's EVAL verdict straight from the WorkResult `reduce ingest` wrote.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {number} round - The EVAL round (`evaluate-r<N>.json`).
 * @returns {{found: boolean, overall: (string|null), status: (string|null), reason: (string|null),
 *   bug_count: (number|null), report_path: (string|null)}} `found` is true only for a PASS/FAIL the
 *   round may act on; otherwise `reason` says why not — a fact, not a guess.
 */
export function evalVerdict(cwd, slug, round) {
  const path = join(resultsDir(cwd, slug), `evaluate-r${round}.json`);
  const unfit = (reason, status = null, overall = null) =>
    ({ found: false, overall, status, reason, bug_count: null, report_path: null });
  if (!existsSync(path)) return unfit("no evaluate result for this round yet");
  let doc;
  try { doc = JSON.parse(readFileSync(path, "utf8")); }
  catch { return unfit("the evaluate result is not readable JSON"); }
  const status = typeof doc?.status === "string" ? doc.status : null;
  const v = doc?.verdict || {};
  const overall = v.overall === "PASS" || v.overall === "FAIL" ? v.overall : null;
  if (!overall) {
    // A worker that refused to grade says why in its FIRST deviation — the only channel it has.
    const first = Array.isArray(doc?.deviations) && typeof doc.deviations[0] === "string" ? doc.deviations[0] : "";
    return unfit(clip(first
      ? `the evaluator returned ${status || "no status"}: ${first}`
      : `status ${status || "unknown"} with no PASS/FAIL verdict`), status);
  }
  const problem = citationProblem(cwd, slug, v);
  if (problem) return unfit(problem, status, overall);
  return {
    found: true,
    overall,
    status,
    reason: null,
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
 * @returns {void} Exits 0 when the round holds a verdict the run may act on, 1 when it does not.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const { found, overall, status, reason, bug_count, report_path } = evalVerdict(cwd, args.slug, args.round);
  console.log(JSON.stringify({ ok: found, overall, bug_count, report_path, round: args.round, status, reason }));
  process.exit(found ? 0 : 1);
}
