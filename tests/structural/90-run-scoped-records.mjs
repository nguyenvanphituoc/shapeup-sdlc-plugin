// Three readers reached durable artifacts run-blind. Driven on a two-run fixture: run 1 leaves a
// round's worth of records; run 2, opened with --force and having dispatched nothing, must report
// only its own — none of run 1's rounds, none of its gate decisions, and no citation of its verdict.
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
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
    writeFileSync(join(resultsDir(ws, "f"), "evaluate-r1.json"), JSON.stringify({ schema_version: 1, order_id: "f/evaluate-r1", worker: "spec-evaluator", status: "done", verdict: { overall: "PASS", criteria: [{ criterion: "UC-01 step 1", verdict: "PASS", evidence: "src/a.ts:1" }] } }));
    const verdictPath = join(verdictsDir(ws, "f"), "r1-a1-t1.json");
    writeFileSync(verdictPath, JSON.stringify({ schema_version: 2, run_id: RUN1, scope_id: "alpha", round: 1, attempt: 1, trial: 1, overall: "green" }));
    writeFileSync(join(roundBuildDir(ws, "f"), "r1-t1.json"), JSON.stringify({ run_id: RUN1, round: 1, overall: "green" }));
    // Run 1 also answered a build attempt: a receipt and a WorkResult for alpha-r1-a1.
    const { dispatchReceipts } = await import(join(ROOT, "kernel/lib/paths.mjs"));
    mkdirSync(dirname(dispatchReceipts(ws, "f")), { recursive: true });
    writeFileSync(dispatchReceipts(ws, "f"), JSON.stringify({ at: "2026-01-01T00:00:00.000Z", order_id: "f/alpha-r1-a1", run_id: RUN1, skill_invoked: "task-executor", dispatch_ok: true }) + "\n");
    writeFileSync(join(resultsDir(ws, "f"), "alpha-r1-a1.json"), JSON.stringify({ schema_version: 1, order_id: "f/alpha-r1-a1", worker: "task-executor", status: "done" }));
    for (const g of ["L1a", "L4"]) spawnSync("node", [KERNEL, "gate", "--resolve", g, "--slug", "f", "--preset", "ci"], { cwd: ws, encoding: "utf8" });
    const rows1 = readFileSync(gates(ws, "f"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    if (rows1.length >= 1 && rows1.every((r) => r.run_id === RUN1)) ok("gate ledger rows carry the run key they were written under");
    else fail(`gate rows lack the run key: ${JSON.stringify(rows1).slice(0, 200)}`);

    // Run 2 over the same slug, having dispatched nothing.
    const run2 = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge", "--force");
    if (run2.status !== 0) { fail(`run 2 did not open: ${run2.stderr.slice(0, 300)}`); return; }
    const RUN2 = JSON.parse(readFileSync(receipt(ws, "f"), "utf8")).run_id;
    if (RUN2 === RUN1) { fail("run 2 reused run 1's key — fixture cannot measure"); return; }

    const att = kernel("probe", "attempts", "--slug", "f", "--scope", "alpha", "--round", "1", "--attempt-budget", "5");
    const aj = (() => { try { return JSON.parse(att.stdout); } catch { return null; } })();
    if (aj && aj.spent === 0 && aj.attempts?.[0]?.hasResult === false && aj.attempts?.[0]?.hasReceipt === false) ok("probe attempts over run 1's receipt and result reports run 2's attempt 1 as unattested — a prior run's WorkResult does not close this run's attempt");
    else fail(`the attempt census read run 1's evidence as run 2's: ${att.stdout.slice(0, 200)}`);
    const { deriveRounds } = await import(join(ROOT, "kernel/probe/rounds.mjs"));
    const r2 = deriveRounds(ws, "f", null);
    if (r2.rounds_used === null && r2.rounds_judged === null) ok("deriveRounds over run 2 reports no rounds — run 1's order, verdict, build gate and evaluation are another run's");
    else fail(`deriveRounds inherited run 1's rounds: ${JSON.stringify(r2)}`);

    spawnSync("node", [KERNEL, "gate", "--resolve", "L1b", "--slug", "f", "--preset", "ci"], { cwd: ws, encoding: "utf8" });
    const { collectRun } = await import(join(ROOT, "kernel/report/export.mjs"));
    const gd = collectRun(ws, "f")?.tables?.gate_decision || [];
    // Run 2's own rows: the L0 its opening recorded, and the L1b resolved above — and none of run 1's.
    const gates2 = gd.map((g) => g.gate).sort();
    if (gd.length === 2 && JSON.stringify(gates2) === JSON.stringify(["L0", "L1b"]) && gd.every((g) => g.run_id === RUN2)) ok("run 2's export carries only its own gate decisions (its opening's L0 and its L1b) — run 1's L4 sign-off is not this run's");
    else fail(`run 2's gate_decision table: ${JSON.stringify(gd)}`);

    // A citation of run 1's green verdict, from run 2, for round 1, scope alpha: refused as another run's.
    const { citationProblem } = await import(join(ROOT, "kernel/probe/eval.mjs"));
    mkdirSync(join(ws, "shapeup/f/scopes"), { recursive: true });
    writeFileSync(join(ws, "shapeup/f/scopes/alpha.md"), "---\nscope_id: alpha\n---\n# alpha\n");
    const sha = createHash("sha256").update(readFileSync(verdictPath)).digest("hex");
    const rel = verdictPath.slice(ws.length + 1);
    const cite = (scope) => ({ overall: "PASS", criteria: [{ criterion: "UC-01 step 1", verdict: "PASS", evidence: "src/a.ts:1" }], t0_citations: [{ scope_id: scope, path: rel, sha256: sha }] });
    const otherRun = citationProblem(ws, "f", cite("alpha"), { round: 1 });
    if (otherRun && /an artifact of run /.test(otherRun)) ok("a citation of a prior run's artifact is refused, naming the run");
    else fail(`a prior run's artifact was accepted as this run's evidence: ${otherRun}`);
    // The other readers of that same run-1 verdict, asked from run 2: the T0 probe, the run subgraph, the hill.
    const t0 = kernel("probe", "t0", "--slug", "f", "--scope", "alpha", "--round", "1");
    if (t0.status === 1 && /"green":false/.test(t0.stdout)) ok("probe t0 over run 1's green verdict answers run 2 with not-green");
    else fail(`probe t0 read run 1's verdict as run 2's: exit ${t0.status} ${t0.stdout.slice(0, 120)}`);
    kernel("reduce", "graph", "--slug", "f");
    const { runSubgraph } = await import(join(ROOT, "kernel/reduce/graph.mjs"));
    const sub = runSubgraph(ws, "f");
    if (sub.run === RUN2 && Object.keys(sub.green_scopes_by_round).length === 0) ok("`--subgraph run` names run 2 and carries none of run 1's greens");
    else fail(`the run subgraph aggregated across runs: run=${sub.run} greens=${JSON.stringify(sub.green_scopes_by_round)}`);
    const hill = kernel("reduce", "hill", "--slug", "f");
    const hrow = (() => { try { return JSON.parse(hill.stdout).find((r) => r.scope_id === "alpha"); } catch { return null; } })();
    if (hrow && hrow.phase !== "DOWNHILL_EXECUTION" && hrow.phase !== "FINISHED") ok(`reduce hill derives run 2's alpha from run 2's evidence (${hrow.phase}), not from run 1's green`);
    else fail(`the hill moved run 2's dot on run 1's verdict: ${JSON.stringify(hrow)}`);
    // Re-key the artifact to run 2 to isolate the scope and round checks.
    writeFileSync(verdictPath, JSON.stringify({ schema_version: 2, run_id: RUN2, scope_id: "alpha", round: 1, attempt: 1, trial: 1, overall: "green" }));
    const sha2 = createHash("sha256").update(readFileSync(verdictPath)).digest("hex");
    const cite2 = (scope) => ({ overall: "PASS", criteria: [{ criterion: "UC-01 step 1", verdict: "PASS", evidence: "src/a.ts:1" }], t0_citations: [{ scope_id: scope, path: rel, sha256: sha2 }] });
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
