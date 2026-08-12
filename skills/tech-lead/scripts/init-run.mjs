#!/usr/bin/env node
// GATE L0.1 — START THE RUN. The orchestrator's first tool call, before any prose.
//
// WHY THIS EXISTS (reproduced, not theorized).
//
// Dispatched with a valid spec, the orchestrator did this:
//
//     TOOL   Skill(tech-lead, "--unattended --rounds 3\n\n# the requirement…")
//     TEXT   "The tech-lead skill is orchestrating the full Shape Up harness. It will: 1. …"
//     FINAL  (same text — session ends)
//
// It loaded an instruction file describing eleven gates and returned a description of eleven
// gates. No code, no board, no gate artifacts — and prose that reads exactly like a successful
// run, with every defect still in the deliverable.
//
// Two guards existed and neither could see it:
//   • `gate-intake.mjs` (L0.0) fires on an EMPTY intake. Intake was valid here. Correct no-op.
//   • `anti-rationalization.mjs` fires when a completion claim contradicts run facts. It is
//     scoped to an ACTIVE run — and a run that never started produces none of the files it
//     reads — and its claim detector matches past-tense completion ("done", "shipped"), while
//     narration is future-tense ("it will"). Two independent misses on the same transcript.
//
// The root cause of BOTH misses is the same: **whether a run had started was not a fact on
// disk.** It was an inference from artifacts that only appear later. So this script exists to
// make starting a run a mechanical event with a receipt, at t=0:
//
//   • It is the orchestrator's FIRST action, stated in the first screen of SKILL.md. Everything
//     emitted before a tool call is narration surface; this shrinks that surface to zero.
//   • It writes `receipt.json` — the fact "this run started, with THIS intake, at THIS time".
//     `gate-zerowork.mjs` (Stop) blocks a session that invoked tech-lead and produced no
//     receipt. Narration now has a detector that does not depend on what the narration says.
//   • It writes `active-scope`, which is the precondition every downstream guard already
//     assumed someone had established. Previously that someone was the model, deciding to.
//     An invariant that depends on the model choosing to establish it is a prompt, not a gate.
//
// It also HASHES the intake into the receipt. The first (wrong) diagnosis of the failure above was
// that requirement text had been dropped on the hand-off. It had not — but nothing on disk could
// settle that either way. Now it can: the intake that reached the orchestrator is recorded
// verbatim next to its digest, so "the spec was dropped" is checkable, not arguable.
//
// USAGE
//   node init-run.mjs --slug <slug> --intake-file <path>            [options]   <- prefer this
//   node init-run.mjs --slug <slug> --intake-text "<requirement>"   [options]
//   cat spec.md | node init-run.mjs --slug <slug> --intake-stdin    [options]
//
// PREFER --intake-file. A multi-line requirement inlined into a shell argument is where this step
// goes wrong: quoting breaks, a `#` after a newline trips path validation, and the run spends six
// turns fighting its own command line instead of starting. Observed, repeatedly.
//
//   --auto-level    interactive | auto | unattended   (default: interactive)
//   --lens          lite | standard | cross-context   (default: standard)
//   --max-rounds N  outer circuit breaker             (default: 3)
//   --attempts N    inner per-scope T0 budget         (default: 5)
//   --spec-folder   SHARED spec deliverable path      (default: shapeup/<slug>/spec/)
//   --gate-answers  path | preset name                (see gate-answers.mjs; recorded, not read)
//   --wall-clock-budget N  deadline breaker, seconds  (off by default; see budget-check.mjs)
//   --cwd           project root                      (default: process.cwd())
//   --force         re-init over an existing run receipt
//
// Prints a JSON receipt on stdout. Exit 0 on success, 2 on a usage error, 3 when a live run
// already exists and --force was not given.
//
// EXIT 3 IS THE RESUME PATH, not a dead end. It prints the file-derived RunSnapshot for the run that
// is already open — slug, status, round, attempt, board counts, pending orders — so the orchestrator
// continues from the phase the files report instead of re-opening the run or restarting the pipeline
// from phase 1. It previously said "Resume it (`--from <slug>`)", and `--from` is a /tech-lead flag
// that takes a phase, not an init-run flag that takes a slug: the one instruction available at the
// one moment it mattered named a mechanism that does not parse.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { decideLane, treeSize } from "./fit-check.mjs";
import { isMain } from "./lib/is-main.mjs";
import { runArgs } from "./lib/argv.mjs";
import { deriveSnapshot } from "./run-snapshot.mjs";
import { localRoot, activeScope, globLocal, globShared } from "./lib/paths.mjs";

export const RECEIPT_VERSION = 1;

const AUTO_LEVELS = new Set(["interactive", "auto", "unattended"]);
const LENSES = new Set(["lite", "standard", "cross-context"]);

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
 * Build the receipt record. Pure — takes resolved inputs, returns the object that gets written.
 * Kept separate from I/O so the structural tests can assert its shape without a filesystem.
 */
