// A GREEN SCOPE IS REPORTED GREEN, AND A PASSED ROUND IS NOT RECORDED AS FAILED.
//
// Two records contradicted the run they described:
//   1. A T0 score carries `regressions` only when there was a baseline to regress against. The
//      ratchet required an explicit 0, so a run whose every scope went green reported "no scope
//      reached green", and the ship report's table printed the missing field as `undefined`.
//   2. GATE L3's answers are written before a verdict exists — `loop` means "on a FAIL, run the next
//      round" — and the row recorded that note whatever happened. A round that PASSED left a row
//      reading "FAIL → fix round r+1".
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the green-and-pass record checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { ratchetReport } = await import(join(ROOT, "kernel/probe/stats.mjs"));
  const { buildReport } = await import(join(ROOT, "kernel/reduce/ship.mjs"));
  const { gateNote } = await import(join(ROOT, "kernel/gate.mjs"));

  section("158. A green scope reads green without a regression count, and a PASS round's L3 row says PASS");

  const row = (scope_id, trial, passed, total, extra = {}) => ({ scope_id, trial, status: "kept", score: { fixtures_passed: passed, fixtures_total: total, db_probe: null, ...extra } });
  const r = ratchetReport([
    row("a", 1, 3, 3),                         // green, no regressions field
    row("b", 1, 2, 3), row("b", 2, 3, 3),      // green on the second trial
    row("c", 1, 3, 3, { regressions: 2 }),     // all fixtures pass but it regressed: not green
  ]);
  const at = Object.fromEntries(r.per_scope.map((s) => [s.scope_id, s.reached_green_at_trial]));
  if (at.a === 1 && at.b === 2) ok("a score with no regressions field counts as green when every fixture passed");
  else fail(`reached_green_at_trial: ${JSON.stringify(at)}`);
  if (at.c === null) ok("an explicit regression count above zero still keeps a scope from green");
  else fail(`a regressed scope was counted green at trial ${at.c}`);
  if (r.mean_trials_to_green === 1.5) ok("mean trials to green is computed over the scopes that reached it");
  else fail(`mean_trials_to_green = ${r.mean_trials_to_green}`);

  const md = buildReport({ slug: "demo", at: "2026-09-26", verdict: "PASS", qa: "run", rounds: 1,
    board: { done: 1, total: 1, unfinished: [] }, t0: [{ scope_id: "a", score: { fixtures_passed: 3, fixtures_total: 3, db_probe: null }, status: "kept", delta: "baseline", trials: 1 }],
    artifacts: 1, ratchet: r });
  if (!/undefined/.test(md)) ok("the ship report never prints 'undefined' for an unmeasured field");
  else fail(`the report prints undefined: ${md.split("\n").filter((l) => /undefined/.test(l)).join(" / ")}`);

  const pass = gateNote({ gate: "L3", decision: "loop", note: "FAIL → fix round r+1" }, "pass");
  const failed = gateNote({ gate: "L3", decision: "loop", note: "FAIL → fix round r+1" }, "fail");
  const other = gateNote({ gate: "L2", decision: "proceed", note: "board complete" }, "pass");
  if (/verdict PASS/.test(pass) && !/FAIL → fix/.test(pass)) ok("an L3 row crossed over a PASS says so, not the preset's failure note");
  else fail(`L3 over PASS noted: ${pass}`);
  if (failed === "FAIL → fix round r+1" && other === "board complete") ok("an L3 row over a FAIL, and every other gate, keep their answer's own note");
  else fail(`notes changed where they should not: ${failed} / ${other}`);

  const d = mkdtempSync(join(tmpdir(), "l3-verdict-"));
  try {
    const g = (...a) => spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "gate", ...a, "--cwd", d], { encoding: "utf8" });
    g("--init", "--preset", "ci", "--slug", "demo");
    g("--resolve", "L3", "--slug", "demo", "--round", "1", "--verdict", "pass");
    const ledger = join(d, ".shapeup/demo/gates.jsonl");
    const rows = existsSync(ledger) ? readFileSync(ledger, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
    const l3 = rows.find((x) => x.gate === "L3");
    if (l3?.verdict === "pass" && /verdict PASS/.test(l3.note || "")) ok("the gate CLI records the round's verdict on the L3 row it writes");
    else fail(`L3 row from the CLI: ${JSON.stringify(l3)} (rows: ${rows.length})`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
