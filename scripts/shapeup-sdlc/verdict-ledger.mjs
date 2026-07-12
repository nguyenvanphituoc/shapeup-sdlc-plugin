#!/usr/bin/env node
// Verdict-ledger reference implementation (audit Stage D1) — REPO-ONLY dev/CI asset.
//
// The `spec-evaluator` skill performs verdict re-probe / confidence / flip-detection as a
// self-contained procedure (`references/verdict-ledger.md`) using its own file tools — it does NOT
// call this file. This is the executable proof that the documented grammar is well-defined and
// actually discriminates an unstable judge from a stable one, the same way scripts/oracles/* prove
// the probing grammar. Structural test #15 exercises it.
//
// Ledger line shape (one per criterion per run), see verdict-ledger.md:
//   { run, task, dimension, criterion, verdict:"PASS"|"FAIL", confidence, reprobed, flip, evidence, at }
//
// Library use:
//   import { reconcile, detectFlips, stability } from ".../scripts/verdict-ledger.mjs";
//   const { records, summary } = reconcile(priorLines, currentRecords);

// Most recent prior line for a (dimension, criterion), by highest run number.
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
export function parseLedger(text) {
  return (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// --- CLI entry: summarize a ledger file -------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import("node:fs");
  const path = process.argv[2];
  if (!path) { console.error("usage: node verdict-ledger.mjs <.verdicts-TASK.jsonl>"); process.exit(2); }
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
