// paths — where the harness writes, and which run a record belongs to, for Shape Up.
//
// CONTRACT. Every generated path in this plugin resolves through this module; nothing else may spell a
// storage root. The structural suite enforces that, because a root hard-coded in two syntaxes (a
// string literal and a `join(cwd, "…", …)` chain) is a rename that no single search completes.
//
// This is the adapter: the two root names, the run-trace builders the core mechanism produces for
// them, and the paths that are Shape Up's own artifacts (spec tree, scope contracts, wiring map,
// task board, evaluation, QA, the knowledge base). The mechanism lives in `../core/runtrace.mjs`.
//
// TIER DISCIPLINE, the reason there are two roots:
//   SHARED (committed) — prose a teammate reads: shaping, spec, contracts, requirements, report.
//   LOCAL (gitignored) — run state, envelopes, verification artifacts, machine policy.

import { join } from "node:path";
import { runTrace } from "../core/runtrace.mjs";

// ---------------------------------------------------------------------------
// The two roots. Renaming a root is these two lines.
// ---------------------------------------------------------------------------

// Both roots are POSIX strings, deliberately. They are used two ways — fed to `join()` (which
// normalises separators on Windows) and interpolated into SUBSTRATE GLOBS, which are matched
// against repo-relative POSIX paths by `sandbox-guard`. A backslash reaching a glob would silently
// stop matching, so the canonical form is the one the globs need.

/**
 * Committed tier — the authored deliverable a teammate gets on `git pull`.
 *
 * Was `docs/shapeup-sdlc`. Moved out of `docs/` because many projects publish that directory
 * through a static-site generator, which either publishes the spec tree by accident or fails the
 * site build on it.
 */
export const SHARED = "shapeup";

/** Gitignored tier — run state for the machine that invoked the harness. Was `.shapeup-sdlc`. */
export const LOCAL = ".shapeup";

/**
 * The earlier roots. Nothing migrates a project off them any more;
 * `bin/init.mjs` writes ignore rules covering both so a checkout still carrying one cannot commit a
 * run trace. Nothing else should read these.
 */
export const LEGACY = { shared: "docs/shapeup-sdlc", local: ".shapeup-sdlc" };


// The run-trace builders for these two roots, from the core mechanism. `SHAPEUP_DECISIONS_PATH`
// redirects the decision ledger: this project's own test suite executes the real hooks, and without a
// redirect every `npm test` would append rows to the developer's live ledger, which would then be read
// back as evaluations from a real run.
export const shapeupTrace = runTrace({ shared: SHARED, local: LOCAL, decisionsEnv: "SHAPEUP_DECISIONS_PATH" });
export const {
  sharedDir, localDir, sharedRoot, localRoot, insideRunTrace, receipt, runArgsPath, ordersDir, resultsDir,
  dispatchReceipts, t0Dir, verdictsDir, trials, gates, activeScope, activeOrder, lastRun, decisions, metricsDir,
  metricsShard, relLocal, relShared, globLocal, globShared, readRunId, resolveRun, resolveRunId, projectRoot, decisionsPath,
  RECEIPT_FILE, RUN_ARGS_FILE, RUN_ID_PATTERN, compactStamp, mintRunId, runIdFromReceipt, readReceipt, runIdFromRoot,
} = shapeupTrace;

// ---------------------------------------------------------------------------
// SHARED — the deliverable
// ---------------------------------------------------------------------------

/** The committed spec tree — the evaluator's grading truth. */
export const specDir = (cwd, slug) => join(sharedRoot(cwd, slug), "spec");
/** Use-case directory inside the spec tree. */
export const usecasesDir = (cwd, slug) => join(specDir(cwd, slug), "usecases");
/** Shaping artifacts — pitch, framing, breadboard, baseline, glossary. `init run` looks here for a breadboard. */
export const shapingDir = (cwd, slug) => join(sharedRoot(cwd, slug), "shaping");
// The three contracts are markdown on disk and JSON on the wire — see
// `lib/contract.mjs`. `readContract()` accepts either extension, so a project mid-migration
// keeps working; these builders name the form the harness WRITES.

