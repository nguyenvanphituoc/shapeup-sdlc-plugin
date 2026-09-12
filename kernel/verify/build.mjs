#!/usr/bin/env node
// The round build gate — does the FEATURE build and launch, before the judge is asked about it.
//
// WHY A GATE ABOVE T0. A T0 verdict is one scope's fixtures, run inside that scope's substrate, and
// the fixtures are the scope-architect's to write. Nothing in that layer proves the feature as a
// whole compiles or starts. Measured on a live mobile run: every one of 30 T0 trials went green on
// its first try — the fixtures were TypeScript stand-ins, structural greps and a test-suite wrapper
// that never compiled its sources — while the ledger's own `run_cmd` failed, and once the compiler
// could actually reach the new files it reported 58 errors. Three rounds of EVAL then graded a
// blank screen: nothing in the loop had ever installed or launched the app. The hill shards, derived
// from those T0 verdicts, all read DOWNHILL_EXECUTION.
//
// Two lessons, and this gate is both:
//
//   1. A green exit code from the build is not proof the feature compiled. Some toolchains compile
//      only what is reachable from an entry point, so a scope's files can sit outside the compiled
//      set and the build stays green. The exit code is the necessary half; `build_probe` is where a
//      project asserts the other half (the artifact covers what the run wrote), in whatever way its
//      toolchain makes possible.
//   2. Nothing else in the loop launches the app. `launch_probe` is where a project installs, starts
//      and asserts a first screen. For the mobile archetype its absence is called out every round,
//      because "on-device install unverified" was an L0 risk with no owner for three rounds.
//
// WHAT RUNS, in order, each stopping the rest on failure: the ledger's `run_cmd` (the build),
// then the profile's `build_probe`, then its `launch_probe`. All three are commands the tech lead
// pinned at GATE L0 — this script invents none of them, and a run that declares none of them gets
// exit 3 and no artifact, which every reader treats as "no gate declared" rather than as green.
//
// THE RED GATE IS THE NEXT ROUND'S BUG LIST. `harness compile` reads the latest gate artifact for
// the previous round and addresses each failing step to the scopes whose substrate contains the
// files the output names (unowned → every scope, marked), exactly as it does for an EVAL verdict.
// `reduce hill` reads the same artifact: a T0-green verdict from a round whose gate is red moves no
// scope downhill. Both are the same file, written once here — zero LLM tokens, same as T0.
//
// Usage:
//   node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" verify build --slug <slug> --round N [--cwd <dir>]
//
// Exit code: 0 = green, 1 = red, 2 = bad argv, 3 = nothing declared (no run_cmd, no probes).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { runArgs, isMain } from "../lib/argv.mjs";
import { harnessRun, projectProfile, roundBuildDir, localRoot, runIdFromRoot } from "../lib/paths.mjs";
import { readContract, readAllContracts, PROJECT_PROFILE, SCOPE_CONTRACT, splitFrontmatter } from "../lib/contract.mjs";
import { scopesDir } from "../lib/paths.mjs";
import { digest } from "../probe/digest.mjs";

/** The three steps, in the order they run. */
export const STEPS = ["run_cmd", "build_probe", "launch_probe"];

/** Archetypes whose product cannot be judged without being launched on a device or simulator. */
export const LAUNCH_REQUIRED_ARCHETYPES = new Set(["mobile"]);

const TAIL_BYTES = 8 * 1024;
const tail = (s) => (s || "").length > TAIL_BYTES ? (s || "").slice(-TAIL_BYTES) : (s || "");

/**
 * The commands this gate runs for a feature, read from the artifacts that declare them.
 *
 * `run_cmd` comes from the run ledger's frontmatter (`harness-run.md`, written at GATE L0 and
 * already what every EVAL order carries); the two probes come from the committed project profile.
 * Nothing is inferred: an absent field is an absent step.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{archetype:(string|null), steps:Array<{kind:string, cmd:string}>, warnings:string[]}}
 *   The declared steps in run order, the profile's archetype, and the warnings a reader should
 *   see — currently one: a launch-required archetype with no `launch_probe`.
 */
export function declaredSteps(cwd, slug) {
  const warnings = [];
  let runCmd = null;
  try {
    const hr = splitFrontmatter(readFileSync(harnessRun(cwd, slug), "utf8")).meta || {};
    runCmd = typeof hr.run_cmd === "string" && hr.run_cmd.trim() ? hr.run_cmd.trim() : null;
  } catch { /* no ledger — no run_cmd */ }

  let profile = null;
  const pp = projectProfile(cwd, slug);
  if (existsSync(pp)) profile = readContract(pp, PROJECT_PROFILE)?.contract || null;
  const archetype = typeof profile?.archetype === "string" ? profile.archetype : null;
  const pick = (k) => (typeof profile?.[k] === "string" && profile[k].trim() ? profile[k].trim() : null);

  const steps = [];
  if (runCmd) { steps.push({ kind: "run_cmd", cmd: runCmd }); warnings.push(...fixtureCoverageWarnings(cwd, slug, runCmd)); }
  else warnings.push("the run ledger declares no run_cmd — the build itself is not part of this gate");
  const buildProbe = pick("build_probe");
  if (buildProbe) steps.push({ kind: "build_probe", cmd: buildProbe });
  const launchProbe = pick("launch_probe");
  if (launchProbe) steps.push({ kind: "launch_probe", cmd: launchProbe });
  else if (archetype && LAUNCH_REQUIRED_ARCHETYPES.has(archetype)) {
    warnings.push(`archetype ${archetype} declares no launch_probe in project-profile.md — nothing in the loop ` +
      `launches the app, so a blank first screen survives every round. Give the install/launch risk an owner: ` +
      `a command that installs the built artifact, starts it, asserts the first screen and fails on fatal logs.`);
  }
  return { archetype, steps, warnings };
}

