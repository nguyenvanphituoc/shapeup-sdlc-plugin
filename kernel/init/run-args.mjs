#!/usr/bin/env node
// GATE L0.9b — THE LAUNCH RECORD, GIVEN A WRITER.
//
// WHY THIS EXISTS. `domain.schema.json`'s `RunArgs` entry calls `.shapeup/<slug>/run-args.json`
// "the only artifact that records what a run was configured with" and names tech-lead as the
// writer — but "tech-lead" meant a paragraph of prose telling the orchestrating session to
// assemble a JSON object by hand and `Write` it. Outside a structural-test fixture, nothing ever
// did: no kernel module wrote the file, so `probe concurrency`'s `dialFrom()` read a fan-out dial
// that was never recorded and reported the effective default every time, indistinguishable from a
// run that genuinely chose it. A registry entry is not an instruction, and an instruction with no
// enforcer is how a documented record becomes a file that simply never exists.
//
// THE FIX. This is the single writer. It takes the resolved GATE L0 values as flags, builds the
// exact `RunArgs` object the schema describes, writes it to `.shapeup/<slug>/run-args.json`, and
// prints that SAME object on stdout — so tech-lead passes the printed value straight to
// `Workflow({args: ...})` rather than re-typing it a second time. One construction, not two: the
// file on disk and the value the workflow actually launches with can no longer disagree.
//
// `wallClockS` is NOT one of this command's flags and never lands in the object it writes.
// `--wall-clock-budget` is consumed earlier, by `harness init run` (see `RECEIPT_VERSION` and
// `config.wall_clock_budget_s` in `./run.mjs`) — the deadline breaker reads that receipt field
// directly and was never going to see this launch's `RunArgs` at all. Naming a third field here
// that nothing reads is the exact defect this command exists to close, not one to reintroduce.
//
// USAGE
//   node `harness init run-args` --slug <slug> --auto-level interactive|auto|unattended \
//        --exec-model <name> [--eval-model <name>] [--qa-model <name>] \
//        --max-rounds N --attempts N --plugin-root <dir> \
//        [--run-id <id>] [--answers <preset|path>] [--lane full|tiny] \
//        [--no-eval] [--no-qa] [--adversarial-verify] [--parallel-scopes N] [--cwd <dir>]
//
// `--eval-model` is required unless `--no-eval` is set — an EVAL-skipping run never resolves one.
// `--run-id`, given no explicit value, is read off the run's own receipt (the run must already be
// open — see `harness init run`), never invented.
//
// Prints the written `RunArgs` object as JSON on stdout. Exit 0 on success, 2 on a usage error,
// 3 when no run is open at `--slug` (the receipt is what makes this artifact meaningful at all).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runArgs } from "../lib/argv.mjs";
import { localRoot, RECEIPT_FILE, runArgsPath, runIdFromReceipt } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The plugin root, resolved from where this file actually is (`kernel/init/` → repo root). */
export const PLUGIN_ROOT = resolve(HERE, "../..");

/**
 * The `autoLevel` enum, read from the schema that defines it — never hand-typed here.
 *
 * `domain.schema.json`'s `$defs/RunArgs.properties.autoLevel.enum` is the one place this set is
 * declared. A `new Set([...])` beside it, inside the very module written to close run-argument
 * contract drift (see this file's own banner), would be that drift repeating one level down —
 * the same class of failure this module exists to close, applied here to an *enum's values*
 * instead of RunArgs *field* names. Mirrors `kernel/verify/skills.mjs`'s `roster()`, which
 * derives `WorkerName` the same way.
 *
 * @param {string} [root=PLUGIN_ROOT] - Plugin root the schema is read from — overridable so a test
 *   can point this at a scratch copy of the schema and prove the result grows and shrinks with it,
 *   never with an edit to this function.
 * @returns {string[]} The enum, in schema order.
 * @throws {Error} When the schema is missing or does not carry the enum.
 */
