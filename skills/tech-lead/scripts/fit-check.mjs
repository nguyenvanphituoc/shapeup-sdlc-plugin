#!/usr/bin/env node
// GATE L0.3 — FIT CHECK. Which lane does this change belong in? Decided by measurement.
//
// WHY THIS EXISTS (measured, and it is the root cause the other three fixes did not touch).
//
// On the SDD harness benchmark, F3 ("add a `summary` command" to a six-file CLI — one new module
// plus one dispatcher wiring) was run through the full eleven-gate pipeline and never finished.
// Not once, across four attempts. It was killed at the 1800s cap mid-build; then, with a
// wall-clock breaker fitted, it reached ship-triage and was killed there; then it produced an
// honest report saying its two must-haves were 0% started.
//
// Every one of those fixes made the FAILURE better. None of them made the RUN finish, because
// none addressed why a three-file change was consuming half an hour: **the ceremony was not
// sized to the change.**
//
// The harness already knew. In the pilot transcripts, tech-lead identified F1 at GATE L0 as
// "about as small as they come… squarely inside the --tiny lane" — and then ran the full pipeline
// anyway, because the lane was a judgment the model was free to talk itself out of. That is the
// same class of defect as narration and as prose consent: an invariant living somewhere a model
// can re-decide it. The project's rule is that such invariants move into the runtime.
//
// So the lane stops being a recommendation and becomes a computed value, recorded in the receipt
// alongside the evidence for it. A PO can still override — with `--lane`, which is recorded AS an
// override, so "we ran the heavy lane on a two-file change" is visible rather than accidental.
//
// WHAT IT MEASURES. Only things that are true before any work starts:
//   • the size of the tree being changed (a 6-file CLI is not a monorepo)
//   • how many distinct deliverables the intake asks for
//   • whether the intake introduces a new dependency, datastore, or external seam
//   • whether the intake itself signals breadth ("migration", "across", "end to end")
//
// It is deliberately CONSERVATIVE: `full` is the default and `tiny` must be earned. A wrong
// `tiny` skips review on something that needed it; a wrong `full` only costs money. Those are not
// symmetric, and the tie goes to the gates.
//
// USAGE
//   node fit-check.mjs --intake-file <path> [--cwd <root>] [--json]
//   node fit-check.mjs --intake-text "<requirement>" [--cwd <root>]
//
// Exit 0 always — this informs a decision, it does not deny a tool call. The orchestrator reads
// `lane` and acts on it; `init-run.mjs` records it in the receipt.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { isMain } from "./lib/is-main.mjs";

/** Directories that are never part of "the tree being changed". */
const IGNORE_DIRS = new Set([".git", "node_modules", ".shapeup-sdlc", "dist", "build", ".next", "coverage", ".claude"]);

/** Source extensions that count toward tree size. */
const SOURCE_EXT = /\.(m?[jt]sx?|py|rb|go|rs|java|kt|swift|php|cs)$/i;

/** Intake phrases that mean "this is bigger than it looks". */
const BREADTH_SIGNALS = [
  /\bmigrat(e|ion)\b/i,
  /\bacross\b.*\b(files?|modules?|services?|commands?)\b/i,
  /\bend[- ]to[- ]end\b/i,
  /\brefactor\b/i,
  /\bbackfill\b/i,
  /\bschema\b/i,
  /\bbreaking change\b/i,
  /\bnew (dependency|package|library|service|datastore|database|table)\b/i,
  /\bauth(entication|orization)\b/i,
  /\bexternal (api|service|provider)\b/i,
];

/** Countable deliverables: things the intake asks to exist that do not exist yet. */
const DELIVERABLE_SIGNALS = [
  /\badd (?:a )?new\b/gi,
  /\badd (?:a|an|the)\b/gi,
  /\bnew (command|module|flag|endpoint|screen|field|option)\b/gi,
  /\bimplement\b/gi,
  /\bcreate\b/gi,
  /\bsupport\b/gi,
];

/** Count source files in the tree, bounded so a huge repo cannot make this slow. */
export function treeSize(root, cap = 400) {
  let files = 0;
  const walk = (dir, depth) => {
    if (files >= cap || depth > 6) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files >= cap) return;
      if (e.name.startsWith(".") && e.name !== ".claude") { if (IGNORE_DIRS.has(e.name)) continue; }
      if (IGNORE_DIRS.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (SOURCE_EXT.test(e.name)) {
        try { if (statSync(p).size > 0) files++; } catch { /* unreadable */ }
      }
    }
  };
  walk(root, 0);
  return files;
}