/**
 * The executable a run command actually invokes — its basename, past any `cd …&&`, `env`, or
 * `VAR=value` prefix. `cd app && DEVECO_SDK_HOME=/x /tools/hvigor/bin/hvigorw assembleHap` → `hvigorw`.
 * @param {string} runCmd - The ledger's run command.
 * @returns {(string|null)} The tool's basename, or null when none can be read.
 */
export function buildTool(runCmd) {
  const segments = String(runCmd || "").split(/&&|;|\|\|/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const tokens = seg.split(/\s+/).filter((t) => t && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t) && t !== "env" && t !== "cd");
    if (seg.startsWith("cd ")) continue;
    if (!tokens.length) continue;
    const base = tokens[0].split(/[\\/]/).pop();
    if (base) return base;
  }
  return null;
}

/**
 * Scopes whose fixtures never invoke the build tool `run_cmd` names — ADVISORY.
 *
 * A T0 layer can be entirely green on a feature that does not compile when every fixture is a
 * grep or a stand-in compiler (measured: 13 of 15 fixtures on one run). The harness cannot know
 * what a project's fixtures should run, but it can see when none of a scope's fixture commands
 * mention the tool the ledger builds with, and say so beside the gate's verdict. A warning, not a
 * failure: a library scope with no compiled surface is a legitimate reason for the mismatch.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {(string|null)} runCmd - The ledger's run command.
 * @returns {string[]} One warning per scope whose fixtures name the tool nowhere.
 */
export function fixtureCoverageWarnings(cwd, slug, runCmd) {
  const tool = buildTool(runCmd);
  if (!tool) return [];
  const out = [];
  let contracts = [];
  try { contracts = readAllContracts(scopesDir(cwd, slug), SCOPE_CONTRACT).map((x) => x.contract); } catch { return []; }
  for (const c of contracts) {
    const fixtures = Array.isArray(c.e2e_verification_fixtures) ? c.e2e_verification_fixtures : [];
    if (!fixtures.length || fixtures.some((f) => String(f).includes(tool))) continue;
    out.push(`scope ${c.scope_id}: none of its ${fixtures.length} fixture(s) invoke ${tool} (the ledger's build tool) — ` +
      `its T0 green is not evidence the scope compiles; only this gate's run_cmd is.`);
  }
  return out;
}

/**
 * Run one gate command and capture its outcome (10-minute timeout), output tails kept for the digest.
 * @param {{kind:string, cmd:string}} step - The step to run.
 * @param {string} cwd - Working directory.
 * @returns {object} `{kind, cmd, exit, pass, stdout_tail, stderr_tail, error?}`.
 */
export function runStep(step, cwd) {
  const r = spawnSync(step.cmd, { shell: true, cwd, encoding: "utf8", timeout: 10 * 60 * 1000 });
  const error = r.error ? String(r.error.message || r.error) : null;
  return {
    kind: step.kind, cmd: step.cmd,
    exit: r.status ?? 1, pass: r.status === 0,
    stdout_tail: tail(r.stdout), stderr_tail: tail(r.stderr),
    ...(error ? { error } : {}),
  };
}

/**
 * Run the declared steps in order, stopping at the first failure — a probe over a build that did
 * not complete answers nothing, and would only bury the real error under a second one.
 *
 * @param {Array<{kind:string, cmd:string}>} steps - From {@link declaredSteps}.
 * @param {string} cwd - Working directory.
 * @returns {{overall:("green"|"red"), steps:Array<object>}} Every declared step, the ones not
 *   reached marked `skipped: true`.
 */
export function runGate(steps, cwd) {
  const out = [];
  let failed = false;
  for (const step of steps) {
    if (failed) { out.push({ kind: step.kind, cmd: step.cmd, skipped: true }); continue; }
    const r = runStep(step, cwd);
    out.push(r);
    if (!r.pass) failed = true;
  }
  return { overall: failed ? "red" : "green", steps: out };
}

/**
 * Every gate artifact for a round, oldest first.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {number} round - Round number.
 * @returns {Array<{path:string, trial:number, body:object}>} Parsed artifacts; unreadable ones skipped.
 */