export function autoLevels(root = PLUGIN_ROOT) {
  const schemaPath = join(root, "kernel/schemas/domain.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const levels = schema?.$defs?.RunArgs?.properties?.autoLevel?.enum;
  if (!Array.isArray(levels) || !levels.length) {
    throw new Error(`${schemaPath} carries no $defs/RunArgs.properties.autoLevel.enum — the auto-level set cannot be derived`);
  }
  return levels;
}

/** The typed argv contract (see `../lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: `harness.mjs init run-args --slug <slug> --auto-level ${autoLevels().join("|")} ` +
         '--exec-model <name> [--eval-model <name>] [--qa-model <name>] --max-rounds N --attempts N ' +
         '--plugin-root <dir> [--run-id <id>] [--answers <preset|path>] [--lane full|tiny] ' +
         '[--no-eval] [--no-qa] [--adversarial-verify] [--parallel-scopes N] [--cwd <dir>]',
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  slug: { type: "str", required: true },
  "run-id": { type: "str" },
  "auto-level": { type: "str", required: true },
  answers: { type: "str" },
  lane: { type: "str" },
  "exec-model": { type: "str", required: true },
  "eval-model": { type: "str" },
  "qa-model": { type: "str" },
  "max-rounds": { type: "int", min: 1, required: true },
  attempts: { type: "int", min: 1, required: true },
  "plugin-root": { type: "path", required: true },
  "no-eval": { type: "flag" },
  "no-qa": { type: "flag" },
  "adversarial-verify": { type: "flag" },
  "parallel-scopes": { type: "int", min: 1 },
};

function fail(code, msg) {
  console.error(msg);
  process.exit(code);
}

/**
 * Drop `undefined`-valued keys, one level deep on the named nested objects — so the JSON this
 * writes never carries a literal `"eval": undefined` for a skipped role or an unset switch.
 *
 * @param {object} o - The candidate RunArgs object.
 * @returns {object} The same shape with every `undefined` leaf and empty nested object removed.
 */
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
 * Build the `RunArgs` object — pure, so the structural suite can assert its shape without a
 * filesystem. Mirrors `domain.schema.json` `$defs/RunArgs` exactly: this is the one place that
 * shape is constructed, so a field this function does not carry cannot reach the file either.
 *
 * @param {object} o - Resolved inputs (destructured); optional fields may be `undefined`.
 * @returns {object} The RunArgs object, pruned of unset optionals.
 */
export function buildRunArgs({
  slug, runId, autoLevel, answers, lane, execModel, evalModel, qaModel,
  maxRounds, attemptBudget, pluginRoot, startedAt,
  noEval, noQa, adversarialVerify, maxParallelScopes,
}) {
  return pruned({
    slug, runId, autoLevel, answers, lane,
    models: { exec: execModel, eval: evalModel, qa: qaModel },
    budgets: { maxRounds, attemptBudget },
    pluginRoot, startedAt,
    noEval, noQa, adversarialVerify, maxParallelScopes,
  });
}

/**
 * Write `.shapeup/<slug>/run-args.json`, or refuse (exit 3) when no run is open at `--slug`.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; every path
 *   calls `process.exit()` with the subcommand's documented code rather than returning.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = args.cwd || process.cwd();

  if (!autoLevels().includes(args.autoLevel)) {
    fail(2, `--auto-level must be one of: ${autoLevels().join(", ")}`);
  }
  if (!args.noEval && !args.evalModel) {
    fail(2, "--eval-model is required unless --no-eval is set — an EVAL-skipping run never resolves one.");
  }

  const runRoot = localRoot(cwd, args.slug);
  const receiptPath = join(runRoot, RECEIPT_FILE);
  if (!existsSync(receiptPath)) {
    fail(3, [
      `✋ init run-args: no open run at ${runRoot} — run "harness init run" first (GATE L0.1).`,
      "",
      "`run-args.json` records what an OPEN run was launched with; writing one with no receipt",
      "behind it would leave a launch record for a run that, everywhere else in the harness, never",
      "started.",
    ].join("\n"));
  }
  let receipt = null;
  try { receipt = JSON.parse(readFileSync(receiptPath, "utf8")); } catch { /* handled below */ }
  const runId = args.runId ?? runIdFromReceipt(receipt) ?? undefined;

  const runArgsObj = buildRunArgs({
    slug: args.slug,
    runId,
    autoLevel: args.autoLevel,
    answers: args.answers ?? undefined,
    lane: args.lane ?? undefined,
    execModel: args.execModel,
    evalModel: args.evalModel ?? undefined,
    qaModel: args.qaModel ?? undefined,
    maxRounds: args.maxRounds,
    attemptBudget: args.attempts,
    pluginRoot: args.pluginRoot,
    startedAt: new Date().toISOString(),
    noEval: args.noEval || undefined,
    noQa: args.noQa || undefined,
    adversarialVerify: args.adversarialVerify || undefined,
    maxParallelScopes: args.parallelScopes ?? undefined,
  });

  mkdirSync(runRoot, { recursive: true });
  writeFileSync(runArgsPath(cwd, args.slug), JSON.stringify(runArgsObj, null, 2) + "\n", "utf8");

  // Printed, not just written — so the caller's `Workflow({args: ...})` reads this stdout instead
  // of re-assembling the object from the flags it just typed.
  console.log(JSON.stringify(runArgsObj, null, 2));
}
