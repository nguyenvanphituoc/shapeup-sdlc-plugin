#!/usr/bin/env node
// export-run — freeze a run's records into fact tables before the tier that holds them is wiped.
//
// WHY THIS EXISTS (from the storage design, not from a preference for tooling).
//
// Every record this exports already exists. Orders, results, journal rows, trial rows, T0
// verdicts, criterion verdicts and hook decisions are all written during a normal run, all as
// JSON, all schema-registered. They live in `.shapeup/<slug>/` — the LOCAL tier, which ADR-0001
// defines as gitignored, machine-local and REGENERABLE. That definition is correct for run state
// and fatal for measurement: the trial-row contract says it out loud — a measurement left there
// "answers the question exactly once and then deletes itself".
//
// So the harness has been producing a complete dataset and discarding it. Not losing it to a bug;
// discarding it by design, because nothing ever read it before the directory was cleaned. This
// script is the read that was missing, and it is deliberately a SEPARATE STEP rather than a write
// added to the pipeline: the run's writers stay exactly as they are, ``harness reduce ingest`` remains
// the sole writer of shared state, and an export can be re-run against a trace at any point
// without touching it.
//
// WHAT IT DOES NOT DO, said plainly rather than left to be discovered. It does not make the
// records cross a machine boundary on its own. The default destination is `.shapeup/exports/`,
// which survives a per-slug wipe but is still gitignored — because committing per-run structured
// data and a machine id is precisely what ADR-0001 moved the metrics shards out of git to prevent.
// A cross-machine warehouse is `--out <dir>` to a destination the operator owns and chooses. The
// export makes the evidence DURABLE and PORTABLE; where it travels stays a human decision.
//
// READ-ONLY, AND FAIL-OPEN PER RECORD. Nothing here writes into the run trace. A file that will
// not parse is skipped and COUNTED in the manifest rather than aborting the export — a warehouse
// loader that dies on one bad line loses the other nine thousand, and the count is what tells an
// analyst their table is short. It never grades: every column is an id, a count, a duration or a
// copied enum, per the rule ``harness probe stats`` states in its own header.
//
// USAGE
//   node `harness report export` [--slug <slug>] [--cwd <dir>] [--out <dir>] [--all] [--format jsonl|json]
//
//   --slug     the run to export; defaults to the active-scope pointer's slug
//   --all      export every run under the LOCAL root that has a readable receipt
//   --out      destination root (default: .shapeup/exports/); each run lands in <out>/<run_id>/
//   --format   jsonl (default — one object per line, what a warehouse reads natively) or json
//
// Prints the manifest(s) on stdout. Exit 0 on success, 2 on a usage error, 3 when there is
// nothing to export.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { splitFrontmatter } from "../lib/contract.mjs";
import { runIdFromReceipt, readReceipt } from "../lib/paths.mjs";
import { TABLES, runRow, agentCallRow, dispatchFacts, economics } from "./facts.mjs";
import {
  localDir, activeScope, receipt as receiptPath, harnessRun, ordersDir, resultsDir,
  workflowRunDir, trials as trialsPath, verdictsDir, evaluationDir, decisions as decisionsPath,
  exportsDir, exportRunDir,
} from "../lib/paths.mjs";

export const EXPORT_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Readers — every one of them returns data plus a defect count, never throws
// ---------------------------------------------------------------------------

/** A read tally threaded through every reader so the manifest can report what did not parse. */
const tally = () => ({ skipped: 0 });

/**
 * Parse a JSON file, counting rather than throwing on failure.
 * @param {string} path - File to read.
 * @param {{skipped:number}} t - Defect tally, incremented on a parse or read failure.
 * @returns {(*|null)} The parsed value, or null.
 */
function readJson(path, t) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { t.skipped++; return null; }
}

/**
 * Parse a JSONL file into rows, skipping (and counting) lines that do not parse.
 * @param {string} path - File to read; a missing file is not a defect, it is an empty table.
 * @param {{skipped:number}} t - Defect tally.
 * @returns {Array<object>} The parsed rows, in file order.
 */
function readJsonl(path, t) {
  if (!existsSync(path)) return [];
  let text;
  try { text = readFileSync(path, "utf8"); } catch { t.skipped++; return []; }
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { t.skipped++; }
  }
  return out;
}

/**
 * Read every `*.json` in a directory, sorted by name so an export is byte-stable across runs.
 * @param {string} dir - Directory to scan; absent → empty.
 * @param {{skipped:number}} t - Defect tally.
 * @returns {Array<object>} Parsed documents, name-sorted.
 */
