// Oracle registry for the evaluation contract.
//
// The single entry point `spec-evaluator` dispatches through when a criterion / Test-Surface row
// carries an `oracle:` tag. Adding a new oracle type = registering one runner here (the spec's
// "new oracle types are added by registering a probe runner"). The contract interface is fixed —
// `{ fails, results }` where each result is `{ id, desc, pass, evidence }` — implementations grow.
//
//   import { runOracle, ORACLES } from ".../oracles/index.mjs";
//   const { fails, results } = await runOracle("process", { cmd, criteria });
//
// `runOracle` is async so a sync runner (process/test/snapshot) and an async one (http/ui) share
// one call shape; awaiting a non-promise is a no-op.

import { runContract as runProcess } from "./process-oracle.mjs";
import { runContract as runTest } from "./test-oracle.mjs";
import { runContract as runSnapshot } from "./snapshot-oracle.mjs";
import { runContract as runHttp } from "./http-oracle.mjs";
import { runContract as runUi } from "./ui-oracle.mjs";

// The registry is the source of truth for "which oracles exist". The two shipped prose files that
// name the oracles — the evaluator's `references/probing.md` and the planner's
// `references/test-surface.md` — are checked against this table by the structural suite, in both
// directions, so a runner added here without a row there is a failure rather than a silent gap.
export const ORACLES = {
  process: runProcess,   // CLI / script   — spawn, grade exit + stdout
  test: runTest,         // library/module — run the suite, grade exit + failing names
  snapshot: runSnapshot, // generator/refactor — diff stdout vs golden
  http: runHttp,         // service / API  — start server, request, grade status + body
  ui: runUi,             // web app        — start server, drive the Playwright CLI, grade affordances
};

export async function runOracle(oracle, args) {
  const fn = ORACLES[oracle];
  if (!fn) throw new Error(`unknown oracle "${oracle}" (known: ${Object.keys(ORACLES).join(", ")})`);
  return await fn(args);
}

// The full set the evaluator understands. `ui` used to be excluded here and appended by hand,
// because it had no runner and was performed in-skill as a prose loop; it is a runner like the
// rest now, so the registry is once again the whole truth and there is no second list to drift.
export const ORACLE_NAMES = [...Object.keys(ORACLES)];
