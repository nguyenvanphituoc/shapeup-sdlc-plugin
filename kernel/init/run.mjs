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
//   • the ship report's census fires when a completion claim contradicts run facts. It is
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
//   node `harness init run` --slug <slug> --intake-file <path>            [options]   <- prefer this
//   node `harness init run` --slug <slug> --intake-text "<requirement>"   [options]
//   cat spec.md | node `harness init run` --slug <slug> --intake-stdin    [options]
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
//   --dimensions    comma-separated eval dimensions   (default: spec-conformance)
//   --gate-answers  path | preset name                (see `harness gate`; recorded, not read)
//   --wall-clock-budget N  deadline breaker, seconds  (off by default; see `harness verify budget`)
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

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { decideLane, treeSize } from "./fit.mjs";
import { runArgs } from "../lib/argv.mjs";
import { uncoerce } from "../lib/contract.mjs";
import { deriveSnapshot } from "../reduce/snapshot.mjs";
import { mintRunId } from "../lib/paths.mjs";
import { localRoot, activeScope, globLocal, globShared, ordersDir, resultsDir } from "../lib/paths.mjs";
import { resolveWorkers } from "../verify/skills.mjs";

export const RECEIPT_VERSION = 1;

const AUTO_LEVELS = new Set(["interactive", "auto", "unattended"]);
const LENSES = new Set(["lite", "standard", "cross-context"]);

/**
 * The eval dimension set when the caller names none. Kept to the base correctness dimension so an
 * unconfigured run behaves exactly as it did before this flag existed.
 */
export const DEFAULT_DIMENSIONS = ["spec-conformance"];

/**
 * Parse `--dimensions` into the set written to the ledger. Shape-validated only, NOT checked against
 * the dimensions that ship: adding `references/dimensions/<id>.md` and naming it here is the
 * documented injection path, so a closed list here would make the evaluator's own extension point
 * unreachable. An id with no file behind it is skipped-with-a-warning at dimension resolution, which
 * is where that check belongs and where it can actually see the files.
 *
 * @param {(string|null|undefined)} raw - The comma-separated flag value; absent → the default set.
 * @returns {string[]} Trimmed, de-duplicated ids in the caller's order.
 * @throws {Error} If the list is empty or an entry is not a kebab-case id.
 */
export function parseDimensions(raw) {
  if (raw === null || raw === undefined) return [...DEFAULT_DIMENSIONS];
  const ids = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) throw new Error("--dimensions: empty list — omit the flag to use the default [spec-conformance]");
  for (const id of ids) {
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`--dimensions: "${id}" is not a dimension id (kebab-case, e.g. spec-conformance, tdd-surface, integration)`);
    }
  }
  return [...new Set(ids)];
}

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
export function buildReceipt({ slug, intake, config, startedAt, plugin = null }) {
  const intakeText = String(intake ?? "");
  const intakeSha256 = digest(intakeText);
  return {
    receipt_version: RECEIPT_VERSION,
    type: "harness-run-receipt",
    slug,
    // THE JOIN KEY, minted here because this is where a run acquires an identity at all.
    //
    // `order_id` was the nearest thing the harness had, and it is `<slug>/r<N>-a<M>`: unique
    // WITHIN a run and identical across every run of the same slug. So every record the pipeline
    // writes — orders, results, journal rows, trial rows, hook receipts — could be grouped by
    // feature and never by RUN, which makes "compare this run against the last one" and "what did
    // this run cost" both unanswerable from data that was otherwise all present.
    //
    // Derived, not drawn (see `mintRunId` in lib/paths.mjs): a pure function of the three fields below
    // it, so any writer holding this receipt recomputes the same id without being handed it, and a
    // receipt written before this field existed still yields the id it would have been given.
    run_id: mintRunId({ slug, startedAt, intakeSha256 }),
    started_at: startedAt,
    intake_sha256: intakeSha256,
    intake_chars: intakeText.length,
    intake_lines: intakeText ? intakeText.split("\n").length : 0,
    // The single fact that separates "the harness ran" from "the harness described itself".
    // Written before any gate, so its ABSENCE at Stop is unambiguous.
    started: true,
    // WHICH COPY OF THE PLUGIN PRODUCED THIS RUN. Recorded while it is in hand, because afterwards
    // it is unrecoverable: every artifact a run leaves looks identical whether it came from this
    // version, a stale marketplace install, or a sub-agent improvising past a failed dispatch. A
    // run whose trace cannot name its own plugin cannot be compared with another run, and cannot be
    // cleared of the wrong-version failure the roster check exists to catch.
    plugin: plugin ? { name: plugin.name, version: plugin.version, root: plugin.root } : null,
    config,
  };
}

