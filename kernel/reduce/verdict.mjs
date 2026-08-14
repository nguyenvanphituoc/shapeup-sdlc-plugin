#!/usr/bin/env node
// Verdict-ledger reference implementation — spec-evaluator's own skill-local
// reference impl (ships beside SKILL.md; not invoked at runtime).
//
// The `spec-evaluator` skill performs verdict re-probe / confidence / flip-detection as a
// self-contained procedure (`references/verdict-ledger.md`) using its own file tools — it does NOT
// call this file. This is the executable proof that the documented grammar is well-defined and
// actually discriminates an unstable judge from a stable one, the same way oracles/*
// prove the probing grammar. Structural test #15 exercises it.
//
// Ledger line shape (one per criterion per run), see verdict-ledger.md:
//   { run, task, dimension, criterion, verdict:"PASS"|"FAIL", confidence, reprobed, flip, evidence, at }
//
// Library use:
//   import { reconcile, detectFlips, stability } from "kernel/reduce/verdict.mjs";
//   const { records, summary } = reconcile(priorLines, currentRecords);

// Most recent prior line for a (dimension, criterion), by highest run number.
import { runArgs } from "../lib/argv.mjs";

/**
 * Find the most recent prior ledger line for a record's (dimension, criterion), by highest run.
 * @param {Array<{dimension:string, criterion:string, run:number, verdict:string}>} priorLines - Prior lines.
 * @param {{dimension:string, criterion:string}} rec - The record to match.
 * @returns {(object|null)} The highest-run matching prior line, or null when none exists.
 */
function priorFor(priorLines, rec) {
  let best = null;
  for (const p of priorLines) {
    if (p.criterion !== rec.criterion || p.dimension !== rec.dimension) continue;
    if (best === null || p.run > best.run) best = p;
  }
  return best;
}

// Reconcile this run's records against the prior ledger: a verdict change vs the most recent prior
// line for the same criterion sets flip=true and FORCES confidence="low" (a flip means the oracle
// is unstable on that row, regardless of what confidence the judge proposed). Returns augmented
// records + a summary. Pure: no I/O, no clock (caller stamps `at`).
/**
 * Reconcile this run's records against the prior ledger — a verdict change vs the most recent
 * prior line for the same criterion sets flip=true and FORCES confidence="low". Pure: no I/O, no clock.
 * @param {Array<object>} priorLines - Previously recorded ledger lines.
 * @param {Array<{criterion:string, dimension:string, verdict:string, confidence:string}>}
 *   currentRecords - This run's per-criterion records.
 * @returns {{records:Array<object>, summary:{total:number, flipped:number, stable:number,
 *   flips:Array<{criterion:string, dimension:string, to:string}>}}} The records augmented with
 *   `flip` (+ forced-low confidence) and a run summary.
 */
export function reconcile(priorLines, currentRecords) {
  const records = currentRecords.map((rec) => {
    const prior = priorFor(priorLines, rec);
    const flip = !!prior && prior.verdict !== rec.verdict;
    return { ...rec, flip, confidence: flip ? "low" : rec.confidence };
  });
  const flipped = records.filter((r) => r.flip);
  return {
    records,
    summary: {
      total: records.length,
      flipped: flipped.length,
      stable: records.length - flipped.length,
      flips: flipped.map((r) => ({ criterion: r.criterion, dimension: r.dimension, to: r.verdict })),
    },
  };
}

// Walk the full ledger in run order; return every criterion whose verdict changed at any step,
// with the run pair and direction. Used for the report's stability block / audit of a whole task.
/**
 * Walk the full ledger in run order and report every verdict change.
 * @param {Array<{dimension:string, criterion:string, run:number, verdict:string}>} allLines - Every ledger line.
 * @returns {Array<{criterion:string, dimension:string, from:string, to:string, runs:[number,number]}>}
 *   One entry per step where a criterion's verdict changed.
 */
export function detectFlips(allLines) {
  const byKey = new Map();
  for (const l of [...allLines].sort((a, b) => a.run - b.run)) {
    const key = `${l.dimension}::${l.criterion}`;
    const seq = byKey.get(key) || [];
    seq.push(l);
    byKey.set(key, seq);
  }
  const flips = [];
  for (const [key, seq] of byKey) {
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].verdict !== seq[i - 1].verdict) {
        flips.push({
          criterion: seq[i].criterion,
          dimension: seq[i].dimension,
          from: seq[i - 1].verdict,
          to: seq[i].verdict,
          runs: [seq[i - 1].run, seq[i].run],
        });
      }
    }
  }
  return flips;
}

// Stability of the latest run vs the run before it: fraction of the latest run's criteria whose
// verdict matches their immediately-prior line. 1.0 when there is only one run (nothing to contradict).
/**
 * Measure stability of the latest run vs the run before it.
 * @param {Array<{run:number, dimension:string, criterion:string, verdict:string}>} allLines - Every ledger line.
 * @returns {{runs:number, stable:number, total:number, ratio:number}} The max run number, how many
 *   of the latest run's criteria match their prior verdict (new criteria count as stable), the
 *   latest run's criterion count, and their ratio (1.0 when there is only one run).
 */
export function stability(allLines) {
  if (allLines.length === 0) return { runs: 0, stable: 0, total: 0, ratio: 1 };
  const maxRun = Math.max(...allLines.map((l) => l.run));
  const latest = allLines.filter((l) => l.run === maxRun);
  if (maxRun === 1) return { runs: 1, stable: latest.length, total: latest.length, ratio: 1 };
  const prior = allLines.filter((l) => l.run < maxRun);
  let stable = 0;
  for (const rec of latest) {
    const p = priorFor(prior, rec);
    if (p && p.verdict === rec.verdict) stable++;
    else if (!p) stable++; // a brand-new criterion can't have flipped
  }
  return { runs: maxRun, stable, total: latest.length, ratio: latest.length ? stable / latest.length : 1 };
}

// Parse a .jsonl ledger string into records (blank lines ignored).
/**
 * Parse a `.jsonl` verdict ledger into records.
 * @param {string} text - The ledger file contents ("" / null → []).
 * @returns {Array<object>} One parsed object per non-blank line.
 * @throws {SyntaxError} If a non-blank line is not valid JSON.
 */
export function parseLedger(text) {
  return (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// --- CLI entry: summarize a ledger file -------------------------------------
/** The typed argv contract (see `kernel/lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs reduce verdict <.verdicts-TASK.jsonl>",
  _: { arity: 1, max: 1, name: ".verdicts-TASK.jsonl" },
};

/**
 * Reconcile a verdict ledger and report its flips and stability.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const { readFileSync } = await import("node:fs");
  const path = runArgs(ARGV_SPEC, rawArgv)._[0];
  let lines;
  try { lines = parseLedger(readFileSync(path, "utf8")); }
  catch (e) { console.error(`cannot read ledger ${path}: ${e.message}`); process.exit(2); }
  const flips = detectFlips(lines);
  const s = stability(lines);
  console.log(`ledger: ${lines.length} records over ${s.runs} run(s)`);
  console.log(`stability (latest vs prior): ${s.stable}/${s.total} stable`);
  if (flips.length) {
    console.log(`⚠ ${flips.length} flip(s):`);
    for (const f of flips) console.log(`  ${f.dimension}/${f.criterion}: ${f.from}→${f.to} (runs ${f.runs.join("→")})`);
    process.exit(1);
  } else {
    console.log("✅ no verdict flips");
    process.exit(0);
  }
}
