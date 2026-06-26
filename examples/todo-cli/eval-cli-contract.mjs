#!/usr/bin/env node
// Worked example of the `process` evaluation oracle (Stage G of the audit), now landed.
//
// This used to hard-code its criteria inline. It has been *promoted* to consume the shared probe
// runner at `scripts/oracles/process-oracle.mjs` and a declarative contract (`todo.contract.json`)
// — the same mechanism `spec-evaluator` dispatches to for any `oracle: process` criterion. The
// example therefore demonstrates the real runner instead of duplicating its logic.
//
// Usage:  node eval-cli-contract.mjs "<command to run todo>"
//   e.g.  node eval-cli-contract.mjs "node ./reference/todo.js"
//
// Exit 0 = all criteria PASS, 1 = at least one FAIL.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runContract, formatReport } from "../../scripts/oracles/process-oracle.mjs";

const cmd = process.argv[2];
if (!cmd) {
  console.error('usage: node eval-cli-contract.mjs "<command to run todo>"');
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "todo.contract.json"), "utf8"));

const summary = runContract({ cmd, criteria: contract.criteria });
console.log(formatReport(cmd, summary));
process.exit(summary.fails === 0 ? 0 : 1);
