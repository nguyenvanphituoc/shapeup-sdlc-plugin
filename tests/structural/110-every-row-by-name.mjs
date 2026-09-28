// A PASS THAT GRADED THE SURFACE AS A GROUP.
//
// A judge returned two criteria — "device rows" and "local rows" — over a 42-row Test Surface, and
// the PASS validated like any other. Everything that reads a verdict one row at a time went quiet:
// the requirements matrix read no evidence under every covered requirement, and a requirement the
// build had not met passed with the rest. A PASS now grades each row by id, in a criterion or its
// traces_to, or it is refused on ingest and on read alike; the run sends the judge back once.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the row-coverage checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { surfaceRows, coverageProblem } = await import(join(ROOT, "kernel/probe/eval.mjs"));

  section("164. A PASS grades every Test Surface row by id, or it is refused and the judge sent back once");

  const d = mkdtempSync(join(tmpdir(), "rows-"));
  try {
    const put = (rel, text) => { const p = join(d, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
    put("shapeup/demo/spec/usecases/UC-01.md", "# UC-01\n\n## Test Surface\n| ID | Row | Source | Tier |\n|---|---|---|---|\n| TS-01-01 | a | x | local |\n| TS-01-02 | b | x | device |\n");
    put("shapeup/demo/spec/usecases/UC-02.md", "# UC-02\n\n## Test Surface\n| ID | Oracle | Probe | Expect | Source |\n|---|---|---|---|---|\n| TS-02-01 | o | p | e | s |\n| TS-INV-03 | o | p | e | s |\n");

    const rows = surfaceRows(d, "demo");
    if (JSON.stringify(rows) === JSON.stringify(["TS-01-01", "TS-01-02", "TS-02-01", "TS-INV-03"])) ok("surfaceRows reads row ids from either table layout, invariant rows included");
    else fail(`surfaceRows returned ${JSON.stringify(rows)}`);

    const crit = (criterion, traces_to = []) => ({ criterion, verdict: "PASS", evidence: "e", traces_to });
    const pass = (criteria) => ({ overall: "PASS", criteria });
    const all = pass([crit("TS-01-01"), crit("TS-01-02 on device"), crit("UC-02 row", ["TS-02-01"]), crit("TS-INV-03.")]);
    if (coverageProblem(d, "demo", all) === null) ok("a PASS naming every row — in the criterion or traces_to — is accepted");
    else fail(`full coverage refused: ${coverageProblem(d, "demo", all)}`);

    const grouped = coverageProblem(d, "demo", pass([crit("Device Test Surface rows"), crit("Local Test Surface rows")]));
    if (/grades 0 of 4/.test(grouped || "") && /TS-01-01/.test(grouped)) ok("a grouped PASS is refused, naming the ungraded rows");
    else fail(`grouped PASS: ${grouped}`);

    const range = coverageProblem(d, "demo", pass([crit("TS-01-01/02"), crit("TS-02-01"), crit("TS-INV-03")]));
    if (/ungraded: TS-01-02$/.test(range || "")) ok("a range (TS-01-01/02) grades only the id it spells out");
    else fail(`range: ${range}`);

    const failed = { overall: "FAIL", criteria: [{ criterion: "device rows", verdict: "FAIL", evidence: "a.ets:1" }] };
    if (coverageProblem(d, "demo", failed) === null && coverageProblem(join(d, "nowhere"), "demo", pass([crit("x")])) === null) {
      ok("a FAIL, and a spec with no Test Surface, are not held to it");
    } else fail("coverage was applied to a FAIL or to a spec with no rows");

    // Through the real read path the round loop branches on.
    put(".shapeup/demo/results/evaluate-r1.json", JSON.stringify({ schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator", status: "done",
      verdict: { overall: "PASS", criteria: [crit("Device Test Surface rows")], bugs: [] } }));
    const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "probe", "eval", "--slug", "demo", "--round", "1", "--cwd", d], { encoding: "utf8" });
    let out = {}; try { out = JSON.parse(r.stdout); } catch { /* reported below */ }
    if (r.status === 1 && out.ok === false && out.overall === "PASS" && /Test Surface rows by name/.test(out.reason || "")) {
      ok("probe eval refuses the grouped PASS with its reason — what the run hands the judge on the second dispatch");
    } else fail(`probe eval: exit ${r.status} ${r.stdout}`);

    const wf = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
    const evalBlock = wf.slice(wf.indexOf('skill: "spec-evaluator", operation: "evaluate"') - 200, wf.indexOf("verdict = ev.overall"));
    if (/sendBackOnce\(/.test(evalBlock) && /probe eval --slug/.test(evalBlock) && /!v\.ok && !!v\.overall && !!v\.reason/.test(evalBlock)) ok("the run sends a refused verdict back to the judge once, with the refusal's reason");
    else fail("the workflow no longer re-dispatches a refused verdict");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
