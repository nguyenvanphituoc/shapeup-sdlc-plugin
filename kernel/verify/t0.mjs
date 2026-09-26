#!/usr/bin/env node
// T0 mechanical verification layer.
//
// Runs a scope's e2e fixtures and its DB probe (zero LLM tokens). Writes one
// verdict artifact per attempt that spec-evaluator (T1) must cite; a verdict without it is
// structurally invalid. No agent can fabricate this file's contents
// because it is produced by actually running the commands.
//
// Zero dependencies, zero network — same discipline as oracles/* and the GATE L2 block.
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
//        --round N --attempt M [--cwd <dir>] [--out <dir>]
//        [--no-ratchet]
//
// Exit code: 0 = overall green, 1 = overall red (mirrors the oracle convention), 2 = bad argv.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename, extname, resolve as resolvePath, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { digest } from "../probe/digest.mjs";
import { environmentFingerprint } from "./env.mjs";
import { runArgs } from "../lib/argv.mjs";
import { snapshot, restore, keptRef } from "./ratchet-tree.mjs";
import { readContract, SCOPE_CONTRACT } from "../lib/contract.mjs";
import { runIdFromRoot, localRoot, SHARED, projectProfile } from "../lib/paths.mjs";

/**
 * The feature slug a scope contract belongs to, from its path.
 *
 * Scope contracts live at `<SHARED>/<slug>/scopes/<id>.md`, so the slug is the segment two levels
 * above the file. Derived rather than flagged because every caller already names the contract, and
 * a second way to say the same thing is a second thing to get wrong.
 *
 * @param {string} contractPath - Path to the scope contract, absolute or relative.
 * @returns {string} The slug, or "" when the path does not have the expected shape — in which case
 *   the caller's `--out` is the only sensible answer and its absence is a usage error.
 */
export function slugFromContractPath(contractPath) {
  const parts = String(contractPath).split(/[/\\]/);
  const i = parts.lastIndexOf("scopes");
  return i > 0 ? parts[i - 1] : "";
}

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
 * How much of each stream the persisted record keeps, per command.
 *
 * A bound rather than the whole stream, because one chatty fixture would otherwise make every
 * reader of the run trace pay for it — and a bound at the END rather than the start, because that
 * is where a stack trace, an assertion diff and a test summary all land.
 */
export const EVIDENCE_TAIL_CHARS = 4000;

/**
 * The last `limit` characters of a stream, marked when anything was dropped.
 *
 * THE MARKER IS NOT DECORATION. A truncated tail that does not say so is a partial stream that
 * reads as a complete one, which is the same class of defect as the one this whole change fixes:
 * a record that overstates what it actually holds.
 *
 * @param {(string|null|undefined)} text - The captured stream.
 * @param {number} [limit] - Characters to keep.
 * @returns {(string|null)} The kept tail, or null when the stream was empty (the field is then
 *   omitted rather than stored as "", so "nothing was printed" stays visibly different from
 *   "nothing was kept").
 */
export function boundedTail(text, limit = EVIDENCE_TAIL_CHARS) {
  const s = String(text ?? "");
  if (!s) return null;
  if (s.length <= limit) return s;
  return `[truncated: kept the last ${limit} of ${s.length} characters]\n${s.slice(-limit)}`;
}

/**
 * One command's outcome as the verdict artifact stores it — the evidence, not just the score.
 *
 * WHAT THIS FIXES. The artifact used to keep `{cmd, exit, pass}`, and `runCommand` maps a command
 * that never started onto `exit: 1` — the same number a genuine failure returns. So a refused or
 * timed-out command and a broken build were the SAME RECORD everywhere downstream: the digest, the
 * hill, the report, the evaluator's citation and anyone reading the trace back afterwards. The
 * kernel computed the difference (`error`, which the ratchet grades as `crash`) and discarded it
 * one line later.
 *
 * `exit` is deliberately left as it is. Mapping a crash to some other number would change what the
 * ratchet compares and what every existing reader parses; the distinction travels in `error`, which
 * is the field that actually means "this never ran", and which the crash branch already reads.
 *
 * Output is kept for PASSING commands too, and that direction is not an afterthought: a fixture
 * that exits 0 having run zero tests is the false green this evidence layer exists to catch, and
 * its stdout is the only place that shows.
 *
 * @param {({cmd:string, exit:number, pass:boolean, stdout?:string, stderr?:string, error?:string}|null)} r
 *   A `runCommand` result, or null when no command was declared.
 * @returns {(object|null)} The record to persist; null passes through unchanged.
 */
