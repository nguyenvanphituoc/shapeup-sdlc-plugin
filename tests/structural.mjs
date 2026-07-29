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
import { makeCtx } from "./lib/harness.mjs";

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
  "09-anti-lying-kit.mjs",
  "10-run-receipt.mjs",
  "11-is-main.mjs",
  "12-report-parity.mjs",
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
