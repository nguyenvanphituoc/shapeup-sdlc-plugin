// ONE DIMENSION, WHATEVER THE SPEC CARRIED.
//
// The run ledger opened with `eval_dimensions: [spec-conformance]` when nobody named a set, and the
// run handed that list to every evaluate order. The judge treats an explicit list as overriding its
// own auto-enable, so a spec whose every use case carried a Test Surface was graded by
// spec-conformance alone — 101 of 101 criterion verdicts across seven runs of one consumer. The
// default is now `auto`, and each evaluate order resolves the set from the spec with the judge's
// rules; a set the PO named still wins, and GATE L4 reads what was graded back off the order.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the dimension-resolution checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { resolveDimensions } = await import(join(ROOT, "kernel/compile.mjs"));
  const { parseDimensions, runFrontmatter } = await import(join(ROOT, "kernel/init/run.mjs"));

  section("169. An evaluate order grades the dimensions its spec calls for, unless the PO named a set");

  const roots = [];
  const fixture = () => { const d = mkdtempSync(join(tmpdir(), "dims-")); roots.push(d); return d; };
  const put = (d, rel, text) => { const p = join(d, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
  const uc = (d, id, sections) => put(d, `shapeup/demo/spec/usecases/${id}.md`,
    [`# ${id}`, "", "## Steps", "1. tap", "", ...sections.flatMap((s) => [`## ${s}`, "- row", ""])].join("\n"));
  const compileEval = (d, payload) => {
    const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "compile", "--operation", "evaluate", "--slug", "demo",
      "--round", "1", "--payload", JSON.stringify(payload), "--cwd", d], { encoding: "utf8" });
    try { return JSON.parse(readFileSync(r.stdout.trim(), "utf8")); } catch { return { error: r.stderr }; }
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  try {
    const a = fixture();
    uc(a, "UC-01", ["Invariants"]);
    uc(a, "UC-02", ["Test Surface"]);
    const full = resolveDimensions(a, "demo", "shapeup/demo/spec/");
    if (same(full, ["spec-conformance", "tdd-surface", "completeness", "test-surface-conformance"])) {
      ok("a spec with Invariants and a Test Surface resolves both auto dimensions, plus the always-on pair");
    } else fail(`resolved ${JSON.stringify(full)}`);

    const b = fixture();
    uc(b, "UC-01", []);
    put(b, ".shapeup/demo/tasks/TASK-001.be.md", ["---", "id: TASK-001.be", "type: task", "status: todo", "---", ""].join("\n"));
    const be = resolveDimensions(b, "demo", "shapeup/demo/spec/");
    if (same(be, ["spec-conformance", "tdd-surface", "integration"])) ok("a .be task turns on integration; a use case with neither section adds nothing");
    else fail(`resolved ${JSON.stringify(be)}`);

    // The order the workflow compiles when the ledger says `auto`: no dimensions key at all.
    const o1 = compileEval(a, { round: 1 });
    if (same(o1?.payload?.dimensions, full)) ok("an evaluate order compiled with no dimensions carries the resolved set");
    else fail(`order dimensions: ${JSON.stringify(o1?.payload?.dimensions ?? o1)}`);

    const o2 = compileEval(a, { dimensions: ["spec-conformance"], round: 1 });
    if (same(o2?.payload?.dimensions, ["spec-conformance"])) ok("a set the PO named at L0.5 is kept as named");
    else fail(`named set: ${JSON.stringify(o2?.payload?.dimensions ?? o2)}`);

    const o3 = compileEval(a, { dimensions: [], round: 1 });
    if (same(o3?.payload?.dimensions, full)) ok("an empty list is resolved, never sent to the judge as an explicit empty set");
    else fail(`empty list: ${JSON.stringify(o3?.payload?.dimensions ?? o3)}`);

    // What L4 reads back: probe eval names the order's set beside the verdict.
    put(a, ".shapeup/demo/results/evaluate-r1.json", JSON.stringify({ schema_version: 1, order_id: "demo/evaluate-r1",
      worker: "spec-evaluator", status: "done", verdict: { overall: "FAIL", criteria: [] } }));
    const pe = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "probe", "eval", "--slug", "demo", "--round", "1", "--cwd", a], { encoding: "utf8" });
    let out = {}; try { out = JSON.parse(pe.stdout); } catch { /* reported below */ }
    if (Array.isArray(out.dimensions) && out.dimensions.includes("test-surface-conformance")) ok("probe eval returns the dimensions the round's order named");
    else fail(`probe eval: ${pe.stdout}`);

    if (parseDimensions(null) === "auto" && /^eval_dimensions: auto$/m.test(runFrontmatter({
      slug: "demo", startedAt: "2026-09-29T00:00:00Z",
      config: { lens: "standard", spec_folder: "shapeup/demo/spec/", max_rounds: 3, attempt_budget: 5, auto_level: "unattended", eval_dimensions: parseDimensions(null) },
    }))) ok("a run opened without --dimensions records `auto`, not a set nobody chose");
    else fail("the ledger's default dimension line is not `auto`");

    const wf = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
    const rs = readFileSync(join(ROOT, "kernel/probe/resume.mjs"), "utf8");
    if (!/:\s*\["spec-conformance"\]/.test(wf) && !/eval_dimensions[^\n]*:\s*\["spec-conformance"\]/.test(rs)) {
      ok("neither the workflow nor the resume state falls back to a fixed [spec-conformance]");
    } else fail("a fixed [spec-conformance] fallback is back in the workflow or the resume state");
  } finally {
    for (const d of roots) rmSync(d, { recursive: true, force: true });
  }
}
