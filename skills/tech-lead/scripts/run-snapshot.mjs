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
import { fileURLToPath } from "node:url";
import { validate } from "./validate-envelope.mjs";

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

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

function findRun(cwd) {
  const pointer = readJSON(join(cwd, ".shapeup-sdlc", "active-scope"));
  if (pointer?.slug) return { slug: pointer.slug, scope_id: pointer.scope_id };
  const root = join(cwd, ".shapeup-sdlc");
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root)) {
    const runPath = join(root, entry, "harness-run.md");
    if (!existsSync(runPath)) continue;
    try {
      const fm = frontmatter(readFileSync(runPath, "utf8"));
      if (MID_RUN.has(fm.status)) return { slug: entry };
    } catch { /* unreadable → not this one */ }
  }
  return null;
}

/** Derive the RunSnapshot for the active run, or null when no run is in progress. */
export function deriveSnapshot(cwd) {
  const run = findRun(cwd);
  if (!run) return null;
  const root = join(cwd, ".shapeup-sdlc", run.slug);

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
          path: join(".shapeup-sdlc", run.slug, "t0", "verdicts", latest.file),
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
    `. Re-read .shapeup-sdlc/${snapshot.slug}/harness-run.md and the board before continuing — ` +
    `trust the files, not the conversation summary. Never re-dispatch an order that already has a result; ` +
    `re-derive round/attempt/hill from the files, never from memory.`;

  return snapshot;
}

export function snapshotPath(cwd, slug) {
  return join(cwd, ".shapeup-sdlc", slug, "run-snapshot.json");
}

/** Validate + persist a snapshot to its LOCAL run-trace home. Throws on schema drift. */
export function writeSnapshot(cwd, snapshot) {
  assertValid(snapshot);
  writeFileSync(snapshotPath(cwd, snapshot.slug), JSON.stringify(snapshot, null, 2) + "\n");
}

function assertValid(snapshot) {
  const { valid, errors } = validate(snapshot, { $ref: "domain.schema.json#/$defs/RunSnapshot" });
  if (!valid) {
    throw new Error(`run-snapshot drifted from domain.schema.json#/$defs/RunSnapshot:\n  ${errors.join("\n  ")}`);
  }
}

// --- CLI -----------------------------------------------------------------------

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : null;
  };
  const cwd = resolve(flag("--cwd") || process.cwd());
  const format = flag("--format") || "json";

  const snapshot = deriveSnapshot(cwd);
  if (!snapshot) process.exit(0); // no active run → nothing to say (fail-open)

  try {
    assertValid(snapshot);
    if (args.includes("--write")) writeSnapshot(cwd, snapshot);
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    process.exit(1);
  }
  console.log(format === "text" ? snapshot.rehydrate_hint : JSON.stringify(snapshot, null, 2));
}
