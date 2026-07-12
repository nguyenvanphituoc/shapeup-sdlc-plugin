// Oracle registry for the evaluation contract (Stage G of the audit).
//
// The single entry point `spec-evaluator` dispatches through when a criterion / Test-Surface row
// carries an `oracle:` tag. Adding a new oracle type = registering one runner here (the spec's
// "new oracle types are added by registering a probe runner"). The contract interface is fixed —
// `{ fails, results }` where each result is `{ id, desc, pass, evidence }` — implementations grow.
//
//   import { runOracle, ORACLES } from ".../scripts/oracles/index.mjs";
//   const { fails, results } = await runOracle("process", { cmd, criteria });
//
// `runOracle` is async so a sync runner (process/test/snapshot) and an async one (http) share one
// call shape; awaiting a non-promise is a no-op.

import { runContract as runProcess } from "./process-oracle.mjs";
import { runContract as runTest } from "./test-oracle.mjs";
import { runContract as runSnapshot } from "./snapshot-oracle.mjs";
import { runContract as runHttp } from "./http-oracle.mjs";

// The registry is the source of truth for "which oracles exist". Docs (probing.md,
// test-surface.md, evaluation-contract-spec.md) and structural test #8 are checked against it.
export const ORACLES = {
  process: runProcess,   // CLI / script   — spawn, grade exit + stdout
  test: runTest,         // library/module — run the suite, grade exit + failing names
  snapshot: runSnapshot, // generator/refactor — diff stdout vs golden
  http: runHttp,         // service / API  — start server, request, grade status + body
  // ui: handled in-skill by the Playwright CLI loop (not a Node runner) — see probing.md.
};

export async function runOracle(oracle, args) {
  const fn = ORACLES[oracle];
  if (!fn) throw new Error(`unknown oracle "${oracle}" (known: ${Object.keys(ORACLES).join(", ")}, plus "ui" in-skill)`);
  return await fn(args);
}

// The full set the evaluator understands, including the in-skill `ui` path.
export const ORACLE_NAMES = [...Object.keys(ORACLES), "ui"];
