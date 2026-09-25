// `overall` was the judge's own field, and nothing recomputed it from the criteria the judge graded:
// a PASS over a failing criterion, or over no criterion at all, validated, ingested, and the round
// loop branched on it. The evaluator's first rule is that absence of evidence is a FAIL.
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  section("143. A verdict's overall is derived from its criteria — on ingest and on read");

  const { verdictProblem } = await import(join(ROOT, "kernel/probe/eval.mjs"));
  const P = (evidence = "src/a.ts:12") => ({ criterion: "UC-01 step 1", verdict: "PASS", evidence });
  const F = { criterion: "UC-01 step 2", verdict: "FAIL", evidence: "src/a.ts:20 returns null" };
  const cases = [
    ["PASS over a FAIL criterion", { overall: "PASS", criteria: [P(), F] }, /says PASS while 1 of its 2 criteria read FAIL/],
    ["PASS over no criteria", { overall: "PASS", criteria: [] }, /grades no criterion/],
    ["PASS criterion with no evidence", { overall: "PASS", criteria: [P("")] }, /marked PASS with no evidence/],
    ["FAIL over all-PASS criteria", { overall: "FAIL", criteria: [P()] }, /says FAIL while every one/],
    ["FAIL over no criteria", { overall: "FAIL", criteria: [] }, /must name what failed/],
  ];
  for (const [label, v, re] of cases) {
    const why = verdictProblem(v);
    if (why && re.test(why)) ok(`refused: ${label}`);
    else fail(`${label} was not refused as expected: ${why}`);
  }
  if (verdictProblem({ overall: "PASS", criteria: [P(), P("src/b.ts:3")] }) === null && verdictProblem({ overall: "FAIL", criteria: [P(), F] }) === null) ok("an honest PASS (all criteria pass with evidence) and an honest FAIL (a failing criterion cited) both stand");
  else fail("an honest verdict was refused");

  // Through the real ingest and the real probe.
  const ws = mkdtempSync(join(tmpdir(), "verdict-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const opened = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    const compiled = kernel("compile", "--operation", "evaluate", "--slug", "f", "--round", "1");
    if (opened.status !== 0 || compiled.status !== 0) { fail(`fixture: init=${opened.status} compile=${compiled.status} ${compiled.stderr.slice(0, 200)}`); return; }
    const orderPath = join(ws, ".shapeup/f/orders/evaluate-r1.json");
    const orderId = JSON.parse(readFileSync(orderPath, "utf8")).order_id;
    mkdirSync(join(ws, ".shapeup/f/results"), { recursive: true });
    const resultPath = join(ws, ".shapeup/f/results/evaluate-r1.json");
    writeFileSync(resultPath, JSON.stringify({ schema_version: 1, order_id: orderId, worker: "spec-evaluator", status: "done", verdict: { overall: "PASS", criteria: [P(), F] } }));
    const ing = kernel("reduce", "ingest", "--order", orderPath, "--no-receipt-check");
    if (ing.status !== 0 && /says PASS while 1 of its 2 criteria read FAIL/.test(ing.stderr)) ok("reduce ingest refuses a PASS whose own criteria carry a FAIL, and says so");
    else fail(`ingest accepted or misdescribed a PASS over a failing criterion: exit ${ing.status} ${(ing.stderr || ing.stdout).slice(0, 200)}`);
    const pe = kernel("probe", "eval", "--slug", "f", "--round", "1");
    const j = (() => { try { return JSON.parse(pe.stdout); } catch { return null; } })();
    if (pe.status !== 0 && j && j.ok === false && /criteria read FAIL/.test(j.reason || "")) ok("probe eval reports the same verdict as unfit for the round to act on");
    else fail(`probe eval did not refuse: exit ${pe.status} ${pe.stdout.slice(0, 200)}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
