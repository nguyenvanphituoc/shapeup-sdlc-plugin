// Structural test module: oracles. Split out of tests/structural.mjs (Track C).
// Sections: 6, 8, 9, 10, 11. Byte-identical bodies; the runner threads the shared ctx.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Run the oracles structural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 *   Carries ROOT (repo root), the ok/fail/section counters, and the read/readJSON/
 *   frontmatter/walk helpers. ok()/fail() mutate ctx.checks/ctx.failures in place.
 * @returns {Promise<void>} Resolves when the section bodies finish; assertions are
 *   recorded as side effects on ctx (never thrown for an ordinary check failure).
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON, frontmatter, walk } = ctx;

  // =============================================================================
  section("6. Worked example: CLI evaluation oracle passes against its reference impl");
  // =============================================================================
  // Proves examples/todo-cli/ stays runnable: the Stage-G evaluation-contract prototype must
  // report PASS against the correct reference solution (and, by construction, FAIL on a broken one).
  const oracle = join(ROOT, "examples/todo-cli/eval-cli-contract.mjs");
  const refImpl = join(ROOT, "examples/todo-cli/reference/todo.js");
  if (existsSync(oracle) && existsSync(refImpl)) {
    const r = spawnSync("node", [oracle, `node ${refImpl}`], { encoding: "utf8" });
    if (r.status === 0) ok("todo-cli oracle PASSes against reference impl");
    else fail(`todo-cli oracle did not pass against reference impl (exit ${r.status})\n${r.stdout || ""}${r.stderr || ""}`);

    // Negative control: a deliverable that does nothing must FAIL — proves the oracle discriminates
    // (a grader that always PASSes is worthless). `node -e ...` exits 0 with empty stdout, so E1's
    // "prints a friendly message" check must FAIL it.
    const neg = spawnSync("node", [oracle, `node -e ""`], { encoding: "utf8" });
    if (neg.status === 1) ok("todo-cli oracle FAILs a do-nothing impl (discriminates)");
    else fail(`todo-cli oracle did not FAIL a do-nothing impl (exit ${neg.status}) — grader may be a rubber stamp`);
  } else {
    console.log("  (example oracle/reference not found — skipping)");
  }

  // The shared process oracle (Stage G) and its reference contract must be present & well-formed.
  const sharedOracle = join(ROOT, "oracles/process-oracle.mjs");
  const contract = join(ROOT, "examples/todo-cli/todo.contract.json");
  if (existsSync(sharedOracle)) ok("shared process oracle present (oracles/process-oracle.mjs)");
  else fail("shared process oracle missing: oracles/process-oracle.mjs");
  if (existsSync(contract)) {
    try {
      const c = readJSON(contract);
      if (Array.isArray(c.criteria) && c.criteria.length > 0 && c.criteria.every((x) => x.id && x.probe && x.expect))
        ok(`todo.contract.json well-formed (${c.criteria.length} criteria)`);
      else fail("todo.contract.json criteria[] malformed (need id/probe/expect each)");
    } catch (e) { fail(`todo.contract.json does not parse: ${e.message}`); }
  }


  // =============================================================================
  section("8. Evaluation-contract oracle registry (Stage G) is complete & consistent");
  // =============================================================================
  // The registry is the source of truth for "which oracles exist". Every oracle it names must
  // have a runner file; every oracle the docs claim must be in the registry. Catches a doc/code
  // drift in the eval-contract the same way #3 catches broken SKILL references.
  const { ORACLES, ORACLE_NAMES } = await import(join(ROOT, "oracles/index.mjs"));
  const EXPECTED_RUNNERS = {
    process: "oracles/process-oracle.mjs",
    test: "oracles/test-oracle.mjs",
    snapshot: "oracles/snapshot-oracle.mjs",
    http: "oracles/http-oracle.mjs",
  };
  for (const [name, rel] of Object.entries(EXPECTED_RUNNERS)) {
    if (!ORACLES[name]) fail(`oracle "${name}" not registered in oracles/index.mjs`);
    else if (!existsSync(join(ROOT, rel))) fail(`oracle "${name}" runner missing: ${rel}`);
    else ok(`oracle "${name}" registered with runner ${rel}`);
  }
  // The eval-contract spec table and the ba/test-surface registry must name exactly these oracles.
  const specPath = join(ROOT, "docs/audit/evaluation-contract-spec.md");
  if (existsSync(specPath)) {
    const spec = read(specPath);
    for (const name of ORACLE_NAMES) {
      if (spec.includes("`" + name + "`")) ok(`spec documents oracle "${name}"`);
      else fail(`evaluation-contract-spec.md does not document registered oracle "${name}"`);
    }
  }


  // =============================================================================
  section("9. `test` oracle PASSes its green fixture and FAILs a red suite (discriminates)");
  // =============================================================================
  const testOraclePath = join(ROOT, "oracles/test-oracle.mjs");
  const mathxContract = join(ROOT, "examples/lib-mathx/mathx.contract.json");
  if (existsSync(testOraclePath) && existsSync(mathxContract)) {
    const pass = spawnSync("node", [testOraclePath, mathxContract], { encoding: "utf8", cwd: ROOT });
    if (pass.status === 0) ok("test oracle PASSes the green mathx suite");
    else fail(`test oracle did not PASS its green fixture (exit ${pass.status})\n${pass.stdout || ""}${pass.stderr || ""}`);

    // Negative control: a deliberately failing suite must FAIL (a grader that always passes is useless).
    const { runContract: runTest } = await import(testOraclePath);
    const red = runTest({ criteria: [{ id: "T1", desc: "red", probe: { cmd: "node --test --test-reporter=tap mathx.redtest.mjs", cwd: join(ROOT, "examples/lib-mathx") }, expect: { exit: "==0", min_tests: 1, no_failures: true } }] });
    if (red.fails === 1) ok("test oracle FAILs a red suite (discriminates)");
    else fail("test oracle did not FAIL a red suite — grader may be a rubber stamp");
  } else {
    console.log("  (test oracle/fixture not found — skipping)");
  }


  // =============================================================================
  section("10. `snapshot` oracle PASSes its golden and FAILs a do-nothing impl (discriminates)");
  // =============================================================================
  const snapOraclePath = join(ROOT, "oracles/snapshot-oracle.mjs");
  const greetContract = join(ROOT, "examples/refactor-greet/greet.contract.json");
  if (existsSync(snapOraclePath) && existsSync(greetContract)) {
    const pass = spawnSync("node", [snapOraclePath, greetContract, "node examples/refactor-greet/greet.mjs"], { encoding: "utf8", cwd: ROOT });
    if (pass.status === 0) ok("snapshot oracle PASSes output identical to its golden");
    else fail(`snapshot oracle did not PASS its golden (exit ${pass.status})\n${pass.stdout || ""}${pass.stderr || ""}`);

    // Negative control: a do-nothing impl emits nothing → diff non-empty → FAIL.
    const neg = spawnSync("node", [snapOraclePath, greetContract, "node -e undefined"], { encoding: "utf8", cwd: ROOT });
    if (neg.status === 1) ok("snapshot oracle FAILs a do-nothing impl (discriminates)");
    else fail(`snapshot oracle did not FAIL a do-nothing impl (exit ${neg.status}) — grader may be a rubber stamp`);
  } else {
    console.log("  (snapshot oracle/fixture not found — skipping)");
  }


  // =============================================================================
  section("11. `http` oracle PASSes its working server and FAILs a broken one (discriminates)");
  // =============================================================================
  const httpOraclePath = join(ROOT, "oracles/http-oracle.mjs");
  const pingContract = join(ROOT, "examples/http-ping/ping.contract.json");
  if (existsSync(httpOraclePath) && existsSync(pingContract)) {
    const { runContract: runHttp } = await import(httpOraclePath);
    const c = readJSON(pingContract);
    const good = await runHttp({ server: { ...c.server, cwd: ROOT }, criteria: c.criteria });
    if (good.fails === 0) ok(`http oracle PASSes the working server (${good.results.length} criteria)`);
    else fail(`http oracle did not PASS the working server (${good.fails} fail)\n${good.results.map((r) => r.evidence).join("\n")}`);

    // Negative control: a server that is reachable but returns 500/wrong body must FAIL every criterion.
    const bad = await runHttp({ server: { ...c.server, cmd: "node examples/http-ping/broken-server.mjs", cwd: ROOT }, criteria: c.criteria });
    if (bad.fails === bad.results.length && bad.results.length > 0) ok("http oracle FAILs a broken server (discriminates)");
    else fail(`http oracle did not FAIL a broken server (${bad.fails}/${bad.results.length}) — grader may be a rubber stamp`);
  } else {
    console.log("  (http oracle/fixture not found — skipping)");
  }


  // §13 held the `spec-evaluator` planted-bug fixture — the anti-leniency regression. It asserted
  // the fixture's GROUND TRUTH deterministically: the process oracle PASSed the correct control
  // build and FAILed the buggy one on TS-04, so a judge that rubber-stamped a build dressed to
  // look done (green self-suite, every AC box ticked) could be caught in CI without an LLM.
  //
  // The fixture and its successor were removed with the rest of the eval apparatus. The ordinal is
  // deliberately not reused. WHAT THIS COSTS, recorded rather than left to be rediscovered:
  // nothing now proves the evaluator's skeptical posture survives a change to `anti-leniency.md`.
  // The oracle registry above still proves each oracle DISCRIMINATES against a negative control,
  // which is a claim about the grader; this was the only claim about the JUDGE.

}
