#!/usr/bin/env node
// harness init run — open a run, or refuse.
//
// WHAT IT IS FOR. Whether a run has started has to be a fact on disk, written at t=0, because the
// other evidence (artifacts that appear later) cannot tell a run that never started from one that
// described itself and stopped. Opening a run writes four things and stages nothing in the project:
//
//   receipt.json    this run started, with THIS intake, at THIS time, under THIS plugin copy; carries
//                   the run id every later record (orders, trials, hook decisions) is keyed by
//   run-args.json   the launch record: the models, budgets and answer set the run was opened with
//   intake.md       the intake verbatim, so "the spec was dropped on the hand-off" is checkable
//   active-scope    the pointer every hook reads to answer "is a run in flight?"
//
// It also refuses, before anything is written: a model below the floor for the roles that write code
// and grade it, and a plugin copy whose worker roster does not resolve. And it records GATE L0 — the
// intake conversation is that decision, and opening the run is the act that ledgers it.
//
// USAGE
//   harness.mjs init run --slug <slug> --intake-file <path> [options]
//
//   --auto-level interactive|auto|unattended   (default interactive)
//   --max-rounds N        outer breaker, rounds of build + evaluate     (default 3)
//   --attempts N          inner breaker, T0 attempts per scope          (default 5)
//   --spec-folder <dir>   where the committed spec lives                (default shapeup/<slug>/spec/)
//   --gate-answers <preset|path>   the answer set the gates resolve from
//   --exec-model/--eval-model/--qa-model <m>   role -> model (flag, then SHAPEUP_<ROLE>_MODEL, then sonnet)
//   --no-eval --no-qa --parallel-scopes N
//   --force               re-open over a run that is already open
//
// Exit 0 opened · 2 usage error · 3 refused (a run is already open, or the roster is missing).
// A run already open keeps its record: the refusal prints what is on disk and does not overwrite it.

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { discover, resolve as resolveGate, appendGateLedger, PRESETS } from "../gate.mjs";
import { runArgs } from "../lib/argv.mjs";
import { mintRunId } from "../lib/paths.mjs";
import { launchProblems, floorProblems, AUTO_LEVELS } from "../lib/floor.mjs";
import {
  localRoot, activeScope, activeOrder, globLocal, globShared, ordersDir, resultsDir, runArgsPath,
} from "../lib/paths.mjs";
import { resolveWorkers } from "../verify/skills.mjs";

export const RECEIPT_VERSION = 1;

/** The model a role runs on when neither a flag nor its environment knob names one. */
export const DEFAULT_MODEL = "sonnet";

/** Slugify a free-text feature name into a filesystem-safe run id. */
export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "run";
}

