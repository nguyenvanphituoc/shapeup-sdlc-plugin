// TWO JUDGES, ONE SPEC, 5/5 AND 0/5.
//
// `traces_to` is copied from the covers clauses of the acceptance criteria a criterion grades, and
// the requirements matrix is joined along it. One judge anchored every row and the matrix read 5/5;
// the next, on the same spec and instruction, anchored none and it read 0/5 over the same passes. A
// verdict that anchors no criterion at all, beside a board whose ACs cover requirements, is refused on
// ingest and by probe eval, and the run sends the judge back once. Which requirement a criterion
// traces to stays the judge's reading; only the all-empty case is refused.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the traces checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { tracesProblem } = await import(join(ROOT, "kernel/probe/eval.mjs"));

  section("168. A verdict anchors at least one criterion to a requirement when the board covers some");

  const d = mkdtempSync(join(tmpdir(), "traces-"));
  const put = (rel, text) => { const p = join(d, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
  const task = (id, ac) => put(`.shapeup/demo/tasks/${id}-x.md`, ["---", `id: ${id}`, "type: task", "feature: demo", `title: "${id}"`,
    "status: done", "use_case_refs: [UC-01]", "---", "", "## Acceptance Criteria", `- [x] ${ac}`, ""].join("\n"));
  const crit = (criterion, traces_to) => ({ criterion, verdict: "PASS", evidence: "e", ...(traces_to ? { traces_to } : {}) });
  const pass = (criteria) => ({ overall: "PASS", criteria });
  try {
    task("TASK-001", "the list renders (covers: REQ-1)");
    const none = tracesProblem(d, "demo", pass([crit("TS-01-01", []), crit("TS-01-02")]));
    if (/anchors none of its 2 criteria/.test(none || "") && /cover 1/.test(none)) ok("no criterion anchored, beside a board that covers a requirement: refused, naming both counts");
    else fail(`all-empty traces: ${none}`);

    if (tracesProblem(d, "demo", pass([crit("TS-01-01", ["REQ-1"]), crit("TS-01-02", [])])) === null) ok("one anchored criterion is enough — which requirement a row traces to stays the judge's reading");
    else fail("a verdict with an anchored criterion was refused");

    const failed = { overall: "FAIL", criteria: [{ criterion: "TS-01-01", verdict: "FAIL", evidence: "a.ets:1", traces_to: [] }] };
    if (tracesProblem(d, "demo", failed)) ok("a FAIL is held to it too — the matrix at GATE H reads a failed run's anchors as well");
    else fail("a FAIL with no anchors was accepted beside a covering board");

    task("TASK-001", "the list renders");
    if (tracesProblem(d, "demo", pass([crit("TS-01-01", [])])) === null) ok("a board with no covers clause asks for no anchor");
    else fail("a verdict was refused for anchors the board never offered");

    task("TASK-001", "the list renders (covers: REQ-1)");
    put(".shapeup/demo/results/evaluate-r1.json", JSON.stringify({ schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator", status: "done",
      verdict: pass([crit("TS-01-01", [])]) }));
    const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "probe", "eval", "--slug", "demo", "--round", "1", "--cwd", d], { encoding: "utf8" });
    let out = {}; try { out = JSON.parse(r.stdout); } catch { /* reported below */ }
    if (r.status === 1 && out.ok === false && out.overall === "PASS" && /anchors none/.test(out.reason || "")) ok("probe eval refuses it with the reason the run hands the judge on the send-back");
    else fail(`probe eval: exit ${r.status} ${r.stdout}`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
