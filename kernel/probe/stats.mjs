#!/usr/bin/env node
// Stats — the telemetry read-plane (v1.2).
//
// SHIP S.6 has been writing fact rows to .shapeup/metrics/<machine-id>.jsonl since
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
import { validate } from "../verify/envelope.mjs";
import { runArgs } from "../lib/argv.mjs";
import { collectRun } from "../report/export.mjs";
import { localDir, decisions as decisionsPath, metricsDir as metricsDirPath, SHARED } from "../lib/paths.mjs";

/**
 * Read every metrics shard, partitioning valid rows, pathology rows, and malformed lines.
 * @param {string} metricsDir - Directory of `*.jsonl` metric shards (absent → empty result).
 * @returns {{rows:Array<object>, pathologies:Array<object>, sources:string[], rows_malformed:number}}
 *   Harvest rows (each tagged with a per-shard `_seq`), pathology rows, the shard filenames read,
 *   and the count of unparseable/incomplete lines skipped.
 */
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

/**
 * @param {number} n - A number.
 * @returns {number} `n` rounded to two decimal places.
 */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Aggregate harvest rows into the StatsReport body (pure — no I/O, no grading).
 * @param {{rows:Array<object>, pathologies:Array<object>, sources:string[], rows_malformed:number}}
 *   shards - Output of {@link readShards}.
 * @param {{metricsDir?:string, slugFilter?:(string|null)}} [opts] - metricsDir echoed into the
 *   report; slugFilter restricts to one feature slug.
 * @returns {object} A StatsReport (domain.schema.json#/$defs/StatsReport): per-slug run counts,
 *   terminal-state histograms, hammer-cut rate, attempt exhaustions, QA promotion rates, a
 *   pathology histogram, and the round_count trend.
 */
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

// --- the two exit measurements (v1.5) ------------------------------------------------------
//
// Both answer questions this project has never been able to ask, and both cost ZERO model tokens:
// they reduce over artifacts the harness already writes while doing its ordinary work.

/**
 * `--ratchet` — does the build loop actually ratchet?
 *
 * The question harness-versus-bare-agent is already answered elsewhere. This one is THE LOOP
 * VERSUS ITS OWN FIRST ATTEMPT, and it cannot be
 * won by a one-sentence control, because a one-sentence control has no second attempt to compare.
 *
 * A monotone series is a ratchet working. A flat or sawtooth series says the loop is still a
 * budgeted retry loop, and that widening `inspect()` is load-bearing rather than tidy.
 *
 * @param {Array<object>} trials - TrialRow records (from one run's `trials.jsonl`, or many).
 * @returns {{trials:number, scopes:number, scopes_multi_trial:number, improvement_rate:number,
 *   monotone_rate:number, sawtooth_count:number, mean_trials_to_green:(number|null),
 *   status_histogram:Object<string,number>, per_scope:Array<object>}} The ratchet report.
 */
export function ratchetReport(trials) {
  const byScope = new Map();
  const status_histogram = {};
  for (const t of trials || []) {
    status_histogram[t.status] = (status_histogram[t.status] || 0) + 1;
    if (!byScope.has(t.scope_id)) byScope.set(t.scope_id, []);
    byScope.get(t.scope_id).push(t);
  }

  let afterFirst = 0, kept = 0, sawtooth_count = 0, monotone = 0, multi = 0;
  const toGreen = [];
  const per_scope = [];

  for (const [scope_id, rows] of [...byScope.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))) {
    const seq = rows.slice().sort((a, b) => a.trial - b.trial);
    // "Improvement rate" is measured over trials AFTER the first: the first trial is the baseline
    // by construction and counting it as an improvement would inflate every run to ≥ 1/1.
    const later = seq.slice(1);
    afterFirst += later.length;
    kept += later.filter((t) => t.status === "kept").length;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].status === "reverted" && seq[i - 1].status === "kept") sawtooth_count++;
    }
    let scopeMonotone = true;
    if (seq.length >= 2) {
      multi++;
      for (let i = 1; i < seq.length; i++) {
        // A `rebased` step changed the denominator, so it is not a decrease — it is a new series.
        if (seq[i].status === "reverted" || seq[i].status === "crash") { scopeMonotone = false; break; }
      }
      if (scopeMonotone) monotone++;
    }
    const greenAt = seq.findIndex((t) => t.score && t.score.fixtures_total > 0 && t.score.fixtures_passed === t.score.fixtures_total && t.score.regressions === 0);
    if (greenAt !== -1) toGreen.push(greenAt + 1);
    per_scope.push({
      scope_id, trials: seq.length,
      first_score: seq[0]?.score ?? null,
      last_score: seq[seq.length - 1]?.score ?? null,
      monotone: seq.length >= 2 ? scopeMonotone : null,
      reached_green_at_trial: greenAt === -1 ? null : greenAt + 1,
    });
  }

  return {
    trials: (trials || []).length,
    scopes: byScope.size,
    scopes_multi_trial: multi,
    improvement_rate: afterFirst > 0 ? round2(kept / afterFirst) : 0,
    monotone_rate: multi > 0 ? round2(monotone / multi) : 0,
    sawtooth_count,
    mean_trials_to_green: toGreen.length ? round2(toGreen.reduce((s, n) => s + n, 0) / toGreen.length) : null,
    status_histogram,
    per_scope,
  };
}