export function roundBuildArtifacts(cwd, slug, round) {
  const dir = roundBuildDir(cwd, slug);
  let files;
  try { files = readdirSync(dir); } catch { return []; }
  const out = [];
  for (const f of files) {
    const m = f.match(/^r(\d+)-t(\d+)\.json$/);
    if (!m || Number(m[1]) !== Number(round)) continue;
    try { out.push({ path: join(dir, f), trial: Number(m[2]), body: JSON.parse(readFileSync(join(dir, f), "utf8")) }); }
    catch { /* skip */ }
  }
  return out.sort((a, b) => a.trial - b.trial);
}

/**
 * The gate's latest word on a round — the artifact readers branch on.
 *
 * Latest, because the gate may run again after a hand fix between launches, and the run must act on
 * the current state of the build, not the first one recorded. Every earlier artifact stays on disk.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {number} round - Round number.
 * @returns {(object|null)} The latest artifact body, or null when the gate never ran for this round.
 */
export function latestRoundBuild(cwd, slug, round) {
  const all = roundBuildArtifacts(cwd, slug, round);
  return all.length ? all[all.length - 1].body : null;
}

/**
 * The rounds whose latest gate artifact is red — the set `reduce hill` subtracts from.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {Set<number>} Round numbers; empty when the gate never ran (non-regression: every
 *   T0 verdict then counts exactly as it did before the gate existed).
 */
export function redBuildRounds(cwd, slug) {
  const latest = new Map();
  let files;
  try { files = readdirSync(roundBuildDir(cwd, slug)); } catch { return new Set(); }
  for (const f of files) {
    const m = f.match(/^r(\d+)-t(\d+)\.json$/);
    if (!m) continue;
    const round = Number(m[1]), trial = Number(m[2]);
    if (!latest.has(round) || latest.get(round).trial < trial) latest.set(round, { trial, file: f });
  }
  const red = new Set();
  for (const [round, { file }] of latest) {
    try {
      if (JSON.parse(readFileSync(join(roundBuildDir(cwd, slug), file), "utf8")).overall === "red") red.add(round);
    } catch { /* unreadable → not proven red */ }
  }
  return red;
}

/**
 * Write the gate artifact immutably (`wx`, next ordinal on collision — the T0 convention).
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {number} round - Round number.
 * @param {object} body - Artifact fields.
 * @returns {{path:string, sha256:string, trial:number}} Where it landed and its digest.
 */
export function writeRoundBuild(cwd, slug, round, body) {
  const dir = roundBuildDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  const existing = roundBuildArtifacts(cwd, slug, round);
  for (let trial = (existing.length ? existing[existing.length - 1].trial : 0) + 1; ; trial++) {
    const path = join(dir, `r${round}-t${trial}.json`);
    const text = JSON.stringify({ schema_version: 1, round, trial, at: new Date().toISOString(), ...body }, null, 2);
    try {
      writeFileSync(path, text, { flag: "wx" });
      return { path, sha256: createHash("sha256").update(text).digest("hex"), trial };
    } catch (e) { if (e.code !== "EEXIST") throw e; }
  }
}

export const ARGV_SPEC = {
  usage: "harness.mjs verify build --slug <slug> --round <N> [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  round: { type: "int", min: 1, required: true },
  cwd: { type: "path" },
};

/**
 * Run the round build gate and write its artifact.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {Promise<void>} Exits 0 green, 1 red, 3 nothing declared, 2 bad argv.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const { slug, round } = args;
  const { archetype, steps, warnings } = declaredSteps(cwd, slug);
  for (const w of warnings) console.error(`build-gate: ${w}`);

  if (steps.length === 0) {
    console.log(JSON.stringify({ round, overall: "skipped", steps: [], warnings,
      reason: "nothing declared — no run_cmd in the run ledger, no build_probe or launch_probe in project-profile.md" }, null, 2));
    process.exit(3);
  }

  const gate = runGate(steps, cwd);
  const failing = gate.steps.filter((s) => !s.skipped && !s.pass);
  const discovered = failing.flatMap((s) => digest(`${s.stdout_tail}\n${s.stderr_tail}`));
  const runId = runIdFromRoot(localRoot(cwd, slug));
  const { path, sha256, trial } = writeRoundBuild(cwd, slug, round, {
    ...(runId ? { run_id: runId } : {}),
    archetype,
    overall: gate.overall,
    steps: gate.steps,
    warnings,
    discovered_tasks: discovered.slice(0, 16),
  });

  console.log(JSON.stringify({
    path, sha256, trial, round, overall: gate.overall, warnings,
    steps: gate.steps.map((s) => (s.skipped ? { kind: s.kind, skipped: true } : { kind: s.kind, exit: s.exit, pass: s.pass })),
    ...(failing.length ? { failed_step: failing[0].kind, stderr_tail: failing[0].stderr_tail.slice(-1200) } : {}),
  }, null, 2));
  process.exit(gate.overall === "green" ? 0 : 1);
}

if (isMain(import.meta.url)) cli(process.argv.slice(2));
