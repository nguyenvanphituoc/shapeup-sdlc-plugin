// Three readers reached durable artifacts run-blind. Driven on a two-run fixture: run 1 leaves a
// round's worth of records; run 2, opened with --force and having dispatched nothing, must report
// only its own — none of run 1's rounds, none of its gate decisions, and no citation of its verdict.
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  section("142. Rounds, gate decisions and citations are scoped to the run that produced them");

  const ws = mkdtempSync(join(tmpdir(), "run-scoped-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const { verdictsDir, roundBuildDir, ordersDir, resultsDir, gates, receipt } = await import(join(ROOT, "kernel/lib/paths.mjs"));
    const run1 = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    if (run1.status !== 0) { fail(`run 1 did not open: ${run1.stderr.slice(0, 200)}`); return; }
    const RUN1 = JSON.parse(readFileSync(receipt(ws, "f"), "utf8")).run_id;

    // Run 1's round: an order, a green verdict, a build gate, an evaluation, and two gate decisions.
    mkdirSync(ordersDir(ws, "f"), { recursive: true }); mkdirSync(resultsDir(ws, "f"), { recursive: true });
    mkdirSync(verdictsDir(ws, "f"), { recursive: true }); mkdirSync(roundBuildDir(ws, "f"), { recursive: true });
    writeFileSync(join(ordersDir(ws, "f"), "alpha-r1-a1.json"), JSON.stringify({ schema_version: 1, order_id: "f/alpha-r1-a1", run_id: RUN1, worker: "task-executor", operation: "execute" }));
    writeFileSync(join(ordersDir(ws, "f"), "evaluate-r1.json"), JSON.stringify({ schema_version: 1, order_id: "f/evaluate-r1", run_id: RUN1, worker: "spec-evaluator", operation: "evaluate" }));
    writeFileSync(join(resultsDir(ws, "f"), "evaluate-r1.json"), JSON.stringify({ schema_version: 1, order_id: "f/evaluate-r1", worker: "spec-evaluator", status: "done", verdict: { overall: "PASS", criteria: [] } }));
    const verdictPath = join(verdictsDir(ws, "f"), "r1-a1-t1.json");
    writeFileSync(verdictPath, JSON.stringify({ schema_version: 2, run_id: RUN1, scope_id: "alpha", round: 1, attempt: 1, trial: 1, overall: "green" }));
    writeFileSync(join(roundBuildDir(ws, "f"), "r1-t1.json"), JSON.stringify({ run_id: RUN1, round: 1, overall: "green" }));
    for (const g of ["L1a", "L4"]) spawnSync("node", [KERNEL, "gate", "--resolve", g, "--slug", "f", "--preset", "ci"], { cwd: ws, encoding: "utf8" });
    const rows1 = readFileSync(gates(ws, "f"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    if (rows1.length >= 1 && rows1.every((r) => r.run_id === RUN1)) ok("gate ledger rows carry the run key they were written under");
    else fail(`gate rows lack the run key: ${JSON.stringify(rows1).slice(0, 200)}`);

    // Run 2 over the same slug, having dispatched nothing.
    const run2 = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge", "--force");
    if (run2.status !== 0) { fail(`run 2 did not open: ${run2.stderr.slice(0, 300)}`); return; }
    const RUN2 = JSON.parse(readFileSync(receipt(ws, "f"), "utf8")).run_id;
    if (RUN2 === RUN1) { fail("run 2 reused run 1's key — fixture cannot measure"); return; }

    const { deriveRounds } = await import(join(ROOT, "kernel/probe/rounds.mjs"));
    const r2 = deriveRounds(ws, "f", null);
    if (r2.rounds_used === null && r2.rounds_judged === null) ok("deriveRounds over run 2 reports no rounds — run 1's order, verdict, build gate and evaluation are another run's");
    else fail(`deriveRounds inherited run 1's rounds: ${JSON.stringify(r2)}`);

    spawnSync("node", [KERNEL, "gate", "--resolve", "L1b", "--slug", "f", "--preset", "ci"], { cwd: ws, encoding: "utf8" });
    const { collectRun } = await import(join(ROOT, "kernel/report/export.mjs"));
    const gd = collectRun(ws, "f")?.tables?.gate_decision || [];
    if (gd.length === 1 && gd[0].gate === "L1b" && gd[0].run_id === RUN2) ok("run 2's export carries only its own gate decision — run 1's L4 sign-off is not this run's");
    else fail(`run 2's gate_decision table: ${JSON.stringify(gd)}`);

    // A citation of run 1's green verdict, from run 2, for round 1, scope alpha: refused as another run's.
    const { citationProblem } = await import(join(ROOT, "kernel/probe/eval.mjs"));
    mkdirSync(join(ws, "shapeup/f/scopes"), { recursive: true });
    writeFileSync(join(ws, "shapeup/f/scopes/alpha.md"), "---\nscope_id: alpha\n---\n# alpha\n");
    const sha = createHash("sha256").update(readFileSync(verdictPath)).digest("hex");
    const rel = verdictPath.slice(ws.length + 1);
    const cite = (scope) => ({ overall: "PASS", criteria: [], t0_citations: [{ scope_id: scope, path: rel, sha256: sha }] });
    const otherRun = citationProblem(ws, "f", cite("alpha"), { round: 1 });
    if (otherRun && /an artifact of run /.test(otherRun)) ok("a citation of a prior run's artifact is refused, naming the run");
    else fail(`a prior run's artifact was accepted as this run's evidence: ${otherRun}`);
    // Re-key the artifact to run 2 to isolate the scope and round checks.
    writeFileSync(verdictPath, JSON.stringify({ schema_version: 2, run_id: RUN2, scope_id: "alpha", round: 1, attempt: 1, trial: 1, overall: "green" }));
    const sha2 = createHash("sha256").update(readFileSync(verdictPath)).digest("hex");
    const cite2 = (scope) => ({ overall: "PASS", criteria: [], t0_citations: [{ scope_id: scope, path: rel, sha256: sha2 }] });
    const wrongScope = citationProblem(ws, "f", cite2("beta"), { round: 1 });
    const wrongRound = citationProblem(ws, "f", cite2("alpha"), { round: 2 });
    const right = citationProblem(ws, "f", cite2("alpha"), { round: 1 });
    if (wrongScope && /scope "beta"/.test(wrongScope) && wrongRound && /round 1 artifact/.test(wrongRound) && right === null) {
      ok("a citation must name the scope and the round the artifact records; the honest one still passes");
    } else fail(`scope/round checks: scope=${wrongScope} round=${wrongRound} right=${right}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