/**
 * `--hooks` — do the enforcement points actually fire?
 *
 * For a hook, "never had to fire" and "never ran" used to produce the same evidence: exit 0,
 * empty stdout. With a decision row per evaluation, a hook that sat inert and a hook that
 * inspected-and-permitted become SEPARABLE FACTS rather than the same blank.
 *
 * @param {Array<object>} decisions - Rows from `.shapeup/decisions.jsonl`.
 * @returns {{evaluations:number, hooks:number, per_hook:Array<object>}} Per-hook fire, allow, deny,
 *   block and error counts, plus the rules that fired.
 */
export function hooksReport(decisions) {
  const byHook = new Map();
  for (const d of decisions || []) {
    const name = d.hook || "unknown";
    if (!byHook.has(name)) byHook.set(name, { hook: name, evaluations: 0, allow: 0, deny: 0, block: 0, error: 0, rules: {} });
    const h = byHook.get(name);
    h.evaluations++;
    if (h[d.verdict] !== undefined) h[d.verdict]++;
    if (d.rule) h.rules[d.rule] = (h.rules[d.rule] || 0) + 1;
  }
  const per_hook = [...byHook.values()].sort((a, b) => a.hook.localeCompare(b.hook));
  return { evaluations: (decisions || []).length, hooks: per_hook.length, per_hook };
}

/**
 * Read every trial ledger under a run root (or all runs).
 * @param {string} cwd - Project root.
 * @param {(string|null)} [slug] - Restrict to one run; null reads every run's ledger.
 * @returns {Array<object>} TrialRow records, in file order per run.
 */