export function buildReceipt({ slug, intake, config, startedAt }) {
  const intakeText = String(intake ?? "");
  return {
    receipt_version: RECEIPT_VERSION,
    type: "harness-run-receipt",
    slug,
    started_at: startedAt,
    intake_sha256: digest(intakeText),
    intake_chars: intakeText.length,
    intake_lines: intakeText ? intakeText.split("\n").length : 0,
    // The single fact that separates "the harness ran" from "the harness described itself".
    // Written before any gate, so its ABSENCE at Stop is unambiguous.
    started: true,
    config,
  };
}

/** The `harness-run.md` frontmatter block, per references/ledger-schema.md. */
export function runFrontmatter({ slug, config, startedAt }) {
  return [
    "---",
    "type: harness-run",
    `feature: ${slug}`,
    `spec_folder: ${config.spec_folder}`,
    `lens: ${config.lens}`,
    "eval_dimensions: [spec-conformance]",
    `max_rounds: ${config.max_rounds}`,
    `attempt_budget: ${config.attempt_budget}`,
    `wall_clock_budget_s: ${config.wall_clock_budget_s ?? "~"}`,
    `auto_level: ${config.auto_level}`,
    `gate_answers: ${config.gate_answers ?? "~"}`,
    `lane: ${config.fit?.lane ?? "full"}${config.fit?.overridden_from ? ` (overridden from ${config.fit.overridden_from})` : ""}`,
    "status: orienting",
    "final_verdict: ~",
    "rounds_used: 0",
    "discovered_rounds: 0",
    "deploy: ~",
    `started_at: ${startedAt}`,
    "closed_at: ~",
    "---",
    "",
    `# Harness run — ${slug}`,
    "",
    "Opened by `init-run.mjs` (GATE L0.1). The tech lead is the sole writer from here on.",
    "",
    "## Rounds",
    "",
    "| Phase | Round | Result | Duration | Notes |",
    "|-------|-------|--------|----------|-------|",
    "| Init  | —     | run opened | — | intake recorded, receipt written |",
    "",
    "## Decisions log",
    "",
    "| Gate | Decision | Source | Note |",
    "|------|----------|--------|------|",
    "",
  ].join("\n");
}

// ---- CLI -------------------------------------------------------------------

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: 'init-run.mjs (--intake-file <path> | --intake-text "<req>" | --intake-stdin) ' +
         "[--slug <slug>] [--auto-level interactive|auto|unattended] [--lens <lens>] " +
         "[--max-rounds N] [--attempts N] [--spec-folder <dir>] [--gate-answers <preset|path>] " +
         "[--lane full|tiny] [--tiny] [--wall-clock-budget <seconds>] [--cwd <dir>] [--force]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  "intake-text": { type: "str" },
  "intake-file": { type: "str" }, // "-" is a legitimate value here (stdin), so not type "path"
  "intake-stdin": { type: "flag" },
  slug: { type: "str" },
  "auto-level": { type: "str" },
  lens: { type: "str" },
  "max-rounds": { type: "int", min: 1 },
  attempts: { type: "int", min: 1 },
  "spec-folder": { type: "path" },
  "gate-answers": { type: "str" },
  lane: { type: "str" },
  tiny: { type: "flag" },
  "wall-clock-budget": { type: "int", min: 1 },
  force: { type: "flag" },
};

function fail(code, msg) {
  console.error(msg);
  process.exit(code);
}