/** The `harness-run.md` frontmatter block, per references/state.md. */
export function runFrontmatter({ slug, config, startedAt }) {
  return [
    "---",
    "type: harness-run",
    `feature: ${slug}`,
    `spec_folder: ${config.spec_folder}`,
    `lens: ${config.lens}`,
    // The ledger is the ONE place the dimension set lives: resume-state reads it back off this line
    // and the workflow hands it to every evaluate order. Written through the same list dialect the
    // parser reads (contract-md), never hand-joined.
    `eval_dimensions: ${uncoerce(config.eval_dimensions ?? DEFAULT_DIMENSIONS)}`,
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
    "Opened by ``harness init run`` (GATE L0.1). The tech lead is the sole writer from here on.",
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

/**
 * Unwedge `--force`: resolve every order left LIVE by a run nobody is continuing.
 *
 * `hooks/sandbox-guard.mjs`'s `liveOrders()` treats any file under `orders/` with no SAME-NAMED
 * file under `results/` as live, and constrains every later Edit/Write to what some live order's
 * substrate permits. `--force` used to `mkdirSync(..., {recursive:true})` over the same directories
 * and stop — a no-op on dirs that already exist and already hold the stale order, so the wedge
 * survived it exactly as before. This is the real unwedge path: for every order abandoned by the run
 * being forced over, write a same-named record under `results/` so `liveOrders()` no longer counts
 * it, without deleting the order file itself (`orders/` is this codebase's own audit trail of what
 * was dispatched, not a rolling buffer — losing the file loses the record that a dispatch happened).
 *
 * Not a real WorkResult: `work-result.schema.json`'s `status` enum (done/partial/escalated/failed)
 * has no member that honestly means "no worker ever answered" — every one of those values would
 * misrepresent an abandoned dispatch as an attempt that actually ran. So this writes a plainly
 * self-labelled, intentionally non-conforming marker instead of forcing a lie into a schema-valid
 * shape. `liveOrders()` only checks filename presence under `results/`, never content, so this is
 * sufficient to unwedge on its own.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - The run being forced over.
 * @returns {string[]} Order-id suffixes (filenames minus `.json`) resolved as abandoned.
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
      status: "abandoned", // not in work-result.schema.json's enum — deliberately: see banner above
      order_id: f.slice(0, -".json".length),
      reason: "dispatched, never answered — resolved by `harness init run --force`",
      resolved_at: resolvedAt,
    };
    writeFileSync(join(rDir, f), JSON.stringify(marker, null, 2) + "\n", "utf8");
    resolved.push(marker.order_id);
  }
  return resolved;
}

// ---- CLI -------------------------------------------------------------------

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: 'harness.mjs init run (--intake-file <path> | --intake-text "<req>" | --intake-stdin) ' +
         "[--slug <slug>] [--auto-level interactive|auto|unattended] [--lens <lens>] " +
         "[--max-rounds N] [--attempts N] [--spec-folder <dir>] [--dimensions <a,b>] " +
         "[--gate-answers <preset|path>] " +
         "[--lane full|tiny] [--tiny] [--wall-clock-budget <seconds>] [--cwd <dir>] " +
         "[--plugin-root <dir>] [--force]",
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
  dimensions: { type: "str" },
  "gate-answers": { type: "str" },
  lane: { type: "str" },
  tiny: { type: "flag" },
  "wall-clock-budget": { type: "int", min: 1 },
  // Which copy of the plugin this run is opened against. Defaults to the one this kernel is part
  // of, which is right for every ordinary invocation; it is nameable because a machine can carry
  // several installs, and because the roster refusal below is otherwise unreachable for a test —
  // a check whose failure path cannot be exercised is a check nobody has seen work.
  "plugin-root": { type: "path" },
  force: { type: "flag" },
};

function fail(code, msg) {
  console.error(msg);
  process.exit(code);
}

/**
 * Open a run: mint the receipt, or refuse (exit 3) when one is already live.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = args.cwd || process.cwd();

  // GATE L0 — the worker roster, before any spend.
  //
  // HERE AND NOT IN THE WORKFLOW SCRIPT, for two reasons. This is what GATE L0 actually executes,
  // and it covers both lanes rather than only the orchestrated one — the prose/`--tiny` lane opens
  // its run through exactly this call. And it is genuinely before any spend: the workflow script's
  // own helpers reach the kernel by spawning a sub-agent first, so a check placed there has already
  // paid for a model call before it can refuse.
  //
  // What it can and cannot prove is stated in verify/skills.mjs and is worth repeating where it is
  // enforced: this says the files exist at this root at this version. It does not say the SESSION
  // will resolve that copy. The orchestrator's canary dispatch answers that, and its receipt is the
  // evidence; this refusal is the cheap half that costs nothing to run on every single run.
  const plugin = resolveWorkers(args.pluginRoot ? resolve(args.pluginRoot) : undefined);
  if (plugin.missing.length) {
    fail(3, [
      `✋ init-run: refusing to open a run — ${plugin.missing.length} of ${plugin.workers.length} worker skills are missing.`,
      "",
      `  plugin: ${plugin.name ?? "unknown"} ${plugin.version ?? "unknown version"}`,
      `  root:   ${plugin.root}`,
      `  missing: ${plugin.missing.join(", ")}`,
      "",
      "A run against this copy would dispatch workers that cannot resolve, and a failed dispatch is",
      "answered by the sub-agent improvising the craft itself — phases reporting complete with none",
      "of the shipped craft applied. Load the working copy (`claude --plugin-dir <repo>`) or install",
      "and enable the plugin, then retry. `harness verify skills` reports the same thing on demand.",
    ].join("\n"));
  }

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
  // GATE L0.5 — the eval dimension set, resolved ONCE here and carried by the ledger. Before this
  // flag the line was a constant, so a dimension the PO asked for at L0.5 had nowhere to be
  // recorded and the run graded spec-conformance whatever the answer had been.
  let eval_dimensions;
  try { eval_dimensions = parseDimensions(args.dimensions ?? null); }
  catch (e) { fail(2, e.message); }

  const config = {
    auto_level,
    lens,
    eval_dimensions,
    max_rounds: args.maxRounds ?? 3,
    attempt_budget: args.attempts ?? 5,
    spec_folder: args.specFolder ?? `${globShared(slug, "spec")}/`,
    gate_answers: args.gateAnswers ?? null,
    tiny_lane: !!args.tiny,
    // GATE L0.3 — the lane, computed rather than judged (see `harness init fit`). Recorded with its
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
    // The third breaker (see `harness verify budget`). Null = off, which is the default and
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
  // already invisible — under a symlinked install an entry-point guard once skipped this whole body.
  //
  // Observed consequence on a handoff: a fresh session in a workspace with an open run burns most
  // of its budget before its first write, largely on forensics against this step, and closes none
  // of the gap.
  //
  // So the refusal now DOES the resume work instead of describing it. It emits the derived snapshot
  // — the same file-only derivation `harness reduce graph --subgraph run` injects — so the orchestrator gets
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
      "  node <plugin>/kernel/harness.mjs reduce snapshot --cwd <dir>",
      "To abandon the open run and start over, deliberately: --force",
    ].join("\n"));
  }

  // THE REAL UNWEDGE PATH. `--force` used to `mkdirSync(..., {recursive:true})` over orders/,
  // results/ and discovery/ and stop — a no-op on directories that already exist and already hold a
  // dispatched-but-unanswered order, so `sandbox-guard.mjs`'s `liveOrders()` kept constraining every
  // later write to that stale order's substrate regardless of `--force`. Resolve every such order
  // BEFORE the fresh run starts writing (see `resolveAbandonedOrders()` above for why this writes a
  // marker under `results/` rather than deleting the order file).
  if (args.force) {
    const abandoned = resolveAbandonedOrders(cwd, slug);
    if (abandoned.length) {
      console.error(
        `⚠ init-run --force: resolved ${abandoned.length} dispatched-but-unanswered order(s) as abandoned — ${abandoned.join(", ")}`,
      );
    }
  }

  const startedAt = new Date().toISOString();
  const receipt = buildReceipt({ slug, intake, config, startedAt, plugin });

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
    // Echoed so the orchestrator can put it in RunArgs without re-reading the receipt.
    run_id: receipt.run_id,
    run_root: globLocal(slug),
    receipt: globLocal(slug, "receipt.json"),
    intake_sha256: receipt.intake_sha256,
    intake_chars: receipt.intake_chars,
    config,
    next: "GATE L0 — pin the run config, emit the gate block, then ORIENT.",
  }, null, 2));
}