function readJsonDir(dir, t) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const doc = readJson(join(dir, f), t);
    if (doc) out.push(doc);
  }
  return out;
}

/**
 * Flatten a T0 verdict artifact into one fact row, dropping the nested arms (they are the
 * `CommandResult` detail, and belong to the artifact, not to a column).
 * @param {object} a - A parsed T0Artifact.
 * @param {(string|null)} runId - Run key for artifacts written before the field existed.
 * @returns {object} A flat `t0_verdict` row.
 */
function t0Row(a, runId) {
  const fixtures = Array.isArray(a?.fixtures) ? a.fixtures : [];
  return {
    run_id: a?.run_id ?? runId ?? null,
    scope_id: a?.scope_id ?? null,
    round: a?.round ?? null,
    attempt: a?.attempt ?? null,
    trial: a?.trial ?? null,
    at: a?.at ?? null,
    overall: a?.overall ?? null,
    regression: a?.regression ?? null,
    fixtures_green: a?.fixtures_green ?? null,
    db_probe_green: a?.db_probe_green ?? null,
    seesaw_green: a?.seesaw_green ?? null,
    fixtures_total: fixtures.length,
    fixtures_passed: fixtures.filter((f) => f?.pass === true).length,
    seesaw_ran: a?.seesaw?.ran ?? null,
    seesaw_failing: Array.isArray(a?.seesaw?.failing) ? a.seesaw.failing.length : null,
    discovered_tasks: Array.isArray(a?.discovered_tasks) ? a.discovered_tasks.length : 0,
  };
}

/**
 * Collect every criterion-verdict row across the evaluator's per-target ledgers.
 * @param {string} dir - The run's `evaluation/` directory.
 * @param {(string|null)} runId - Run key to stamp (the ledger line carries none).
 * @param {{skipped:number}} t - Defect tally.
 * @returns {Array<object>} Flat `criterion_verdict` rows, each tagged with its target ledger.
 */
