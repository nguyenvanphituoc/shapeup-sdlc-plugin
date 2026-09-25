// 51 — the judge is handed the T0 artifacts it must cite, and a round it could not grade stays open.
//
// spec-evaluator treats a scoped spec whose order lists no T0 artifact as NOT gradeable: it returns
// `status: failed` and grades nothing. That is its contract and it is right — a verdict on a scoped
// spec must cite a T0 artifact it re-hashed. Three writers each broke a different link of it, and
// each looked correct on its own:
//
//   1. NO ORDER LISTED AN ARTIFACT. The workflow's evaluate dispatch passes
//      `{dimensions, run_cmd, round}` and nothing added `t0_artifacts`. Evaluators that went
//      looking on disk graded anyway; one that followed its contract refused, and the run aborted
//      at L3 over a round whose every scope was green.
//   2. A REFUSED ROUND COUNTED AS DONE. `probe resume` read every `evaluate-r<N>.json` as a graded
//      round, so the relaunch opened round N+1 with no bugs to route, rebuilt every scope, and was
//      refused again.
//   3. A VERDICT CITING NOTHING WAS LEDGERED LIKE ANY OTHER. The citation rule lived only in the
//      evaluator's prose; ingest and the round loop accepted a scoped PASS with zero citations.
//
// And the L3 abort said the sub-agent "died after retries" while the evaluator's own reason sat in
// its result. Each property below is asserted by executing the kernel against a fixture.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Run the EVAL T0-artifact checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("82. EVAL is handed the T0 artifacts it must cite, and a round it could not grade stays open");
  // =============================================================================

  const K = (verb) => [join(ROOT, "kernel/harness.mjs"), ...verb.split(" ")];
  const { newestFirst } = await import(join(ROOT, "kernel/probe/t0.mjs"));
  const { t0ArtifactsFor } = await import(join(ROOT, "kernel/compile.mjs"));
  const { evalVerdict } = await import(join(ROOT, "kernel/probe/eval.mjs"));
  const { deriveResumeState } = await import(join(ROOT, "kernel/probe/resume.mjs"));

  const roots = [];
  const fixture = (name) => { const d = mkdtempSync(join(tmpdir(), `eval-t0-${name}-`)); roots.push(d); return d; };
  const w = (root, rel, body) => {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
    return p;
  };
  const contract = (root, id) => w(root, `shapeup/demo/scopes/${id}.json`,
    { schema_version: 1, scope_id: id, allowed_file_substrate: [`src/${id}/**`] });
  // Writes the verdict artifact AND returns its re-hashable identity ({path, sha256}) — a citation
  // is no longer accepted on presence alone (HD-043), so every fixture that cites one now has to
  // hand back the real digest of the exact bytes it wrote, not a fixed placeholder.
  const t0 = (root, file, body) => {
    const full = { schema_version: 2, ...body };
    const p = w(root, `.shapeup/demo/t0/verdicts/${file}`, full);
    return { path: p, sha256: createHash("sha256").update(JSON.stringify(full, null, 2)).digest("hex") };
  };
  // `overall` is derived from the criteria now, so a fixture verdict carries one honest criterion
  // unless the case supplies its own — this module is about T0 artifacts, not verdict arithmetic.
  const honest = (v) => (v && !Array.isArray(v.criteria) && (v.overall === "PASS" || v.overall === "FAIL")
    ? { ...v, criteria: [{ criterion: "UC-01 step 1", verdict: v.overall, evidence: "src/a.ts:1 measured" }] }
    : v);
  const evalResult = (root, body) => w(root, ".shapeup/demo/results/evaluate-r1.json",
    { schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator", ...body, ...(body?.verdict ? { verdict: honest(body.verdict) } : {}) });
  // Exactly the payload the workflow's evaluate dispatch sends — the compile line under test is the
  // one every lane goes through, so this is what a live round compiles.
  const WORKFLOW_PAYLOAD = JSON.stringify({ dimensions: ["spec-conformance"], run_cmd: "npm start", round: 1 });
  const compileEval = (root, extra = []) => {
    const r = spawnSync("node", [...K("compile"), "--operation", "evaluate", "--slug", "demo", ...extra, "--cwd", root], { encoding: "utf8" });
    let order = null;
    try { order = r.status === 0 ? JSON.parse(readFileSync(r.stdout.trim(), "utf8")) : null; } catch { /* reported below */ }
    return { r, order };
  };

  try {
    // --- (a) verdict files are ordered by their numeric address -------------------------------
    const got = newestFirst(["r1-a1-t9.json", "r1-a1.json", "r1-a1-t10.json", "r2-a1-t1.json", "r1-a2-t1.json"]);
    const want = ["r2-a1-t1.json", "r1-a2-t1.json", "r1-a1-t10.json", "r1-a1-t9.json", "r1-a1.json"];
    if (JSON.stringify(got) === JSON.stringify(want)) {
      ok("verdict files sort newest-first by (round, attempt, trial) as numbers — t10 is newer than t9");
    } else {
      fail(`newestFirst ordered verdicts as ${JSON.stringify(got)}; a string sort reads r1-a1-t9 as newer than r1-a1-t10`);
    }

    // --- (b) the derivation: one green verdict per scope, for THIS round ----------------------
    const d = fixture("derive");
    contract(d, "alpha"); contract(d, "beta"); contract(d, "gamma");
    // alpha is green twice in round 1; only a numeric sort cites the newer (t10).
    t0(d, "r1-a1-t9.json", { round: 1, attempt: 1, trial: 9, scope_id: "alpha", overall: "green" });
    t0(d, "r1-a1-t10.json", { round: 1, attempt: 1, trial: 10, scope_id: "alpha", overall: "green" });
    // beta is red in round 1 — there is nothing it can cite.
    t0(d, "r1-a1-t2.json", { round: 1, attempt: 1, trial: 2, scope_id: "beta", overall: "red" });
    // gamma is green only in round 2 — not round 1's evidence.
    t0(d, "r2-a1-t1.json", { round: 2, attempt: 1, trial: 1, scope_id: "gamma", overall: "green" });

    const r1 = t0ArtifactsFor(d, "demo", 1);
    if (JSON.stringify(r1.artifacts) === JSON.stringify([".shapeup/demo/t0/verdicts/r1-a1-t10.json"])) {
      ok("t0ArtifactsFor cites each scope's newest green verdict of the round, repo-relative");
    } else fail(`t0ArtifactsFor(round 1) cited ${JSON.stringify(r1.artifacts)} — expected alpha's r1-a1-t10 only`);
    if (JSON.stringify(r1.missing) === JSON.stringify(["beta", "gamma"])) {
      ok("a scope red in the round, or green only in another round, is reported as having nothing to cite");
    } else fail(`t0ArtifactsFor(round 1) reported missing ${JSON.stringify(r1.missing)} — expected [beta, gamma]`);

    const any = t0ArtifactsFor(d, "demo", undefined);
    if (JSON.stringify(any.artifacts) === JSON.stringify([
      ".shapeup/demo/t0/verdicts/r1-a1-t10.json", ".shapeup/demo/t0/verdicts/r2-a1-t1.json",
    ])) {
      ok("with no round (a standalone evaluation), each scope cites its newest green verdict of any round");
    } else fail(`t0ArtifactsFor(no round) cited ${JSON.stringify(any.artifacts)}`);

    // --- (c) the compiled order carries them, from the workflow's own payload -----------------
    const c1 = compileEval(d, ["--round", "1", "--payload", WORKFLOW_PAYLOAD]);
    if (JSON.stringify(c1.order?.payload?.t0_artifacts) === JSON.stringify([".shapeup/demo/t0/verdicts/r1-a1-t10.json"])) {
      ok("an evaluate order compiled from the workflow's payload carries t0_artifacts derived from disk");
    } else {
      fail(`the evaluate order carries t0_artifacts=${JSON.stringify(c1.order?.payload?.t0_artifacts)} ` +
        `(exit ${c1.r.status}) — without them the evaluator must refuse a scoped round\n${c1.r.stderr}`);
    }
    if (/no green T0 verdict in round 1 for beta, gamma/.test(c1.r.stderr)) {
      ok("compile names, on stderr, the scopes the judge has nothing to cite for");
    } else fail(`compile did not warn about the uncitable scopes; stderr was: ${c1.r.stderr.trim() || "(empty)"}`);

    const c2 = compileEval(d, ["--round", "1", "--payload", JSON.stringify({ t0_artifacts: ["hand/picked.json"] })]);
    if (JSON.stringify(c2.order?.payload?.t0_artifacts) === JSON.stringify(["hand/picked.json"])) {
      ok("an explicit --payload t0_artifacts list outranks the derivation");
    } else fail(`an explicit t0_artifacts list was overridden: ${JSON.stringify(c2.order?.payload?.t0_artifacts)}`);

    const u = fixture("unscoped");
    const c3 = compileEval(u, ["--round", "1", "--payload", WORKFLOW_PAYLOAD]);
    if (c3.r.status === 0 && c3.order && !("t0_artifacts" in c3.order.payload) && !/T0 verdict/.test(c3.r.stderr)) {
      ok("an unscoped spec compiles its evaluate order with no t0_artifacts and no warning (non-regression)");
    } else fail(`unscoped evaluate order changed: exit ${c3.r.status}, payload ${JSON.stringify(c3.order?.payload)}, stderr ${c3.r.stderr}`);

    // --- (d) a refused round is reported with its reason, and stays open ----------------------
    const s = fixture("refused");
    contract(s, "alpha");
    evalResult(s, { status: "failed", deviations: ["NOT gradeable: the spec is scoped and the order lists no T0 artifact for alpha"] });
    const pe = spawnSync("node", [...K("probe eval"), "--slug", "demo", "--round", "1", "--cwd", s], { encoding: "utf8" });
    let peOut = {};
    try { peOut = JSON.parse(pe.stdout); } catch { /* reported below */ }
    if (pe.status === 1 && peOut.ok === false && peOut.status === "failed" && /NOT gradeable/.test(peOut.reason || "")) {
      ok("probe eval reports a refused round as not ok, with the evaluator's status and its own reason");
    } else fail(`probe eval over a refused round printed ${pe.stdout.trim()} (exit ${pe.status}) — the reason must reach the L3 abort`);
    if (JSON.stringify(deriveResumeState(s, "demo").eval_rounds_done) === "[]") {
      ok("a refused EVAL round is not a done round — the relaunch re-enters it instead of opening the next");
    } else fail(`eval_rounds_done counted a refused round: ${JSON.stringify(deriveResumeState(s, "demo").eval_rounds_done)}`);

    // --- (e) a scoped verdict citing nothing is not a judgement; a cited one is ---------------
    evalResult(s, { status: "done", verdict: { overall: "PASS" } });
    const uncited = evalVerdict(s, "demo", 1);
    if (!uncited.found && uncited.overall === "PASS" && /cites no T0 artifact/.test(uncited.reason || "")) {
      ok("a scoped PASS citing no T0 artifact is refused as a round's verdict, and the reason says so");
    } else fail(`a scoped, uncited PASS was accepted as a verdict: ${JSON.stringify(uncited)}`);
    if (JSON.stringify(deriveResumeState(s, "demo").eval_rounds_done) === "[]") {
      ok("an uncited scoped verdict leaves its round open");
    } else fail("an uncited scoped verdict was counted as a graded round");

    // The T0 artifact itself must exist and re-hash green — HD-043: a citation is now resolved, not
    // merely present. alpha is scoped by contract(s, "alpha") above; its round-1 attempt is green.
    const alphaGreenS = t0(s, "r1-a1-t1.json", { round: 1, attempt: 1, trial: 1, scope_id: "alpha", overall: "green" });
    evalResult(s, { status: "done", verdict: { overall: "FAIL", bugs: [],
      t0_citations: [{ scope_id: "alpha", path: ".shapeup/demo/t0/verdicts/r1-a1-t1.json", sha256: alphaGreenS.sha256 }] } });
    const cited = evalVerdict(s, "demo", 1);
    if (cited.found && cited.overall === "FAIL" && JSON.stringify(deriveResumeState(s, "demo").eval_rounds_done) === "[1]") {
      ok("a cited scoped verdict is found, and its round counts as done");
    } else fail(`a cited scoped FAIL was not accepted: ${JSON.stringify(cited)}`);

    const n = fixture("unscoped-verdict");
    evalResult(n, { status: "done", verdict: { overall: "PASS" } });
    if (evalVerdict(n, "demo", 1).found) ok("an unscoped verdict needs no T0 citation (non-regression)");
    else fail(`an unscoped PASS was refused for citing no T0 artifact: ${JSON.stringify(evalVerdict(n, "demo", 1))}`);

    // --- (f) ingest refuses what the round loop would refuse --------------------------------
    const g = fixture("ingest");
    contract(g, "alpha");
    const criteria = [{ criterion: "UC-01 step 1", dimension: "spec-conformance", verdict: "PASS", confidence: "high", evidence: "ran it" }];
    const resultPath = evalResult(g, { status: "done", verdict: { overall: "PASS", criteria } });
    const ledger = join(g, ".shapeup/demo/evaluation/.verdicts-evaluate-r1.jsonl");
    const i1 = spawnSync("node", [...K("reduce ingest"), resultPath, "--cwd", g], { encoding: "utf8" });
    if (i1.status === 1 && /cites no T0 artifact/.test(i1.stderr) && !existsSync(ledger)) {
      ok("ingest refuses a scoped verdict citing no T0 artifact, before writing the verdict ledger");
    } else fail(`ingest accepted an uncited scoped verdict (exit ${i1.status}, ledger written: ${existsSync(ledger)})\n${i1.stderr}`);
    const alphaGreenG = t0(g, "r1-a1-t1.json", { round: 1, attempt: 1, trial: 1, scope_id: "alpha", overall: "green" });
    evalResult(g, { status: "done", verdict: { overall: "PASS", criteria,
      t0_citations: [{ scope_id: "alpha", path: ".shapeup/demo/t0/verdicts/r1-a1-t1.json", sha256: alphaGreenG.sha256 }] } });
    const i2 = spawnSync("node", [...K("reduce ingest"), resultPath, "--cwd", g], { encoding: "utf8" });
    if (i2.status === 0 && existsSync(ledger)) ok("ingest applies the same verdict once it cites its T0 artifact");
    else fail(`ingest refused a cited scoped verdict (exit ${i2.status})\n${i2.stdout}${i2.stderr}`);

    // --- (g) the L3 abort carries the reason instead of "died after retries" ------------------
    const wf = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
    const schema = (wf.match(/const EVAL_VERDICT = \{[\s\S]*?\n\};/) || [""])[0];
    if (/\breason:/.test(schema) && /\bstatus:/.test(schema) && /diedAt\("L3",[^\n]*ev\.reason/.test(wf)) {
      ok("the workflow's L3 abort names the reason probe eval reports, not a dead sub-agent");
    } else {
      fail("shapeup-run.js does not carry probe eval's status/reason into its L3 abort — a refused round " +
        "still reads as a sub-agent that died after retries");
    }
  } finally {
    for (const d of roots) rmSync(d, { recursive: true, force: true });
  }
}
