#!/usr/bin/env node
// Run snapshot — the compaction-resilience derivation (v1.2, absorb-audit P4).
//
// Derives a RunSnapshot (domain.schema.json#/$defs/RunSnapshot) from FILES ONLY: the
// active-scope pointer, harness-run.md frontmatter, board task frontmatter, t0/verdicts
// filenames, and the orders/ vs results/ diff. Never from conversation memory — that is the
// point: after a context compaction the summary may be lossy, but the files are not. The
// danger this record exists to prevent is the orchestrator continuing on a degraded summary:
// re-dispatching an already-ingested order, miscounting attempts (breaking the inner circuit
// breaker), or "remembering" a hill phase instead of re-deriving it.
//
// Consumers (both in hooks/): compact-snapshot.mjs persists it before compaction (audit
// anchor); session-rehydrate.mjs re-derives it fresh after compaction and injects the
// rehydrate_hint as additionalContext.
//
// Output is self-validated against the registry before it is emitted — the same
// refuse-to-emit-schema-drift discipline as compile-order.mjs.
//
// Usage: node run-snapshot.mjs [--cwd <dir>] [--format json|text] [--write]
//   exit 0 with empty stdout when no run is active (fail-open), 1 on schema drift.

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { validate } from "./validate-envelope.mjs";
import { isMain } from "./lib/is-main.mjs";
import { runArgs } from "./lib/argv.mjs";
import { localDir, localRoot, relLocal, globLocal, runSnapshot as runSnapshotPath } from "./lib/paths.mjs";

/**
 * Read a JSON file, tolerating absence/parse errors.
 * @param {string} p - Path to the JSON file.
 * @returns {(*|null)} The parsed value, or null when the file is missing or not valid JSON.
 */
function readJSON(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/**
 * Parse a Markdown frontmatter block into a flat scalar map.
 * @param {string} text - Full document text ("" / null tolerated).
 * @returns {Object<string,string>} Top-level `key: value` pairs (quotes stripped); {} when absent.
 */
function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text || "");
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim());
    if (kv) fm[kv[1]] = kv[2].replace(/^['"]|['"]$/g, "");
  }
  return fm;
}

const MID_RUN = new Set(["orienting", "mapping", "building", "evaluating"]);

/**
 * Is this run still open, per its own ledger? Fails CLOSED — a missing or unreadable
 * `harness-run.md` cannot be evidence that a run is in progress.
 * @param {string} root - The `.shapeup` directory.
 * @param {string} slug - Run slug (a child directory of root).
 * @returns {boolean} True when the run's frontmatter status is one of MID_RUN.
 */
function isMidRun(root, slug) {
  const runPath = join(root, slug, "harness-run.md");
  if (!existsSync(runPath)) return false;
  try {
    return MID_RUN.has(frontmatter(readFileSync(runPath, "utf8")).status);
  } catch {
    return false; // unreadable ledger → cannot claim the run is open
  }
}

/**
 * Find the active run from files alone — the active-scope pointer, else a mid-run harness-run.md.
 * Either way the run must be OPEN per its own ledger; a pointer alone is not enough.
 * @param {string} cwd - Working-directory root.
 * @returns {({slug:string, scope_id?:string}|null)} The active run's slug (and scope when pointed
 *   at one), or null when no run is in progress.
 */
function findRun(cwd) {
  const root = localDir(cwd);
  if (!existsSync(root)) return null;

  // The pointer names the run the sandbox guard is scoping, NOT necessarily a run still open.
  // `.shapeup/active-scope` has existed since v0.3 and nothing has ever cleared it, because
  // its original reader (sandbox-guard) fails OPEN on a stale one — a pointer at a finished run
  // simply stops matching any substrate. session-rehydrate is the opposite kind of reader: it
  // turns a pointer into "a run is ALREADY OPEN in this workspace … do NOT open a new run", and
  // it now fires on `startup`/`clear`. Following the pointer without checking the run's status
  // therefore made every cold session in every repo that had EVER run the harness open with a
  // false claim about its own workspace — including sessions with nothing to do with the harness,
  // and including the case where the user's next act is to open the run the injection forbids.
  // This function's own contract (and session-rehydrate's header) always said "a run only for an
  // active-scope pointer or a mid-run harness-run.md"; the status check is what makes that true.
  const pointer = readJSON(join(root, "active-scope"));
  if (pointer?.slug && isMidRun(root, pointer.slug)) {
    return { slug: pointer.slug, scope_id: pointer.scope_id };
  }

  for (const entry of readdirSync(root)) {
    if (isMidRun(root, entry)) return { slug: entry };
  }
  return null;
}