function criterionRows(dir, runId, t) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.startsWith(".verdicts-") && x.endsWith(".jsonl")).sort()) {
    const target = f.replace(/^\.verdicts-/, "").replace(/\.jsonl$/, "");
    for (const row of readJsonl(join(dir, f), t)) {
      out.push({
        run_id: runId ?? null, target,
        run: row?.run ?? null,
        dimension: row?.dimension ?? null,
        criterion: row?.criterion ?? null,
        verdict: row?.verdict ?? null,
        confidence: row?.confidence ?? null,
        reprobed: row?.reprobed ?? null,
        has_evidence: !!(row?.evidence && String(row.evidence).trim()),
        at: row?.at ?? null,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The export itself
// ---------------------------------------------------------------------------

/**
 * Read one run's trace and project it into fact tables. Pure-ish: reads the run trace, writes
 * nothing.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - The feature slug whose run to export.
 * @returns {(object|null)} `{run_id, slug, tables:{…}, economics, defects}` — or null when the
 *   slug has no readable receipt, which is the definition of "not a run".
 */
export function collectRun(cwd, slug) {
  const t = tally();
  const rec = readReceipt(receiptPath(cwd, slug));
  if (!rec) return null;
  const runId = runIdFromReceipt(rec);

  let ledger = {};
  try { ledger = splitFrontmatter(readFileSync(harnessRun(cwd, slug), "utf8")).meta || {}; } catch { /* no ledger yet */ }

  const orders = readJsonDir(ordersDir(cwd, slug), t);
  const results = readJsonDir(resultsDir(cwd, slug), t);
  const journal = readJsonl(join(workflowRunDir(cwd, slug), "journal.jsonl"), t);

  const { dispatch, ac_result, discovery, file_touched } = dispatchFacts({ orders, results, journal, runId });
  const agent_call = journal.map((j) => agentCallRow(j, runId));
  const run = runRow({ receipt: rec, ledger, runId });

  // Hook decisions are checkout-wide, so they are FILTERED to this run rather than read from a
  // per-run file. Rows with a null key belong to no run (a hook that fired outside one) and are
  // correctly excluded here — they are not this run's, and claiming them would inflate its
  // enforcement counts with ambient activity.
  const hook_decision = readJsonl(decisionsPath(cwd), t).filter((d) => runId && d?.run_id === runId);

  return {
    run_id: runId,
    slug,
    tables: {
      run: run ? [run] : [],
      dispatch, ac_result, discovery, file_touched, agent_call,
      trial: readJsonl(trialsPath(cwd, slug), t).map((r) => ({ ...r, run_id: r.run_id ?? runId ?? null })),
      t0_verdict: readJsonDir(verdictsDir(cwd, slug), t).map((a) => t0Row(a, runId)),
      criterion_verdict: criterionRows(evaluationDir(cwd, slug), runId, t),
      hook_decision,
    },
    economics: economics({ agent_call, dispatch, run }),
    defects: { records_skipped: t.skipped },
  };
}

/**
 * Write one collected run's tables to disk and return its manifest.
 * @param {object} collected - Output of {@link collectRun}.
 * @param {string} outDir - Destination directory for this run's tables.
 * @param {string} format - `jsonl` (one object per line) or `json` (one array per file).
 * @returns {object} The manifest, which is also written to `<outDir>/manifest.json`.
 */
export function writeRun(collected, outDir, format = "jsonl") {
  mkdirSync(outDir, { recursive: true });
  const ext = format === "json" ? "json" : "jsonl";
  const rows = {};
  for (const name of TABLES) {
    const table = collected.tables[name] || [];
    rows[name] = table.length;
    const body = format === "json"
      ? JSON.stringify(table, null, 2) + "\n"
      : table.map((r) => JSON.stringify(r)).join("\n") + (table.length ? "\n" : "");
    writeFileSync(join(outDir, `${name}.${ext}`), body, "utf8");
  }
  const manifest = {
    schema_version: EXPORT_SCHEMA_VERSION,
    run_id: collected.run_id,
    slug: collected.slug,
    generated_at: new Date().toISOString(),
    format: ext,
    tables: TABLES.map((name) => ({ name, file: `${name}.${ext}`, rows: rows[name] })),
    rows_total: Object.values(rows).reduce((a, b) => a + b, 0),
    // The defect count is a first-class manifest field, not a log line. A short table with no
    // record of why is indistinguishable from a short run.
    records_skipped: collected.defects.records_skipped,
    economics: collected.economics,
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return manifest;
}

/**
 * Every slug under the LOCAL root that has a readable receipt — i.e. every run, discovered from
 * the filesystem rather than from a list someone has to maintain.
 * @param {string} cwd - Project root.
 * @returns {string[]} Slugs, sorted.
 */
export function discoverRuns(cwd) {
  const root = localDir(cwd);
  if (!existsSync(root)) return [];
  const out = [];
  for (const e of readdirSync(root)) {
    try { if (!statSync(join(root, e)).isDirectory()) continue; } catch { continue; }
    if (existsSync(receiptPath(cwd, e))) out.push(e);
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs report export [--slug <slug>] [--all] [--cwd <dir>] [--out <dir>] [--format jsonl|json]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  slug: { type: "str" },
  out: { type: "path" },
  all: { type: "flag" },
  format: { type: "enum", values: ["jsonl", "json"], default: "jsonl" },
};

/**
 * Project a run's records as fact tables under the exports tier.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());

  let slugs = [];
  if (args.all) slugs = discoverRuns(cwd);
  else if (args.slug) slugs = [args.slug];
  else {
    // The active-scope pointer, same as every other run-scoped tool resolves through.
    const active = readJson(activeScope(cwd), tally());
    if (active?.slug) slugs = [active.slug];
  }
  if (!slugs.length) {
    console.error("✋ export-run: no run to export — pass --slug <slug>, or --all, or open a run first.");
    process.exit(3);
  }

  const outRoot = args.out ? resolve(cwd, args.out) : exportsDir(cwd);
  const manifests = [];
  for (const slug of slugs) {
    const collected = collectRun(cwd, slug);
    if (!collected) { console.error(`export-run: ${slug} has no readable receipt — skipped (not a run)`); continue; }
    // Keyed by RUN ID, not by slug: two runs of the same feature are two datasets, and filing them
    // under the slug would make the second silently overwrite the first — the exact collision the
    // run key exists to end.
    const dir = args.out ? join(outRoot, String(collected.run_id ?? slug)) : exportRunDir(cwd, collected.run_id ?? slug);
    manifests.push(writeRun(collected, dir, args.format));
  }
  if (!manifests.length) process.exit(3);
  console.log(JSON.stringify(manifests.length === 1 ? manifests[0] : manifests, null, 2));
}