export function commandEvidence(r) {
  if (!r) return null;
  const stdout = boundedTail(r.stdout);
  const stderr = boundedTail(r.stderr);
  return {
    cmd: r.cmd, exit: r.exit, pass: r.pass,
    ...(r.error ? { error: r.error } : {}),
    ...(stdout ? { stdout_tail: stdout } : {}),
    ...(stderr ? { stderr_tail: stderr } : {}),
  };
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
  // AN ABSENCE IS NOT A PASS, and this is the whole "measured, not claimed" invariant in one line.
  //
  // `[].every(...)` is `true`, so a scope whose contract declared no fixtures — or whose fixtures
  // failed to PARSE, which is how it actually happened — scored `pass: true` and the verdict came
  // back `overall: "green"`. Measured directly:
  //
  //     runFixtures(undefined)  ->  pass=true, results=0
  //     computeVerdict(…)       ->  {"overall":"green"}
  //
  // Nothing ran, and the scope was certified. That is not a weaker version of the guarantee, it is
  // the inverse of it: the one layer the evaluator is required to cite, green on zero evidence. The
  // same reasoning the decision ledger states one directory over — "an absence proves nothing and
  // must not sharpen the message".
  //
  // `ran` is reported rather than folded into `pass` so the two facts stay distinguishable: a scope
  // with nothing to run is a contract that is not finished, which is different from a scope whose
  // fixtures ran and failed, and the ratchet should be able to tell them apart.
  return { pass: results.length > 0 && results.every((r) => r.pass), ran: results.length > 0, results };
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
 * Combine the fixtures and the DB probe into the overall T0 verdict.
 *
 * THE SEESAW ARM IS GONE (3.8.0), by a Betting Table decision rather than by neglect. It was
 * declared in the schema, the docs and this function, and nothing ever wrote the registry it read,
 * so it never ran once in any recorded run — while its absence held the hill's top phase shut:
 * FINISHED required `seesaw.ran && seesaw.pass`, and the 38 committed hill shards across the live
 * consumer's features contain no FINISHED at all. A cross-scope regression is still caught by the
 * round build gate, which builds and launches the whole feature once per round; what the arm would
 * have added is attribution and an earlier signal, at the price of re-running every finished
 * scope's fixtures on every attempt — minutes per attempt on an eighteen-scope feature.
 *
 * @param {{fixtures:{pass:boolean}, dbProbe:({pass:boolean}|null)}} parts - The two sub-results.
 * @returns {{fixtures_green:boolean, db_probe_green:boolean, overall:("green"|"red")}} Per-arm
 *   greens and the overall verdict, green iff both.
 */
export function computeVerdict({ fixtures, dbProbe }) {
  const fixturesGreen = fixtures.pass;
  const dbGreen = dbProbe === null || dbProbe.pass;
  return {
    fixtures_green: fixturesGreen,
    db_probe_green: dbGreen,
    overall: fixturesGreen && dbGreen ? "green" : "red",
  };
}

/**
 * The comparable T0 outcome — a VECTOR, not a float, because the arms are not fungible.
 *
 * Every number here is a reduce over data `writeArtifact` already persists (`fixtures:
 * [{cmd, exit, pass}]`). Nothing new is measured; a number that has always been on disk is
 * finally counted.
 *
 * @param {{fixtures:{results:Array<{pass:boolean}>}, dbProbe:({pass:boolean}|null)}} parts - The
 *   two T0 sub-results.
 * @returns {{fixtures_passed:number, fixtures_total:number, db_probe:(0|1|null)}} The score vector.
 *   `db_probe` is null when no probe is declared, which is never a failure — only an absence.
 */
export function score({ fixtures, dbProbe }) {
  return {
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
 *   • DIFFERENT `fixtures_total` IS INCOMPARABLE, not worse. A re-slice changes the
 *     denominator; comparing across it is a category error, so the ratchet treats it as a baseline
 *     reset (`rebased`) rather than issuing a false verdict.
 *
 * @param {{fixtures_passed:number, fixtures_total:number,
 *   db_probe:(0|1|null)}} next - The candidate score.
 * @param {({fixtures_passed:number, fixtures_total:number,
 *   db_probe:(0|1|null)}|null)} current - The incumbent score, or null for the first trial.
 * @returns {(boolean|null)} true = strictly better · false = not better · null = incomparable.
 */
export function better(next, current) {
  if (current === null || current === undefined) return true; // baseline
  if (next.fixtures_total !== current.fixtures_total) return null; // the contract changed
  if (next.fixtures_passed !== current.fixtures_passed) return next.fixtures_passed > current.fixtures_passed;
  if (next.db_probe !== current.db_probe) return (next.db_probe ?? 0) > (current.db_probe ?? 0);
  // EVERY COMPONENT TIES. What that means depends entirely on whether the incumbent was green.
  //
  // On a RED scope a tie is the sawtooth the pawl exists to stop, and it stays `false` — that is the
  // case the rule above was written for and the case the guard fixtures assert (2/5 vs 2/5).
  //
  // On a GREEN scope there is no score left to win. Every further attempt ties BY CONSTRUCTION, so
  // `false` restores the tree every time and the scope can never change again: the pawl stops being
  // a pawl and becomes a weld. That is exactly the state a spec-conformance round is in. EVAL
  // returns FAIL citing bugs T0's fixtures do not test — a bare stack trace, an error message that
  // does not match the catalogue, validation ordered after a load — the next round's workers fix
  // them, T0 scores 1/1 again because its fixtures never tested the prose, and the ratchet throws
  // the fix away.
  //
  // Measured on a live run: round 2 produced six trials, 0 kept, 6 reverted, `bin/todo.js` byte-for-
  // byte unchanged, and all three cited bugs reproducing. The FAIL → fix → re-evaluate loop — the
  // harness's central promise — is inert for precisely the defects EVAL is best at finding.
  //
  // So: a green tie KEEPS. The tree may move when the score cannot, because by then the work being
  // done is work T0 does not measure, and refusing it does not protect the scope — it freezes it.
  if (isGreenScore(next) && isGreenScore(current)) return true;
  return false;
}

/**
 * Is this score a clean pass — every fixture passing, and none of them absent?
 *
 * `fixtures_total > 0` is load-bearing: a scope with no fixtures has nothing to be green ABOUT, and
 * treating its empty score as a pass is the same absence-reads-as-success mistake `runFixtures`
 * made one function above.
 *
 * @param {{fixtures_passed:number, fixtures_total:number}} s - A trial score.
 * @returns {boolean} True when the score represents a real, complete pass.
 */
function isGreenScore(s) {
  return s.fixtures_total > 0 && s.fixtures_passed === s.fixtures_total;
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
 * @returns {string} e.g. "+2 fixtures", "-1 db_probe", "baseline", "no change".
 */
export function describeDelta(next, current) {
  if (!current) return "baseline";
  if (next.fixtures_total !== current.fixtures_total) {
    return `denominator ${current.fixtures_total} → ${next.fixtures_total}`;
  }
  const parts = [];
  const df = next.fixtures_passed - current.fixtures_passed;
  const dp = (next.db_probe ?? 0) - (current.db_probe ?? 0);
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

// --- a check rewritten to pass ----------------------------------------------------------------
//
// A fixture that names Test Surface rows (`PASS TS-02-04`, `FAIL TS-02-04 step 10: …`) reads its
// checks from files the scope itself writes. Measured on a live run: a row FAILed on attempt 1 —
// the check renamed a list and found the old name still on screen — and went green on attempt 2
// because the check had been rewritten to stop renaming, while the code was unchanged. Nothing
// recorded that the evidence had moved. So each verdict records the checks it read, by digest, and
// the named results they printed; a row that failed in this scope's previous trial and passes now,
// whose own check file changed in between, is a REVISED check — a pass the judge must read against
// its row before it can count. Recorded, never refused: rewriting a check that overreached is
// legitimate, and only a person or the judge can tell which it was.

/**
 * The files a fixture's arguments name, with their digests — a named directory contributes its
 * direct children. Paths resolve against the project root and are recorded relative to it.
 *
 * @param {string[]} commands - The fixture command lines.
 * @param {string} cwd - Project root.
 * @returns {Object<string,string>} Relative path → sha256 of its bytes. Empty when no argument names
 *   an existing path.
 */
export function checkFiles(commands, cwd) {
  const out = {};
  /**
   * Record one file's digest under its project-relative path.
   * @param {string} abs - Absolute path of the file.
   * @returns {void} Nothing; an unreadable file is skipped, since it is not evidence.
   */
  const add = (abs) => {
    try { out[relative(cwd, abs)] = createHash("sha256").update(readFileSync(abs)).digest("hex"); } catch { /* unreadable — not evidence */ }
  };
  for (const cmd of commands || []) {
    const tokens = String(cmd).match(/"[^"]*"|'[^']*'|\S+/g) || [];
    for (const raw of tokens.slice(1)) {
      const tok = raw.replace(/^["']|["']$/g, "");
      if (!tok || tok.startsWith("-")) continue;
      const abs = resolvePath(cwd, tok);
      let st; try { st = statSync(abs); } catch { continue; }
      if (st.isFile()) add(abs);
      else if (st.isDirectory()) {
        for (const f of readdirSync(abs).sort()) {
          const child = join(abs, f);
          try { if (statSync(child).isFile()) add(child); } catch { /* skip */ }
        }
      }
    }
  }
  return out;
}

/**
 * The rows a fixture's output names, and how each came out.
 *
 * @param {Array<{stdout?:string}>} results - Fixture results with their full stdout.
 * @returns {Object<string,("PASS"|"FAIL")>} Row id → its result; a FAIL anywhere wins over a PASS.
 */
export function namedResults(results) {
  const out = {};
  for (const r of results || []) {
    for (const line of String(r?.stdout || "").split(/\r?\n/)) {
      const m = line.match(/^(PASS|FAIL)\s+(\S+)/);
      if (!m) continue;
      if (m[1] === "FAIL" || out[m[2]] !== "FAIL") out[m[2]] = m[1];
    }
  }
  return out;
}

/**
 * Rows that failed in the previous trial and pass now while their own check file changed.
 *
 * A row's check is the file whose name, without extension, is the row id — the convention a
 * per-row check follows. A row with no such file is not reported: nothing can be said about it.
 *
 * @param {({check_files?:Object<string,string>, named_results?:Object<string,string>}|null)} prev
 *   The scope's previous verdict in this round, or null.
 * @param {{check_files:Object<string,string>, named_results:Object<string,string>}} curr - This one.
 * @returns {Array<{id:string, file:string}>} One entry per revised check.
 */
export function revisedChecks(prev, curr) {
  if (!prev?.named_results || !prev?.check_files) return [];
  const out = [];
  for (const [id, now] of Object.entries(curr.named_results || {})) {
    if (now !== "PASS" || prev.named_results[id] !== "FAIL") continue;
    const file = Object.keys(curr.check_files || {}).find((f) => basename(f, extname(f)) === id);
    if (!file) continue;
    if (prev.check_files[file] !== curr.check_files[file]) out.push({ id, file });
  }
  return out;
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
 * `r<round>-a<attempt>.json`, written with a bare `writeFileSync` — and on a revert-and-retry the
 * protocol says stash, then RETRY THIS ATTEMPT, same attempt number. The address had no term for
 * the retry, so the artifact recording the regression was silently replaced by the one recording
 * the recovery, at the same path. Reproduced against the shipped script: two runs at
 * `--round 1 --attempt 2`, one red and one green, left ONE file — the red verdict was gone. This
 * is the same missing-identity-key defect logged elsewhere in this codebase, recurring on the one
 * artifact the evaluator is structurally required to cite.
 *
 * An `existsSync` guard would be check-then-write: still racy, and still a policy expressed in code
 * rather than a property of the store. `flag: "wx"` makes overwriting IMPOSSIBLE — the filesystem
 * refuses with EEXIST and the loop moves to the next ordinal. Same class of move as the entry-point guard:
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
         "[--no-ratchet]",
  _: { arity: 1, max: 1, name: "scope-contract.json" },
  round: { type: "int", min: 1, required: true },
  attempt: { type: "int", min: 1, required: true },
  cwd: { type: "path" },
  out: { type: "path" },
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
  // Markdown first, legacy JSON second (ADR-0001, lib/contract.mjs).
  const found = readContract(contractPath, SCOPE_CONTRACT);
  if (!found) { console.error(`t0-verify: no scope contract at ${contractPath} (.md or .json)`); process.exit(2); }
  const contract = found.contract;
  const cwd = args.cwd || process.cwd();
  // WHERE THE VERDICT LANDS, and the one thing about this file that must not be derived from the
  // contract's own location.
  //
  // This used to be `dirname(dirname(contractPath))` — "the parent of scopes/" — which was correct
  // while scope contracts and the run trace shared a root. ADR-0001 split the tiers and moved scope
  // contracts to COMMITTED `shapeup/<slug>/scopes/`, so the default silently followed them: every
  // T0 verdict and trial row was written to `shapeup/<slug>/t0/` while `probe t0` — the ONLY reader,
  // and the one the build round's confirm stage asks — resolves `verdictsDir()` to
  // `.shapeup/<slug>/t0/`. AGENTS.md is unambiguous that T0 artifacts are LOCAL tier.
  //
  // Measured on a live run: six verdicts and six trial rows were written, `foundation` among them
  // with `fixtures_passed: 2/2, status: kept` — a real green — and the round still reported ZERO
  // green scopes, tripped the inner breaker and returned `gate_h`. The evidence existed, was
  // correct, and was invisible to the only thing that reads it. That is the same silent disconnect
  // `hooks/lib/decision.mjs` records in its own header, one directory over.
  //
  // `--out` still wins: `verify t0` is also called with an explicit run root, and that caller knows
  // better than any derivation.
  const outDir = args.out || localRoot(cwd, slugFromContractPath(contractPath));
  const round = args.round;
  const attempt = args.attempt;

  const fixtures = runFixtures(contract.e2e_verification_fixtures, cwd);
  const dbProbe = runDbProbe(contract.db_probe, cwd);
  const verdict = computeVerdict({ fixtures, dbProbe });
  const discovered = verdict.overall === "red" ? digestFailures({ fixtures, dbProbe }) : [];
  const checks = {
    check_files: checkFiles(fixtures.results.map((r) => r.cmd), cwd),
    named_results: namedResults(fixtures.results),
  };

  // ---- the ratchet ---------------------------------------------------------------------
  // `current` is the incumbent: the score of the most recent trial whose TREE is the one on disk
  // (`kept` or `rebased`). A `reverted` or `crash` trial's tree was thrown away, so its score is
  // history, never the thing to beat.
  const trialsPath = join(outDir, "t0", "trials.jsonl");
  const priorTrials = readTrials(trialsPath).filter((t) => t.scope_id === contract.scope_id);
  const baseline = [...priorTrials].reverse().find((t) => t.status === "kept" || t.status === "rebased") || null;
  const s = score({ fixtures, dbProbe });
  const verdictBetter = better(s, baseline ? baseline.score : null);
  const crashed = fixtures.results.some((r) => r.error) || !!dbProbe?.error;
  const { status, action } = decideStatus(verdictBetter, crashed);
  // The scope's previous trial in this round, read back for the checks it recorded.
  const prevTrial = [...priorTrials].reverse().find((tr) => tr.round === round);
  let prevVerdict = null;
  if (prevTrial?.artifact) { try { prevVerdict = JSON.parse(readFileSync(join(outDir, prevTrial.artifact), "utf8")); } catch { /* none */ } }
  const revised = revisedChecks(prevVerdict, checks);

  // The run key, read from the receipt that lives in the run root this script was pointed at.
  // `--out` IS that root, so identity comes from the receipt rather than from parsing a slug back
  // out of a directory name; a caller that points `--out` somewhere else simply gets no key.
  const runId = runIdFromRoot(outDir);

  const { path, sha256: hash, trial } = writeArtifact(outDir, round, attempt, {
    ...(runId ? { run_id: runId } : {}),
    scope_id: contract.scope_id,
    // WHERE IT RAN, beside what it measured. A verdict that records only the tree is portable
    // evidence in appearance only: the same commit built three ways on three machines because the
    // toolchain resolved through a path-keyed cache. This block does not judge — it is what lets a
    // disagreeing re-run be told from a regression (see verify/env.mjs).
    env: environmentFingerprint(cwd, {
      commands: [...fixtures.results.map((r) => r.cmd), ...(dbProbe?.cmd ? [dbProbe.cmd] : [])],
      profilePath: projectProfile(cwd, slugFromContractPath(contractPath)),
    }),
    // The evidence, not just the score — see `commandEvidence` for what the three-field record
    // could not tell apart, and why `exit` still reads the way it always did.
    fixtures: fixtures.results.map((r) => commandEvidence(r)),
    db_probe: commandEvidence(dbProbe),
    ...verdict,
    score: s,
    discovered_tasks: discovered,
    ...(Object.keys(checks.check_files).length ? { check_files: checks.check_files } : {}),
    ...(Object.keys(checks.named_results).length ? { named_results: checks.named_results } : {}),
    ...(revised.length ? { revised_checks: revised } : {}),
  });

  // The tree operation. `--no-ratchet` leaves the working tree exactly as the attempt left it —
  // the pre-v1.5 behaviour, kept for standalone CLI use and for any caller managing its own tree.
  let tree = { ok: false, reason: "--no-ratchet" };
  if (!args.noRatchet) {
    // The revert is bounded by what this scope was allowed to write. Unbounded, it rolls back every
    // other scope building alongside it — see `restore`.
    const own = contract.allowed_file_substrate || [];
    tree = action === "keep" ? snapshot(contract.scope_id, cwd) : restore(contract.scope_id, cwd, own);
    // First trial with nothing to restore to: there is no kept tree yet BY DEFINITION. Take one,
    // so trial 2 has a floor to fall back to instead of inheriting the "no revert at all" defect.
    // Gated on `!baseline` (no prior kept/rebased trial exists at all), NOT on `!tree.ok` alone —
    // a genuine restore failure with a real baseline to have restored to must NOT be silently
    // promoted as the new kept tree; it stays `tree.ok === false` so the trial row records
    // `tree_ref: null` and the failure stays visible instead of quietly becoming the baseline.
    if (action === "restore" && !tree.ok && !baseline) tree = { ...snapshot(contract.scope_id, cwd), fell_back_to: "snapshot" };
  }

  // `baseline_trial` is the parent link — the experiment DAG (lineage, PARENT_OF and a genuine
  // SUPERSEDES edge) delivered as one field, with no graph store behind it.
  //
  // COUNTED WITHIN THE SCOPE, NEVER ACROSS THE FILE. This used to be
  // `readTrials(trialsPath).length + 1` — every row in the run, whoever wrote it — which is a
  // read-modify-write counter over a file that concurrent scopes append to. Scopes build in
  // parallel, so several `verify t0` processes reach this line at once, each reads the same length
  // and each writes the same ordinal: four concurrent scopes produced ordinals [1,1,1,4] and
  // [1,1,3,3]. The ordinal is only ever consumed WITHIN a scope — `baseline` is picked from
  // `priorTrials`, which is already filtered by `scope_id`, and the ratchet report groups by scope
  // before it sorts — so counting the scope's own prior trials is both the race-free answer and the
  // one the readers actually want. Two attempts of the SAME scope cannot race: one worker leg owns
  // a scope and runs its attempts in sequence.
  const trialNo = priorTrials.length + 1;
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
    path, sha256: hash, trial, overall: verdict.overall,
    score: s, status, baseline_trial: row.baseline_trial, delta: row.delta,
    tree_ref: row.tree_ref ?? keptRef(contract.scope_id),
  }, null, 2));
  process.exit(verdict.overall === "green" ? 0 : 1);
}

