// paths — the single source of truth for where the harness writes.
//
// WHY THIS FILE EXISTS (measured by grepping the shipped tree, not theorized).
//
// The two storage roots were hard-coded in ~90 files, in TWO syntaxes that no single search finds:
//
//     "docs/shapeup-sdlc/<slug>/scopes/..."            568 string literals
//     join(cwd, "docs", "shapeup-sdlc", slug, ...)      48 segment-built sites
//
// A find/replace over the first set leaves the second silently pointing at the old root. That is
// the failure mode this project keeps rediscovering: a change that appears complete, produces no
// error, and is wrong — `lib/is-main.mjs` (a guard duplicated 18 times, inert under a symlink) and
// `lib/argv.mjs` (`rNaN-a1.json` written with exit 0) are the same defect at different layers. The
// remedy each time is to give the duplicated thing one home and add a test that no one may bypass
// it (`tests/structural/45-paths.mjs`, mirroring #11a).
//
// It also removes a live ambiguity. `gate-answers.mjs` resolved three candidate paths and
// `sandbox-guard.mjs` built a fourth independently; the same filename meant "my personal lane" at
// one path and "team policy" at another, auto-discovered with no flag (ADR-0001 §Context).
//
// TIER DISCIPLINE, restated here because this is where it becomes mechanical:
//   SHARED (committed) — prose a teammate reads: shaping, spec, contracts, requirements, report.
//   LOCAL (gitignored) — run state, envelopes, verification artifacts, machine policy.
// See docs/design/adr/0001-consumer-file-organization.md.
//
// Zero dependencies. Pure — every function takes `cwd` and returns a path; nothing here touches
// the filesystem, so importing this module can never have a side effect.

import { join } from "node:path";

// ---------------------------------------------------------------------------
// The two roots. Renaming a root is these two lines plus migration 0006.
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
 * site build on it (ADR-0001).
 */
export const SHARED = "shapeup";

/** Gitignored tier — run state for the machine that invoked the harness. Was `.shapeup-sdlc`. */
export const LOCAL = ".shapeup";

/**
 * The pre-ADR-0001 roots. Migration `0006` moves a project from these to the pair above;
 * `bin/init.mjs` writes ignore rules covering both so a half-migrated checkout cannot commit a
 * run trace. Nothing else should read these.
 */
export const LEGACY = { shared: "docs/shapeup-sdlc", local: ".shapeup-sdlc" };

// ---------------------------------------------------------------------------
// Roots
// ---------------------------------------------------------------------------

/**
 * The committed tier root.
 * @param {string} cwd - Project root.
 * @returns {string} `<cwd>/shapeup`.
 */
export const sharedDir = (cwd) => join(cwd, SHARED);

/**
 * The gitignored tier root.
 * @param {string} cwd - Project root.
 * @returns {string} `<cwd>/.shapeup`.
 */
export const localDir = (cwd) => join(cwd, LOCAL);

/**
 * A feature's committed root.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {string} `<cwd>/shapeup/<slug>`.
 */
export const sharedRoot = (cwd, slug) => join(cwd, SHARED, slug);

/**
 * A feature's run-trace root.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {string} `<cwd>/.shapeup/<slug>`.
 */
export const localRoot = (cwd, slug) => join(cwd, LOCAL, slug);

// ---------------------------------------------------------------------------
// SHARED — the deliverable
// ---------------------------------------------------------------------------

/** The committed spec tree — the evaluator's grading truth. */
export const specDir = (cwd, slug) => join(sharedRoot(cwd, slug), "spec");
/** Use-case directory inside the spec tree. */
export const usecasesDir = (cwd, slug) => join(specDir(cwd, slug), "usecases");
/** Shaping artifacts — pitch, framing, breadboard, baseline, glossary. */
export const shapingDir = (cwd, slug) => join(sharedRoot(cwd, slug), "shaping");
// The three contracts are markdown on disk and JSON on the wire (ADR-0001) — see
// `lib/contract-md.mjs`. `readContract()` accepts either extension, so a project mid-migration
// keeps working; these builders name the form the harness WRITES.

