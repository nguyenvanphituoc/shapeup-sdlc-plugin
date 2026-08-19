// paths — where the harness writes, and which run a record belongs to.
//
// CONTRACT. Every generated path in this plugin resolves through this module; nothing else may
// spell a storage root. The structural suite enforces that, because a root hard-coded in two
// syntaxes (a string literal and a `join(cwd, "…", …)` chain) is a rename that no single search
// completes.
//
// TIER DISCIPLINE (ADR-0001), the reason there are two roots:
//   SHARED (committed) — prose a teammate reads: shaping, spec, contracts, requirements, report.
//   LOCAL (gitignored) — run state, envelopes, verification artifacts, machine policy.
//
// RUN KEY. The bottom half of this file mints and reads `run_id`, the only field that separates
// two runs of the same feature — `order_id`, round and attempt all repeat. It lives here because a
// run key is an addressing question, and because every reader of it also needs a path.
//
// Zero dependencies. The path half is pure — every function takes `cwd` and returns a string,
// touching no filesystem. The run-key half reads receipts and fails open (`null`, never a throw),
// because hooks call it and telemetry must never break a tool call.

import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

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
// `lib/contract.mjs`. `readContract()` accepts either extension, so a project mid-migration
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
// `.harness-version` and `.harness-migrations` were resolved here, committed by necessity as
// ADR-0001's third exception. Their sole writer was the upgrade path's data-migration runner, which
// has been removed; no code in the plugin has written either file since. The helpers went with
// them rather than remaining as resolvable paths to files nothing produces — a path helper is a
// claim that the file is part of the layout, and this one would have been false.

// ---------------------------------------------------------------------------
// LOCAL — run state
// ---------------------------------------------------------------------------

/**
 * The receipt's filename, as a constant rather than a literal at each call site.
 *
 * {@link runIdFromRoot} resolves a receipt from a run root it was handed directly (`verify t0` gets
 * `--out <run root>` and never derives a slug), so it cannot go through {@link receipt}, which
 * takes `(cwd, slug)`.
 */
export const RECEIPT_FILE = "receipt.json";

/** The run receipt — the mechanical fact that a run started (GATE L0.1). */
export const receipt = (cwd, slug) => join(localRoot(cwd, slug), RECEIPT_FILE);
/** The intake, verbatim, next to its digest in the receipt. */
export const intake = (cwd, slug) => join(localRoot(cwd, slug), "intake.md");
/** The run ledger — rounds, decisions, status frontmatter. */
export const harnessRun = (cwd, slug) => join(localRoot(cwd, slug), "harness-run.md");
/** File-derived mid-run digest, frozen by `reduce snapshot --write` as an audit anchor. */
export const runSnapshot = (cwd, slug) => join(localRoot(cwd, slug), "run-snapshot.json");
/** The task board directory. */
export const tasksDir = (cwd, slug) => join(localRoot(cwd, slug), "tasks");
/** The board index. */
export const boardIndex = (cwd, slug) => join(tasksDir(cwd, slug), "_index.md");
/** Compiled WorkOrders. */
export const ordersDir = (cwd, slug) => join(localRoot(cwd, slug), "orders");
/** Returned WorkResults. */
export const resultsDir = (cwd, slug) => join(localRoot(cwd, slug), "results");
/**
 * Dispatch receipts — the attestation that the SHIPPED skill ran, one appended row per dispatch.
 *
 * IT HAS ITS OWN DIRECTORY, and that is not tidiness. A receipt filed as a sibling of the order it
 * answers (`orders/orient.receipt.json`) would land inside a directory three readers enumerate —
 * `probe resume`, `reduce graph` and `report export` all `readdirSync` `orders/` — where it survives
 * today only because each of them happens to filter `.json`. `orient.receipt.json` passes that
 * filter and becomes a bogus `Order` node in the run graph. A separate directory means no future
 * reader has to know this file exists.
 *
 * IT IS APPEND-ONLY JSONL, not one file per order, for the same reason `trials.jsonl` is: order
 * paths repeat (`orders/orient.json` is re-dispatched verbatim on a relaunch) and scopes dispatch
 * concurrently. One small `O_APPEND` line per dispatch needs no lock and loses no history, where a
 * per-order file would silently overwrite the very staleness the reader has to detect.
 *
 * (`receipt`, above, is the RUN receipt — a different fact, hence the different name.)
 */
