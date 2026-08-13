#!/usr/bin/env node
// Structural test layer for the Shape Up SDLC plugin — thin runner (Track C split).
//
// Zero dependencies, zero network, no Claude calls. Runs in milliseconds and is safe in CI.
// It does NOT test agent behavior (that needs tier-1/2 evals — see docs/audit). It proves the
// plugin is *well-formed*: the cheapest, highest-ROI guard, and the one that would have caught
// the broken `AGENT.md` reference and any future frontmatter/version drift.
//
// The suite is split by ownership domain into tests/structural/*.mjs; this runner threads one
// shared ctx (tests/lib/harness.mjs) through each module in order, isolates a thrown module as a
// single failure (the whole suite never aborts), then applies the §26d checks-floor against the
// grand total. The name is kept — docs cite `tests/structural.mjs` and §26c would fail otherwise.
//
// Usage:  node tests/structural.mjs        (exit 0 = pass, 1 = fail)

import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { makeCtx } from "./lib/harness.mjs";

// The suite EXECUTES the real hooks, and since v1.5 every hook evaluation appends a decision row.
// Without this redirect each `npm test` wrote ~21 rows into the developer's live
// `.shapeup/decisions.jsonl`, where `stats --hooks` would later read them back as if they
// were evaluations from a real run. Tests must not contaminate the instrument they test.
// (15-hook-receipts.mjs deliberately UNSETS this for its own spawns — it needs the real
// per-workspace path resolution to be what is under test.)
const DECISIONS_TMP = mkdtempSync(join(tmpdir(), "structural-decisions-"));
process.env.SHAPEUP_DECISIONS_PATH = join(DECISIONS_TMP, "decisions.jsonl");
process.on("exit", () => { try { rmSync(DECISIONS_TMP, { recursive: true, force: true }); } catch { /* best effort */ } });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HERE = dirname(fileURLToPath(import.meta.url));
const ctx = makeCtx(ROOT);

// Modules run in this order; the docs module (08) is last so §26d sees the full check count.
const MODULE_FILES = [
  "01-manifests.mjs",
  "02-skills.mjs",
  "03-hooks.mjs",
  "04-oracles.mjs",
  "05-tech-lead.mjs",
  "06-ba-pitch-analyzer.mjs",
  "07-spec-evaluator.mjs",
  "10-run-receipt.mjs",
  "11-is-main.mjs",
  "13-argv-contract.mjs",
  "14-invocation-paths.mjs",
  "15-hook-receipts.mjs",
  // 16-workflows.mjs: skills/tech-lead/workflows/*.js — the D5 model floor and the test-#45
  // path-literal discipline extended to Workflow scripts.
  "16-workflows.mjs",
  // 17-gate-zerowork-workflow.mjs: the zero-work gate's Workflow arm (migration A5). Its own
  // module rather than a section-37 addendum — the predicate is the cutover's, not the receipt's.
  "17-gate-zerowork-workflow.mjs",
  // 18-resume-state.mjs: the fast-forward derivation (migration A2). The kill/resume probe found
  // ORIENT re-dispatched on every relaunch because its skip read stored status instead of its own
  // artifacts; this module is the seam that defect could not be caught through.
  "18-resume-state.mjs",
  // 19-run-records.mjs: the run key and the fact tables projected from it. Its own module because
  // the property is cross-cutting — five separate writers must stamp the same key, and the failure
  // mode is the one this repo keeps hitting: stamp four of them and nothing errors.
  "19-run-records.mjs",
  "45-paths.mjs",
  "46-contract-md.mjs",
  "47-ship-report.mjs",
  "50-payload-contract-parity.mjs",
  "08-docs.mjs",
];

for (const file of MODULE_FILES) {
  const mod = await import(join(HERE, "structural", file));
  try {
    await mod.run(ctx);
  } catch (e) {
    // Isolate a thrown module as one failure and continue — never abort the whole suite.
    ctx.fail(`${file} threw: ${e && e.stack ? e.stack : e}`);
  }
}

// The floor parsed in section 26(d) is asserted here, where the final total exists.
if (ctx.checksFloor !== null) {
  if (ctx.checks >= ctx.checksFloor) ctx.ok(`total checks (${ctx.checks}) meet the documented floor (${ctx.checksFloor}+)`);
  else ctx.fail(`docs promise ${ctx.checksFloor}+ checks but only ${ctx.checks} ran — lower the floor only if checks were deliberately removed`);
}

console.log(`\n${"=".repeat(60)}`);
if (ctx.failures === 0) {
  console.log(`✅ structural tests passed (${ctx.checks} checks)`);
  process.exit(0);
} else {
  console.error(`❌ ${ctx.failures} structural failure(s), ${ctx.checks} checks passed`);
  process.exit(1);
}
