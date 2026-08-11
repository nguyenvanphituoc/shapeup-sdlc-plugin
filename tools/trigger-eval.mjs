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
import { spawnSync, spawn } from "node:child_process";

// `tools/` -> repo root is ONE level up. This read "../.." and resolved to the repo's PARENT, so
// loadDatasets scanned a `skills/` directory outside the checkout and loaded nothing — on every
// machine, for as long as it has been wrong. The 13 datasets §16 certifies as well-formed were
// invisible to the harness meant to run them, and no check asked whether the instrument could
// reach its own input; §16 now asserts this resolution. FC-05's rate is produced by this tool.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = join(ROOT, "skills");
const BASELINE = join(ROOT, "evals", "baselines", "trigger-evals.baseline.json");
// Turn budget per probe — see the adapter note below. Override with --max-turns N.
const mtIdx = process.argv.indexOf("--max-turns");
const MAX_TURNS = mtIdx > -1 ? Math.max(1, parseInt(process.argv[mtIdx + 1], 10) || 8) : 8;

// Probe model. A full run is 149 headless sessions × up to MAX_TURNS turns, so this is a genuinely
// expensive job — pass the model explicitly (`--model claude-sonnet-5`, ~$18 at $3/$15 per MTok)
// rather than letting probes inherit whatever the caller's default is, which could be several times
// that. `claude-haiku-4-5-20251001` (~$6) remains valid and is what the committed baseline was
// measured on. Trigger rates are MODEL-DEPENDENT, so whatever is used here is recorded in the
// baseline, and a run on a different model starts a SECOND baseline rather than updating the first:
// an unlabeled activation number is not a measurement of anything, and a cross-model comparison is
// not a regression signal.
const mIdx = process.argv.indexOf("--model");
const MODEL = mIdx > -1 ? process.argv[mIdx + 1] : (process.env.TRIGGER_EVAL_MODEL || null);

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
//
// The default adapter caps the session at --max-turns 8: a trigger-eval measures ACTIVATION
// (does the model reach for the skill on this query?), not task completion — without a cap
// each probe runs the full agentic session it triggered, which is far more cost for no extra
// signal. The cap is part of the recorded method: "activation within the first 8 turns".
//
// 8, not 2. A cap of 2 was measured and REJECTED: the model routinely announces "I'll run the
// breadboarding step", spends a turn or two orienting, and calls Skill at turn ~5. At cap 2
// that scores as a miss and fabricates a low TPR — "breadboard the checkout flow" measured
// TPR 0 at cap 2 and activates cleanly at cap 6. Do not lower this to save tokens; it changes
// what is being measured.