/** Scope contracts, one markdown file per vertical slice. */
export const scopesDir = (cwd, slug) => join(sharedRoot(cwd, slug), "scopes");
/** One scope contract by id. */
export const scopeContract = (cwd, slug, id) => join(scopesDir(cwd, slug), `${id}.md`);
/** The wiring map — engine → seam → entry-point call site → affordance. */
export const wiringMap = (cwd, slug) => join(sharedRoot(cwd, slug), "wiring-map.md");
/** Archetype + entry_point; gates the reachability arm of trace-lint. */
export const projectProfile = (cwd, slug) => join(sharedRoot(cwd, slug), "project-profile.md");
/** The REQ clause registry that covers-closure checks against. */
export const requirements = (cwd, slug) => join(sharedRoot(cwd, slug), "requirements.md");
/** Hill shards — mechanical phase per scope. */
export const hillDir = (cwd, slug) => join(sharedRoot(cwd, slug), "hill");
/** The frozen ship report, written once at GATE L4. */
export const report = (cwd, slug) => join(sharedRoot(cwd, slug), "REPORT.md");
/** Team-shared coaching rules, read back by the three coachable workers. */
export const knowledgeBaseDir = (cwd) => join(sharedDir(cwd), "knowledge-base");
/** One worker's coaching file. */
export const knowledgeBase = (cwd, skill) => join(knowledgeBaseDir(cwd), `${skill}.md`);
/** Migration bookkeeping — committed by necessity (ADR-0001 exception 3). */
export const harnessVersion = (cwd) => join(sharedDir(cwd), ".harness-version");
/** Applied-migration record — committed by necessity (ADR-0001 exception 3). */
export const harnessMigrations = (cwd) => join(sharedDir(cwd), ".harness-migrations");

// ---------------------------------------------------------------------------
// LOCAL — run state
// ---------------------------------------------------------------------------

/** The run receipt — the mechanical fact that a run started (GATE L0.1). */
export const receipt = (cwd, slug) => join(localRoot(cwd, slug), "receipt.json");
/** The intake, verbatim, next to its digest in the receipt. */
export const intake = (cwd, slug) => join(localRoot(cwd, slug), "intake.md");
/** The run ledger — rounds, decisions, status frontmatter. */
export const harnessRun = (cwd, slug) => join(localRoot(cwd, slug), "harness-run.md");
/** File-derived mid-run digest, frozen before compaction. */
export const runSnapshot = (cwd, slug) => join(localRoot(cwd, slug), "run-snapshot.json");
/** The task board directory. */
export const tasksDir = (cwd, slug) => join(localRoot(cwd, slug), "tasks");
/** The board index. */
export const boardIndex = (cwd, slug) => join(tasksDir(cwd, slug), "_index.md");
/** Compiled WorkOrders. */
export const ordersDir = (cwd, slug) => join(localRoot(cwd, slug), "orders");
/** Returned WorkResults. */
export const resultsDir = (cwd, slug) => join(localRoot(cwd, slug), "results");
/** T0 verification artifacts. */
export const t0Dir = (cwd, slug) => join(localRoot(cwd, slug), "t0");
/** Immutable per-attempt verdict artifacts the evaluator must cite. */
export const verdictsDir = (cwd, slug) => join(t0Dir(cwd, slug), "verdicts");
/** The append-only trial ledger the ratchet reduces over. */
export const trials = (cwd, slug) => join(t0Dir(cwd, slug), "trials.jsonl");
/** Finished-scope fixture registry for the seesaw regression check. */
export const seesawRegistry = (cwd, slug) => join(localRoot(cwd, slug), "seesaw", "registry.json");
/** Evaluator output — report, evidence, verdict ledger. */
export const evaluationDir = (cwd, slug) => join(localRoot(cwd, slug), "evaluation");
/** QA hunt output. */
export const qaDir = (cwd, slug) => join(localRoot(cwd, slug), "qa");
/** Scout recon — code-surface map, spikes, discovered seed. */
export const orientDir = (cwd, slug) => join(localRoot(cwd, slug), "orient");
/** Time-boxed spike workspace. */
export const spikesDir = (cwd, slug) => join(localRoot(cwd, slug), "spikes");
/** Covers-closure + reachability run trace. */
export const traceDir = (cwd, slug) => join(localRoot(cwd, slug), "trace");
/** The discovered-task ledger every discovery flow appends to. */
export const discoveryLedger = (cwd, slug) => join(localRoot(cwd, slug), "discovery", "ledger.md");
/** Queued worker escalations awaiting adjudication. */
export const escalatesDir = (cwd, slug) => join(localRoot(cwd, slug), "escalates");
/**
 * Adjudicated decisions, read back by `compile-order` as binding precedent.
 *
 * LOCAL since ADR-0001. It was committed, and it is appended to DURING a build round — so a run
 * left the working tree dirty in the deliverable tier while it was still building. Its
 * conclusions reach the team in `REPORT.md` at GATE L4 instead, frozen once.
 */
export const roundLedger = (cwd, slug) => join(localRoot(cwd, slug), "round-ledger.md");

/**
 * Spec WORKING NOTES — analysis that informed the contract but is not the contract.
 *
 * `synthesis.md`, `assess-report.md`, `feedback.md`, `api-feasibility.md`, `integration.md`. The
 * committed `spec/` keeps only what the evaluator grades against and a reviewer needs (ADR-0001
 * "contract vs working artifact").
 */
