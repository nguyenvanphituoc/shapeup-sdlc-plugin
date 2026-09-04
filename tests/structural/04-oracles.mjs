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

  // THE PITCH MUST STATE THE CONVENTION THE ORACLE GRADES AGAINST.
  //
  // The oracle seeds `$TODO_STORE` and points the CLI at a throwaway file — that is how it
  // exercises "corrupted store" and "a seeded store is actually read" without writing to the
  // developer's own todo list. The reference implementation honours it, in a source comment: "so
  // the eval oracle can sandbox it". The PITCH said only "a local JSON file".
  //
  // So a harness run built a CLI storing at `~/.todo.json` — a perfectly reasonable reading of the
  // pitch, working correctly under its own convention, with `add/list/done/rm` all correct and a
  // corrupted store refused by name without destroying data — and the oracle scored it 4/6, because
  // it could not reach the store it had seeded. Two FAILs that were a contract mismatch, not a
  // defect, in the file this repo uses to decide whether a run succeeded.
  //
  // A requirement that lives only in the grader is a trick question. This asserts the pitch a run is
  // built from names the same mechanism the grader drives it by.
  const pitch = join(ROOT, "examples/todo-cli/idea.md");
  if (existsSync(pitch) && existsSync(contract)) {
    const usesEnv = /TODO_STORE/.test(read(pitch));
    const oracleSeeds = /"store"\s*:/.test(read(contract));
    if (!oracleSeeds || usesEnv) {
      ok("the todo-cli pitch states the $TODO_STORE convention its own oracle seeds — the grader tests nothing the brief withheld");
    } else {
      fail("todo.contract.json seeds a store the pitch never mentions. A run built from idea.md cannot know to read " +
        "$TODO_STORE, so a correct CLI is graded FAIL on the two criteria that need a sandboxed store — a defect in " +
        "the acceptance contract, scored against the deliverable.");
    }
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
    ui: "oracles/ui-oracle.mjs",
  };
  for (const [name, rel] of Object.entries(EXPECTED_RUNNERS)) {
    if (!ORACLES[name]) fail(`oracle "${name}" not registered in oracles/index.mjs`);
    else if (!existsSync(join(ROOT, rel))) fail(`oracle "${name}" runner missing: ${rel}`);
    else ok(`oracle "${name}" registered with runner ${rel}`);
  }
  // EVERY REGISTERED ORACLE MUST BE DOCUMENTED IN PROSE THE USER ACTUALLY RECEIVES.
  //
  // This check was previously gated on `docs/audit/evaluation-contract-spec.md`, which does not
  // exist and — under `docs/` — would not ship even if it did. `existsSync` was therefore always
  // false and the whole block never executed: a doc-parity assertion that had never once run,
  // sitting inside a green suite, which is this repo's own documented pathology (an unfired guard
  // and an absent one look identical from outside).
  //
  // Re-pointed at the SUBSTANCE rather than deleted, and at the two shipped files that carry the
  // oracle tables for real — the evaluator's dispatch table and the planner's `Oracle` column.
  // Strictly stronger than the original: it runs, and it covers both sides of the contract (the
  // BA tags a row, the evaluator dispatches on the tag), so an oracle registered without a row in
  // either is caught rather than assumed.
  const ORACLE_PROSE = [
    "skills/spec-evaluator/references/probing.md",
    "skills/ba-pitch-analyzer/references/test-surface.md",
  ];
  for (const rel of ORACLE_PROSE) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) { fail(`oracle prose missing: ${rel}`); continue; }
    const prose = read(abs);
    for (const name of ORACLE_NAMES) {
      if (prose.includes("`" + name + "`")) ok(`${rel} documents oracle "${name}"`);
      else fail(`${rel} does not document registered oracle "${name}" — a dispatch key the evaluator will meet with no instructions`);
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


  // =============================================================================
  section("82. `ui` oracle — the affordance grammar is enforced, and the runner discriminates");
  // =============================================================================
  // `ui` is the DEFAULT oracle, and until now it was the only one in the registry with no runner:
  // an agent drove a browser and reported on itself, so nothing here could hold it to the standard
  // §§9–11 hold `test`/`snapshot`/`http` to. Three claims, in the order of how much they depend on
  // the machine having a browser — the first two hold everywhere, including CI.

  const uiOraclePath = join(ROOT, "oracles/ui-oracle.mjs");
  const uiContractPath = join(ROOT, "examples/ui-counter/counter.contract.json");
  if (existsSync(uiOraclePath) && existsSync(uiContractPath)) {
    const ui = await import(uiOraclePath);
    const uiContract = readJSON(uiContractPath);

    // --- (1) THE AFFORDANCE RULE IS MECHANICAL, NOT PROSE ---------------------------------
    // "UI assertions target affordances only (test_id/role/data-state)" is a Hard Rule addressed
    // to the same model the anti-leniency protocol exists to distrust. It is enforced here by a
    // vocabulary that has no word for a colour, so the rule cannot be rationalised past.
    for (const smuggled of [{ color: "#00f" }, { css: ".btn" }, { screenshot: "a.png" }, { bounding_box: [0, 0] }]) {
      const why = ui.validateCriterion({ id: "X", expect: { testid: "inc", ...smuggled } });
      const key = Object.keys(smuggled)[0];
      if (why && why.includes(key)) ok(`ui contract rejects a styling assertion (expect.${key})`);
      else fail(`ui contract ACCEPTED expect.${key} — the frozen styling layer is gradeable through the judge again`);
    }
    if (ui.validateCriterion({ id: "U1", probe: { path: "/" }, expect: { testid: "count", text: "/^0$/" } }) === null)
      ok("ui contract accepts a conforming affordance assertion (the rule discriminates, it is not a blanket no)");
    else fail("ui contract rejected a conforming affordance assertion — the grammar is over-tight");

    // Every shipped fixture criterion must survive the same validator, or the worked example is
    // one the runner would refuse to execute.
    const badRows = uiContract.criteria.map((c) => [c.id, ui.validateCriterion(c)]).filter(([, w]) => w);
    if (badRows.length === 0) ok(`counter.contract.json conforms to the affordance grammar (${uiContract.criteria.length} criteria)`);
    else fail(`counter.contract.json has criteria the runner would refuse: ${badRows.map(([id, w]) => id + ": " + w).join("; ")}`);

    // --- (2) A CRITERION WITH NO RESULT IS A FAIL, NEVER A SKIP ---------------------------
    // The registry-wide rule ("absence of evidence = FAIL") applied to report parsing: a spec that
    // vanished from the run — file failed to load, browser died, suite never started — must not
    // fall through as an untested pass.
    {
      const synthetic = {
        suites: [{ specs: [
          { title: "A", ok: true, tests: [{ results: [{ status: "passed" }] }] },
          { title: "B", ok: false, tests: [{ results: [{ status: "failed", error: { message: "boom" } }] }] },
        ] }],
        errors: [],
      };
      const parsed = ui.parseReport(synthetic, [{ id: "A" }, { id: "B" }, { id: "C" }]);
      const byId = Object.fromEntries(parsed.results.map((r) => [r.id, r]));
      if (byId.A.pass && !byId.B.pass) ok("parseReport maps a passed spec to PASS and a failed one to FAIL");
      else fail(`parseReport mis-mapped the report: ${JSON.stringify(parsed.results)}`);
      if (!byId.C.pass && /NO EVIDENCE/.test(byId.C.evidence)) ok("parseReport FAILs a criterion the run produced no result for (no silent skip)");
      else fail("parseReport let a criterion with no result through as anything but a NO EVIDENCE FAIL");
      if (parsed.fails === 2) ok("parseReport counts exactly the two non-passing criteria");
      else fail(`parseReport fails count = ${parsed.fails}, expected 2`);
    }

    // --- (2b) THE NEGATIVE CONTROL IS ACTUALLY BROKEN --------------------------------------
    // A control that drifts into a copy of the correct fixture silently converts §(3) from a
    // discrimination proof into a tautology, and both files would still be "present".
    const goodPage = join(ROOT, "examples/ui-counter/server.mjs");
    const badPage = join(ROOT, "examples/ui-counter/broken-server.mjs");
    if (existsSync(goodPage) && existsSync(badPage)) {
      const good = read(goodPage), bad = read(badPage);
      if (!/data-testid="export"/.test(good) && /data-testid="export"/.test(bad))
        ok("the ui negative control breaches the no-go the correct fixture honours (they have not converged)");
      else fail("examples/ui-counter: the negative control no longer differs from the correct fixture on the no-go affordance");
    }

    // --- (3) THE RUNNER ITSELF ------------------------------------------------------------
    // Branches on what this machine actually has, and BOTH branches assert something real. With a
    // Playwright CLI reachable, the full §§9–11 discrimination: PASS the correct build, FAIL the
    // broken one. Without one — the CI case, since this plugin has zero dependencies and installs
    // no browser — the claim under test is the lazy-preflight rule: a `[ui]` criterion that cannot
    // be verified is a FAIL naming the fix, never a skip and never an auto-install.
    const cli = ui.resolveCli(ROOT);
    if (cli) {
      const good = await ui.runContract({ server: { ...uiContract.server, cwd: ROOT }, criteria: uiContract.criteria, browser: uiContract.browser, cwd: ROOT });
      if (good.fails === 0) ok(`ui oracle PASSes the correct counter fixture (${good.results.length} criteria, via ${cli.source})`);
      else fail(`ui oracle did not PASS its correct fixture (${good.fails} fail)\n${good.results.map((r) => r.id + ": " + r.evidence).join("\n")}`);

      const broken = await ui.runContract({ server: { ...uiContract.server, cmd: "node examples/ui-counter/broken-server.mjs", cwd: ROOT }, criteria: uiContract.criteria, browser: uiContract.browser, cwd: ROOT });
      if (broken.fails === broken.results.length && broken.results.length > 0) ok("ui oracle FAILs the broken counter fixture on every criterion (discriminates)");
      else fail(`ui oracle did not FAIL the broken fixture (${broken.fails}/${broken.results.length}) — grader may be a rubber stamp`);
    } else {
      const noBrowser = await ui.runContract({ server: { ...uiContract.server, cwd: ROOT }, criteria: uiContract.criteria, cwd: ROOT });
      if (noBrowser.fails === noBrowser.results.length) ok("with no Playwright CLI reachable, the ui oracle FAILs every criterion (absence of evidence = FAIL, never a skip)");
      else fail(`ui oracle passed ${noBrowser.results.length - noBrowser.fails} criteria with no browser available — a [ui] AC was graded without a probe`);
      if (noBrowser.results.every((r) => r.evidence.includes("playwright install chromium")))
        ok("the no-browser FAIL names the fix (`npx playwright install chromium`), so the operator can act on it");
      else fail("the no-browser FAIL does not name the install command — an unactionable verdict");
      console.log("  (no Playwright CLI on this machine — the ui oracle's PASS/FAIL discrimination is unproven here; the preflight path above is)");
    }
  } else {
    console.log("  (ui oracle/fixture not found — skipping)");
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