export function readAllTrials(cwd, slug = null) {
  const root = localDir(cwd);
  if (!existsSync(root)) return [];
  let slugs;
  try { slugs = slug ? [slug] : readdirSync(root); } catch { return []; }
  const out = [];
  for (const s of slugs) {
    const p = join(root, s, "t0", "trials.jsonl");
    if (!existsSync(p)) continue;
    try {
      for (const line of readFileSync(p, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try { out.push(JSON.parse(line)); } catch { /* a torn row is not a trial */ }
      }
    } catch { /* unreadable ledger → skip */ }
  }
  return out;
}

/**
 * Read the checkout-wide decision ledger.
 * @param {string} cwd - Project root.
 * @returns {Array<object>} Decision rows; [] when no hook has ever recorded one.
 */
export function readDecisions(cwd) {
  const p = decisionsPath(cwd);
  if (!existsSync(p)) return [];
  try {
    return readFileSync(p, "utf8").split("\n").filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

/**
 * Project run economics for every run in the checkout — measurement-table row 4.
 *
 * WHY IT LIVES HERE and reads the run trace rather than the metrics shards: the same reason
 * `--ratchet` reads `trials.jsonl` and `--hooks` reads `decisions.jsonl`. A harvest row is written
 * once at SHIP S.6 and carries counts, never durations or cost — so a run that never shipped, which
 * is exactly the run whose cost you want to see, has no harvest row at all. The journal has one row
 * per agent call from the first dispatch onwards.
 *
 * FACTS ONLY, unchanged: sums, counts and durations over rows that already exist. Nothing here is
 * divided by an expectation or compared to a target, because that would be a grade.
 *
 * @param {string} cwd - Project root.
 * @param {(string|null)} [slug=null] - Restrict to one feature slug.
 * @returns {object} `{runs, per_run[]}` — one economics block per run, newest last, each tagged
 *   with its run_id and slug.
 */
export function economicsReport(cwd, slug = null) {
  const root = localDir(cwd);
  if (!existsSync(root)) return { runs: 0, per_run: [] };
  let slugs;
  try { slugs = slug ? [slug] : readdirSync(root); } catch { return { runs: 0, per_run: [] }; }
  const per_run = [];
  for (const s of slugs.sort()) {
    let collected = null;
    try { collected = collectRun(cwd, s); } catch { collected = null; }
    if (!collected) continue; // no receipt ⇒ not a run, which is not an error
    per_run.push({ run_id: collected.run_id, slug: s, ...collected.economics });
  }
  return { runs: per_run.length, per_run };
}

/**
 * Format a dollar figure, keeping "no cost row was recorded" visibly different from "$0.0000".
 * @param {(number|null|undefined)} v - A cost in USD, or null when nothing recorded one.
 * @returns {string} e.g. `$1.2000`, or `—` when the value is absent.
 */
function money(v) {
  return v === null || v === undefined ? "—" : `$${v.toFixed(4)}`;
}

/**
 * Render the economics report as text.
 * @param {object} r - Output of {@link economicsReport}.
 * @returns {string} The multi-line report.
 */
function renderEconomics(r) {
  const lines = [`economics: ${r.runs} run(s) with a receipt`];
  if (!r.runs) {
    lines.push("", "(no run trace in this checkout — this reads the run's own records, so it is empty");
    lines.push(" until a run opens, and stays readable after one ends until the trace is cleaned.)");
    return lines.join("\n");
  }
  for (const e of r.per_run) {
    lines.push("", `  ${e.run_id ?? e.slug}`,
      `    agent calls           ${e.agent_calls}   (${e.retried_calls} retried, ${e.failed_calls} failed, ${e.killed_calls} killed)`,
      `    cost                  ${money(e.cost_usd)}   attributed ${money(e.cost_attributed_usd)} · unattributed ${money(e.cost_unattributed_usd)}`,
      `    wall clock            ${e.wall_ms_total === null ? "—" : `${Math.round(e.wall_ms_total / 1000)}s`}`,
      `    to first write        ${e.calls_to_first_write ?? "—"} call(s)` +
        `${e.seconds_to_first_write === null ? "" : ` · ${e.seconds_to_first_write}s`}`,
      `    dispatches            ${e.dispatches}   (${e.dispatches_answered} answered, ${e.dispatches_costed} costed)`);
    for (const m of e.by_model) {
      lines.push(`      ${String(m.model).padEnd(22)}${String(m.calls).padStart(3)} call(s)  ${money(m.cost_usd)}`);
    }
    // The gap is named, never left as a quiet shortfall in the total.
    if (e.dispatches_costed < e.dispatches) {
      lines.push(`    ⓘ ${e.dispatches - e.dispatches_costed} dispatch(es) carry no cost row — the journal exists only on the`,
        "      workflow lane, so a prose-lane or --tiny dispatch has no agent call to join to.");
    }
  }
  return lines.join("\n");
}

/**
 * Render a StatsReport as a human-readable fixed-width table.
 * @param {object} report - A validated StatsReport (see {@link aggregate}).
 * @returns {string} The multi-line table text (header + one row per slug + optional trend line).
 */
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

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs probe stats [--cwd <dir>] [--metrics-dir <dir>] [--slug <slug>] [--format json|table] " +
         "[--ratchet] [--hooks] [--economics]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  "metrics-dir": { type: "path" },
  slug: { type: "str" },
  format: { type: "enum", values: ["json", "table"], default: "json" },
  ratchet: { type: "flag" },
  hooks: { type: "flag" },
  economics: { type: "flag" },
};

/**
 * Format one score vector for the ratchet table.
 * @param {(object|null)} x - A T0Score, or null.
 * @returns {string} e.g. "4/5" or "2/5 +1reg", or "—" when absent.
 */
function fmtScore(x) {
  return x ? `${x.fixtures_passed}/${x.fixtures_total}${x.regressions ? ` +${x.regressions}reg` : ""}` : "—";
}

/**
 * Render the ratchet report as text.
 * @param {object} r - Output of {@link ratchetReport}.
 * @returns {string} The multi-line report.
 */
function renderRatchet(r) {
  const lines = [
    `ratchet: ${r.trials} trial(s) across ${r.scopes} scope(s); ${r.scopes_multi_trial} with ≥2 trials`,
    `  improvement_rate     ${r.improvement_rate}   (kept ÷ trials after the first)`,
    `  monotone_rate        ${r.monotone_rate}   (scopes whose score never decreased)`,
    `  sawtooth_count       ${r.sawtooth_count}   (a revert immediately after a keep)`,
    `  mean_trials_to_green ${r.mean_trials_to_green ?? "—"}`,
  ];
  const hist = Object.entries(r.status_histogram);
  if (hist.length) lines.push(`  status: ${hist.map(([k, n]) => `${k}=${n}`).join("  ")}`);
  if (r.scopes_multi_trial === 0) {
    lines.push("", "(no scope has a second trial yet — the Day-1 question needs at least one retry to answer)");
  }
  for (const s of r.per_scope) {
    lines.push(`  ${String(s.scope_id).padEnd(16)} ${String(s.trials).padStart(2)} trial(s)  ` +
      `${fmtScore(s.first_score)} → ${fmtScore(s.last_score)}  ` +
      `${s.monotone === null ? "" : s.monotone ? "monotone" : "sawtooth"}${s.reached_green_at_trial ? `  green@t${s.reached_green_at_trial}` : ""}`);
  }
  return lines.join("\n");
}

/**
 * Render the hook report as text.
 * @param {object} r - Output of {@link hooksReport}.
 * @returns {string} The multi-line report.
 */
function renderHooks(r) {
  const lines = [`hooks: ${r.evaluations} evaluation(s) across ${r.hooks} hook(s)`, ""];
  lines.push("hook                      evals  allow  deny  block  error");
  for (const h of r.per_hook) {
    lines.push(`${h.hook.padEnd(26)}${String(h.evaluations).padEnd(7)}${String(h.allow).padEnd(7)}` +
      `${String(h.deny).padEnd(6)}${String(h.block).padEnd(7)}${h.error}`);
  }
  if (r.evaluations === 0) {
    lines.push("", "(zero rows: either no hook has run in this checkout, or the enforcement layer is inert —");
    lines.push(" and that distinction is exactly what this ledger exists to make.)");
  }
  return lines.join("\n");
}

/**
 * Aggregate the metric shards, or report the ratchet, hook and economics ledgers.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const metricsDir = args.metricsDir ? resolve(cwd, args.metricsDir) : metricsDirPath(cwd);
  const format = args.format;

  // The two exit measurements are separate modes: each reads a different ledger, and neither is a
  // StatsReport (which is schema-locked to the harvest shards).
  if (args.ratchet || args.hooks || args.economics) {
    const out = {};
    if (args.ratchet) out.ratchet = ratchetReport(readAllTrials(cwd, args.slug ?? null));
    if (args.hooks) out.hooks = hooksReport(readDecisions(cwd));
    if (args.economics) out.economics = economicsReport(cwd, args.slug ?? null);
    if (format === "table") {
      const parts = [];
      if (out.ratchet) parts.push(renderRatchet(out.ratchet));
      if (out.hooks) parts.push(renderHooks(out.hooks));
      if (out.economics) parts.push(renderEconomics(out.economics));
      console.log(parts.join("\n\n"));
    } else {
      console.log(JSON.stringify(out, null, 2));
    }
    process.exit(0);
  }

  const report = aggregate(readShards(metricsDir), { metricsDir, slugFilter: args.slug ?? null });

  const { valid, errors } = validate(report, { $ref: "domain.schema.json#/$defs/StatsReport" });
  if (!valid) {
    console.error(`  ✗ stats report drifted from domain.schema.json#/$defs/StatsReport:`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(format === "table" ? renderTable(report) : JSON.stringify(report, null, 2));
}