/** Scope contracts, one markdown file per vertical slice. */
export const scopesDir = (cwd, slug) => join(sharedRoot(cwd, slug), "scopes");
/** One scope contract by id. */
export const scopeContract = (cwd, slug, id) => join(scopesDir(cwd, slug), `${id}.md`);
/** The wiring map — engine → seam → entry-point call site → affordance. */
export const wiringMap = (cwd, slug) => join(sharedRoot(cwd, slug), "wiring-map.md");
/** Archetype + entry_point + the build and launch probes. */
export const projectProfile = (cwd, slug) => join(sharedRoot(cwd, slug), "project-profile.md");
/** The REQ clause registry that covers-closure checks against. */
export const requirements = (cwd, slug) => join(sharedRoot(cwd, slug), "requirements.md");
/** The frozen ship report, written once at GATE L4. */
export const report = (cwd, slug) => join(sharedRoot(cwd, slug), "REPORT.md");
/** Team-shared coaching rules, read back by the coachable workers, the plan activity and the loop at GATE L0. */
export const knowledgeBaseDir = (cwd) => join(sharedDir(cwd), "knowledge-base");
/** One reader's coaching file (a coachable worker, or the `plan` / `building` activity). */
export const knowledgeBase = (cwd, skill) => join(knowledgeBaseDir(cwd), `${skill}.md`);
// `.harness-version` and `.harness-migrations` were resolved here, committed by necessity as
// The third exception to the tier rule. Their sole writer was the upgrade path's data-migration runner, which
// has been removed; no code in the plugin has written either file since. The helpers went with
// them rather than remaining as resolvable paths to files nothing produces — a path helper is a
// claim that the file is part of the layout, and this one would have been false.


// ---------------------------------------------------------------------------
// LOCAL — Shape Up's run artifacts
// ---------------------------------------------------------------------------

/** The intake, verbatim, next to its digest in the receipt. */
export const intake = (cwd, slug) => join(localRoot(cwd, slug), "intake.md");
/** The breadboard the pitch was shaped with, verbatim, next to its digest in the receipt. */
export const breadboard = (cwd, slug) => join(localRoot(cwd, slug), "breadboard.md");
/** The run ledger — rounds, decisions, status frontmatter. */
export const harnessRun = (cwd, slug) => join(localRoot(cwd, slug), "harness-run.md");
/** The task board directory. */
export const tasksDir = (cwd, slug) => join(localRoot(cwd, slug), "tasks");
/** Evaluator output — report, evidence, verdict ledger. */
export const evaluationDir = (cwd, slug) => join(localRoot(cwd, slug), "evaluation");
/** QA hunt output. */
export const qaDir = (cwd, slug) => join(localRoot(cwd, slug), "qa");
/** Scout recon — code-surface map, spikes, discovered seed. */
export const orientDir = (cwd, slug) => join(localRoot(cwd, slug), "orient");
/** The discovered-task ledger every discovery flow appends to. */
export const discoveryLedger = (cwd, slug) => join(localRoot(cwd, slug), "discovery", "ledger.md");
/**
 * Spec WORKING NOTES — analysis that informed the contract but is not the contract. The committed
 * `spec/` keeps only what the evaluator grades against and a reviewer needs.
 */
export const workingDir = (cwd, slug) => join(localRoot(cwd, slug), "working");
/**
 * The stop step's census as DATA — `{verdict, cut_list, …}` — the one artifact the Ship Sign-off
 * resolver reads before it lets an answer say `ship`. The loop's printed blocks are prose; this file is
 * the same proposal in a shape a gate can read. (The file keeps its name from when a worker wrote it.)
 */
export const hammerCensus = (cwd, slug) => join(localRoot(cwd, slug), "reports", "hammer-census.json");
/** Human-authored safety escape hatch. LOCAL so no PR can widen another machine's envelope. */
export const safetyOverrides = (cwd) => join(localDir(cwd), "safety-overrides.json");
/**
 * The coaching file a coachable worker reads, as a repo-relative path for the WorkOrder payload.
 * @param {string} skill - A worker that reads a coaching file, or an activity name (`plan`, `building`).
 * @returns {string} e.g. `shapeup/knowledge-base/task-executor.md`.
 */
export const relKnowledgeBase = (skill) => [SHARED, "knowledge-base", `${skill}.md`].join("/");
