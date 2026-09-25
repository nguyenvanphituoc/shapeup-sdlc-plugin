// The run ledger's front matter and tables used to be hand-shaped placeholders nothing filled: a
// run closed `shipped` beside `final_verdict: ~`, `rounds_used: 0`, an empty Decisions table and
// seven rows in gates.jsonl. A reader who trusted the counters concluded no round ran. The close
// now derives all of it from the run's own records — the same ones the export reads.
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  section("140. The ledger's verdict, round count and tables are derived at the close, never hand-kept");

  const ws = mkdtempSync(join(tmpdir(), "ledger-close-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const opened = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    if (opened.status !== 0) { fail(`could not open a run: ${opened.stderr.slice(0, 200)}`); return; }
    const { gates, verdictsDir, roundBuildDir, resultsDir, harnessRun } = await import(join(ROOT, "kernel/lib/paths.mjs"));
    // The records the export reads: two gate decisions, one T0 verdict, one build gate, one FAIL evaluation.
    writeFileSync(gates(ws, "f"), [
      JSON.stringify({ gate: "L1a", status: "ok", decision: "proceed", source: "preset:ci", note: "Pre-approved | headless" }),
      JSON.stringify({ gate: "L3", status: "ok", decision: "loop", source: "preset:ci", note: "again" }),
    ].join("\n") + "\n");
    mkdirSync(verdictsDir(ws, "f"), { recursive: true });
    writeFileSync(join(verdictsDir(ws, "f"), "r1-a1-t1.json"), JSON.stringify({ schema_version: 2, round: 1, attempt: 1, trial: 1, scope_id: "sc-a", overall: "green" }));
    mkdirSync(roundBuildDir(ws, "f"), { recursive: true });
    writeFileSync(join(roundBuildDir(ws, "f"), "r1-t1.json"), JSON.stringify({ round: 1, overall: "green" }));
    mkdirSync(resultsDir(ws, "f"), { recursive: true });
    writeFileSync(join(resultsDir(ws, "f"), "evaluate-r1.json"), JSON.stringify({ schema_version: 1, order_id: "f/evaluate-r1", worker: "spec-evaluator", status: "done",
      verdict: { overall: "FAIL", criteria: [{ criterion: "a", verdict: "PASS" }, { criterion: "b", verdict: "FAIL" }, { criterion: "c", verdict: "FAIL" }] } }));

    const closed = kernel("probe", "resume", "--slug", "f", "--close-arm", "gate_h", "--cause", "breaker=outer");
    if (closed.status !== 0) { fail(`the close failed: ${(closed.stderr || closed.stdout).slice(0, 300)}`); return; }
    const ledger = readFileSync(harnessRun(ws, "f"), "utf8");
    if (/^final_verdict: FAIL$/m.test(ledger)) ok("final_verdict is derived from the newest evaluation result (FAIL), not left at ~");
    else fail(`final_verdict not derived: ${(ledger.match(/^final_verdict:.*$/m) || ["(missing)"])[0]}`);
    if (/^rounds_used: 1$/m.test(ledger)) ok("rounds_used is derived from the round artifacts (1), not left at 0");
    else fail(`rounds_used not derived: ${(ledger.match(/^rounds_used:.*$/m) || ["(missing)"])[0]}`);
    if (/^\| L1a \| proceed \| preset:ci \| Pre-approved \\\| headless \|$/m.test(ledger) && /^\| L3 \| loop \| preset:ci \| again \|$/m.test(ledger)) ok("the Decisions table carries every gates.jsonl row, pipes escaped");
    else fail(`the Decisions table was not derived from gates.jsonl:\n${ledger.slice(ledger.indexOf("## Decisions"))}`);
    if (/^\| Init  \| —     \| run opened/m.test(ledger) && /^\| Build \| 1 \| T0 1 green \/ 0 red \| — \| round build gate: green \|$/m.test(ledger) && /^\| Eval \| 1 \| FAIL \| — \| 1 PASS \/ 2 FAIL criteria \|$/m.test(ledger)) {
      ok("the Rounds table keeps the Init row and derives one Build row and one Eval row from the round's artifacts");
    } else fail(`the Rounds table was not derived:\n${ledger.slice(ledger.indexOf("## Rounds"), ledger.indexOf("## Decisions"))}`);
    if (/^closed_status: escalated$/m.test(ledger) && /^close_cause: breaker=outer$/m.test(ledger)) ok("the close line itself is unchanged by the derivation");
    else fail("the close line was disturbed");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