export const dispatchReceipts = (cwd, slug) => join(localRoot(cwd, slug), "receipts", "dispatch.jsonl");
/**
 * Leg-completion rows — the moment a dispatched leg was closed by the reducer.
 *
 * WHY IT IS A SEPARATE LEDGER FROM {@link dispatchReceipts}. A dispatch receipt is written by a
 * `PostToolUse` hook, which fires when the skill RESOLVES — measured across archived runs, 1.8 to
 * 47 seconds after the order was compiled, on legs that then ran for minutes. So the receipt is a
 * hook-attested START and there is no end anywhere in the record set: concurrency and span are
 * guesses without one. This ledger is the end, written by the one component that closes a leg.
 *
 * WHY IT SNAPSHOTS RATHER THAN POINTS. A row carries the order's `compiled_at` as a VALUE, not a
 * path to read it from later. Order paths are reused verbatim on relaunch, so the `compiled_at` in
 * `orders/<id>.json` is the LAST compile's; a row that deferred to the file would silently re-date
 * itself to a dispatch that is not the one it recorded.
 *
 * APPEND-ONLY JSONL, for the same two reasons `dispatch.jsonl` is: order ids repeat across
 * relaunches and rounds, and scopes close concurrently. One `O_APPEND` line needs no lock.
 *
 * A LEG THAT DIES LEAVES NO ROW, deliberately. The absence is the fact — a reader compares starts
 * to completions and reports the hole rather than averaging over it.
 */
export const legLedger = (cwd, slug) => join(localRoot(cwd, slug), "legs.jsonl");
/** T0 verification artifacts. */
export const t0Dir = (cwd, slug) => join(localRoot(cwd, slug), "t0");
/** Immutable per-attempt verdict artifacts the evaluator must cite. */
export const verdictsDir = (cwd, slug) => join(t0Dir(cwd, slug), "verdicts");
/** The append-only trial ledger the ratchet reduces over. */
export const trials = (cwd, slug) => join(t0Dir(cwd, slug), "trials.jsonl");
/**
 * The gate-crossing ledger — one append-only row per resolved gate, written by `kernel/gate.mjs`.
 *
 * `resolve()` in `gate.mjs` has always computed a `ledger_row` string but never persisted it, so a
 * gate crossing left no durable trace for the run graph to project a `GateDecision` node from. This
 * is that write's home: same tier, same append-only-JSONL shape as {@link trials} and
 * {@link decisions}, one small file with one writer.
 */
export const gates = (cwd, slug) => join(localRoot(cwd, slug), "gates.jsonl");
/** Finished-scope fixture registry for the seesaw regression check. */
export const seesawRegistry = (cwd, slug) => join(localRoot(cwd, slug), "seesaw", "registry.json");
/** Evaluator output — report, evidence, verdict ledger. */
export const evaluationDir = (cwd, slug) => join(localRoot(cwd, slug), "evaluation");
/** The workflow launcher's run directory — `journal.jsonl` and the launch `result.json`. */
export const workflowRunDir = (cwd, slug) => join(localRoot(cwd, slug), "workflow-run");
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

/**
 * The RUN pointer — "which run is open in this checkout?" — written once by ``harness init run``.
 *
 * IT NO LONGER NAMES A SCOPE, and the name is the last trace of what it used to be. It was the
 * branch-per-scope substrate pointer, rewritten as each scope was checked out, and a single mutable
 * pointer cannot survive scopes building side by side: the last writer wins it and another leg's
 * write is then judged against the wrong contract. That pointer is gone — the writer that moved it
 * was removed, and `sandbox-guard` resolves the LIVE ORDER SET instead, which is why the guard is
 * unaffected by this file's presence or absence.
 *
 * What is left is written once, at run open, and never moved again, so it is not a concurrency
 * hazard. Its readers all degrade rather than fail without it: the budget check and the snapshot
 * both fall back to scanning for a receipt or a mid-run ledger, and `report export` refuses with
 * instructions rather than guessing. The one thing it uniquely supplies is the slug that
 * {@link resolveRunId} turns into a `run_id` for callers that were handed no slug — hook decision
 * rows, above all, which without it are written unjoinable to any run.
 */
