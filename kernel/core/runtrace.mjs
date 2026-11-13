// runtrace — where a run writes, and which run a record belongs to, for whatever tier names it is given.
//
// The mechanism only: `runTrace({ shared, local, decisionsEnv })` returns the path builders every
// run-trace file resolves through — receipt, launch record, orders, results, dispatch receipts, the T0
// ledgers, the gate ledger, the run pointers, the decision ledger, the run key and the project-root
// probe — over a committed root and a gitignored root the caller names. Nothing here knows what either
// root is called or what a workflow keeps under them beyond the run trace; a workflow's own artifacts
// are the adapter's to name.
//
// TIER DISCIPLINE, the reason there are two roots:
//   shared (committed) — prose a teammate reads.
//   local (gitignored) — run state, envelopes, verification artifacts, machine policy.
//
// RUN KEY. `run_id` is the only field that separates two runs of the same feature — `order_id`, round
// and attempt all repeat. It lives here because a run key is an addressing question, and because every
// reader of it also needs a path.
//
// Zero dependencies. The path half is pure — every function takes `cwd` and returns a string,
// touching no filesystem. The run-key half reads receipts and fails open (`null`, never a throw),
// because hooks call it and telemetry must never break a tool call. Both roots are POSIX strings,
// deliberately: they are fed to `join()` and interpolated into substrate globs matched against
// repo-relative POSIX paths, and a backslash reaching a glob would silently stop matching.

import { join, resolve, dirname, sep } from "node:path";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";

/**
 * The receipt's filename, as a constant rather than a literal at each call site: {@link runIdFromRoot}
 * resolves a receipt from a run root it was handed directly (`verify t0` gets `--out <run root>` and
 * never derives a slug), so it cannot go through `receipt`, which takes `(cwd, slug)`.
 */
export const RECEIPT_FILE = "receipt.json";
/** The launch record's filename: the writer and every reader resolve it the same way a bare run root is resolved. */
export const RUN_ARGS_FILE = "run-args.json";

/** The run id's shape, as one regex, so the schema, the tests and the export tier check the same pattern. */
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
 * Mint the run key — `<slug>-<YYYYMMDDTHHMMSSZ>-<8 hex>` — from the three receipt fields it is a function of.
 *
 * DERIVED, NEVER DRAWN. A random key exists only where it was first written, so a record that missed
 * the stamp could never be joined afterwards; this id is a pure function of slug, started_at and the
 * intake digest, so every writer that can see the receipt computes the same id and older runs are
 * backfillable. Slug first because it is the aggregate root; timestamp second so a lexical sort within
 * a slug is chronological; hash last as the tiebreak. Filesystem-safe by construction.
 *
 * @param {object} o - The identity inputs (destructured):
 * @param {string} o.slug - The feature slug.
 * @param {string} o.startedAt - The run's ISO start time (`receipt.started_at`).
 * @param {string} [o.intakeSha256=""] - The intake digest, which separates two runs of one slug started in the same second.
 * @returns {(string|null)} The id, or null when slug or timestamp is missing or malformed — never a partial id, which would join wrongly rather than not at all.
 */