// Activation-name normalization (verified against a live stream 2026-07: the Skill tool's
// input field is `skill`, and plugin skills arrive namespaced, e.g. "shapeup-sdlc-plugin:qa").
//   1. The marketplace prefix is stripped.
//   2. The plugin's slash COMMANDS also surface through the Skill tool. A wrapper firing IS
//      the query routing to the right craft, so each command aliases to the skill(s) it
//      delegates to — and a wrapper firing on the WRONG query stays a false positive for the
//      skill it delegates to, so aliasing never launders misfires.
const COMMAND_ALIASES = {
  ship: ["tech-lead"], shape: ["shapeup"], orient: ["orient"],
  wire: ["solution-architect"], scopes: ["ba-pitch-analyzer", "scope-architect"],
  build: ["task-executor"], eval: ["spec-evaluator"], qa: ["qa-edge-hunter"],
  hammer: ["scope-hammer"], retro: ["coach"],
};
export function parseActivations(raw) {
  const activated = new Set();
  let sawAnyEvent = false;
  // A probe that ERRORED (rate-limit, overload, api failure) and shows no activation is NOT
  // a measured miss — it is an unmeasured probe, and scoring it as a miss fabricates a low
  // TPR. The one expected "error" is error_max_turns: that is our own cap ending the session,
  // by which point any activation is already in the stream. (First measured run shipped 9
  // skills at a flat TPR 0 this way under concurrency 6; solo re-runs activated fine.)
  let apiError = false;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    let ev; try { ev = JSON.parse(t); } catch { continue; }
    sawAnyEvent = true;
    if (ev.type === "result" && ev.is_error && ev.subtype !== "error_max_turns") apiError = true;
    if (ev.type === "error" || /"(overloaded_error|rate_limit_error|api_error)"/.test(t)) apiError = true;
    const stack = [ev];
    while (stack.length) {
      const node = stack.pop();
      if (node && typeof node === "object") {
        if ((node.type === "tool_use" || node.name) && /^skill$/i.test(node.name || "")) {
          const sn = node.input?.skill || node.input?.skill_name || node.input?.name;
          if (sn) {
            const bare = String(sn).replace(/^[^:]+:/, "");
            activated.add(bare);
            for (const target of COMMAND_ALIASES[bare] || []) activated.add(target);
          }
        }
        for (const v of Object.values(node)) if (v && typeof v === "object") stack.push(v);
      }
    }
  }
  return { activated, sawAnyEvent, apiError };
}
function runQuery(query) {
  const tmpl = process.env.TRIGGER_EVAL_CMD;
  let bin, args;
  if (tmpl) {
    const parts = tmpl.replace(/\{\{query\}\}/g, query).replace(/\{\{root\}\}/g, ROOT).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    [bin, ...args] = parts.map((p) => p.replace(/^"|"$/g, ""));
  } else {
    bin = "claude";
    args = ["--plugin-dir", ROOT, "-p", query, "--max-turns", String(MAX_TURNS),
            ...(MODEL ? ["--model", MODEL] : []),
            "--output-format", "stream-json", "--verbose"];
  }
  const r = spawnSync(bin, args, { encoding: "utf8", timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`adapter failed to spawn "${bin}": ${r.error.message}`);
  const raw = (r.stdout || "") + (r.stderr || "");
  const { activated, sawAnyEvent } = parseActivations(raw);
  if (!sawAnyEvent) throw new Error("adapter produced no parseable JSON events — is `claude` installed, authed, and the plugin loadable? Refusing to score this as a non-trigger.");
  return { activated, raw };
}

// Parallel pool over ALL cases (flattened across skills): each probe is an independent
// headless session, so concurrency changes wall-clock only, never the measurement. Scoring
// stays per-skill. Any adapter throw aborts the WHOLE run — a partial result is never
// scored (audit F1: a broken harness must look broken).
async function measure(datasets, concurrency) {
  const jobs = datasets.flatMap((d) => d.cases.map((c) => ({ d, c })));
  let next = 0, done = 0, aborted = null;
  const outcomes = new Array(jobs.length);
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= jobs.length || aborted) return;
      const { d, c } = jobs[i];
      try {
        let probe = await runQueryAsync(c.query);
        if (probe.apiError && !probe.activated.has(d.skill)) {
          // Errored with no activation → unmeasured, not a miss. One retry after a breather.
          console.log(`  ↻ retrying (api error, no activation): "${c.query.slice(0, 60)}"`);
          await new Promise((r) => setTimeout(r, 20_000));
          probe = await runQueryAsync(c.query);
          if (probe.apiError && !probe.activated.has(d.skill)) {
            throw new Error(`probe errored twice with no activation ("${c.query}") — refusing to score an unmeasured probe as a miss. Lower --concurrency or wait out the rate limit.`);
          }
        }
        outcomes[i] = { fired: probe.activated.has(d.skill) };
      } catch (e) {
        aborted = e; return;
      }
      done++;
      if (done % 10 === 0 || done === jobs.length) console.log(`  … ${done}/${jobs.length} probes done`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  if (aborted) throw aborted;

  const results = {};
  for (const d of datasets) {
    let tp = 0, fn = 0, fp = 0, tn = 0;
    const misses = [], falsePos = [];
    jobs.forEach(({ d: jd, c }, i) => {
      if (jd !== d) return;
      const { fired } = outcomes[i];
      if (c.should_trigger) { fired ? tp++ : (fn++, misses.push(c.query)); }
      else { fired ? (fp++, falsePos.push(c.query)) : tn++; }
    });
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

// Async twin of runQuery: spawn (not spawnSync) so the pool actually overlaps subprocesses.
function runQueryAsync(query) {
  const tmpl = process.env.TRIGGER_EVAL_CMD;
  let bin, args;
  if (tmpl) {
    const parts = tmpl.replace(/\{\{query\}\}/g, query).replace(/\{\{root\}\}/g, ROOT).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    [bin, ...args] = parts.map((p) => p.replace(/^"|"$/g, ""));
  } else {
    bin = "claude";
    args = ["--plugin-dir", ROOT, "-p", query, "--max-turns", String(MAX_TURNS),
            ...(MODEL ? ["--model", MODEL] : []),
            "--output-format", "stream-json", "--verbose"];
  }
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let raw = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); }, 180_000);
    child.stdout.on("data", (d) => (raw += d));
    child.stderr.on("data", (d) => (raw += d));
    child.on("error", (e) => { clearTimeout(timer); reject(new Error(`adapter failed to spawn "${bin}": ${e.message}`)); });
    child.on("close", () => {
      clearTimeout(timer);
      const { activated, sawAnyEvent } = parseActivations(raw);
      if (!sawAnyEvent) return reject(new Error("adapter produced no parseable JSON events — is `claude` installed, authed, and the plugin loadable? Refusing to score this as a non-trigger."));
      resolvePromise({ activated, raw });
    });
  });
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
const method = `claude headless (--plugin-dir . -p <query> --max-turns ${MAX_TURNS}${MODEL ? ` --model ${MODEL}` : ""}) detecting real Skill-tool activation within the first ${MAX_TURNS} turns; trigger rates are MODEL-DEPENDENT — this baseline describes the model named in the "model" field and no other; NOT slash-command self-invocation (the prior TPR≈0 proxy artifact, audit F1). Activation names are namespace-stripped, and a phase-command wrapper firing counts for the skill(s) it delegates to (COMMAND_ALIASES) — a wrapper firing on the wrong query stays a false positive. Probes run in parallel (independent sessions; concurrency affects wall-clock only). KNOWN LIMITATION: probes run in this repo's own working tree, where the artifacts some queries presuppose (a pitch, a spec folder, TASK-NNN) do not exist; 17 of 74 positive cases name such an artifact and the model may correctly decline to activate and ask for it instead. Those cases understate TPR and are tracked separately — see evals/README.md.`;

if (process.argv.includes("--measure")) {
  const ci = process.argv.indexOf("--concurrency");
  // Default 2: the first run at 6 rate-limited itself into a fake flat-zero TPR for 9 skills.
  const concurrency = ci > -1 ? Math.max(1, parseInt(process.argv[ci + 1], 10) || 1) : 2;
  console.log(`Measuring ${totalCases} cases across ${datasets.length} skills (needs Claude auth, concurrency ${concurrency})…`);
  let results;
  try { results = await measure(datasets, concurrency); }
  catch (e) {
    console.error(`\n✗ Measurement aborted: ${e.message}`);
    console.error("  No baseline written — an unmeasurable run must NOT be recorded as a result (audit F1).");
    process.exit(1);
  }
  // measured_at is supplied by the environment, not invented here (scripts can't trust the clock).
  const measuredAt = process.env.TRIGGER_EVAL_AT || new Date().toISOString();
  writeBaseline({ status: "measured", method, model: MODEL || "unknown (inherited caller default)", measured_at: measuredAt, datasets: inv, results });
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