export function main() {
  const args = runArgs(ARGV_SPEC);
  const cwd = args.cwd || process.cwd();

  let intake = args.intakeText ?? null;
  const intakeFile = args.intakeFile ?? null;
  // `--intake-file -` is the shape everyone reaches for; accept it rather than erroring on a
  // file literally named "-". (Measured: an agent tried exactly this on its second attempt.)
  if (args.intakeStdin || intakeFile === "-") {
    try { intake = readFileSync(0, "utf8"); } catch { fail(2, "--intake-stdin: nothing on stdin"); }
  } else if (intakeFile) {
    const p = intakeFile.startsWith("/") ? intakeFile : join(cwd, intakeFile);
    if (!existsSync(p)) fail(2, `--intake-file not found: ${p}`);
    intake = readFileSync(p, "utf8");
  }
  if (!intake || !intake.trim()) {
    fail(2, [
      "✋ init-run: no intake. Pass --intake-text \"<the requirement>\" or --intake-file <path>.",
      "",
      "An orchestrator with no spec has nothing to orchestrate — this is the same precondition",
      "GATE L0.0 (hooks/gate-intake.mjs) enforces at dispatch, re-checked here where the run is",
      "actually opened.",
    ].join("\n"));
  }

  const slug = (args.slug ?? null) || slugify(intake.split("\n").find((l) => l.trim()) || "run");

  const auto_level = args.autoLevel ?? "interactive";
  if (!AUTO_LEVELS.has(auto_level)) fail(2, `--auto-level must be one of: ${[...AUTO_LEVELS].join(", ")}`);
  const lens = args.lens ?? "standard";
  if (!LENSES.has(lens)) fail(2, `--lens must be one of: ${[...LENSES].join(", ")}`);

  const config = {
    auto_level,
    lens,
    max_rounds: args.maxRounds ?? 3,
    attempt_budget: args.attempts ?? 5,
    spec_folder: args.specFolder ?? `${globShared(slug, "spec")}/`,
    gate_answers: args.gateAnswers ?? null,
    tiny_lane: !!args.tiny,
    // GATE L0.3 — the lane, computed rather than judged (see fit-check.mjs). Recorded with its
    // evidence so a heavy lane on a small change is visible instead of accidental. An explicit
    // --lane or --tiny is honoured and marked as an override, because a measured recommendation
    // fitted on three features must not outrank a human who knows the codebase.
    fit: (() => {
      const auto = decideLane({ intake, files: treeSize(cwd) });
      const forced = (args.lane ?? null) || (args.tiny ? "tiny" : null);
      return forced && forced !== auto.lane
        ? { ...auto, lane: forced, overridden_from: auto.lane, override_source: args.tiny ? "--tiny" : "--lane" }
        : auto;
    })(),
    // The third breaker (see scripts/budget-check.mjs). Null = off, which is the default and
    // keeps every existing run behaving exactly as before. Set it in any lane with a hard clock
    // — CI, an overnight run — so the harness trips its own breaker and ships what
    // is green, instead of being killed from outside and shipping nothing.
    wall_clock_budget_s: args.wallClockBudget ?? null,
  };

  const runRoot = localRoot(cwd, slug);
  const receiptPath = join(runRoot, "receipt.json");
  // A RUN IS ALREADY OPEN. This is the resume path, and it used to be a dead end.
  //
  // The refusal is right: silently re-initialising would discard the round history the circuit
  // breaker counts against. What was wrong was the instruction it gave — "Resume it (`--from
  // <slug>`)". `--from` is not an init-run flag at all; it is a `/tech-lead` flag, and it takes a
  // PHASE (`--from build`), not a slug. So at the one moment the orchestrator most needs a next
  // step, the runtime named a mechanism that does not exist, on a script whose failure mode was
  // already invisible (see lib/is-main.mjs — under a symlinked install this whole body did not run).
  //
  // Observed consequence on a handoff: a fresh session in a workspace with an open run burns most
  // of its budget before its first write, largely on forensics against this step, and closes none
  // of the gap.
  //
  // So the refusal now DOES the resume work instead of describing it. It emits the derived snapshot
  // — the same file-only derivation `hooks/session-rehydrate.mjs` injects — so the orchestrator gets
  // slug, status, round, attempt, board counts and pending orders in THIS tool call rather than
  // needing to discover that it needs another one. Exit 3 still means "do not proceed as if you
  // opened a run"; it now also means "here is the run you are actually in".
  if (existsSync(receiptPath) && !args.force) {
    let resume = null;
    try { resume = deriveSnapshot(cwd); } catch { /* a broken run must still produce the refusal */ }
    fail(3, [
      `✋ init-run: a run is ALREADY OPEN — receipt exists at ${receiptPath}.`,
      "",
      "Do NOT re-initialise and do NOT restart the pipeline from phase 1. Re-opening would discard",
      "the round history the circuit breaker counts against, and the board, ledger and receipt below",
      "already hold the run's real state. RESUME from the phase these files report.",
      "",
      resume
        ? `RESUME STATE (derived from files, never from memory):\n${JSON.stringify(resume, null, 2)}`
        : [
            "The receipt exists but no run state could be derived, which means the run root is",
            "incomplete. Inspect it before deciding:",
            `  ls -R ${runRoot}`,
          ].join("\n"),
      "",
      "To re-derive this at any time:",
      "  node <plugin>/skills/tech-lead/scripts/run-snapshot.mjs --cwd <dir>",
      "To abandon the open run and start over, deliberately: --force",
    ].join("\n"));
  }

  const startedAt = new Date().toISOString();
  const receipt = buildReceipt({ slug, intake, config, startedAt });

  mkdirSync(runRoot, { recursive: true });
  mkdirSync(join(runRoot, "orders"), { recursive: true });
  mkdirSync(join(runRoot, "results"), { recursive: true });
  mkdirSync(join(runRoot, "discovery"), { recursive: true });

  // The intake, verbatim. So "the spec was dropped on the hand-off" is a checkable claim.
  writeFileSync(join(runRoot, "intake.md"), intake.endsWith("\n") ? intake : intake + "\n", "utf8");
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  writeFileSync(join(runRoot, "harness-run.md"), runFrontmatter({ slug, config, startedAt }), "utf8");

  // The pointer every downstream guard reads to answer "is a run active?".
  const pointer = activeScope(cwd);
  mkdirSync(dirname(pointer), { recursive: true });
  writeFileSync(pointer, JSON.stringify({ slug, started_at: startedAt }, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({
    ok: true,
    slug,
    run_root: globLocal(slug),
    receipt: globLocal(slug, "receipt.json"),
    intake_sha256: receipt.intake_sha256,
    intake_chars: receipt.intake_chars,
    config,
    next: "GATE L0 — pin the run config, emit the gate block, then ORIENT.",
  }, null, 2));
}

if (isMain(import.meta.url)) {
  main();
}