/**
 * Derive a RunSnapshot for the active run from FILES ONLY (never conversation memory).
 * @param {string} cwd - Working-directory root.
 * @returns {(object|null)} A RunSnapshot (domain.schema.json#/$defs/RunSnapshot): slug, optional
 *   scope_id/status/rounds, latest T0 verdict, board done/total + unfinished, open escalates,
 *   dispatched-not-ingested `pending_orders`, and a human `rehydrate_hint`. null when no run is active.
 */
export function deriveSnapshot(cwd) {
  const run = findRun(cwd);
  if (!run) return null;
  const root = localRoot(cwd, run.slug);

  const snapshot = {
    schema_version: 1,
    at: new Date().toISOString(),
    slug: run.slug,
  };
  if (run.scope_id) snapshot.scope_id = run.scope_id;

  const runPath = join(root, "harness-run.md");
  if (existsSync(runPath)) {
    try {
      const fm = frontmatter(readFileSync(runPath, "utf8"));
      if (MID_RUN.has(fm.status) || ["shipped", "escalated"].includes(fm.status)) snapshot.status = fm.status;
      if (/^\d+$/.test(fm.rounds_used || "")) snapshot.rounds_used = Number(fm.rounds_used);
      if (/^\d+$/.test(fm.max_rounds || "")) snapshot.max_rounds = Number(fm.max_rounds);
      if (fm.auto_level) snapshot.auto_level = fm.auto_level;
      if (fm.spec_folder) snapshot.spec_folder = fm.spec_folder;
    } catch { /* run ledger unreadable → snapshot stays partial; the files still win */ }
  }

  const verdictsDir = join(root, "t0", "verdicts");
  if (existsSync(verdictsDir)) {
    let latest = null;
    for (const f of readdirSync(verdictsDir)) {
      const m = /^r(\d+)-a(\d+)\.json$/.exec(f);
      if (!m) continue;
      const round = Number(m[1]), attempt = Number(m[2]);
      if (!latest || round > latest.round || (round === latest.round && attempt > latest.attempt)) {
        latest = { round, attempt, file: f };
      }
    }
    if (latest) {
      snapshot.round = latest.round;
      snapshot.attempt = latest.attempt;
      const verdict = readJSON(join(verdictsDir, latest.file));
      if (verdict?.overall === "green" || verdict?.overall === "red") {
        snapshot.latest_t0 = {
          path: relLocal(run.slug, "t0", "verdicts", latest.file),
          overall: verdict.overall,
          round: latest.round,
          attempt: latest.attempt,
        };
      }
    }
  }
  if (snapshot.round === undefined && snapshot.rounds_used !== undefined) snapshot.round = snapshot.rounds_used;

  const tasksDir = join(root, "tasks");
  if (existsSync(tasksDir)) {
    const board = { total: 0, done: 0, unfinished: [] };
    for (const f of readdirSync(tasksDir)) {
      if (!/^TASK-.*\.md$/.test(f)) continue;
      board.total++;
      try {
        const fm = frontmatter(readFileSync(join(tasksDir, f), "utf8"));
        if (fm.status === "done") board.done++;
        else if (board.unfinished.length < 10) board.unfinished.push(fm.id || f.replace(/\.md$/, ""));
      } catch { /* unreadable task counts as unfinished-unknown; skip naming it */ }
    }
    if (board.total > 0) snapshot.board = board;
  }

  const escDir = join(root, "escalates");
  snapshot.open_escalates = existsSync(escDir)
    ? readdirSync(escDir).filter((f) => f.endsWith(".json")).length
    : 0;

  const ordersDir = join(root, "orders");
  const resultsDir = join(root, "results");
  const results = new Set(existsSync(resultsDir) ? readdirSync(resultsDir) : []);
  snapshot.pending_orders = existsSync(ordersDir)
    ? readdirSync(ordersDir).filter((f) => f.endsWith(".json") && !results.has(f))
    : [];

  snapshot.rehydrate_hint =
    `mid-run harness state: slug "${snapshot.slug}"` +
    (snapshot.scope_id ? `, scope "${snapshot.scope_id}"` : "") +
    (snapshot.round !== undefined ? `, round ${snapshot.round}` : "") +
    (snapshot.attempt !== undefined ? `, attempt ${snapshot.attempt}` : "") +
    (snapshot.status ? `, status ${snapshot.status}` : "") +
    (snapshot.board ? `, board ${snapshot.board.done}/${snapshot.board.total} done` : "") +
    (snapshot.latest_t0 ? `, latest T0 ${snapshot.latest_t0.overall}` : "") +
    (snapshot.pending_orders.length ? `, ${snapshot.pending_orders.length} dispatched-not-ingested order(s): ${snapshot.pending_orders.join(", ")}` : "") +
    `. Re-read ${globLocal(snapshot.slug, "harness-run.md")} and the board before continuing — ` +
    `trust the files, not the conversation summary. Never re-dispatch an order that already has a result; ` +
    `re-derive round/attempt/hill from the files, never from memory.`;

  return snapshot;
}

