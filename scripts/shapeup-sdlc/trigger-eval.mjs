#!/usr/bin/env node
// Tier-1 trigger-eval harness (audit Stage C1) — REPO-ONLY dev/CI asset.
//
// Measures whether each skill's `description` actually makes the model ACTIVATE that skill (via the
// real Skill tool) on the right queries — and NOT on a sibling's queries. This is the evidence
// layer F1 found missing: the prior roadmap claimed a measured baseline that was never committed,
// and its TPR≈0 was a proxy artifact (it measured slash-command self-invocation, not Skill-tool
// activation). This harness measures the real thing, and refuses to emit numbers from a run that
// didn't actually exercise the model — a broken harness must look broken, never like "0% trigger".
//
// Two modes:
//   node scripts/trigger-eval.mjs            → INVENTORY only (no auth): refresh the baseline's
//                                              dataset counts + print a summary. Safe in CI.
//   node scripts/trigger-eval.mjs --measure  → MEASURE (needs Claude auth + the plugin installed):
//                                              run every case, detect Skill activation, write a
//                                              measured baseline with method + timestamp.
//
// Measurement adapter: by default runs
//     claude --plugin-dir <root> -p "<query>" --output-format stream-json --verbose
// and scans the stream for a tool_use named "Skill" with input.skill_name. Override the whole
// command with TRIGGER_EVAL_CMD (use {{query}} and {{root}} placeholders) if your CLI differs.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = join(ROOT, "skills");
const BASELINE = join(ROOT, "evals", "baselines", "trigger-evals.baseline.json");

// ---- load datasets ----------------------------------------------------------
function loadDatasets() {
  const out = [];
  for (const name of readdirSync(SKILLS)) {
    const f = join(SKILLS, name, "evals", "trigger-evals.json");
    if (!existsSync(f)) continue;
    const ds = JSON.parse(readFileSync(f, "utf8"));
    out.push({ skill: name, file: f, ...ds });
  }
  return out.sort((a, b) => a.skill.localeCompare(b.skill));
}

function inventory(datasets) {
  const inv = {};
  for (const d of datasets) {
    const pos = d.cases.filter((c) => c.should_trigger).length;
    inv[d.skill] = { positives: pos, negatives: d.cases.length - pos, total: d.cases.length };
  }
  return inv;
}

// ---- measurement adapter ----------------------------------------------------
// Returns { activated: Set<string>, raw } for one query, or throws if the run produced NO parseable
// model/tool events at all (→ harness misconfigured; caller aborts rather than scoring it as a miss).
function runQuery(query) {
  const tmpl = process.env.TRIGGER_EVAL_CMD;
  let bin, args;
  if (tmpl) {
    const parts = tmpl.replace(/\{\{query\}\}/g, query).replace(/\{\{root\}\}/g, ROOT).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    [bin, ...args] = parts.map((p) => p.replace(/^"|"$/g, ""));
  } else {
    bin = "claude";
    args = ["--plugin-dir", ROOT, "-p", query, "--output-format", "stream-json", "--verbose"];
  }
  const r = spawnSync(bin, args, { encoding: "utf8", timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`adapter failed to spawn "${bin}": ${r.error.message}`);
  const raw = (r.stdout || "") + (r.stderr || "");
  const activated = new Set();
  let sawAnyEvent = false;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    let ev; try { ev = JSON.parse(t); } catch { continue; }
    sawAnyEvent = true;
    // Walk the event for any tool_use named "Skill" and pull its skill_name.
    const stack = [ev];
    while (stack.length) {
      const node = stack.pop();
      if (node && typeof node === "object") {
        if ((node.type === "tool_use" || node.name) && /^skill$/i.test(node.name || "")) {
          const sn = node.input?.skill_name || node.input?.name;
          if (sn) activated.add(String(sn));
        }
        for (const v of Object.values(node)) if (v && typeof v === "object") stack.push(v);
      }
    }
  }
  if (!sawAnyEvent) throw new Error("adapter produced no parseable JSON events — is `claude` installed, authed, and the plugin loadable? Refusing to score this as a non-trigger.");
  return { activated, raw };
}

function measure(datasets) {
  const results = {};
  for (const d of datasets) {
    let tp = 0, fn = 0, fp = 0, tn = 0;
    const misses = [], falsePos = [];
    for (const c of d.cases) {
      const { activated } = runQuery(c.query); // throws → abort whole run (honest failure)
      const fired = activated.has(d.skill);
      if (c.should_trigger) { fired ? tp++ : (fn++, misses.push(c.query)); }
      else { fired ? (fp++, falsePos.push(c.query)) : tn++; }
    }
    const pos = tp + fn, neg = fp + tn;
    results[d.skill] = {
      positives: pos, negatives: neg,
      tpr: pos ? +(tp / pos).toFixed(3) : null,
      fpr: neg ? +(fp / neg).toFixed(3) : null,
      precision: tp + fp ? +(tp / (tp + fp)).toFixed(3) : null,
      misses, false_positives: falsePos,
    };
  }
  return results;
}

// ---- baseline I/O -----------------------------------------------------------
function writeBaseline(obj) {
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, JSON.stringify(obj, null, 2) + "\n");
}

// ---- main -------------------------------------------------------------------
const datasets = loadDatasets();
const inv = inventory(datasets);
const totalCases = Object.values(inv).reduce((a, b) => a + b.total, 0);
const method = "claude headless (--plugin-dir .) detecting real Skill-tool activation; NOT slash-command self-invocation (the prior TPR≈0 proxy artifact, audit F1).";

if (process.argv.includes("--measure")) {
  console.log(`Measuring ${totalCases} cases across ${datasets.length} skills (needs Claude auth)…`);
  let results;
  try { results = measure(datasets); }
  catch (e) {
    console.error(`\n✗ Measurement aborted: ${e.message}`);
    console.error("  No baseline written — an unmeasurable run must NOT be recorded as a result (audit F1).");
    process.exit(1);
  }
  // measured_at is supplied by the environment, not invented here (scripts can't trust the clock).
  const measuredAt = process.env.TRIGGER_EVAL_AT || new Date().toISOString();
  writeBaseline({ status: "measured", method, model: process.env.TRIGGER_EVAL_MODEL || "unknown", measured_at: measuredAt, datasets: inv, results });
  console.log(`✓ Wrote measured baseline → ${BASELINE.replace(ROOT + "/", "")}`);
  for (const [s, r] of Object.entries(results)) console.log(`  ${s}: TPR ${r.tpr} / FPR ${r.fpr} / precision ${r.precision}`);
} else {
  // Inventory refresh only — preserve any prior measured results, just update counts honestly.
  const prior = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
  if (prior?.status === "measured") {
    prior.datasets = inv;
    writeBaseline(prior);
    console.log(`Refreshed dataset inventory in measured baseline (${totalCases} cases). Re-run with --measure to re-measure.`);
  } else {
    writeBaseline({
      status: "unmeasured",
      note: "Datasets authored; baselines NOT yet measured. Run `node scripts/trigger-eval.mjs --measure` with Claude auth and the plugin installed. Per audit F1, no TPR/FPR is written until a real run produces it.",
      method, model: null, measured_at: null, datasets: inv, results: null,
    });
    console.log(`Wrote UNMEASURED baseline inventory (${totalCases} cases across ${datasets.length} skills) → ${BASELINE.replace(ROOT + "/", "")}`);
    console.log("  Run with --measure (Claude auth) to populate TPR/FPR. Numbers are never fabricated.");
  }
  for (const [s, c] of Object.entries(inv)) console.log(`  ${s}: ${c.positives}+ / ${c.negatives}− (${c.total})`);
}
