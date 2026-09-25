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
//   --breadboard    path to the pitch's breadboard     (default: found — see resolveBreadboard())
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

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, copyFileSync, rmSync, statSync } from "node:fs";
import { discover, resolve as resolveGate, appendGateLedger, PRESETS } from "../gate.mjs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { decideLane, treeSize } from "./fit.mjs";
import { runArgs } from "../lib/argv.mjs";
import { uncoerce } from "../lib/contract.mjs";
import { deriveSnapshot } from "../reduce/snapshot.mjs";
import { mintRunId } from "../lib/paths.mjs";
import {
  localRoot, activeScope, activeOrder, globLocal, globShared, ordersDir, resultsDir,
  workflowsStage, globWorkflowsStage, sharedRoot, shapingDir, breadboard as stagedBreadboard,
} from "../lib/paths.mjs";
import { parseBreadboard, hasBreadboardTables, idCounts } from "../lib/breadboard.mjs";
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
 *
 * @param {object} o - Resolved inputs (destructured).
 * @param {string} o.slug - Feature slug.
 * @param {string} o.intake - The intake text, verbatim.
 * @param {object} o.config - The pinned run config.
 * @param {string} o.startedAt - ISO start time.
 * @param {(object|null)} [o.plugin] - The plugin copy that answered.
 * @param {(string|null)} [o.intakeSource] - Repo-relative `--intake-file` path, or "text" / "stdin".
 * @param {({source: string, path: (string|null), text: string, translated?: boolean}|null)} [o.breadboard] -
 *   The resolved breadboard, `path` repo-relative (null when embedded in the intake), or null.
 * @returns {object} The receipt.
 */
