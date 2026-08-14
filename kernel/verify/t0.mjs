#!/usr/bin/env node
// T0 mechanical verification layer.
//
// Runs a scope's e2e fixtures + DB probe (zero LLM tokens), then — on green — the seesaw
// regression check (re-runs every FINISHED scope's fixtures from the registry). Writes one
// verdict artifact per attempt that spec-evaluator (T1) must cite; a verdict without it is
// structurally invalid. No agent can fabricate this file's contents
// because it is produced by actually running the commands.
//
// Zero dependencies, zero network — same discipline as oracles/* and gate-l2.mjs.
//
// THE PAWL (v1.5). This script also owns the ratchet's comparison and its history. The attempt
// loop used to be a BUDGETED RETRY LOOP wearing a ratchet's shape: `computeVerdict` returned four
// booleans, N fixture outcomes collapsed through a single AND, and an attempt that moved 2-of-5
// fixtures to 4-of-5 was recorded identically to one that moved 2-of-5 to 0-of-5 — `red`. With no
// scalar there was nothing to compare, so `better()` could not exist, so nothing was ever kept or
// reverted on the strength of having improved. Three additions close that, and all three reduce
// over data this script ALREADY wrote to disk:
//
//   • `score()`  — the comparable outcome vector (§2.1). No new measurement is taken.
//   • `better()` — strict lexicographic comparison; a tie is NOT better, because a tie that counts
//                  as an improvement makes a sawtooth look like a ratchet.
//   • `trials.jsonl` — one append-only row per T0 run, with `baseline_trial` as the parent link.
//                  That single field is the experiment DAG (lineage + SUPERSEDES) with no graph
//                  store, and it is what `compile-order` reads back as `inspect()`'s history.
//
// The consequence that matters: an attempt that moves 2/5 → 4/5 fixtures is RED BUT BETTER, and is
// therefore KEPT. The ratchet retains improvements, not just greens — which is what lets attempt
// N+1 build on attempt N instead of restarting from unexplained code.
//
// Usage:
//   node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" verify t0 <scope-contract.json> \
//        --round N --attempt M [--cwd <dir>] [--out <dir>] [--seesaw-registry <path>] [--no-seesaw]
//        [--no-ratchet]
//
// Exit code: 0 = overall green, 1 = overall red (mirrors the oracle convention), 2 = bad argv.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { digest } from "../probe/digest.mjs";
import { runArgs } from "../lib/argv.mjs";
import { snapshot, restore, keptRef } from "./ratchet-tree.mjs";
import { readContract, SCOPE_CONTRACT } from "../lib/contract.mjs";
import { runIdFromRoot } from "../lib/paths.mjs";

/**
 * Run one shell command and capture its outcome (10-minute timeout).
 * @param {string} cmd - The command line to run in a shell.
 * @param {string} cwd - Working directory to run it in.
 * @returns {{cmd:string, exit:number, pass:boolean, stdout:string, stderr:string}} The command,
 *   its exit code (1 when null), whether it exited 0, and captured output.
 */
function runCommand(cmd, cwd) {
  const r = spawnSync(cmd, { shell: true, cwd, encoding: "utf8", timeout: 10 * 60 * 1000 });
  const stdout = r.stdout || "";
  const stderr = r.stderr || "";
  // A spawn failure or a timeout is NOT the same fact as "the command ran and failed", and the
  // ratchet grades it differently (`crash` → restore, never `reverted`). Keeping it costs a field.
  const error = r.error ? String(r.error.message || r.error) : null;
  return { cmd, exit: r.status ?? 1, pass: r.status === 0, stdout, stderr, ...(error ? { error } : {}) };
}

/**
 * Run every e2e fixture command for a scope.
 * @param {string[]} fixtures - Fixture command lines (null/empty → no commands).
 * @param {string} cwd - Working directory.
 * @returns {{pass:boolean, results:Array<{cmd:string,exit:number,pass:boolean,stdout:string,
 *   stderr:string}>}} pass=true iff every fixture passed, plus each command's result.
 */