export const activeScope = (cwd) => join(localDir(cwd), "active-scope");
/** The pointer the sandbox guard reads to answer "which order is executing?". */
export const activeOrder = (cwd) => join(localDir(cwd), "active-order");
/** Hook receipts — one row per evaluation, so `allow` carries evidence. */
export const decisions = (cwd) => join(localDir(cwd), "decisions.jsonl");
/** Human-authored safety escape hatch. LOCAL so no PR can widen another machine's envelope. */
export const safetyOverrides = (cwd) => join(localDir(cwd), "safety-overrides.json");
/**
 * Telemetry shards.
 *
 * LOCAL since ADR-0001. Committed, they put `process.env.HOSTNAME` — a person's laptop name —
 * into the repository, and append-only JSONL in git only grows. The cost, stated plainly: with
 * these local, ``harness probe stats`` becomes a personal tool and "is the KB flywheel working across the
 * team?" is no longer answerable from the repo.
 */
export const metricsDir = (cwd) => join(localDir(cwd), "metrics");
/** This machine's telemetry shard. */
export const metricsShard = (cwd, id = process.env.HOSTNAME || "local") =>
  join(metricsDir(cwd), `${id}.jsonl`);

/**
 * The default landing tier for exported run records — the analysis plane's staging area.
 *
 * DELIBERATELY LOCAL, and the trade-off is stated rather than dodged. The run trace it reads from
 * (`.shapeup/<slug>/`) is regenerable and gets wiped per-slug; an export keyed by run id survives
 * that, which is the failure this directory closes. What it does NOT do is cross a machine
 * boundary: making it SHARED would put per-run structured data and a machine id back in the
 * repository, which is exactly what ADR-0001 moved the metrics shards out of git to prevent. A
 * cross-machine warehouse is therefore an explicit `--out <dir>` to a destination the operator
 * owns, never a default that commits telemetry on their behalf.
 */
export const exportsDir = (cwd) => join(localDir(cwd), "exports");

/** One exported run's table directory, keyed by the run id (see {@link mintRunId}). */
export const exportRunDir = (cwd, runId) => join(exportsDir(cwd), String(runId ?? "unkeyed"));
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
 * @returns {string} e.g. `shapeup/checkout/scopes/*.md`.
 */
export const globShared = (slug, ...parts) => [SHARED, slug, ...parts].join("/");

/**
 * The coaching file a coachable worker reads, as a repo-relative path for the WorkOrder payload.
 * @param {string} skill - Worker name (task-executor | ba-pitch-analyzer | qa-edge-hunter).
 * @returns {string} e.g. `shapeup/knowledge-base/task-executor.md`.
 */
export const relKnowledgeBase = (skill) => [SHARED, "knowledge-base", `${skill}.md`].join("/");


// ---------------------------------------------------------------------------
// The run key — `<slug>-<YYYYMMDDTHHMMSSZ>-<8 hex>`.
// ---------------------------------------------------------------------------
//
// DERIVED, NEVER DRAWN. `randomUUID()` would be one line and would forfeit re-derivability: a
// random key exists only where it was first written, so a record that missed the stamp could never
// be joined afterwards. This id is a pure function of three fields the receipt already holds —
// slug, started_at, intake_sha256 — so every writer that can see the receipt computes the same id,
// and runs that predate the field are backfillable.
//
// Slug first because it is the aggregate root every path is already keyed off; timestamp second so
// a lexical sort within a slug is chronological; hash last as the tiebreak. Filesystem-safe by
// construction — the export tier uses it as a directory name.


/**
 * The id's shape, as one regex. Exported so the schema, the tests and the export tier check the
 * same pattern instead of three drifting copies of it.
 */
export const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]*-\d{8}T\d{6}Z-[0-9a-f]{8}$/;

/**
 * Compact an ISO timestamp into the id's sortable middle segment.
 * @param {string} iso - An ISO-8601 timestamp, e.g. `2026-08-13T09:12:33.456Z`.
 * @returns {(string|null)} e.g. `20260813T091233Z`, or null when the input is not ISO-shaped.
 */