export function mintRunId({ slug, startedAt, intakeSha256 = "" }) {
  const stamp = compactStamp(startedAt);
  const clean = String(slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
  if (!clean || !stamp) return null;
  // NUL as the field separator — it cannot occur in a slug, an ISO timestamp or a hex digest, so no two
  // different field triples concatenate to the same string. Written as the ESCAPE `\u0000`, never as a
  // literal control byte: a source file carrying a raw NUL is classified as binary and every
  // line-oriented tool skips it in silence.
  const h = createHash("sha256").update(`${clean}\u0000${startedAt}\u0000${intakeSha256 ?? ""}`, "utf8").digest("hex").slice(0, 8);
  return `${clean}-${stamp}-${h}`;
}

/**
 * The run key for a parsed receipt — stamped if present, minted if not (the backfill branch is the
 * load-bearing one: a receipt written before the field existed still yields the id it would have had).
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
 * The run key for a run whose local root is known directly (`verify t0` is handed the run root as
 * `--out` and never derives a slug, so asking it for one would mean inferring identity from a directory name).
 * @param {string} runRoot - The feature's local root.
 * @returns {(string|null)} The run key, or null when no readable receipt lives there.
 */
export function runIdFromRoot(runRoot) {
  return runIdFromReceipt(readReceipt(join(runRoot, RECEIPT_FILE)));
}

/**
 * The path builders for one pair of tier roots.
 * @param {object} o - Destructured:
 * @param {string} o.shared - The committed root, relative to the project (POSIX).
 * @param {string} o.local - The gitignored root, relative to the project (POSIX).
 * @param {string} [o.decisionsEnv] - Name of an environment variable that redirects the decision ledger (a test suite's own runs must not write into a developer's live ledger).
 * @returns {object} The builders, plus the run-key functions that need them.
 */
export function runTrace({ shared, local, decisionsEnv }) {
  const sharedDir = (cwd) => join(cwd, shared);
  const localDir = (cwd) => join(cwd, local);
  const sharedRoot = (cwd, slug) => join(cwd, shared, slug);
  const localRoot = (cwd, slug) => join(cwd, local, slug);
  /**
   * Whether a working directory is inside a run trace. A kernel command resolves every path from the
   * working directory, so run from inside the trace it would open a second, empty run nested in the
   * first and write its records there; the commands that write run state refuse instead.
   */
  const insideRunTrace = (cwd) => resolve(cwd).split(sep).includes(local);

  const receipt = (cwd, slug) => join(localRoot(cwd, slug), RECEIPT_FILE);
  const runArgsPath = (cwd, slug) => join(localRoot(cwd, slug), RUN_ARGS_FILE);
  /** Compiled WorkOrders. */
  const ordersDir = (cwd, slug) => join(localRoot(cwd, slug), "orders");
  /** Returned WorkResults. */
  const resultsDir = (cwd, slug) => join(localRoot(cwd, slug), "results");
  /**
   * Dispatch receipts — one appended row per dispatch. IT HAS ITS OWN DIRECTORY: a receipt filed beside
   * the order it answers would land inside a directory other readers enumerate and become a bogus node.
   * IT IS APPEND-ONLY JSONL, because order paths repeat and scopes dispatch concurrently: one small
   * `O_APPEND` line per dispatch needs no lock and loses no history. (`receipt` is the RUN receipt.)
   */
  const dispatchReceipts = (cwd, slug) => join(localRoot(cwd, slug), "receipts", "dispatch.jsonl");
  /** T0 verification artifacts. */
  const t0Dir = (cwd, slug) => join(localRoot(cwd, slug), "t0");
  /** Immutable per-attempt verdict artifacts the evaluator must cite. */
  const verdictsDir = (cwd, slug) => join(t0Dir(cwd, slug), "verdicts");
  /** The append-only trial ledger the ratchet reduces over. */
  const trials = (cwd, slug) => join(t0Dir(cwd, slug), "trials.jsonl");
  /** The gate-crossing ledger — one append-only row per resolved gate. */
  const gates = (cwd, slug) => join(localRoot(cwd, slug), "gates.jsonl");

  /**
   * The RUN pointer — "which run is open in this checkout?" — written once when a run opens. It names a
   * run, never a scope or a live dispatch; its readers all degrade rather than fail without it, and the
   * one thing it uniquely supplies is the slug {@link resolveRun} turns into a `run_id` for callers
   * handed no slug (hook decision rows above all).
   */
  const activeScope = (cwd) => join(localDir(cwd), "active-scope");
  /**
   * The pointer that tells the write fence WHICH RUN it is fencing. It names a run, not a live
   * dispatch: liveness is derived from the run's order set, never from this file, because this pointer
   * has one writer and no natural eraser. Closing a run retires it.
   */
  const activeOrder = (cwd) => join(localDir(cwd), "active-order");
  /**
   * The run a terminal close just ended — `{slug, run_id, closed_at, closed_status}`, left in the same
   * act that retires the run pointers, so the decisions taken after the close (the stretch that decides
   * the most) still join to the run. It names a run and never arms anything.
   */
  const lastRun = (cwd) => join(localDir(cwd), "last-run");
  /** Hook receipts — one row per evaluation, so `allow` carries evidence. */
  const decisions = (cwd) => join(localDir(cwd), "decisions.jsonl");
  /** Telemetry shards: local, because committed they would put a person's machine name into the repository. */
  const metricsDir = (cwd) => join(localDir(cwd), "metrics");
  const metricsShard = (cwd, id = process.env.HOSTNAME || "local") => join(metricsDir(cwd), `${id}.jsonl`);

  /** A run-trace path relative to the project root, for display. */
  const relLocal = (slug, ...parts) => join(local, slug, ...parts);
  /** A deliverable path relative to the project root, for display. */
  const relShared = (slug, ...parts) => join(shared, slug, ...parts);
  /** A run-trace glob, always POSIX-separated: the fence matches these against `path.relative()` output normalised to forward slashes. */
  const globLocal = (slug, ...parts) => [local, slug, ...parts].join("/");
  /** A deliverable glob, POSIX-separated for the same reason. */
  const globShared = (slug, ...parts) => [shared, slug, ...parts].join("/");

  /** The run key for a feature slug under a project root. */
  const readRunId = (cwd, slug) => runIdFromReceipt(readReceipt(receipt(cwd, slug)));

  /**
   * The run key AND where it came from. Resolution order: the slug the caller knows (`slug`); else the
   * run pointer (`pointer`); else the breadcrumb the last terminal close left (`closed`); else `null`,
   * which is "no run" and a real answer. A key resolved through the breadcrumb is a key to a run that
   * is OVER, and the caller records that rather than presenting the two the same way.
   * @returns {{run_id:(string|null), source:("slug"|"pointer"|"closed"|null)}}
   */
  const resolveRun = (cwd, slug = null) => {
    if (slug) return { run_id: readRunId(cwd, slug), source: "slug" };
    try {
      const ptr = JSON.parse(readFileSync(activeScope(cwd), "utf8"));
      if (ptr?.slug) return { run_id: readRunId(cwd, ptr.slug), source: "pointer" };
    } catch { /* no live run — fall through to the breadcrumb */ }
    try {
      const crumb = JSON.parse(readFileSync(lastRun(cwd), "utf8"));
      if (typeof crumb?.run_id === "string" && crumb.run_id) return { run_id: crumb.run_id, source: "closed" };
    } catch { /* no close on record either */ }
    return { run_id: null, source: null };
  };
  const resolveRunId = (cwd, slug = null) => resolveRun(cwd, slug).run_id;

  /**
   * The project root a hook should file under, from wherever the tool call happened to fire.
   *
   * THE HOOK PAYLOAD'S `cwd` FOLLOWS THE SHELL, NOT THE PROJECT. A worker that `cd`s into a sub-folder
   * fires every later hook with that folder as `cwd`; read as the project root, that started a fresh
   * decision ledger in the sub-folder and made the write fence fail open on every write from that shell,
   * since the run pointer it fences from was not beside it. So the root is FOUND: walk up from `cwd` to
   * the nearest ancestor that carries a run pointer, the committed tier, or a git boundary. A bare local
   * root is deliberately NOT a marker, because the stray ledgers this fixes are exactly what would create one.
   *
   * A COMMITTED TIER ALONE DOES NOT END THE SEARCH: a folder inside the project can carry a committed
   * tier and be no project at all (a copy of a plugin, a vendored package). So when the nearest marker
   * is a committed tier and nothing else, the climb goes on looking for a run pointer, and one found that
   * way is the root. Two things stop that second climb, both failing open: a git boundary (a nested
   * repository is somebody's separate project), and a pointer in a folder that is no project by the same
   * markers. No marker anywhere returns `cwd` unchanged. Never throws.
   */
  const projectRoot = (cwd) => {
    let start;
    try { start = resolve(cwd || process.cwd()); } catch { return cwd; }
    const probe = (test) => (dir) => { try { return test(dir); } catch { return false; } };   // an unreadable ancestor has no marker
    const pointer = probe((dir) => existsSync(activeScope(dir)));
    const tier = probe((dir) => statSync(sharedDir(dir)).isDirectory());
    const git = probe((dir) => existsSync(resolve(dir, ".git")));

    const chain = [];
    for (let dir = start, i = 0; i < 64; i++) {
      chain.push(dir);
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    const at = chain.findIndex((dir) => pointer(dir) || tier(dir) || git(dir));
    if (at < 0) return cwd;
    const nearest = chain[at];
    if (pointer(nearest) || git(nearest)) return nearest;

    // The nearest marker is a committed tier and nothing else: look above it for the run.
    for (let i = at + 1; i < chain.length; i++) {
      const dir = chain[i];
      if (pointer(dir)) return tier(dir) || chain.slice(i).some(git) ? dir : nearest;
      if (git(dir)) break;
    }
    return nearest;
  };

  /** Where the decision receipts land: the redirect variable when set, else the local root's ledger under the found project root. */
  const decisionsPath = (cwd) => (decisionsEnv && process.env[decisionsEnv]) || decisions(projectRoot(cwd || process.cwd()));

  return {
    sharedDir, localDir, sharedRoot, localRoot, insideRunTrace, receipt, runArgsPath, ordersDir, resultsDir,
    dispatchReceipts, t0Dir, verdictsDir, trials, gates, activeScope, activeOrder, lastRun, decisions, metricsDir,
    metricsShard, relLocal, relShared, globLocal, globShared, readRunId, resolveRun, resolveRunId, projectRoot, decisionsPath,
    RECEIPT_FILE, RUN_ARGS_FILE, RUN_ID_PATTERN, compactStamp, mintRunId, runIdFromReceipt, readReceipt, runIdFromRoot,
  };
}
