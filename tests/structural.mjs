#!/usr/bin/env node
// Structural test layer — the runner.
//
// Zero dependencies, zero network, no Claude calls. Every module executes shipped code against a
// fixture, or validates a shipped file, or reads a shipped instruction against the thing it names;
// none asserts wording. One shared context (tests/lib/harness.mjs) goes through each module in
// order, a module that throws is recorded as one failure and the suite goes on, and the last module
// runs after the rest so the checks floor sees every check.
//
// Usage:  node tests/structural.mjs        (exit 0 = pass, 1 = fail)
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCtx } from "./lib/harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HERE = dirname(fileURLToPath(import.meta.url));
const ctx = makeCtx(ROOT);

const MODULES = [
  "01-manifests.mjs",
  "02-agents-and-skills.mjs",
  "03-fence.mjs",
  "04-ledger.mjs",
  "05-t0.mjs",
  "06-gate.mjs",
  "07-envelope.mjs",
  "08-shipped-set.mjs",
  "09-init.mjs",
  "10-oracles.mjs",
  "11-skill-anatomy.mjs",
  "12-layers.mjs",
  "13-core-profile.mjs",
];

// The floor: a refactor that silently deletes checks must fail loudly rather than read green.
const CHECKS_FLOOR = 190;

for (const file of MODULES) {
  try {
    const mod = await import(join(HERE, "structural", file));
    await mod.run(ctx);
  } catch (e) {
    ctx.fail(`${file} threw: ${e.stack || e.message}`);
  }
}

if (ctx.checks < CHECKS_FLOOR) ctx.fail(`only ${ctx.checks} checks ran; the floor is ${CHECKS_FLOOR}`);
console.log(`\n${ctx.checks} checks, ${ctx.failures} failure(s)`);
process.exit(ctx.failures ? 1 : 0);