/**
 * @param {string} cwd - Working-directory root.
 * @param {string} slug - Feature slug.
 * @returns {string} The LOCAL run-trace path `.shapeup/<slug>/run-snapshot.json`.
 */
export function snapshotPath(cwd, slug) {
  return runSnapshotPath(cwd, slug);
}

/**
 * Validate then persist a snapshot to its LOCAL run-trace home.
 * @param {string} cwd - Working-directory root.
 * @param {object} snapshot - The RunSnapshot to persist (its `slug` names the path).
 * @returns {void} Side effect: writes the snapshot JSON.
 * @throws {Error} If the snapshot drifts from domain.schema.json#/$defs/RunSnapshot.
 */
export function writeSnapshot(cwd, snapshot) {
  assertValid(snapshot);
  writeFileSync(snapshotPath(cwd, snapshot.slug), JSON.stringify(snapshot, null, 2) + "\n");
}

/**
 * Assert a snapshot conforms to its registry definition.
 * @param {object} snapshot - The RunSnapshot to check.
 * @returns {void}
 * @throws {Error} If it fails domain.schema.json#/$defs/RunSnapshot (message lists each error).
 */
function assertValid(snapshot) {
  const { valid, errors } = validate(snapshot, { $ref: "domain.schema.json#/$defs/RunSnapshot" });
  if (!valid) {
    throw new Error(`run-snapshot drifted from domain.schema.json#/$defs/RunSnapshot:\n  ${errors.join("\n  ")}`);
  }
}

// --- CLI -----------------------------------------------------------------------

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "run-snapshot.mjs [--cwd <dir>] [--format json|text] [--write]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  format: { type: "enum", values: ["json", "text"], default: "json" },
  write: { type: "flag" },
};

const isMainModule = isMain(import.meta.url);
if (isMainModule) {
  const args = runArgs(ARGV_SPEC);
  const cwd = resolve(args.cwd || process.cwd());
  const format = args.format;

  const snapshot = deriveSnapshot(cwd);
  if (!snapshot) process.exit(0); // no active run → nothing to say (fail-open)

  try {
    assertValid(snapshot);
    if (args.write) writeSnapshot(cwd, snapshot);
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    process.exit(1);
  }
  console.log(format === "text" ? snapshot.rehydrate_hint : JSON.stringify(snapshot, null, 2));
}