export function runFixtures(fixtures, cwd) {
  const results = (fixtures || []).map((cmd) => runCommand(cmd, cwd));
  return { pass: results.every((r) => r.pass), results };
}

/**
 * Run the scope's DB probe, if one is declared.
 * @param {(string|null|undefined)} dbProbeCmd - The probe command, or falsy when none applies.
 * @param {string} cwd - Working directory.
 * @returns {({cmd:string,exit:number,pass:boolean,stdout:string,stderr:string}|null)} The command
 *   result, or null when no probe is declared (null never counts as a failure).
 */
export function runDbProbe(dbProbeCmd, cwd) {
  if (!dbProbeCmd) return null;
  return runCommand(dbProbeCmd, cwd);
}

/**
 * Re-run every FINISHED scope's fixtures from the seesaw registry (regression guard).
 * @param {(string|null)} registryPath - Path to the seesaw registry JSON (absent/unreadable → skipped).
 * @param {string} cwd - Working directory.
 * @returns {{ran:boolean, pass:boolean, scopes_checked:string[], failing:string[], error?:string}}
 *   ran=false/pass=true when skipped; otherwise pass=true iff no prior scope regressed, with the
 *   scope ids checked and those now failing.
 */
export function seesawCheck(registryPath, cwd) {
  if (!registryPath || !existsSync(registryPath)) {
    return { ran: false, pass: true, scopes_checked: [], failing: [] };
  }
  let registry;
  try {
    registry = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch {
    return { ran: false, pass: true, scopes_checked: [], failing: [], error: "registry unparsable" };
  }
  const scopes = registry.scopes || [];
  const failing = [];
  for (const s of scopes) {
    const { pass } = runFixtures(s.fixtures, cwd);
    if (!pass) failing.push(s.scope_id);
  }
  return { ran: true, pass: failing.length === 0, scopes_checked: scopes.map((s) => s.scope_id), failing };
}

/**
 * Combine fixtures + DB probe + seesaw into the overall T0 verdict.
 * @param {{fixtures:{pass:boolean}, dbProbe:({pass:boolean}|null),
 *   seesaw:{ran:boolean,pass:boolean}}} parts - The three sub-results.
 * @returns {{fixtures_green:boolean, db_probe_green:boolean, seesaw_green:boolean,
 *   overall:("green"|"red"), regression:boolean}} Per-arm greens, the overall verdict (green iff
 *   all three), and `regression` = fixtures+db green but seesaw red (the rollback-and-retry case).
 */
export function computeVerdict({ fixtures, dbProbe, seesaw }) {
  const fixturesGreen = fixtures.pass;
  const dbGreen = dbProbe === null || dbProbe.pass;
  const seesawGreen = !seesaw.ran || seesaw.pass;
  return {
    fixtures_green: fixturesGreen,
    db_probe_green: dbGreen,
    seesaw_green: seesawGreen,
    overall: fixturesGreen && dbGreen && seesawGreen ? "green" : "red",
    // A regression is specifically fixtures/db green but seesaw red — the case that should
    // trigger rollback+retry (spec §3.5) rather than "go fix the new scope's own bug".
    regression: fixturesGreen && dbGreen && !seesawGreen,
  };
}

/**
 * The comparable T0 outcome — a VECTOR, not a float, because the three arms are not fungible.
 *
 * Every number here is a reduce over data `writeArtifact` already persists (`fixtures:
 * [{cmd, exit, pass}]`). Nothing new is measured; a number that has always been on disk is
 * finally counted.
 *
 * @param {{fixtures:{results:Array<{pass:boolean}>}, dbProbe:({pass:boolean}|null),
 *   seesaw:{ran:boolean, failing:string[]}}} parts - The three T0 sub-results.
 * @returns {{regressions:number, fixtures_passed:number, fixtures_total:number,
 *   db_probe:(0|1|null)}} The score vector. `db_probe` is null when no probe is declared, which
 *   is never a failure — only an absence.
 */
export function score({ fixtures, dbProbe, seesaw }) {
  return {
    regressions: seesaw?.ran ? (seesaw.failing || []).length : 0,
    fixtures_passed: fixtures.results.filter((r) => r.pass).length,
    fixtures_total: fixtures.results.length,
    db_probe: dbProbe === null || dbProbe === undefined ? null : (dbProbe.pass ? 1 : 0),
  };
}

/**
 * The pawl. Lexicographic and STRICT.
 *
 * Three decisions worth defending:
 *   • A TIE IS NOT BETTER. A tie that counted as an improvement would make a sawtooth look like a
 *     ratchet, and the whole point of the Day-1 measurement is to tell those two apart.
 *   • REGRESSIONS DOMINATE. Breaking a previously-finished scope is never an improvement, whatever
 *     the new scope's fixtures did. This is what lets the old seesaw branch collapse into the
 *     general rule rather than needing a special case.
 *   • DIFFERENT `fixtures_total` IS INCOMPARABLE, not worse. A re-slice changes the
 *     denominator; comparing across it is a category error, so the ratchet treats it as a baseline
 *     reset (`rebased`) rather than issuing a false verdict.
 *
 * @param {{regressions:number, fixtures_passed:number, fixtures_total:number,
 *   db_probe:(0|1|null)}} next - The candidate score.
 * @param {({regressions:number, fixtures_passed:number, fixtures_total:number,
 *   db_probe:(0|1|null)}|null)} current - The incumbent score, or null for the first trial.
 * @returns {(boolean|null)} true = strictly better · false = not better · null = incomparable.
 */
export function better(next, current) {
  if (current === null || current === undefined) return true; // baseline
  if (next.fixtures_total !== current.fixtures_total) return null; // the contract changed
  if (next.regressions !== current.regressions) return next.regressions < current.regressions;
  if (next.fixtures_passed !== current.fixtures_passed) return next.fixtures_passed > current.fixtures_passed;
  if (next.db_probe !== current.db_probe) return (next.db_probe ?? 0) > (current.db_probe ?? 0);
  return false;
}

/**
 * The one rule that replaces the protocol's two red branches.
 *
 * | better(next, current) | action                          | status     |
 * |-----------------------|---------------------------------|------------|
 * | true                  | keep tree · current = next      | `kept`     |
 * | false                 | restore last kept snapshot      | `reverted` |
 * | null                  | keep tree · reset the baseline  | `rebased`  |
 * | a command crashed     | restore last kept snapshot      | `crash`    |
 *
 * @param {(boolean|null)} verdict - The result of {@link better}.
 * @param {boolean} crashed - True when any command failed to spawn or timed out.
 * @returns {{status:("kept"|"reverted"|"rebased"|"crash"), action:("keep"|"restore")}} The status
 *   recorded on the trial row and the tree operation to perform.
 */
export function decideStatus(verdict, crashed) {
  if (crashed) return { status: "crash", action: "restore" };
  if (verdict === null) return { status: "rebased", action: "keep" };
  return verdict ? { status: "kept", action: "keep" } : { status: "reverted", action: "restore" };
}

/**
 * Human-readable one-line summary of a score change, for the trial row's `delta` field.
 * @param {object} next - The candidate score.
 * @param {(object|null)} current - The incumbent score, or null.
 * @returns {string} e.g. "+2 fixtures", "+1 regression", "baseline", "no change".
 */
export function describeDelta(next, current) {
  if (!current) return "baseline";
  if (next.fixtures_total !== current.fixtures_total) {
    return `denominator ${current.fixtures_total} → ${next.fixtures_total}`;
  }
  const parts = [];
  const dr = next.regressions - current.regressions;
  const df = next.fixtures_passed - current.fixtures_passed;
  const dp = (next.db_probe ?? 0) - (current.db_probe ?? 0);
  if (dr) parts.push(`${dr > 0 ? "+" : ""}${dr} regression${Math.abs(dr) === 1 ? "" : "s"}`);
  if (df) parts.push(`${df > 0 ? "+" : ""}${df} fixture${Math.abs(df) === 1 ? "" : "s"}`);
  if (dp) parts.push(`${dp > 0 ? "+" : ""}${dp} db_probe`);
  return parts.length ? parts.join(", ") : "no change";
}

/**
 * Read the append-only trial ledger.
 * @param {string} path - Path to `t0/trials.jsonl`.
 * @returns {Array<object>} One entry per parseable row, in write order; [] when the file is absent
 *   (the non-regression path — every caller falls back to today's behaviour).
 */
export function readTrials(path) {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

/**
 * Append one row to the trial ledger.
 *
 * WRITER RULE. `t0-verify` writes this, not `ingest-result`. The single-writer invariant governs
 * WORKER-DERIVED shared state — board, ledger, verdict — because a worker's claims must pass
 * through one applier. A trial row is a MECHANICAL FACT produced by running commands, in exactly
 * the same class as the verdict artifact this script already owns; routing it through an envelope
 * that carries no worker claim would buy nothing.
 *
 * @param {string} path - Path to `t0/trials.jsonl`.
 * @param {object} row - The row to append.
 * @returns {boolean} True when the row was written. Best-effort: a ledger that can break a build
 *   would get the ratchet disabled, which costs more than the row is worth.
 */
export function appendTrial(path, row) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(row) + "\n");
    return true;
  } catch { return false; }
}

