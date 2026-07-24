#!/usr/bin/env node
// T0 mechanical verification layer (design spec v1.1 §3.5, Blueprint A/E).
//
// Runs a scope's e2e fixtures + DB probe (zero LLM tokens), then — on green — the seesaw
// regression check (re-runs every FINISHED scope's fixtures from the registry). Writes one
// verdict artifact per attempt that spec-evaluator (T1) must cite; a verdict without it is
// structurally invalid (PA4 countermeasure, DD-7). No agent can fabricate this file's contents
// because it is produced by actually running the commands.
//
// Zero dependencies, zero network — same discipline as scripts/oracles/* and gate-l2.mjs.
//
// Usage:
//   node skills/tech-lead/scripts/t0-verify.mjs <scope-contract.json> --round N --attempt M
//        [--cwd <dir>] [--out <dir>] [--seesaw-registry <path>] [--no-seesaw]
//
// Exit code: 0 = overall green, 1 = overall red (mirrors the oracle convention).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { digest } from "./aegis-digest.mjs";

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
  return { cmd, exit: r.status ?? 1, pass: r.status === 0, stdout, stderr };
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
 * Write the T0 verdict artifact spec-evaluator (T1) must cite.
 * @param {string} outDir - Base output dir; the file lands at `<outDir>/t0/verdicts/r<round>-a<attempt>.json`.
 * @param {number} round - Round number.
 * @param {number} attempt - Attempt number within the round.
 * @param {object} verdictBody - Verdict fields to persist (scope_id, per-arm results, discovered_tasks…).
 * @returns {{path:string, sha256:string}} The artifact path and the sha-256 of its exact bytes —
 *   the citation the evaluator's report must include. Side effect: writes the JSON file.
 */
export function writeArtifact(outDir, round, attempt, verdictBody) {
  const dir = join(outDir, "t0", "verdicts");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `r${round}-a${attempt}.json`);
  const body = { schema_version: 1, round, attempt, at: new Date().toISOString(), ...verdictBody };
  const text = JSON.stringify(body, null, 2);
  writeFileSync(path, text);
  return { path, sha256: sha256(text) };
}

/**
 * Parse the t0-verify CLI argv.
 * @param {string[]} argv - Arguments after `node t0-verify.mjs`.
 * @returns {{_:string[], round?:number, attempt?:number, cwd?:string, out?:string,
 *   seesawRegistry?:string, noSeesaw?:boolean}} Flag values, with positional args under `_`.
 */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--round") out.round = Number(argv[++i]);
    else if (a === "--attempt") out.attempt = Number(argv[++i]);
    else if (a === "--cwd") out.cwd = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--seesaw-registry") out.seesawRegistry = argv[++i];
    else if (a === "--no-seesaw") out.noSeesaw = true;
    else out._.push(a);
  }
  return out;
}

/**
 * CLI entry: run a scope's fixtures + probe + seesaw, write the verdict artifact, print it, and
 * exit 0 (green) / 1 (red) / 2 (usage).
 * @returns {Promise<void>} Resolves after writing the artifact; the process exit code carries the verdict.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contractPath = args._[0];
  if (!contractPath) {
    console.error("Usage: t0-verify.mjs <scope-contract.json> --round N --attempt M [--cwd dir] [--out dir]");
    process.exit(2);
  }
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  const cwd = args.cwd || process.cwd();
  const outDir = args.out || dirname(dirname(contractPath)); // default: <slug>/ (parent of scopes/)
  const round = args.round ?? 1;
  const attempt = args.attempt ?? 1;

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

  const { path, sha256: hash } = writeArtifact(outDir, round, attempt, {
    scope_id: contract.scope_id,
    fixtures: fixtures.results.map(({ cmd, exit, pass }) => ({ cmd, exit, pass })),
    db_probe: dbProbe && { cmd: dbProbe.cmd, exit: dbProbe.exit, pass: dbProbe.pass },
    seesaw,
    ...verdict,
    discovered_tasks: discovered,
  });

  console.log(JSON.stringify({ path, sha256: hash, overall: verdict.overall, regression: verdict.regression }, null, 2));
  process.exit(verdict.overall === "green" ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
