#!/usr/bin/env node
// Stats — the telemetry read-plane (v1.2, absorb-audit P3).
//
// SHIP S.6 has been writing fact rows to docs/shapeup-sdlc/metrics/<machine-id>.jsonl since
// v0.x with exactly one documented reader: `cat *.jsonl`. This script is the missing
// projection: rounds per pitch, hammer-cut rate, attempt-budget exhaustions, QA promotion
// rate, and the round_count trend — the "is the KB flywheel actually working?" chart.
//
// Hard rules, inherited from the MetricsRow contract:
//   • READ-ONLY. Only read APIs are imported; the shards stay the single source of truth.
//   • FACTS ONLY. Aggregates copied fields (counts, rates, trends); it never grades — a
//     computed score here would be a second judge behind spec-evaluator.
//   • Fail-open per row: a malformed line is skipped and counted, never fatal. Pathology
//     rows (sandbox-guard / safety-spine denials share the shards) are partitioned into a
//     histogram, not treated as runs or errors.
//
// Output is a StatsReport (domain.schema.json#/$defs/StatsReport), self-validated before it
// is emitted; --format table renders the human view from the already-validated object.
//
// Usage: node stats.mjs [--cwd <dir>] [--metrics-dir <dir>] [--slug <slug>] [--format json|table]

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate-envelope.mjs";

/** Read every shard: { rows, pathologies:[…], sources, rows_malformed }. */
export function readShards(metricsDir) {
  const out = { rows: [], pathologies: [], sources: [], rows_malformed: 0 };
  if (!existsSync(metricsDir)) return out;
  for (const shard of readdirSync(metricsDir).filter((f) => f.endsWith(".jsonl")).sort()) {
    out.sources.push(shard);
    const lines = readFileSync(join(metricsDir, shard), "utf8").split("\n");
    let seq = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      let row;
      try { row = JSON.parse(line); } catch { out.rows_malformed++; continue; }
      if (row?.kind === "pathology") { out.pathologies.push(row); continue; }
      if (!row?.feature_slug || !row?.terminal_state) { out.rows_malformed++; continue; }
      out.rows.push({ ...row, _seq: seq++ });
    }
  }
  return out;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Aggregate harvest rows into the StatsReport body (pure — no I/O). */