/**
 * The next retry ordinal for a (round, attempt) pair, read from the verdicts directory.
 *
 * The legacy unsuffixed `r<R>-a<A>.json` written before v1.5 is treated as `t0`, so old artifacts
 * on disk stay readable and can never be collided with.
 *
 * @param {string} dir - The `t0/verdicts` directory.
 * @param {number} round - Round number.
 * @param {number} attempt - Attempt number.
 * @returns {number} The lowest unused ordinal ≥ 1.
 */
export function nextTrialNo(dir, round, attempt) {
  let max = 0;
  let entries;
  try { entries = readdirSync(dir); } catch { return 1; }
  const re = new RegExp(`^r${round}-a${attempt}-t(\\d+)\\.json$`);
  for (const f of entries) {
    const m = f.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/**
 * Distill every failing command's output into AEGIS {file,line,core_message} triples.
 * @param {{fixtures:{results:Array<{pass:boolean,stdout:string,stderr:string}>},
 *   dbProbe:({pass:boolean,stdout:string,stderr:string}|null)}} parts - The T0 sub-results.
 * @returns {Array<{file:(string|null), line:(number|null), core_message:string, kind:string}>}
 *   Deduped triples across all failing logs; [] when nothing failed.
 */
export function digestFailures({ fixtures, dbProbe }) {
  const failingLogs = [];
  for (const r of fixtures.results) if (!r.pass) failingLogs.push(r.stdout + "\n" + r.stderr);
  if (dbProbe && !dbProbe.pass) failingLogs.push(dbProbe.stdout + "\n" + dbProbe.stderr);
  return failingLogs.flatMap((log) => digest(log));
}

/**
 * @param {string} text - Bytes to hash.
 * @returns {string} The lowercase hex SHA-256 digest of `text`.
 */
function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Write the T0 verdict artifact spec-evaluator (T1) must cite — IMMUTABLY (invariant I4:
 * every superseded object remains addressable).
 *
 * WHAT THIS REPLACED, and why the remedy is `wx` rather than a guard. The address used to be
 * `r<round>-a<attempt>.json`, written with a bare `writeFileSync` — and on a seesaw regression the
 * protocol says stash, then RETRY THIS ATTEMPT, same attempt number. The address had no term for
 * the retry, so the artifact recording the regression was silently replaced by the one recording
 * the recovery, at the same path. Reproduced against the shipped script: two runs at
 * `--round 1 --attempt 2`, one red and one green, left ONE file — the red verdict was gone. This
 * is the same missing-identity-key defect logged elsewhere in this codebase, recurring on the one
 * artifact the evaluator is structurally required to cite.
 *
 * An `existsSync` guard would be check-then-write: still racy, and still a policy expressed in code
 * rather than a property of the store. `flag: "wx"` makes overwriting IMPOSSIBLE — the filesystem
 * refuses with EEXIST and the loop moves to the next ordinal. Same class of move as `lib/is-main.mjs`:
 * replace a fragile comparison with one that cannot silently be wrong.
 *
 * The evaluator's citation contract is unaffected: it re-hashes whatever path it is handed, and
 * `T0Citation` carries `path` + `sha256`, never a filename pattern.
 *
 * @param {string} outDir - Base output dir; the file lands at
 *   `<outDir>/t0/verdicts/r<round>-a<attempt>-t<trial>.json`.
 * @param {number} round - Round number.
 * @param {number} attempt - Attempt number within the round.
 * @param {object} verdictBody - Verdict fields to persist (scope_id, per-arm results, score,
 *   discovered_tasks…).
 * @returns {{path:string, sha256:string, trial:number}} The artifact path, the sha-256 of its exact
 *   bytes (the citation the evaluator's report must include), and the retry ordinal used.
 *   Side effect: writes the JSON file, never over an existing one.
 */
export function writeArtifact(outDir, round, attempt, verdictBody) {
  const dir = join(outDir, "t0", "verdicts");
  mkdirSync(dir, { recursive: true });
  for (let trial = nextTrialNo(dir, round, attempt); ; trial++) {
    const path = join(dir, `r${round}-a${attempt}-t${trial}.json`);
    const body = {
      schema_version: 2, round, attempt, trial,
      at: new Date().toISOString(), ...verdictBody,
    };
    const text = JSON.stringify(body, null, 2);
    try {
      writeFileSync(path, text, { flag: "wx" }); // EEXIST, never clobber
      return { path, sha256: sha256(text), trial };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
}

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs verify t0 <scope-contract.json> --round N --attempt M [--cwd <dir>] [--out <dir>] " +
         "[--seesaw-registry <path>] [--no-seesaw] [--no-ratchet]",
  _: { arity: 1, max: 1, name: "scope-contract.json" },
  round: { type: "int", min: 1, required: true },
  attempt: { type: "int", min: 1, required: true },
  cwd: { type: "path" },
  out: { type: "path" },
  "seesaw-registry": { type: "path" },
  "no-seesaw": { type: "flag" },
  "no-ratchet": { type: "flag" },
};

/**
 * Run the T0 evidence layer for one attempt and write the verdict artifact the judge cites.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const contractPath = args._[0];
  // Markdown first, legacy JSON second (ADR-0001, lib/contract-md.mjs).
  const found = readContract(contractPath, SCOPE_CONTRACT);
  if (!found) { console.error(`t0-verify: no scope contract at ${contractPath} (.md or .json)`); process.exit(2); }
  const contract = found.contract;
  const cwd = args.cwd || process.cwd();
  const outDir = args.out || dirname(dirname(contractPath)); // default: <slug>/ (parent of scopes/)
  const round = args.round;
  const attempt = args.attempt;

  const fixtures = runFixtures(contract.e2e_verification_fixtures, cwd);
  const dbProbe = runDbProbe(contract.db_probe, cwd);
  // --seesaw-registry is expected explicitly (tech-lead always passes it, delegation.md 3c);
  // standalone CLI use without it simply skips the seesaw check rather than guessing a path.
  const seesawRegistry = args.noSeesaw ? null : args.seesawRegistry || null;
  const seesaw = args.noSeesaw || fixtures.pass === false
    ? { ran: false, pass: true, scopes_checked: [], failing: [] } // don't seesaw on an already-red attempt
    : seesawCheck(seesawRegistry, cwd);

  const verdict = computeVerdict({ fixtures, dbProbe, seesaw });
  const discovered = verdict.overall === "red" ? digestFailures({ fixtures, dbProbe }) : [];

  // ---- the ratchet ---------------------------------------------------------------------
  // `current` is the incumbent: the score of the most recent trial whose TREE is the one on disk
  // (`kept` or `rebased`). A `reverted` or `crash` trial's tree was thrown away, so its score is
  // history, never the thing to beat.
  const trialsPath = join(outDir, "t0", "trials.jsonl");
  const priorTrials = readTrials(trialsPath).filter((t) => t.scope_id === contract.scope_id);
  const baseline = [...priorTrials].reverse().find((t) => t.status === "kept" || t.status === "rebased") || null;
  const s = score({ fixtures, dbProbe, seesaw });
  const verdictBetter = better(s, baseline ? baseline.score : null);
  const crashed = fixtures.results.some((r) => r.error) || !!dbProbe?.error;
  const { status, action } = decideStatus(verdictBetter, crashed);

  // The run key, read from the receipt that lives in the run root this script was pointed at.
  // `--out` IS that root, so identity comes from the receipt rather than from parsing a slug back
  // out of a directory name; a caller that points `--out` somewhere else simply gets no key.
  const runId = runIdFromRoot(outDir);

  const { path, sha256: hash, trial } = writeArtifact(outDir, round, attempt, {
    ...(runId ? { run_id: runId } : {}),
    scope_id: contract.scope_id,
    fixtures: fixtures.results.map(({ cmd, exit, pass }) => ({ cmd, exit, pass })),
    db_probe: dbProbe && { cmd: dbProbe.cmd, exit: dbProbe.exit, pass: dbProbe.pass },
    seesaw,
    ...verdict,
    score: s,
    discovered_tasks: discovered,
  });

  // The tree operation. `--no-ratchet` leaves the working tree exactly as the attempt left it —
  // the pre-v1.5 behaviour, kept for standalone CLI use and for any caller managing its own tree.
  let tree = { ok: false, reason: "--no-ratchet" };
  if (!args.noRatchet) {
    tree = action === "keep" ? snapshot(contract.scope_id, cwd) : restore(contract.scope_id, cwd);
    // First trial with nothing to restore to: there is no kept tree yet BY DEFINITION. Take one,
    // so trial 2 has a floor to fall back to instead of inheriting the "no revert at all" defect.
    if (action === "restore" && !tree.ok) tree = { ...snapshot(contract.scope_id, cwd), fell_back_to: "snapshot" };
  }

  // `baseline_trial` is the parent link — the experiment DAG (lineage, PARENT_OF and a genuine
  // SUPERSEDES edge) delivered as one field, with no graph store behind it.
  const trialNo = readTrials(trialsPath).length + 1;
  const row = {
    schema_version: 1,
    trial: trialNo,
    ...(runId ? { run_id: runId } : {}),
    round, attempt,
    scope_id: contract.scope_id,
    at: new Date().toISOString(),
    artifact: path.startsWith(outDir) ? path.slice(outDir.length).replace(/^[/\\]/, "") : path,
    sha256: hash,
    score: s,
    status,
    baseline_trial: baseline ? baseline.trial : null,
    delta: describeDelta(s, baseline ? baseline.score : null),
    tree_ref: tree.ok ? tree.ref : null,
    digest: discovered.slice(0, 8),
  };
  appendTrial(trialsPath, row);

  console.log(JSON.stringify({
    path, sha256: hash, trial, overall: verdict.overall, regression: verdict.regression,
    score: s, status, baseline_trial: row.baseline_trial, delta: row.delta,
    tree_ref: row.tree_ref ?? keptRef(contract.scope_id),
  }, null, 2));
  process.exit(verdict.overall === "green" ? 0 : 1);
}