export function compactStamp(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6]}Z` : null;
}

/**
 * Mint the run key from the three receipt fields it is a function of.
 *
 * Pure and total: same inputs → same id, on every machine and at any later date. That is what makes
 * an unstamped record joinable after the fact.
 *
 * @param {object} o - The identity inputs (destructured):
 * @param {string} o.slug - The feature slug — the aggregate root, and the id's partition prefix.
 * @param {string} o.startedAt - The run's ISO start time (`receipt.started_at`).
 * @param {string} [o.intakeSha256=""] - The intake digest, which separates two runs of the same
 *   slug started in the same second.
 * @returns {(string|null)} `<slug>-<YYYYMMDDTHHMMSSZ>-<8 hex>`, or null when slug or timestamp is
 *   missing or malformed — never a partial id, which would join wrongly rather than not at all.
 */
export function mintRunId({ slug, startedAt, intakeSha256 = "" }) {
  const stamp = compactStamp(startedAt);
  const clean = String(slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
  if (!clean || !stamp) return null;
  // NUL as the field separator — it cannot occur in a slug, an ISO timestamp or a hex digest, so
  // no two different field triples can concatenate to the same string. Written as the ESCAPE
  // `\u0000`, never as a literal control byte: a source file carrying a raw NUL is classified as
  // binary, and every line-oriented tool — `grep -r`, a diff viewer, this repo's own
  // non-delivered-content sweep — skips it in silence. A file no grep can see is a file no audit
  // can check, and this one hid a real finding until it was read another way.
  const h = createHash("sha256")
    .update(`${clean}\u0000${startedAt}\u0000${intakeSha256 ?? ""}`, "utf8")
    .digest("hex").slice(0, 8);
  return `${clean}-${stamp}-${h}`;
}

/**
 * The run key for a parsed receipt — stamped if present, minted if not.
 *
 * The backfill branch is the load-bearing one: a receipt written before this field existed still
 * yields the id it would have been given, so the export tier can key runs it never stamped.
 *
 * @param {(object|null)} r - A parsed `receipt.json`.
 * @returns {(string|null)} The run key, or null when the receipt is absent or lacks identity fields.
 */
export function runIdFromReceipt(r) {
  if (!r || typeof r !== "object") return null;
  if (typeof r.run_id === "string" && RUN_ID_PATTERN.test(r.run_id)) return r.run_id;
  return mintRunId({ slug: r.slug, startedAt: r.started_at, intakeSha256: r.intake_sha256 });
}

/**
 * Read a receipt from disk without throwing.
 * @param {string} path - Path to a `receipt.json`.
 * @returns {(object|null)} The parsed receipt, or null when missing or unparseable.
 */
export function readReceipt(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

/**
 * The run key for a run whose LOCAL root is known directly.
 *
 * ``harness verify t0`` is the caller this exists for: it is handed the run root as `--out` and never
 * derives a slug, so asking it for one would mean inferring identity from a directory name.
 *
 * @param {string} runRoot - The feature's LOCAL root, e.g. `<cwd>/.shapeup/<slug>`.
 * @returns {(string|null)} The run key, or null when no readable receipt lives there.
 */
export function runIdFromRoot(runRoot) {
  return runIdFromReceipt(readReceipt(join(runRoot, RECEIPT_FILE)));
}

/**
 * The run key for a feature slug under a project root.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {(string|null)} The run key, or null when that run has no readable receipt.
 */
export function readRunId(cwd, slug) {
  return runIdFromReceipt(readReceipt(receipt(cwd, slug)));
}

/**
 * Best-effort run key for a caller that may not know the slug — the shape hooks need.
 *
 * Resolution order: the slug it was given, else the `active-scope` pointer ``harness init run`` writes.
 * A hook firing outside any run resolves to null, which is the correct answer and not an error:
 * "this row belongs to no run" is a fact the warehouse must be able to record.
 *
 * @param {string} cwd - Project root.
 * @param {(string|null)} [slug=null] - Feature slug when the caller already knows it.
 * @returns {(string|null)} The run key, or null when no run is active or readable.
 */
export function resolveRunId(cwd, slug = null) {
  if (slug) return readRunId(cwd, slug);
  try {
    const ptr = JSON.parse(readFileSync(activeScope(cwd), "utf8"));
    return ptr?.slug ? readRunId(cwd, ptr.slug) : null;
  } catch { return null; }
}