export function digest(text) {
  return createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

/**
 * Build the receipt. Pure: resolved inputs in, the object that gets written out.
 *
 * The run id is derived, not drawn (`mintRunId`): a pure function of slug, start time and intake
 * digest, so any writer holding the receipt recomputes the same id without being handed it.
 *
 * @param {object} o - Resolved inputs.
 * @returns {object} The receipt.
 */
export function buildReceipt({ slug, intake, config, startedAt, plugin = null, intakeSource = null }) {
  const intakeText = String(intake ?? "");
  const intakeSha256 = digest(intakeText);
  return {
    receipt_version: RECEIPT_VERSION,
    type: "harness-run-receipt",
    slug,
    run_id: mintRunId({ slug, startedAt, intakeSha256 }),
    started_at: startedAt,
    intake_sha256: intakeSha256,
    intake_chars: intakeText.length,
    intake_lines: intakeText ? intakeText.split("\n").length : 0,
    intake_source: intakeSource,
    started: true,
    // Which copy of the plugin produced this run. A run whose trace cannot name its own plugin cannot
    // be cleared of the wrong-version failure the roster check exists to catch.
    plugin: plugin ? { name: plugin.name, version: plugin.version, root: plugin.root } : null,
    config,
  };
}

/** Drop `undefined` leaves, one level deep, so the record never carries a literal `undefined`. */
function pruned(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = pruned(v);
      if (Object.keys(inner).length) out[k] = inner;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * Resolve the role -> model matrix: the flag, else the role's environment knob, else `sonnet`; `qa`
 * follows `exec` when nothing names it. `eval` is left unset under `--no-eval`.
 *
 * @param {object} a - Parsed argv.
 * @param {object} [env=process.env] - Environment, injectable for a test.
 * @returns {{exec: string, eval?: string, qa: string}} The matrix.
 */
export function resolveModels(a, env = process.env) {
  const pick = (flag, knob) => (flag ?? env[knob] ?? "").trim() || undefined;
  const exec = pick(a.execModel, "SHAPEUP_EXEC_MODEL") ?? DEFAULT_MODEL;
  const evalModel = a.noEval ? pick(a.evalModel, "SHAPEUP_EVAL_MODEL") : (pick(a.evalModel, "SHAPEUP_EVAL_MODEL") ?? DEFAULT_MODEL);
  const qa = pick(a.qaModel, "SHAPEUP_QA_MODEL") ?? exec;
  return pruned({ exec, eval: evalModel, qa });
}

/**
 * Build the launch record. Pure, so a test asserts its shape without a filesystem. The receipt's
 * config and the record come from the same parsed argv, so the two cannot disagree about the dials.
 *
 * @param {object} o - Resolved inputs.
 * @returns {object} The record, pruned of unset optionals.
 */
export function buildLaunchRecord({
  slug, runId, autoLevel, answers, models, maxRounds, attemptBudget, pluginRoot, startedAt,
  noEval, noQa, maxParallelScopes,
}) {
  return pruned({
    slug, runId, autoLevel, answers,
    models, budgets: { maxRounds, attemptBudget },
    pluginRoot, startedAt,
    noEval: noEval || undefined, noQa: noQa || undefined,
    maxParallelScopes,
  });
}

/**
 * Unwedge `--force`: resolve every order left LIVE by a run nobody is continuing.
 *
 * The substrate fence treats any order with no same-named result as live and constrains every later
 * write to what it permits, so re-opening over a dispatch nobody answered would keep the stale fence.
 * For each such order this writes a plainly self-labelled marker under `results/` (never a lie in a
 * schema-valid shape), and keeps the order file: `orders/` is the audit trail of what was dispatched.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - The run being forced over.
 * @returns {string[]} Order ids resolved as abandoned.
 */
export function resolveAbandonedOrders(cwd, slug) {
  const oDir = ordersDir(cwd, slug);
  const rDir = resultsDir(cwd, slug);
  if (!existsSync(oDir)) return [];
  const done = new Set(existsSync(rDir) ? readdirSync(rDir) : []);
  const resolvedAt = new Date().toISOString();
  const resolved = [];
  for (const f of readdirSync(oDir)) {
    if (!f.endsWith(".json") || done.has(f)) continue;
    mkdirSync(rDir, { recursive: true });
    const marker = {
      synthetic: true,
      status: "abandoned", // deliberately outside the WorkResult status enum: nobody answered
      order_id: f.slice(0, -".json".length),
      reason: "dispatched, never answered — resolved by `harness init run --force`",
      resolved_at: resolvedAt,
    };
    writeFileSync(join(rDir, f), JSON.stringify(marker, null, 2) + "\n", "utf8");
    resolved.push(marker.order_id);
  }
  return resolved;
}

/** A path relative to the project root, `/`-joined on every platform. */
const repoRel = (cwd, p) => relative(cwd, p).split(sep).join("/");

/** The typed argv contract (see `../lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: 'harness.mjs init run (--intake-file <path> | --intake-text "<req>" | --intake-stdin) ' +
         "[--slug <slug>] [--auto-level interactive|auto|unattended] " +
         "[--max-rounds N] [--attempts N] [--spec-folder <dir>] [--gate-answers <preset|path>] " +
         "[--exec-model <m>] [--eval-model <m>] [--qa-model <m>] [--no-eval] [--no-qa] " +
         "[--parallel-scopes N] [--cwd <dir>] [--plugin-root <dir>] [--force]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  "intake-text": { type: "str" },
  "intake-file": { type: "str" }, // "-" is a legitimate value here (stdin), so not type "path"
  "intake-stdin": { type: "flag" },
  slug: { type: "str" },
  "auto-level": { type: "str" },
  "max-rounds": { type: "int", min: 1 },
  attempts: { type: "int", min: 1 },
  "spec-folder": { type: "path" },
  "gate-answers": { type: "str" },
  "exec-model": { type: "str" },
  "eval-model": { type: "str" },
  "qa-model": { type: "str" },
  "no-eval": { type: "flag" },
  "no-qa": { type: "flag" },
  "parallel-scopes": { type: "int", min: 1 },
  // Which copy of the plugin this run is opened against. Nameable because a machine can carry several
  // installs, and because the roster refusal is otherwise unreachable for a test.
  "plugin-root": { type: "path" },
  force: { type: "flag" },
};

function fail(code, msg) {
  console.error(msg);
  process.exit(code);
}

/**
 * Open a run: mint the receipt, or refuse when one is already live.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments.
 * @returns {void} Calls `process.exit()` with the documented code on every refusal.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = args.cwd || process.cwd();

  // THE MODEL FLOOR, before anything is written and before the already-open refusal.
  const models = resolveModels(args);
  const belowFloor = floorProblems(models, { noEval: Boolean(args.noEval) });
  if (belowFloor.length) {
    fail(2, [
      `✋ init-run: ${belowFloor.join("; ")}.`,
      "",
      "The roles that write code (exec) and grade it (eval) run on sonnet or above; a cheaper tier is",
      "refused here, before a run is opened. Name a model with --exec-model / --eval-model, or set",
      "SHAPEUP_EXEC_MODEL / SHAPEUP_EVAL_MODEL. `qa` is not checked, and `eval` is not under --no-eval.",
    ].join("\n"));
  }

  // GATE L0 — the worker roster, before any spend. It says the files exist at this root at this
  // version; whether the SESSION resolves that copy is answered by the first dispatch's receipt.
  const plugin = resolveWorkers(args.pluginRoot ? resolve(args.pluginRoot) : undefined);
  if (plugin.missing.length) {
    fail(3, [
      `✋ init-run: refusing to open a run — ${plugin.missing.length} of ${plugin.workers.length} workers are missing.`,
      "",
      `  plugin: ${plugin.name ?? "unknown"} ${plugin.version ?? "unknown version"}`,
      `  root:   ${plugin.root}`,
      `  missing: ${plugin.missing.join(", ")}`,
      "",
      "A run against this copy would dispatch workers that cannot resolve, and a failed dispatch is",
      "answered by the sub-agent improvising the craft itself. Load the working copy",
      "(`claude --plugin-dir <repo>`) or install and enable the plugin, then retry.",
    ].join("\n"));
  }

  let intake = args.intakeText ?? null;
  const intakeFile = args.intakeFile ?? null;
  if (args.intakeStdin || intakeFile === "-") {
    try { intake = readFileSync(0, "utf8"); } catch { fail(2, "--intake-stdin: nothing on stdin"); }
  } else if (intakeFile) {
    const p = intakeFile.startsWith("/") ? intakeFile : join(cwd, intakeFile);
    if (!existsSync(p)) fail(2, `--intake-file not found: ${p}`);
    intake = readFileSync(p, "utf8");
  }
  if (!intake || !intake.trim()) {
    fail(2, [
      "✋ init-run: no intake. Pass --intake-file <path> or --intake-text \"<the requirement>\".",
      "",
      "A run opened over no requirement would plan nothing and read like a success.",
    ].join("\n"));
  }

  const slug = (args.slug ?? null) || slugify(intake.split("\n").find((l) => l.trim()) || "run");
  const auto_level = args.autoLevel ?? "interactive";
  if (!AUTO_LEVELS.includes(auto_level)) fail(2, `--auto-level must be one of: ${AUTO_LEVELS.join(", ")}`);
  const intakeSource = args.intakeStdin || intakeFile === "-" ? "stdin" : intakeFile ? repoRel(cwd, resolve(cwd, intakeFile)) : "text";

  const config = {
    auto_level,
    max_rounds: args.maxRounds ?? 3,
    attempt_budget: args.attempts ?? 5,
    spec_folder: args.specFolder ?? `${globShared(slug, "spec")}/`,
    gate_answers: args.gateAnswers ?? null,
  };

  const runRoot = localRoot(cwd, slug);
  const receiptPath = join(runRoot, "receipt.json");

  // A RUN IS ALREADY OPEN: the refusal does the resume work, printing what is on disk. Re-opening
  // would discard the round history the circuit breaker counts against.
  if (existsSync(receiptPath) && !args.force) {
    let kept = null;
    try { kept = JSON.parse(readFileSync(runArgsPath(cwd, slug), "utf8")); } catch { /* no record on disk */ }
    fail(3, [
      `✋ init-run: a run is ALREADY OPEN — receipt exists at ${receiptPath}.`,
      "",
      "Do NOT re-initialise and do NOT restart from phase 1. The orders, results, gate ledger and board",
      "under the run root already hold the run's real state; resume from the phase they report.",
      "",
      kept
        ? `LAUNCH RECORD (kept — the switches typed to this call were NOT applied; --force re-opens with new ones):\n${JSON.stringify(kept, null, 2)}`
        : "No launch record is on disk for this run — re-open it with --force to write one.",
      "",
      "To abandon the open run and start over, deliberately: --force",
    ].join("\n"));
  }

  // The real unwedge path: resolve every dispatched-but-unanswered order BEFORE the fresh run writes,
  // and retire the pointer the abandoned run left, so the fence stops constraining writes to it.
  if (args.force) {
    const abandoned = resolveAbandonedOrders(cwd, slug);
    if (abandoned.length) {
      console.error(`⚠ init-run --force: resolved ${abandoned.length} dispatched-but-unanswered order(s) as abandoned — ${abandoned.join(", ")}`);
    }
    rmSync(activeOrder(cwd), { force: true });
  }

  const startedAt = new Date().toISOString();
  const receipt = buildReceipt({ slug, intake, config, startedAt, plugin, intakeSource });
  const launch = buildLaunchRecord({
    slug, runId: receipt.run_id, autoLevel: auto_level, answers: config.gate_answers ?? undefined, models,
    maxRounds: config.max_rounds, attemptBudget: config.attempt_budget,
    pluginRoot: plugin.root, startedAt,
    noEval: args.noEval, noQa: args.noQa, maxParallelScopes: args.parallelScopes ?? undefined,
  });
  const unlaunchable = launchProblems(launch);
  if (unlaunchable.length) fail(2, `✋ init-run: the launch record is not launchable — ${unlaunchable.join("; ")}`);

  for (const d of ["", "orders", "results", "discovery"]) mkdirSync(join(runRoot, d), { recursive: true });
  writeFileSync(join(runRoot, "intake.md"), intake.endsWith("\n") ? intake : intake + "\n", "utf8");
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  // The launch record, in the same act as the receipt and from the same parsed argv.
  writeFileSync(runArgsPath(cwd, slug), JSON.stringify(launch, null, 2) + "\n", "utf8");

  const pointer = activeScope(cwd);
  mkdirSync(dirname(pointer), { recursive: true });
  writeFileSync(pointer, JSON.stringify({ slug, started_at: startedAt }, null, 2) + "\n", "utf8");

  // GATE L0 has a deterministic call site: the run's opening. The intake conversation is the L0
  // decision; opening the run records it, with the answer set the run was configured with. Best
  // effort: a row that cannot be written must not fail the opening.
  try {
    const ga = config.gate_answers ?? null;
    const presetName = ga && PRESETS[ga] ? ga : null;
    const found = discover({ cwd, slug, preset: presetName, file: ga && !presetName ? ga : null });
    const r = found.error
      ? { status: "ok", decision: "proceed", source: "intake (no answer set on disk)", note: "the intake conversation is the L0 decision" }
      : resolveGate(found.set, "L0", found.source);
    appendGateLedger(cwd, slug, {
      at: startedAt, run_id: receipt.run_id, gate: "L0", status: r.status, decision: r.decision ?? null,
      source: r.source ?? found.source, note: `${r.note ?? r.reason ?? ""} — run opened: intake recorded, receipt written`.replace(/^ — /, ""),
      round: null,
    });
  } catch { /* the ledger row is a record of the opening, never a condition of it */ }

  console.log(JSON.stringify({
    ok: true,
    slug,
    run_id: receipt.run_id,
    run_root: globLocal(slug),
    receipt: globLocal(slug, "receipt.json"),
    intake_sha256: receipt.intake_sha256,
    intake_chars: receipt.intake_chars,
    config,
    launch_record: globLocal(slug, "run-args.json"),
    launch,
    next: "GATE L0 — confirm the run config with the PO, then orient.",
  }, null, 2));
}