export function aggregate({ rows, pathologies, sources, rows_malformed }, { metricsDir = "", slugFilter = null } = {}) {
  const filtered = slugFilter ? rows.filter((r) => r.feature_slug === slugFilter) : rows;

  const bySlug = new Map();
  for (const row of filtered) {
    if (!bySlug.has(row.feature_slug)) bySlug.set(row.feature_slug, []);
    bySlug.get(row.feature_slug).push(row);
  }

  const per_slug = [...bySlug.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([slug, runs]) => {
    const rounds = runs.map((r) => r.round_count).filter((n) => Number.isInteger(n));
    const terminal_states = {};
    for (const r of runs) terminal_states[r.terminal_state] = (terminal_states[r.terminal_state] || 0) + 1;
    const cuts = runs.filter((r) => (r.scope_cut_count || 0) > 0).length;
    const qaRows = runs.filter((r) => r.qa_findings);
    const qa = {
      total: qaRows.reduce((s, r) => s + (r.qa_findings.total || 0), 0),
      promoted: qaRows.reduce((s, r) => s + (r.qa_findings.promoted || 0), 0),
      held: qaRows.reduce((s, r) => s + (r.qa_findings.held || 0), 0),
    };
    qa.promotion_rate = qa.total > 0 ? round2(qa.promoted / qa.total) : 0;
    const surprises = runs.map((r) => r.surprise_count).filter((n) => Number.isInteger(n));
    const perSlice = runs
      .filter((r) => Number.isInteger(r.round_count) && Number.isInteger(r.slice_count) && r.slice_count > 0)
      .map((r) => r.round_count / r.slice_count);
    const entry = {
      feature_slug: slug,
      runs: runs.length,
      terminal_states,
      hammer_cut_rate: round2(cuts / runs.length),
      scope_cuts_total: runs.reduce((s, r) => s + (r.scope_cut_count || 0), 0),
      attempt_exhaustions: runs.reduce((s, r) => s + (Number.isInteger(r.attempt_exhaustions) ? r.attempt_exhaustions : 0), 0),
      qa,
    };
    if (rounds.length > 0) {
      entry.rounds = {
        min: Math.min(...rounds),
        max: Math.max(...rounds),
        avg: round2(rounds.reduce((s, n) => s + n, 0) / rounds.length),
      };
    }
    if (surprises.length > 0) entry.surprise_avg = round2(surprises.reduce((s, n) => s + n, 0) / surprises.length);
    if (perSlice.length > 0) entry.rounds_per_slice_avg = round2(perSlice.reduce((s, n) => s + n, 0) / perSlice.length);
    return entry;
  });

  const pathologyHistogram = {};
  for (const p of pathologies) {
    const key = p.pathology || "unknown";
    pathologyHistogram[key] = (pathologyHistogram[key] || 0) + 1;
  }

  const trend = filtered
    .filter((r) => Number.isInteger(r.round_count))
    .sort((a, b) => (a.at && b.at) ? a.at.localeCompare(b.at) : a._seq - b._seq)
    .map((r) => {
      const t = { feature_slug: r.feature_slug, seq: r._seq, round_count: r.round_count };
      if (r.at) t.at = r.at;
      return t;
    });

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    metrics_dir: metricsDir,
    sources,
    rows_total: filtered.length,
    rows_malformed,
    rows_pathology: pathologies.length,
    pathologies: pathologyHistogram,
    per_slug,
    trend,
  };
}

function renderTable(report) {
  const lines = [];
  lines.push(`metrics: ${report.metrics_dir || "(none)"} — ${report.rows_total} run row(s), ` +
    `${report.rows_pathology} pathology, ${report.rows_malformed} malformed (skipped)`);
  if (Object.keys(report.pathologies).length > 0) {
    lines.push(`pathologies: ${Object.entries(report.pathologies).map(([k, n]) => `${k}=${n}`).join("  ")}`);
  }
  if (report.per_slug.length === 0) {
    lines.push("(no harvest rows yet — rows appear at SHIP S.6)");
    return lines.join("\n");
  }
  lines.push("");
  lines.push("slug                        runs  rounds(min/avg/max)  cut-rate  exhaust  qa(prom/total)");
  for (const s of report.per_slug) {
    const r = s.rounds ? `${s.rounds.min}/${s.rounds.avg}/${s.rounds.max}` : "—";
    lines.push(
      `${s.feature_slug.padEnd(28).slice(0, 28)}${String(s.runs).padEnd(6)}` +
      `${r.padEnd(21)}${String(s.hammer_cut_rate).padEnd(10)}${String(s.attempt_exhaustions).padEnd(9)}` +
      `${s.qa.promoted}/${s.qa.total}`
    );
  }
  if (report.trend.length > 1) {
    lines.push("");
    lines.push("round_count trend: " + report.trend.map((t) => `${t.feature_slug}:${t.round_count}`).join(" → "));
  }
  return lines.join("\n");
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
  const metricsDir = resolve(cwd, flag("--metrics-dir") || join("docs", "shapeup-sdlc", "metrics"));
  const format = flag("--format") || "json";

  const report = aggregate(readShards(metricsDir), { metricsDir, slugFilter: flag("--slug") });

  const { valid, errors } = validate(report, { $ref: "domain.schema.json#/$defs/StatsReport" });
  if (!valid) {
    console.error(`  ✗ stats report drifted from domain.schema.json#/$defs/StatsReport:`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(format === "table" ? renderTable(report) : JSON.stringify(report, null, 2));
}