export function buildReceipt({ slug, intake, config, startedAt, plugin = null, intakeSource = null, breadboard = null }) {
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
    // WHERE THE INTAKE CAME FROM. The copy above is all the run reads, so without its origin nothing
    // on disk says which file the pitch was — or that it had a second half beside it.
    intake_source: intakeSource,
    // THE PITCH'S OTHER HALF. A `/shapeup` pitch is shaping.md + breadboard.md, and a Place that only
    // the breadboard names reaches no planning worker unless the run carries it. Recorded here, at
    // t=0, rather than left to a worker to note: the kernel knows whether a breadboard exists before
    // anything is dispatched, and a worker's prose rule for exactly this case did not hold.
    breadboard: breadboard
      ? {
          source: breadboard.source,
          path: breadboard.path ?? null,
          sha256: digest(breadboard.text),
          chars: String(breadboard.text ?? "").length,
          ids: idCounts(parseBreadboard(breadboard.text)),
          ...(typeof breadboard.translated === "boolean" ? { translated: breadboard.translated } : {}),
        }
      : null,
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

/** The `harness-run.md` frontmatter block, per references/protocol.md Part 4 — State. */
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
    // The cause a terminal status ended on, written alongside `closed_at` by
    // `probe resume --close` (kernel/probe/resume.mjs's closeRun) — the two land in one write, so a
    // closed run's ledger never carries a timestamp with no reason beside it.
    "close_cause: ~",
    // The once-only guard's OWN record of what closed this run — deliberately separate from
    // `status:` above, which every phase rewrites (`setRunStatus`) for the life of the run,
    // including the product's own ship path immediately before `probe resume --close` runs. Only
    // `closeRun` ever writes this line, so it is the one field an intervening `status:` rewrite
    // cannot move (kernel/probe/resume.mjs's closeRun docblock has the measured scenario).
    "closed_status: ~",
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

/**
 * Copy the plugin's run scripts into the project so the launch can actually read them.
 *
 * WHY A COPY, AND WHY HERE. `Workflow({scriptPath})` loads a script only from somewhere the session
 * is already allowed to read — the working directory, or a directory the operator added. The plugin
 * is installed OUTSIDE the project (a version-stamped cache directory on a marketplace install), so
 * naming the shipped path fails the launch outright, and no permission rule fixes it: the grant that
 * authorises the Workflow tool says nothing about where it may read from. The failure is invisible
 * in development, where the plugin root and the working directory are the same tree, and total for
 * everybody else. A project-local copy is inside the working directory by construction, so it loads
 * in every permission mode without widening what the session may read.
 *
 * Opening a run is the right moment: it is the one step every lane passes through before a launch,
 * and it already knows which copy of the plugin answered.
 *
 * `refresh` is what keeps an upgrade from arriving mid-round. Opening a run (or forcing over one)
 * overwrites the staged copies, so a plugin upgrade reaches the NEXT run. A call that finds a run
 * already open only fills in what is missing: that run should finish on the orchestrator it started
 * with, and swapping the script under a resumed round is a different build than the one the gates
 * were answered for — but a relaunch with no script at all is a dead end, so a copy that is gone
 * (a cleaned run workspace, a run opened by a version that never staged) is written back.
 *
 * Best-effort by design: a project that cannot be written to still opens its run and can still be
 * launched from the install path by an operator who adds that directory. Reporting beats refusing.
 *
 * @param {string} cwd - Project root.
 * @param {string} pluginRoot - The plugin copy that answered this call.
 * @param {object} [opts] - Options.
 * @param {boolean} [opts.refresh] - Overwrite an existing copy (true) or only fill gaps (false).
 * @returns {{ok: boolean, dir: string, staged: string[], reason?: string}} Outcome, for the caller to report.
 */
export function stageWorkflows(cwd, pluginRoot, { refresh = true } = {}) {
  const src = join(pluginRoot, "skills", "tech-lead", "workflows");
  const dir = workflowsStage(cwd);
  let names;
  try {
    names = readdirSync(src).filter((f) => f.endsWith(".js")).sort();
  } catch (e) {
    return { ok: false, dir, staged: [], reason: `no workflow scripts at ${src}: ${e.message}` };
  }
  try {
    mkdirSync(dir, { recursive: true });
    for (const f of names) {
      const dst = join(dir, f);
      if (refresh || !existsSync(dst)) copyFileSync(join(src, f), dst);
    }
  } catch (e) {
    return { ok: false, dir, staged: [], reason: `could not stage into ${dir}: ${e.message}` };
  }
  return { ok: true, dir, staged: names };
}

/**
 * Find the breadboard that belongs to this run's pitch. First hit wins:
 *
 *   1. `flag`        — `--breadboard <path>`, resolved against cwd; a missing file is an error.
 *   2. `sibling`     — `breadboard.md` in the folder of `--intake-file` (not for text or stdin).
 *   3. `shaping-dir` — `shapeup/<slug>/shaping/breadboard.md`, the documented location.
 *   4. `shared-root` — `shapeup/<slug>/breadboard.md`, the flat layout real projects use.
 *   5. `embedded`    — the intake itself, when it carries Places and UI tables; nothing is staged.
 *
 * THE INTAKE'S OWN FOLDER COMES FIRST, not the documented location, because the only consumer that
 * hit this keeps its pitch flat in `shapeup/<slug>/`: a lookup that reads only the shaping folder
 * passes every fixture built to the documented layout and misses the real one.
 *
 * A discovered candidate that is the intake file itself, or the run's own staged copy, is skipped:
 * the staged copy is this function's OUTPUT, and re-opening a run from its staged intake must not
 * inherit the breadboard of the run it replaces.
 *
 * A TRANSLATED PITCH GETS ITS TRANSLATED BREADBOARD. When the intake is a translator output
 * (`<name>.en.md`), each folder is tried for `breadboard.en.md` before `breadboard.md`, and the
 * result says whether it is translated — an English spec planned from a source-language breadboard
 * is a mismatch the caller reports, not one it may silently stage.
 *
 * @param {object} o - Inputs (destructured).
 * @param {string} o.cwd - Project root.
 * @param {string} o.slug - Feature slug.
 * @param {(string|null)} [o.intakeFile] - The `--intake-file` value as given ("-" = stdin).
 * @param {(string|null)} [o.flag] - The `--breadboard` value as given.
 * @param {string} [o.intake] - The intake text, for the embedded case.
 * @returns {({source: string, path: (string|null), text: string, translated?: boolean}|null)} The
 *   breadboard, its absolute path (null when embedded), and its text — plus `translated` when the
 *   intake is a `.en.md` translation; or null when the pitch has none.
 * @throws {Error} If `--breadboard` names a file that does not exist.
 */
export function resolveBreadboard({ cwd, slug, intakeFile = null, flag = null, intake = "" }) {
  const self = intakeFile && intakeFile !== "-" ? resolve(cwd, intakeFile) : null;
  const english = Boolean(self && self.endsWith(".en.md"));
  /** Tag a hit with whether it is translated — only meaningful when the intake is. */
  const hit = (source, p, text) => ({ source, path: p, text, ...(english ? { translated: p === null || p.endsWith(".en.md") } : {}) });
  if (flag) {
    const p = resolve(cwd, flag);
    if (!existsSync(p) || !statSync(p).isFile()) throw new Error(`--breadboard not found: ${p}`);
    return hit("flag", p, readFileSync(p, "utf8"));
  }
  const staged = stagedBreadboard(cwd, slug);
  const names = english ? ["breadboard.en.md", "breadboard.md"] : ["breadboard.md"];
  const folders = [
    ...(self ? [["sibling", dirname(self)]] : []),
    ["shaping-dir", shapingDir(cwd, slug)],
    ["shared-root", sharedRoot(cwd, slug)],
  ];
  for (const [source, dir] of folders) {
    for (const n of names) {
      const p = join(dir, n);
      if (p === self || p === staged) continue;
      if (existsSync(p) && statSync(p).isFile()) return hit(source, p, readFileSync(p, "utf8"));
    }
  }
  if (hasBreadboardTables(intake)) return hit("embedded", null, String(intake));
  return null;
}

/** A path relative to the project root, `/`-joined on every platform — the form a receipt records. */
const repoRel = (cwd, p) => relative(cwd, p).split(sep).join("/");

// ---- CLI -------------------------------------------------------------------

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: 'harness.mjs init run (--intake-file <path> | --intake-text "<req>" | --intake-stdin) ' +
         "[--slug <slug>] [--auto-level interactive|auto|unattended] [--lens <lens>] " +
         "[--max-rounds N] [--attempts N] [--spec-folder <dir>] [--dimensions <a,b>] " +
         "[--gate-answers <preset|path>] [--breadboard <path>] " +
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
  breadboard: { type: "path" },
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
  // The pitch's second half, resolved before anything is written so a bad `--breadboard` is a usage
  // error that ran nothing. Read-only here; staged below, once the run is actually opened.
  let bb = null;
  try { bb = resolveBreadboard({ cwd, slug, intakeFile, flag: args.breadboard ?? null, intake }); }
  catch (e) { fail(2, e.message); }
  if (bb?.translated === false) {
    console.error(`⚠ init-run: the intake is a translation but its breadboard is not — staging ${repoRel(cwd, bb.path)} as found.`);
    console.error("  Translate the breadboard too (translator), and name the .en.md with --breadboard, or the spec is planned from two languages.");
  }
  const intakeSource = args.intakeStdin || intakeFile === "-" ? "stdin" : intakeFile ? repoRel(cwd, resolve(cwd, intakeFile)) : "text";

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

  // STAGE THE RUN SCRIPTS BEFORE THE ALREADY-OPEN REFUSAL, not after: a session resuming a paused
  // run reaches that refusal and nothing else, and it still needs a `scriptPath` it can name. What
  // it does NOT get is a swapped orchestrator — see stageWorkflows() for why `refresh` is false
  // exactly when a run is already open and is not being forced over.
  // `Boolean(...)`, not the bare flag: an absent `--force` is `undefined`, and `false || undefined`
  // is `undefined`, which a destructured default reads as "not passed" and turns back into `true`.
  const staged = stageWorkflows(cwd, plugin.root, { refresh: !existsSync(receiptPath) || Boolean(args.force) });
  if (!staged.ok) {
    console.error(`⚠ init-run: could not stage the run scripts — ${staged.reason}`);
    console.error(`  Launch from the install path instead, and add ${plugin.root} to the session's`);
    console.error("  readable directories (/add-dir) if the Workflow tool refuses to load it.");
  }
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
      "",
      staged.ok
        ? `Relaunch the same run with: Workflow({scriptPath: "${globWorkflowsStage("shapeup-run.js")}", args: <the same RunArgs>})`
        : "The run scripts are NOT staged in this project — see the warning above before relaunching.",
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
    // And the pointer the abandoned run left behind. It names a run that is being forced over, so
    // the next compile republishes it within the second; retiring it here means a `--force` that
    // resolves nothing still leaves no stale claim about which run is open.
    rmSync(activeOrder(cwd), { force: true });
  }

  const startedAt = new Date().toISOString();
  const receipt = buildReceipt({
    slug, intake, config, startedAt, plugin, intakeSource,
    breadboard: bb ? { ...bb, path: bb.path ? repoRel(cwd, bb.path) : null } : null,
  });

  mkdirSync(runRoot, { recursive: true });
  mkdirSync(join(runRoot, "orders"), { recursive: true });
  mkdirSync(join(runRoot, "results"), { recursive: true });
  mkdirSync(join(runRoot, "discovery"), { recursive: true });

  // The intake, verbatim. So "the spec was dropped on the hand-off" is a checkable claim.
  writeFileSync(join(runRoot, "intake.md"), intake.endsWith("\n") ? intake : intake + "\n", "utf8");
  // The breadboard, verbatim — byte for byte, so the receipt's digest is the file's. A copy left by a
  // run this one replaces goes first: a re-open without a breadboard must not inherit the last one.
  rmSync(stagedBreadboard(cwd, slug), { force: true });
  if (bb?.path) writeFileSync(stagedBreadboard(cwd, slug), bb.text, "utf8");
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  writeFileSync(join(runRoot, "harness-run.md"), runFrontmatter({ slug, config, startedAt }), "utf8");

  // The pointer every downstream guard reads to answer "is a run active?".
  const pointer = activeScope(cwd);
  mkdirSync(dirname(pointer), { recursive: true });
  writeFileSync(pointer, JSON.stringify({ slug, started_at: startedAt }, null, 2) + "\n", "utf8");

  // GATE L0 HAS A DETERMINISTIC CALL SITE: THE RUN'S OPENING. It used to be a line of prose the
  // tech lead was asked to act on, and the same consumer ledgered L0 on one run and not the next.
  // The intake conversation is the L0 decision; opening the run is the act that records it, with
  // the answer set the run was configured with (a preset name or a file), else the interactive
  // defaults. Best-effort: a row that cannot be written must not fail the opening.
  try {
    const ga = config.gate_answers ?? null;
    const presetName = ga && PRESETS[ga] ? ga : null;
    const found = discover({ cwd, slug, preset: presetName, file: ga && !presetName ? ga : null });
    // A preset or file answers L0 for the run; a run with neither — the interactive lane, where the
    // tech lead held the intake conversation before opening it — has that conversation as its L0
    // decision, and the opening records it as such. An answer set that says `ask` is recorded as
    // `ask`: the row states what the set said, and the intake note says what happened.
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
    // Echoed so the orchestrator can put it in RunArgs without re-reading the receipt.
    run_id: receipt.run_id,
    run_root: globLocal(slug),
    receipt: globLocal(slug, "receipt.json"),
    intake_sha256: receipt.intake_sha256,
    intake_chars: receipt.intake_chars,
    // The staged breadboard the planning dispatches are handed, or null when the pitch has none
    // separate (`breadboard_source` then says "embedded" or null).
    breadboard: bb?.path ? globLocal(slug, "breadboard.md") : null,
    breadboard_source: bb?.source ?? null,
    config,
    // What the launch names. Project-local by necessity, not by preference — see stageWorkflows().
    workflow_script: staged.ok ? globWorkflowsStage("shapeup-run.js") : null,
    next: "GATE L0 — pin the run config, emit the gate block, then ORIENT.",
  }, null, 2));
}

