#!/usr/bin/env node
// Kill/resume probe — the four assertions, as set operations over two snapshots.
// Identical in substance to the Stage A run (docs/migration/stage2-evidence.md §4), so a PASS here
// and the FAIL there are comparable.
//
// usage: node assert.mjs <at-kill.json> <after-resume.json>
// exit 0 = kill-resume-probe: PASS · exit 1 = FAIL

import { readFileSync } from "node:fs";

const [aPath, bPath] = process.argv.slice(2);
const A = JSON.parse(readFileSync(aPath, "utf8"));   // at the kill
const B = JSON.parse(readFileSync(bPath, "utf8"));   // after the resumed leg

const rows = [];
const check = (n, label, pass, detail) => rows.push({ n, label, pass, detail });

// 1 — no COMPLETED phase order was re-dispatched. A phase order is "completed" when a result with
// the same name existed at kill time. Its order file must be byte-identical afterwards.
{
  const bad = [];
  for (const o of A.completed_phase_orders) {
    const key = `.shapeup/${A.slug}/orders/${o}`;
    if (A.files[key] && B.files[key] && A.files[key].sha256 !== B.files[key].sha256) {
      bad.push(`${o}  ${A.files[key].sha256.slice(0, 8)}… → ${B.files[key].sha256.slice(0, 8)}…`);
    }
  }
  check(1, `no completed PHASE order was re-dispatched (${A.completed_phase_orders.length} completed at kill time)`, bad.length === 0, bad);
}

// 1b — nor was its result re-ingested.
{
  const bad = [];
  for (const o of A.completed_phase_orders) {
    const key = `.shapeup/${A.slug}/results/${o}`;
    if (A.files[key] && B.files[key] && A.files[key].sha256 !== B.files[key].sha256) {
      bad.push(`${o}  ${A.files[key].sha256.slice(0, 8)}… → ${B.files[key].sha256.slice(0, 8)}…`);
    }
  }
  check("1b", `no result for a completed phase was re-ingested (${A.completed_phase_orders.length} checked)`, bad.length === 0, bad);
}

// 2 — no scope that was T0-green at kill time was rebuilt: no NEW verdict artifact for that
// (scope, round) may appear afterwards.
{
  const greenPairs = new Set(A.green_verdicts.map((g) => `${g.scope_id}@r${g.round}`));
  const before = new Set(A.verdicts);
  const bad = [];
  for (const g of B.green_verdicts) {
    if (!greenPairs.has(`${g.scope_id}@r${g.round}`)) continue;
    if (!before.has(g.file)) bad.push(`${g.scope_id}@r${g.round} produced a NEW verdict ${g.file} after the kill`);
  }
  for (const v of B.verdicts.filter((x) => !before.has(x))) {
    // A new verdict for an ALREADY-green pair is a rebuild; for a pair that was not green it is the
    // resumed scope doing its job, which is correct and reported rather than asserted.
    const g = B.green_verdicts.find((x) => x.file === v);
    if (g && greenPairs.has(`${g.scope_id}@r${g.round}`) && !bad.some((s) => s.includes(v))) {
      bad.push(`${v} rebuilt an already-green (${g.scope_id}, r${g.round})`);
    }
  }
  check(2, `no scope that was T0-green at kill time was rebuilt (${greenPairs.size} green pair(s) at kill)`, bad.length === 0, bad);
}

// 3 — every pre-kill T0 verdict artifact survives byte-identical, so the resumed round can still
// cite at EVAL the artifact its pre-kill self produced.
{
  const bad = [];
  for (const v of A.verdicts) {
    const key = `.shapeup/${A.slug}/t0/verdicts/${v}`;
    if (!B.files[key]) bad.push(`${v} is GONE after the resumed leg`);
    else if (A.files[key].sha256 !== B.files[key].sha256) bad.push(`${v} was rewritten`);
  }
  check(3, `every pre-kill T0 verdict artifact survives byte-identical (${A.verdicts.length} found)`, bad.length === 0, bad);
}

const passed = rows.every((r) => r.pass);

console.log(`\nkill-resume-probe: ${passed ? "PASS" : "FAIL"}\n`);
console.log("| # | assertion | outcome |");
console.log("|---|---|---|");
for (const r of rows) {
  const detail = r.pass ? "" : ` — ${Array.isArray(r.detail) ? r.detail.join("; ") : r.detail}`;
  console.log(`| ${r.n} | ${r.label} | **${r.pass ? "PASS" : "FAIL"}**${detail} |`);
}

console.log("\nReported, not asserted (resuming these IS the fast-forward working):");
console.log(`  pending orders at kill: ${A.pending_orders.join(", ") || "(none)"}`);
console.log(`  run status:   at kill ${A.run_status} → after resume ${B.run_status}`);
console.log(`  active-scope: at kill ${JSON.stringify(A.active_scope)} → after resume ${JSON.stringify(B.active_scope)}`);
console.log(`  new artifacts after resume: ${Object.keys(B.files).filter((f) => !A.files[f]).length}`);

process.exit(passed ? 0 : 1);
