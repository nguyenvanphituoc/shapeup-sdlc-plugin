#!/usr/bin/env node
// GATE L0.1 — START THE RUN. The orchestrator's first tool call, before any prose.
//
// WHY THIS EXISTS (measured, not theorized).
//
// On the SDD harness benchmark (`sdd-harness-bench`, F2, Haiku 4.5, n=5, zero variance) the
// orchestrator was dispatched with a valid spec and did this:
//
//     TOOL   Skill(tech-lead, "--unattended --rounds 3\n\n# F2 — category budgets…")
//     TEXT   "The tech-lead skill is orchestrating the full Shape Up harness. It will: 1. …"
//     FINAL  (same text — session ends)
//
// It loaded a 450-line instruction file describing eleven gates and returned a description of
// eleven gates. No code, no board, no gate artifacts — and prose that reads exactly like a
// successful run. 29% acceptance, 10 escaped defects, five times out of five.
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
// It also HASHES the intake into the receipt. The benchmark's first (wrong) diagnosis was that
// requirement text was dropped on the hand-off. It was not, on re-run — but nothing on disk
// could have settled that either way. Now it can: the intake that reached the orchestrator is
// recorded verbatim next to its digest, so "the spec was dropped" is checkable, not arguable.
//
// USAGE
//   node init-run.mjs --slug <slug> --intake-file <path>            [options]   <- prefer this
//   node init-run.mjs --slug <slug> --intake-text "<requirement>"   [options]
//   cat spec.md | node init-run.mjs --slug <slug> --intake-stdin    [options]
//
// PREFER --intake-file. A multi-line requirement inlined into a shell argument is where this step
// goes wrong: quoting breaks, a `#` after a newline trips path validation, and the run spends six
// turns fighting its own command line instead of starting. Measured, on this project's benchmark.
//
//   --auto-level    interactive | auto | unattended   (default: interactive)
//   --lens          lite | standard | cross-context   (default: standard)
//   --max-rounds N  outer circuit breaker             (default: 3)
//   --attempts N    inner per-scope T0 budget         (default: 5)
//   --spec-folder   SHARED spec deliverable path      (default: docs/shapeup-sdlc/<slug>/spec/)
//   --gate-answers  path | preset name                (see gate-answers.mjs; recorded, not read)
//   --wall-clock-budget N  deadline breaker, seconds  (off by default; see budget-check.mjs)
//   --cwd           project root                      (default: process.cwd())
//   --force         re-init over an existing run receipt
//
// Prints a JSON receipt on stdout. Exit 0 on success, 2 on a usage error, 3 when a live run
// already exists and --force was not given.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { decideLane, treeSize } from "./fit-check.mjs";

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

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : fallback;
}
const flag = (n) => process.argv.includes(`--${n}`);

function fail(code, msg) {
  console.error(msg);
  process.exit(code);
}

export function main() {
  const cwd = arg("cwd", process.cwd());

  let intake = arg("intake-text", null);
  const intakeFile = arg("intake-file", null);
  // `--intake-file -` is the shape everyone reaches for; accept it rather than erroring on a
  // file literally named "-". (Measured: an agent tried exactly this on its second attempt.)
  if (flag("intake-stdin") || intakeFile === "-") {
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

  const slug = arg("slug", null) || slugify(intake.split("\n").find((l) => l.trim()) || "run");

  const auto_level = arg("auto-level", "interactive");
  if (!AUTO_LEVELS.has(auto_level)) fail(2, `--auto-level must be one of: ${[...AUTO_LEVELS].join(", ")}`);
  const lens = arg("lens", "standard");
  if (!LENSES.has(lens)) fail(2, `--lens must be one of: ${[...LENSES].join(", ")}`);

  const config = {
    auto_level,
    lens,
    max_rounds: Number(arg("max-rounds", "3")),
    attempt_budget: Number(arg("attempts", "5")),
    spec_folder: arg("spec-folder", `docs/shapeup-sdlc/${slug}/spec/`),
    gate_answers: arg("gate-answers", null),
    tiny_lane: flag("tiny"),
    // GATE L0.3 — the lane, computed rather than judged (see fit-check.mjs). Recorded with its
    // evidence so a heavy lane on a small change is visible instead of accidental. An explicit
    // --lane or --tiny is honoured and marked as an override, because a measured recommendation
    // fitted on three features must not outrank a human who knows the codebase.
    fit: (() => {
      const auto = decideLane({ intake, files: treeSize(cwd) });
      const forced = arg("lane", null) || (flag("tiny") ? "tiny" : null);
      return forced && forced !== auto.lane
        ? { ...auto, lane: forced, overridden_from: auto.lane, override_source: flag("tiny") ? "--tiny" : "--lane" }
        : auto;
    })(),
    // The third breaker (see scripts/budget-check.mjs). Null = off, which is the default and
    // keeps every existing run behaving exactly as before. Set it in any lane with a hard clock
    // — CI, a benchmark, an overnight run — so the harness trips its own breaker and ships what
    // is green, instead of being killed from outside and shipping nothing.
    wall_clock_budget_s: arg("wall-clock-budget", null) ? Number(arg("wall-clock-budget")) : null,
  };

  const runRoot = join(cwd, ".shapeup-sdlc", slug);
  const receiptPath = join(runRoot, "receipt.json");
  if (existsSync(receiptPath) && !flag("force")) {
    fail(3, [
      `✋ init-run: a run receipt already exists at ${receiptPath}.`,
      "Resume it (`--from <slug>`) or re-open deliberately with --force. Silently re-initialising",
      "would discard the round history the circuit breaker counts against.",
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
  const pointer = join(cwd, ".shapeup-sdlc", "active-scope");
  mkdirSync(dirname(pointer), { recursive: true });
  writeFileSync(pointer, JSON.stringify({ slug, started_at: startedAt }, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({
    ok: true,
    slug,
    run_root: `.shapeup-sdlc/${slug}`,
    receipt: `.shapeup-sdlc/${slug}/receipt.json`,
    intake_sha256: receipt.intake_sha256,
    intake_chars: receipt.intake_chars,
    config,
    next: "GATE L0 — pin the run config, emit the gate block, then ORIENT.",
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