export const workingDir = (cwd, slug) => join(localRoot(cwd, slug), "working");

// --- checkout-wide ---------------------------------------------------------

/** The pointer the sandbox guard reads to answer "which scope is checked out?". */
export const activeScope = (cwd) => join(localDir(cwd), "active-scope");
/** Hook receipts — one row per evaluation, so `allow` carries evidence. */
export const decisions = (cwd) => join(localDir(cwd), "decisions.jsonl");
/** Human-authored safety escape hatch. LOCAL so no PR can widen another machine's envelope. */
export const safetyOverrides = (cwd) => join(localDir(cwd), "safety-overrides.json");
/**
 * Telemetry shards.
 *
 * LOCAL since ADR-0001. Committed, they put `process.env.HOSTNAME` — a person's laptop name —
 * into the repository, and append-only JSONL in git only grows. The cost, stated plainly: with
 * these local, `stats.mjs` becomes a personal tool and "is the KB flywheel working across the
 * team?" is no longer answerable from the repo.
 */
export const metricsDir = (cwd) => join(localDir(cwd), "metrics");
/** This machine's telemetry shard. */
export const metricsShard = (cwd, id = process.env.HOSTNAME || "local") =>
  join(metricsDir(cwd), `${id}.jsonl`);
/** Archived pitches. */
export const pitchArchiveDir = (cwd) => join(localDir(cwd), "pitch-archive");

/**
 * Gate answer sets, in resolution order (first hit wins).
 *
 * ONE TIER ONLY, since ADR-0001. There used to be a third candidate — a COMMITTED
 * `gate-answers.json`, auto-discovered with no flag — so a file with `preset: ci` pre-approved
 * GATE L4 ship sign-off for everyone who pulled the repo, and the same filename meant "my
 * personal lane" at one path and "team policy" at another. Consent is now per-machine by
 * construction: no committed file can cross a gate on another person's behalf.
 *
 * @param {string} cwd - Project root.
 * @param {(string|null)} [slug] - Feature slug; adds the per-run candidate when given.
 * @returns {string[]} Candidate paths, most specific first.
 */
export const gateAnswerCandidates = (cwd, slug = null) => [
  ...(slug ? [join(localRoot(cwd, slug), "gate-answers.json")] : []),
  join(localDir(cwd), "gate-answers.json"),
];

// ---------------------------------------------------------------------------
// Relative forms — for messages, receipts and anything a human reads
// ---------------------------------------------------------------------------

/**
 * A run-trace path relative to the project root, for display.
 * @param {string} slug - Feature slug.
 * @param {...string} parts - Path segments under the feature's local root.
 * @returns {string} e.g. `.shapeup/checkout/t0/verdicts`.
 */
export const relLocal = (slug, ...parts) => join(LOCAL, slug, ...parts);

/**
 * A deliverable path relative to the project root, for display.
 * @param {string} slug - Feature slug.
 * @param {...string} parts - Path segments under the feature's shared root.
 * @returns {string} e.g. `shapeup/checkout/spec`.
 */
export const relShared = (slug, ...parts) => join(SHARED, slug, ...parts);

// ---------------------------------------------------------------------------
// Glob forms — substrate whitelists, matched against repo-relative POSIX paths
// ---------------------------------------------------------------------------

/**
 * A run-trace glob. Always POSIX-separated: `sandbox-guard` matches these against
 * `path.relative()` output normalised to forward slashes, so a `join()` here would stop matching
 * on Windows without any error to notice.
 * @param {string} slug - Feature slug.
 * @param {...string} parts - Glob segments under the feature's local root.
 * @returns {string} e.g. `.shapeup-sdlc/checkout/tasks/**`.
 */
export const globLocal = (slug, ...parts) => [LOCAL, slug, ...parts].join("/");

/**
 * A deliverable glob, POSIX-separated for the same reason as {@link globLocal}.
 * @param {string} slug - Feature slug.
 * @param {...string} parts - Glob segments under the feature's shared root.
 * @returns {string} e.g. `docs/shapeup-sdlc/checkout/scopes/*.json`.
 */
export const globShared = (slug, ...parts) => [SHARED, slug, ...parts].join("/");

/**
 * The coaching file a coachable worker reads, as a repo-relative path for the WorkOrder payload.
 * @param {string} skill - Worker name (task-executor | ba-pitch-analyzer | qa-edge-hunter).
 * @returns {string} e.g. `docs/shapeup-sdlc/knowledge-base/task-executor.md`.
 */
export const relKnowledgeBase = (skill) => [SHARED, "knowledge-base", `${skill}.md`].join("/");