/**
 * Decide the lane from measurable facts.
 *
 * @param {{intake: string, files: number}} input
 * @returns {{lane: "tiny"|"full", confidence: "clear"|"borderline", reasons: string[], signals: object}}
 */
export function decideLane({ intake, files }) {
  const text = String(intake || "");
  const breadth = BREADTH_SIGNALS.filter((re) => re.test(text)).map((re) => String(re));
  let deliverables = 0;
  for (const re of DELIVERABLE_SIGNALS) {
    re.lastIndex = 0;
    deliverables += (text.match(re) || []).length;
  }

  const signals = {
    tree_source_files: files,
    intake_chars: text.length,
    deliverable_mentions: deliverables,
    breadth_signals: breadth.length,
  };

  // CONJUNCTIVE, and it must be. The first version asked "is there evidence this is BIG?" and
  // defaulted to tiny when it found none — which classified all three benchmark features as tiny,
  // including the five-seam one that genuinely needs the pipeline and used two evaluation rounds
  // to pass. A router that confident and that wrong is worse than no router: it would skip review
  // on exactly the change that needed it.
  //
  // So `tiny` now requires positive evidence of smallness on EVERY axis, and `full` is what you
  // get by default. A wrong `tiny` skips gates on something that needed them; a wrong `full` only
  // costs money. Those are not symmetric.
  const TINY = { files: 10, chars: 1500, deliverables: 2 };
  const checks = [
    { ok: files > 0 && files <= TINY.files, why: `tree has ${files} source file(s) (tiny needs 1–${TINY.files})` },
    { ok: text.length <= TINY.chars, why: `intake is ${text.length} chars (tiny needs ≤${TINY.chars})` },
    { ok: deliverables <= TINY.deliverables, why: `intake names ~${deliverables} deliverable(s) (tiny needs ≤${TINY.deliverables})` },
    { ok: breadth.length === 0, why: breadth.length ? `${breadth.length} breadth signal(s) present` : "no breadth signals" },
  ];
  const reasons = checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.why}`);
  const tiny = checks.every((c) => c.ok);
  const failed = checks.filter((c) => !c.ok).length;

  // "Borderline" is not decoration: it is the signal that a human should look. One failed check
  // means the change sits on the boundary and the lane is a judgment, not a measurement.
  const confidence = tiny ? "clear" : failed === 1 ? "borderline" : "clear";

  return {
    lane: tiny ? "tiny" : "full",
    confidence,
    reasons,
    signals,
    // Say it on every invocation rather than burying it in a doc. These thresholds are calibrated
    // against THREE features. That is enough to stop the router being obviously wrong and nowhere
    // near enough to trust it silently, so it recommends and never denies.
    calibration: "advisory — thresholds fitted on 3 benchmark features (n=3); `full` is the default and the PO may override with --lane",
  };
}

// ---- CLI -------------------------------------------------------------------

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : fallback;
}

export function main() {
  const cwd = arg("cwd", process.cwd());
  let intake = arg("intake-text", null);
  const f = arg("intake-file", null);
  if (f) {
    const p = f.startsWith("/") ? f : join(cwd, f);
    if (!existsSync(p)) { console.error(`--intake-file not found: ${p}`); process.exit(2); }
    intake = readFileSync(p, "utf8");
  }
  if (!intake) { console.error("fit-check: pass --intake-file <path> or --intake-text \"<requirement>\""); process.exit(2); }

  const files = treeSize(cwd);
  const result = decideLane({ intake, files });

  console.log(JSON.stringify({
    ...result,
    // The sentence the orchestrator must act on, so the decision is not re-derived from the JSON.
    action: result.lane === "tiny"
      ? "TINY LANE. Run: orient (light) → single-task board → build → T0 → ⏸ L4. Skip WIRE, scope contracts, spec tree, EVAL and QA. The full pipeline on a change this size is the measured cause of a benchmark run that never finished, four attempts running."
      : "FULL LANE. Run the complete pipeline: ORIENT → WIRE → MAP SCOPES → BUILD → EVAL → QA → GATE H → L4.",
  }, null, 2));
}

if (isMain(import.meta.url)) {
  main();
}
