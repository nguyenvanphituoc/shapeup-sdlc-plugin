// Structural test module: tech-lead. Split out of tests/structural.mjs (Track C).
// Sections: 18, 19, 20, 21, 24, 30, 31. Byte-identical bodies; the runner threads the shared ctx.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { assertJsdocCoverage } from "../lib/jsdoc.mjs";

/**
 * Run the tech-lead structural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 *   Carries ROOT (repo root), the ok/fail/section counters, and the read/readJSON/
 *   frontmatter/walk helpers. ok()/fail() mutate ctx.checks/ctx.failures in place.
 * @returns {Promise<void>} Resolves when the section bodies finish; assertions are
 *   recorded as side effects on ctx (never thrown for an ordinary check failure).
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON, frontmatter, walk } = ctx;

  // =============================================================================
  section("18. T0 mechanical layer (t0-verify.mjs) computes a discriminating verdict + writes a citable artifact");
  // =============================================================================
  const t0Path = join(ROOT, "skills/tech-lead/scripts/t0-verify.mjs");
  if (existsSync(t0Path)) {
    const {
      runFixtures, runDbProbe, seesawCheck, computeVerdict, writeArtifact,
      score, better, decideStatus, readTrials, appendTrial, nextTrialNo,
    } = await import(t0Path);

    const green = runFixtures(["node -e \"process.exit(0)\""], ROOT);
    if (green.pass) ok("t0-verify runFixtures reports green for a passing fixture command");
    else fail("t0-verify runFixtures did not report green for an exit-0 command");

    const red = runFixtures(["node -e \"process.exit(1)\""], ROOT);
    if (!red.pass) ok("t0-verify runFixtures reports red for a failing fixture command (discriminates)");
    else fail("t0-verify runFixtures did not report red for an exit-1 command — grader may be a rubber stamp");

    if (runDbProbe(null, ROOT) === null) ok("t0-verify runDbProbe is a no-op (null) when no db_probe is declared — never a false failure");
    else fail("t0-verify runDbProbe should return null when no db_probe command is given");

    const verdictGreen = computeVerdict({ fixtures: green, dbProbe: null, seesaw: { ran: false, pass: true } });
    if (verdictGreen.overall === "green" && !verdictGreen.regression) ok("t0-verify computeVerdict is green + non-regression when fixtures pass and seesaw didn't run");
    else fail(`t0-verify computeVerdict wrong on an all-green input: ${JSON.stringify(verdictGreen)}`);

    const verdictRegression = computeVerdict({ fixtures: green, dbProbe: null, seesaw: { ran: true, pass: false } });
    if (verdictRegression.overall === "red" && verdictRegression.regression) ok("t0-verify computeVerdict flags a seesaw failure as a regression (own fixtures green, seesaw red)");
    else fail(`t0-verify computeVerdict did not flag the seesaw-red case as a regression: ${JSON.stringify(verdictRegression)}`);

    const verdictOwnFail = computeVerdict({ fixtures: red, dbProbe: null, seesaw: { ran: false, pass: true } });
    if (verdictOwnFail.overall === "red" && !verdictOwnFail.regression) ok("t0-verify computeVerdict distinguishes an own-fixture failure from a regression");
    else fail(`t0-verify computeVerdict wrongly classified an own-fixture failure: ${JSON.stringify(verdictOwnFail)}`);

    // Artifact write + citation hash — what spec-evaluator's GATE V0.7 will read and re-verify.
    const { mkdtempSync, rmSync, readFileSync: rf, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const outDir = mkdtempSync(join(tmpdir(), "t0-artifact-"));
    try {
      const { path, sha256 } = writeArtifact(outDir, 2, 3, { scope_id: "cart-creation", ...verdictGreen });
      if (existsSync(path) && /r2-a3-t1\.json$/.test(path)) ok("t0-verify writeArtifact writes to the r<N>-a<M>-t<T>.json path convention");
      else fail(`t0-verify writeArtifact wrote to an unexpected path: ${path}`);
      const body = JSON.parse(rf(path, "utf8"));
      if (body.round === 2 && body.attempt === 3 && body.overall === "green") ok("t0-verify artifact body carries round/attempt/overall");
      else fail(`t0-verify artifact body malformed: ${JSON.stringify(body)}`);
      const { createHash } = await import("node:crypto");
      const recomputed = createHash("sha256").update(rf(path, "utf8")).digest("hex");
      if (recomputed === sha256) ok("t0-verify artifact sha256 citation is reproducible from the file on disk");
      else fail("t0-verify artifact sha256 does not match the file's actual contents — citation would be unverifiable");

      // I4 — the RETRY case, which used to destroy its own evidence. The protocol says "stash,
      // then retry THIS attempt", so (round, attempt) repeats; the old address had no term for it
      // and the red verdict was silently replaced by the green one at the same path.
      const second = writeArtifact(outDir, 2, 3, { scope_id: "cart-creation", ...verdictOwnFail });
      const verdicts = readdirSync(join(outDir, "t0", "verdicts")).filter((f) => /^r2-a3-t\d+\.json$/.test(f));
      if (verdicts.length === 2 && second.path !== path) ok("t0-verify writeArtifact called twice with the SAME (round, attempt) produces TWO files (I4 — never clobbers)");
      else fail(`t0-verify writeArtifact clobbered the prior verdict: ${verdicts.length} file(s) for r2-a3`);
      if (JSON.parse(rf(path, "utf8")).overall === "green") ok("t0-verify the superseded verdict is still addressable and unchanged after the retry");
      else fail("t0-verify the first verdict's bytes changed when the attempt was retried");
      if (second.trial === 2 && nextTrialNo(join(outDir, "t0", "verdicts"), 2, 3) === 3) ok("t0-verify nextTrialNo advances the retry ordinal past every artifact on disk");
      else fail(`t0-verify nextTrialNo did not advance: trial=${second.trial}`);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }

    // ---- the pawl: score() / better() / decideStatus() -----------------------------------
    const sc = score({ fixtures: { results: [{ pass: true }, { pass: true }, { pass: false }] }, dbProbe: { pass: true }, seesaw: { ran: true, failing: ["checkout"] } });
    if (sc.fixtures_passed === 2 && sc.fixtures_total === 3 && sc.db_probe === 1 && sc.regressions === 1) ok("t0-verify score() reduces the already-persisted fixture results into a comparable vector");
    else fail(`t0-verify score() wrong: ${JSON.stringify(sc)}`);
    if (score({ fixtures: { results: [] }, dbProbe: null, seesaw: { ran: false, failing: [] } }).db_probe === null) ok("t0-verify score() reports db_probe null (an absence) when no probe is declared — never a 0");
    else fail("t0-verify score() turned an undeclared db_probe into a failure");

    const S = (r, p, t, d) => ({ regressions: r, fixtures_passed: p, fixtures_total: t, db_probe: d });
    const truth = [
      ["baseline (no incumbent) is always better", better(S(0, 0, 5, null), null), true],
      // The whole ratchet: RED BUT IMPROVED is kept. 2/5 → 4/5 is progress, and the loop must
      // build on it instead of restarting from unexplained code.
      ["red-but-improved 2/5 → 4/5 is strictly better", better(S(0, 4, 5, null), S(0, 2, 5, null)), true],
      ["fewer fixtures passing is not better", better(S(0, 1, 5, null), S(0, 2, 5, null)), false],
      ["a tie is NOT better (a sawtooth must not read as a ratchet)", better(S(0, 2, 5, 1), S(0, 2, 5, 1)), false],
      ["a new regression dominates a fixture gain", better(S(1, 5, 5, null), S(0, 2, 5, null)), false],
      ["clearing a regression is better even with fewer fixtures", better(S(0, 1, 5, null), S(1, 4, 5, null)), true],
      ["a db_probe recovery is better when all else ties", better(S(0, 2, 5, 1), S(0, 2, 5, 0)), true],
      ["a changed denominator is incomparable (null), not worse", better(S(0, 4, 6, null), S(0, 2, 5, null)), null],
      ["a changed denominator is null even when it looks like a win", better(S(0, 9, 9, null), S(0, 1, 5, null)), null],
    ];
    for (const [label, got, want] of truth) {
      if (got === want) ok(`t0-verify better(): ${label}`);
      else fail(`t0-verify better() ${label} — expected ${want}, got ${got}`);
    }

    const statuses = [
      ["true → kept, tree keeps", decideStatus(true, false), { status: "kept", action: "keep" }],
      ["false → reverted, tree restores", decideStatus(false, false), { status: "reverted", action: "restore" }],
      ["null → rebased, tree keeps", decideStatus(null, false), { status: "rebased", action: "keep" }],
      ["a crash restores regardless of the comparison", decideStatus(true, true), { status: "crash", action: "restore" }],
    ];
    for (const [label, got, want] of statuses) {
      if (got.status === want.status && got.action === want.action) ok(`t0-verify decideStatus(): ${label}`);
      else fail(`t0-verify decideStatus() ${label} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }

    // ---- the trial ledger is append-only, and absent means "fall back", never "crash" -------
    const ledgerDir = mkdtempSync(join(tmpdir(), "t0-trials-"));
    try {
      const lp = join(ledgerDir, "t0", "trials.jsonl");
      if (readTrials(lp).length === 0) ok("t0-verify readTrials on a missing ledger returns [] (the non-regression path)");
      else fail("t0-verify readTrials should return [] when trials.jsonl does not exist");
      appendTrial(lp, { schema_version: 1, trial: 1, scope_id: "SC-01", score: S(0, 2, 5, null), status: "kept" });
      appendTrial(lp, { schema_version: 1, trial: 2, scope_id: "SC-01", score: S(0, 4, 5, null), status: "kept", baseline_trial: 1 });
      const rows = readTrials(lp);
      if (rows.length === 2 && rows[0].trial === 1 && rows[1].baseline_trial === 1) ok("t0-verify the trial ledger is append-only and carries the baseline_trial parent link");
      else fail(`t0-verify trial ledger did not append in order: ${JSON.stringify(rows)}`);
      writeFileSync(lp, readFileSync(lp, "utf8") + "{ not json\n");
      if (readTrials(lp).length === 2) ok("t0-verify readTrials skips an unparseable row rather than losing the ledger");
      else fail("t0-verify readTrials should tolerate a torn final row");
    } finally {
      rmSync(ledgerDir, { recursive: true, force: true });
    }

    // Seesaw over a registry with one always-failing scope.
    const regDir = mkdtempSync(join(tmpdir(), "t0-seesaw-"));
    try {
      const regPath = join(regDir, "registry.json");
      writeFileSync(regPath, JSON.stringify({ scopes: [{ scope_id: "checkout", fixtures: ["node -e \"process.exit(1)\""] }] }));
      const s = seesawCheck(regPath, ROOT);
      if (s.ran && !s.pass && s.failing.includes("checkout")) ok("t0-verify seesawCheck detects a regressed FINISHED scope");
      else fail(`t0-verify seesawCheck did not detect the seeded regression: ${JSON.stringify(s)}`);
      const none = seesawCheck(join(regDir, "does-not-exist.json"), ROOT);
      if (none.ran === false && none.pass === true) ok("t0-verify seesawCheck is a no-op-green when the registry doesn't exist yet (first FINISHED scope)");
      else fail("t0-verify seesawCheck should default to ran:false, pass:true with no registry");
    } finally {
      rmSync(regDir, { recursive: true, force: true });
    }
  } else {
    console.log("  (t0-verify.mjs not found — skipping)");
  }


  // =============================================================================
  section("19. AEGIS digester distills raw logs into {file, line, core_message} triples");
  // =============================================================================
  const digestPath = join(ROOT, "skills/tech-lead/scripts/aegis-digest.mjs");
  if (existsSync(digestPath)) {
    const { digest } = await import(digestPath);

    const stackLog = "TypeError: Cannot read properties of undefined (reading 'total')\n    at calculateCartTotal (apps/web/cart/Cart.tsx:84:12)\n    at process (apps/web/cart/Cart.tsx:40:5)\n";
    const triples = digest(stackLog);
    const first = triples.find((t) => t.file === "apps/web/cart/Cart.tsx" && t.line === 84);
    if (first && /Cannot read properties/.test(first.core_message)) ok("aegis-digest extracts {file, line, core_message} from a Node stack trace");
    else fail(`aegis-digest did not extract the expected triple from a stack trace: ${JSON.stringify(triples)}`);

    const dupLog = stackLog + stackLog; // identical failure logged twice (retry noise)
    const deduped = digest(dupLog);
    const count = deduped.filter((t) => t.file === "apps/web/cart/Cart.tsx" && t.line === 84).length;
    if (count === 1) ok("aegis-digest de-duplicates identical (file, line, message) triples");
    else fail(`aegis-digest did not de-duplicate a repeated triple (found ${count})`);

    const unmatched = digest("some unrelated line of prose with no file:line signal\n");
    if (Array.isArray(unmatched)) ok("aegis-digest never throws on unrecognized log content (script-first, no invented file:line)");
    else fail("aegis-digest should return an array even when nothing matches");

    const empty = digest("");
    if (Array.isArray(empty) && empty.length === 0) ok("aegis-digest returns an empty array for empty input");
    else fail("aegis-digest should return [] for empty input");
  } else {
    console.log("  (aegis-digest.mjs not found — skipping)");
  }


  // =============================================================================
  section("20. Envelope schemas + validate-envelope.mjs discriminate (pure-skill P0)");
  // =============================================================================
  // The WorkOrder/WorkResult port is the harness's canonical contract (plan §4.1). The validator
  // must PASS a well-formed order, FAIL a malformed one, and as a PreToolUse hook DENY a dispatch
  // whose --order file is invalid while deferring on everything else (fail-open for standalone).
  const vePath = join(ROOT, "skills/tech-lead/scripts/validate-envelope.mjs");
  const orderSchemaPath = join(ROOT, "skills/tech-lead/schemas/work-order.schema.json");
  const resultSchemaPath = join(ROOT, "skills/tech-lead/schemas/work-result.schema.json");
  if (existsSync(vePath) && existsSync(orderSchemaPath)) {
    const { validate: veValidate } = await import(vePath);
    const orderSchema = readJSON(orderSchemaPath);
    const resultSchema = readJSON(resultSchemaPath);
    const goodOrder = {
      schema_version: 1, order_id: "demo/r1-a1", worker: "task-executor", mode: "orchestrated",
      operation: "execute", substrate: { allowed: ["apps/api/**"] },
      payload: { tasks: [{ id: "TASK-001", acceptance_criteria: ["x"] }] },
    };
    if (veValidate(goodOrder, orderSchema).valid) ok("validate-envelope PASSes a well-formed WorkOrder");
    else fail(`validate-envelope rejected a well-formed WorkOrder: ${veValidate(goodOrder, orderSchema).errors}`);
    const badOrder = { schema_version: 2, order_id: "Bad Slug", worker: "nobody", mode: "yolo" };
    const badRes = veValidate(badOrder, orderSchema);
    if (!badRes.valid && badRes.errors.length >= 4) ok("validate-envelope FAILs a malformed WorkOrder with per-field errors (discriminates)");
    else fail(`validate-envelope did not discriminate a malformed order: ${JSON.stringify(badRes)}`);
    const goodResult = {
      schema_version: 1, order_id: "demo/r1-a1", status: "done",
      task_results: [{ task_id: "TASK-001", status: "done", ac_results: [{ ac: "x", result: "pass" }] }],
    };
    if (veValidate(goodResult, resultSchema).valid) ok("validate-envelope PASSes a well-formed WorkResult");
    else fail("validate-envelope rejected a well-formed WorkResult");
    if (!veValidate({ schema_version: 1, order_id: "d/x", status: "nope" }, resultSchema).valid)
      ok("validate-envelope FAILs an invalid WorkResult status");
    else fail("validate-envelope accepted an invalid WorkResult status — rubber stamp");

    // Hook mode.
    {
      const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const d = mkdtempSync(join(tmpdir(), "ve-hook-"));
      try {
        writeFileSync(join(d, "bad.json"), JSON.stringify(badOrder));
        writeFileSync(join(d, "good.json"), JSON.stringify(goodOrder));
        const askVe = (prompt, tool = "Agent") => {
          const r = spawnSync("node", [vePath], { encoding: "utf8", input: JSON.stringify({ tool_name: tool, cwd: d, tool_input: { prompt } }) });
          return (r.stdout || "").includes('"permissionDecision":"deny"');
        };
        if (askVe("run task-executor --order bad.json")) ok("hook DENIES a dispatch whose --order fails the schema");
        else fail("hook did not deny a malformed --order dispatch — the envelope gate is not enforcing");
        if (askVe("run task-executor --order missing.json")) ok("hook DENIES a dispatch whose --order file is missing");
        else fail("hook did not deny a dangling --order path");
        if (!askVe("run task-executor --order good.json")) ok("hook ALLOWS a valid --order dispatch");
        else fail("hook denied a valid order — false block");
        if (!askVe("just run the tests")) ok("hook defers when no --order is present (standalone stays free)");
        else fail("hook blocked a dispatch with no --order — fail-open broken");
      } finally { rmSync(d, { recursive: true, force: true }); }
    }
    // hooks.json must wire the envelope gate.
    const hooksManifest2 = readJSON(join(ROOT, "hooks/hooks.json"));
    const wired = JSON.stringify(hooksManifest2).includes("validate-envelope.mjs");
    if (wired) ok("hooks.json wires validate-envelope.mjs as a PreToolUse hook");
    else fail("hooks.json does not wire validate-envelope.mjs — malformed orders would reach workers");
  } else {
    fail("validate-envelope.mjs or schemas/ missing — the P0 envelope layer is absent");
  }


  // =============================================================================
  section("21. compile-order.mjs assembles a schema-valid, fact-only WorkOrder (pure-skill P1)");
  // =============================================================================
  const coPath = join(ROOT, "skills/tech-lead/scripts/compile-order.mjs");
  const irPath = join(ROOT, "skills/tech-lead/scripts/ingest-result.mjs");
  if (existsSync(coPath) && existsSync(irPath)) {
    const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const d = mkdtempSync(join(tmpdir(), "pipe-"));
    const w = (rel, body) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), body); };
    try {
      w(".shapeup/demo/tasks/TASK-001-a.md", `---\nid: TASK-001\ntitle: "A"\nstatus: ready\npriority: 1\ndepends_on: []\n---\n## Acceptance Criteria\n- [ ] first criterion\n- [ ] second criterion\n`);
      w(".shapeup/demo/tasks/TASK-002-b.md", `---\nid: TASK-002\ntitle: "B"\nstatus: blocked\npriority: 2\ndepends_on: [TASK-001]\n---\n## Acceptance Criteria\n- [ ] third criterion\n`);
      w(".shapeup/demo/tasks/_index.md", `| ID | Title | Status |\n|---|---|---|\n| TASK-001 | A | ⬜ ready |\n| TASK-002 | B | 🚫 blocked |\n`);
      // MARKDOWN contract (ADR-0001). Written in the real on-disk format so this path exercises
      // the frontmatter + table parser end-to-end, not just the legacy-JSON fallback.
      w("shapeup/demo/scopes/cart.md", [
        "---",
        "scope_id: cart",
        "topology_type: LAYER_CAKE",
        "allowed_file_substrate: [apps/web/cart/*.tsx, apps/api/cart/*.ts]",
        "shared_substrate: []",
        "---",
        "## Why this slice",
        "Cart is the riskiest flow.",
        "",
        "## Affordances",
        "| test_id | role | required_states |",
        "|---|---|---|",
        "| add-to-cart | button | [empty, one-item] |",
        "",
      ].join("\n"));
      // LOCAL since ADR-0001 — the ledger is appended to mid-round, so it never belonged in the
      // committed tier; its conclusions reach the team through REPORT.md at GATE L4 instead.
      w(".shapeup/demo/round-ledger.md", `## Decisions\n| ID | Scope | Q | A |\n|---|---|---|---|\n| ESC-1 | cart | q | use idempotency key |\n| ESC-2 | other | q | not mine |\n`);
      w(".shapeup/demo/t0/verdicts/r1-a1.json", JSON.stringify({ overall: "red", discovered_tasks: [{ file: "apps/api/cart/x.ts", line: 4, core_message: "boom" }] }));

      const r = spawnSync("node", [coPath, "--scope", "shapeup/demo/scopes/cart.md", "--round", "1", "--attempt", "2", "--cwd", d], { encoding: "utf8" });
      const orderPath = (r.stdout || "").trim();
      if (r.status === 0 && existsSync(orderPath)) ok("compile-order writes the order to orders/r<N>-a<M>.json");
      else fail(`compile-order failed (exit ${r.status})\n${r.stdout}${r.stderr}`);
      if (existsSync(orderPath)) {
        const order = readJSON(orderPath);
        const { validate: veValidate2 } = await import(vePath);
        if (veValidate2(order, readJSON(orderSchemaPath)).valid) ok("compiled order validates against work-order.schema.json");
        else fail("compiled order fails its own schema");
        if (order.payload.decisions?.length === 1 && order.payload.decisions[0].answer === "use idempotency key")
          ok("compile-order threads ONLY this scope's ledger decisions into the order");
        else fail(`compile-order decisions wrong: ${JSON.stringify(order.payload.decisions)}`);
        if (order.payload.digested_errors?.[0]?.core_message === "boom")
          ok("compile-order folds the previous attempt's AEGIS triples into digested_errors");
        else fail("compile-order did not pick up the previous T0 artifact's discovered_tasks");
        if (order.payload.tasks?.some((t) => t.acceptance_criteria.includes("first criterion")))
          ok("compile-order parses AC checkbox text into the task entries");
        else fail("compile-order did not parse acceptance criteria");
        if (order.substrate.allowed.includes("apps/web/cart/*.tsx")) ok("compile-order carries the scope substrate as the write contract");
        else fail("compile-order lost the substrate");
      }
      // ---- inspect(): trial_history ------------------------------------------------------
      // The block ABOVE is the non-regression proof: with no trials.jsonl on disk, compile-order
      // read the previous attempt's verdict artifact and produced today's `digested_errors`
      // exactly as it always has. Now seed the ledger and assert the widened read.
      if (existsSync(orderPath)) {
        const legacy = readJSON(orderPath);
        if (legacy.payload.trial_history === undefined) ok("compile-order omits trial_history entirely when no trials.jsonl exists (non-regression)");
        else fail("compile-order emitted trial_history with no ledger on disk — the fallback path is not byte-identical");
      }

      // 12 rows: 10 for this scope spread over rounds 1–2, plus 2 for another scope.
      const trialRows = [];
      for (let i = 1; i <= 10; i++) {
        trialRows.push({
          schema_version: 1, trial: i, round: i <= 5 ? 1 : 2, attempt: i, scope_id: "cart",
          score: { regressions: 0, fixtures_passed: i, fixtures_total: 12, db_probe: null },
          status: i % 3 === 0 ? "reverted" : "kept", baseline_trial: i > 1 ? i - 1 : null,
          delta: `+1 fixture`,
          digest: [1, 2, 3, 4, 5].map((n) => ({ file: `f${n}.ts`, line: n, core_message: `m${i}-${n}`, kind: "type" })),
        });
      }
      trialRows.push({ schema_version: 1, trial: 11, round: 2, attempt: 11, scope_id: "other", score: { regressions: 0, fixtures_passed: 1, fixtures_total: 1, db_probe: null }, status: "kept", digest: [] });
      trialRows.push({ schema_version: 1, trial: 12, round: 9, attempt: 1, scope_id: "cart", score: { regressions: 0, fixtures_passed: 1, fixtures_total: 12, db_probe: null }, status: "kept", digest: [] });
      w(".shapeup/demo/t0/trials.jsonl", trialRows.map((r) => JSON.stringify(r)).join("\n") + "\n");

      const rh = spawnSync("node", [coPath, "--scope", "shapeup/demo/scopes/cart.md", "--round", "2", "--attempt", "3", "--cwd", d], { encoding: "utf8" });
      const hOrder = rh.status === 0 ? readJSON((rh.stdout || "").trim()) : null;
      if (!hOrder) fail(`compile-order failed with a trial ledger present: ${rh.stdout}${rh.stderr}`);
      else {
        const th = hOrder.payload.trial_history;
        if (Array.isArray(th) && th.length === 8) ok("compile-order emits exactly 8 trial rows from a 12-row ledger (token-bounded)");
        else fail(`compile-order emitted ${th?.length} trial rows, expected 8`);
        if (th && th.every((t, i) => i === 0 || t.trial > th[i - 1].trial)) ok("trial_history is ordered oldest-first");
        else fail(`trial_history is not ordered: ${JSON.stringify(th?.map((t) => t.trial))}`);
        // Scope filter + round window: only "cart", only rounds 2 and 1 (never round 9).
        if (th && th.every((t) => t.trial <= 10)) ok("trial_history excludes other scopes and out-of-window rounds");
        else fail(`trial_history leaked a foreign scope or round: ${JSON.stringify(th?.map((t) => t.trial))}`);
        // Crossing the round boundary is the point: round 1's trials must be visible in round 2.
        if (th && th.some((t) => t.round === 1) && th.some((t) => t.round === 2)) ok("trial_history CROSSES the round boundary — round 2 is not blind to round 1");
        else fail(`trial_history did not cross the round boundary: ${JSON.stringify(th?.map((t) => t.round))}`);
        if (th && th.every((t) => t.digest.length <= 3)) ok("trial_history truncates each digest to 3 triples (token discipline)");
        else fail(`trial_history digest not truncated: ${JSON.stringify(th?.map((t) => t.digest.length))}`);
        if (th && th.every((t) => t.score && t.status && !("stdout" in t) && !("stderr" in t))) ok("trial_history carries score + status and strips stdout/stderr");
        else fail("trial_history rows are missing score/status or carry raw output");
        const { valid } = (await import(vePath)).validate(hOrder, readJSON(orderSchemaPath));
        if (valid) ok("an order carrying trial_history still validates against work-order.schema.json (the history is a typed contract, not a convention)");
        else fail("an order with trial_history fails the WorkOrder schema");
        // The stagnation breaker reports on stderr, never on stdout (stdout IS the order path).
        if ((rh.stdout || "").trim().endsWith(".json")) ok("compile-order keeps stdout to the order path — the breaker never corrupts the pipeline's own output");
        else fail(`compile-order polluted stdout: ${rh.stdout}`);
      }

      // The stagnation breaker fires on consecutive non-kept trials and only advises.
      w(".shapeup/demo/t0/trials.jsonl", [
        { schema_version: 1, trial: 1, round: 2, attempt: 1, scope_id: "cart", score: { regressions: 0, fixtures_passed: 2, fixtures_total: 5, db_probe: null }, status: "kept", digest: [] },
        { schema_version: 1, trial: 2, round: 2, attempt: 2, scope_id: "cart", score: { regressions: 0, fixtures_passed: 2, fixtures_total: 5, db_probe: null }, status: "reverted", digest: [] },
        { schema_version: 1, trial: 3, round: 2, attempt: 3, scope_id: "cart", score: { regressions: 0, fixtures_passed: 2, fixtures_total: 5, db_probe: null }, status: "reverted", digest: [] },
      ].map((r) => JSON.stringify(r)).join("\n") + "\n");
      const rs = spawnSync("node", [coPath, "--scope", "shapeup/demo/scopes/cart.md", "--round", "2", "--attempt", "4", "--cwd", d], { encoding: "utf8" });
      if (rs.status === 0 && /"breaker":"stagnation"/.test(rs.stderr || "")) ok("the stagnation breaker fires after no_progress_k consecutive non-kept trials");
      else fail(`stagnation breaker did not fire: exit ${rs.status}, stderr ${(rs.stderr || "").slice(0, 120)}`);
      if (rs.status === 0) ok("the stagnation breaker ADVISES (exit 0) — an exhausted scope queues a GATE H proposal, it never blocks the round");
      else fail(`stagnation breaker blocked the round (exit ${rs.status}) — it must only advise`);

      const { stagnation } = await import(coPath);
      const st = (statuses) => stagnation(statuses.map((s) => ({ status: s })), 2);
      if (st(["kept", "reverted", "reverted"]).stagnant && !st(["reverted", "kept"]).stagnant && !st(["reverted"]).stagnant) {
        ok("stagnation() counts only the TRAILING non-kept streak — one keep resets it");
      } else fail("stagnation() mis-counts the trailing streak");

      // --next respects dependency order: only TASK-001 is dispatchable.
      const rn = spawnSync("node", [coPath, "--next", "--slug", "demo", "--cwd", d], { encoding: "utf8" });
      const nextOrder = rn.status === 0 ? readJSON((rn.stdout || "").trim()) : null;
      if (nextOrder && nextOrder.payload.tasks.length === 1 && nextOrder.payload.tasks[0].id === "TASK-001")
        ok("compile-order --next picks the ready task with satisfied dependencies");
      else fail(`compile-order --next wrong: ${rn.stdout}${rn.stderr}`);

      // =============================================================================
      section("22. ingest-result.mjs is the single writer: ticks, flips, unblocks, appends — and rejects malformed results");
      // =============================================================================
      const result = {
        schema_version: 1, order_id: "demo/r1-a2", worker: "task-executor", status: "done",
        task_results: [{ task_id: "TASK-001", status: "done", ac_results: [
          { ac: "first criterion", result: "pass", evidence: "ran it" },
          { ac: "second criterion", result: "pass", evidence: "ran it too" },
        ] }],
        discoveries: [{ marker: "+", line: "edge case found" }],
        escalates: [{ kind: "spec-ambiguity", question: "which default?" }],
      };
      w(".shapeup/demo/results/r1-a2.json", JSON.stringify(result));
      const ri = spawnSync("node", [irPath, join(d, ".shapeup/demo/results/r1-a2.json"), "--cwd", d], { encoding: "utf8" });
      if (ri.status === 0) ok("ingest-result ingests a valid WorkResult");
      else fail(`ingest-result failed (exit ${ri.status})\n${ri.stdout}${ri.stderr}`);
      const t1 = read(join(d, ".shapeup/demo/tasks/TASK-001-a.md"));
      if (/- \[x\] first criterion/.test(t1) && /- \[x\] second criterion/.test(t1)) ok("ingest ticks the verified AC boxes");
      else fail("ingest did not tick AC boxes");
      if (/^status: done$/m.test(t1) && /## Execution Log/.test(t1)) ok("ingest flips status: done + appends the Execution Log");
      else fail("ingest did not flip status / append the log");
      const t2 = read(join(d, ".shapeup/demo/tasks/TASK-002-b.md"));
      if (/^status: ready$/m.test(t2)) ok("ingest propagates unblocks (blocked → ready when deps done)");
      else fail("ingest did not unblock the dependent task");
      if (read(join(d, ".shapeup/demo/tasks/_index.md")).includes("✅")) ok("ingest updates the board row");
      else fail("ingest did not update the board index");
      if (read(join(d, ".shapeup/demo/discovery/ledger.md")).includes("edge case found")) ok("ingest appends discoveries to the ledger");
      else fail("ingest did not append the discovery");
      if (existsSync(join(d, ".shapeup/demo/escalates/r1-a2.json"))) ok("ingest queues escalates for the orchestrator");
      else fail("ingest did not queue the escalate");
      // Verdict path: refuted box un-ticked + verdict JSONL appended.
      const evalResult = {
        schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator", status: "done",
        verdict: { overall: "FAIL",
          criteria: [{ criterion: "first criterion", verdict: "FAIL", confidence: "high", evidence: "broke" }],
          refuted: [{ task_id: "TASK-001", ac: "first criterion" }] },
      };
      w(".shapeup/demo/results/evaluate-r1.json", JSON.stringify(evalResult));
      const rv = spawnSync("node", [irPath, join(d, ".shapeup/demo/results/evaluate-r1.json"), "--cwd", d], { encoding: "utf8" });
      const t1b = read(join(d, ".shapeup/demo/tasks/TASK-001-a.md"));
      if (rv.status === 0 && /- \[ \] first criterion/.test(t1b) && /eval_verdict: fail/.test(t1b))
        ok("ingest un-ticks refuted AC boxes + sets eval_verdict from the judge's data");
      else fail("ingest did not apply the judge's refuted list");
      if (existsSync(join(d, ".shapeup/demo/evaluation/.verdicts-evaluate-r1.jsonl")))
        ok("ingest appends the verdict-ledger JSONL");
      else fail("ingest did not write the verdict ledger");
      // Negative control: malformed result must be rejected without mutating anything.
      w(".shapeup/demo/results/bad.json", JSON.stringify({ schema_version: 1, order_id: "demo/x", status: "nope" }));
      const rb = spawnSync("node", [irPath, join(d, ".shapeup/demo/results/bad.json"), "--cwd", d], { encoding: "utf8" });
      if (rb.status === 1) ok("ingest-result REJECTS a malformed WorkResult (a bad envelope never mutates the board)");
      else fail("ingest-result accepted a malformed result — the board can be corrupted");
    } finally { rmSync(d, { recursive: true, force: true }); }
  } else {
    fail("compile-order.mjs / ingest-result.mjs missing — the P1 pipeline layer is absent");
  }


  // =============================================================================
  section("24. domain.schema.json is the central registry: every $ref resolves, the payload map is consistent, and validation discriminates through the ref chain");
  // =============================================================================
  // The definition layer (central-domain-registry): every record type and payload field the
  // envelopes carry is defined ONCE in skills/tech-lead/schemas/domain.schema.json; the two
  // envelope schemas only $ref it. This section guards the registry the way #3 guards SKILL
  // references: a dangling $ref, a payload field named in x-payload-by-worker but not defined,
  // or a worker listed that isn't in the WorkerName enum is drift between the registry and
  // reality — exactly the "each skill defines its own fields" failure the registry exists to end.
  const domainSchemaPath = join(ROOT, "skills/tech-lead/schemas/domain.schema.json");
  if (existsSync(domainSchemaPath) && existsSync(vePath)) {
    let domain;
    try { domain = readJSON(domainSchemaPath); ok("domain.schema.json parses"); }
    catch (e) { fail(`domain.schema.json does not parse: ${e.message}`); }
    if (domain) {
      // Every $ref anywhere in the three schema files must resolve to a real definition.
      const schemasDir = join(ROOT, "skills/tech-lead/schemas");
      const docs = {};
      for (const f of readdirSync(schemasDir).filter((x) => x.endsWith(".json"))) docs[f] = readJSON(join(schemasDir, f));
      const collectRefs = (node, acc) => {
        if (Array.isArray(node)) node.forEach((n) => collectRefs(n, acc));
        else if (node && typeof node === "object") {
          if (typeof node.$ref === "string") acc.push(node.$ref);
          for (const v of Object.values(node)) collectRefs(v, acc);
        }
        return acc;
      };
      let dangling = 0;
      for (const [file, doc] of Object.entries(docs)) {
        for (const ref of collectRefs(doc, [])) {
          const [refFile, pointer = ""] = ref.split("#");
          const target = refFile ? docs[refFile] : doc;
          let nodeAt = target;
          for (const seg of pointer.split("/").filter(Boolean)) nodeAt = nodeAt?.[seg];
          if (!nodeAt) { dangling++; fail(`${file}: dangling $ref "${ref}"`); }
        }
      }
      if (dangling === 0) ok("every $ref across the schemas resolves to a real definition");

      // x-payload-by-worker: every field must exist in WorkOrderPayload.properties, every
      // worker key must be in the WorkerName enum — the registry may not drift from itself.
      const payloadProps = domain.$defs?.WorkOrderPayload?.properties || {};
      const workerEnum = new Set(domain.$defs?.WorkerName?.enum || []);
      const byWorker = domain["x-payload-by-worker"] || {};
      let mapDrift = 0;
      for (const [worker, fields] of Object.entries(byWorker)) {
        if (worker === "description") continue;
        if (!workerEnum.has(worker)) { mapDrift++; fail(`x-payload-by-worker names unknown worker "${worker}"`); }
        for (const f of fields) {
          if (!payloadProps[f]) { mapDrift++; fail(`x-payload-by-worker: ${worker} relies on undefined payload field "${f}"`); }
        }
      }
      const mappedWorkers = Object.keys(byWorker).filter((k) => k !== "description");
      if (mappedWorkers.length === workerEnum.size) ok(`x-payload-by-worker covers all ${workerEnum.size} workers`);
      else fail(`x-payload-by-worker covers ${mappedWorkers.length}/${workerEnum.size} workers`);
      if (mapDrift === 0) ok("x-payload-by-worker is consistent with WorkOrderPayload + WorkerName");

      // x-result-by-worker: the result half of the registry gets the same guard — every field
      // must exist in work-result.schema.json properties, every worker key must be in the
      // WorkerName enum, all workers must be mapped, and the two authority boundaries hold
      // (only spec-evaluator returns a verdict; only task-executor returns task_results).
      const resultProps = docs["work-result.schema.json"]?.properties || {};
      const byWorkerResult = domain["x-result-by-worker"] || {};
      let resultDrift = 0;
      for (const [worker, fields] of Object.entries(byWorkerResult)) {
        if (worker === "description") continue;
        if (!workerEnum.has(worker)) { resultDrift++; fail(`x-result-by-worker names unknown worker "${worker}"`); }
        for (const f of fields) {
          if (!resultProps[f]) { resultDrift++; fail(`x-result-by-worker: ${worker} may output undefined result field "${f}"`); }
        }
      }
      const mappedResultWorkers = Object.keys(byWorkerResult).filter((k) => k !== "description");
      if (mappedResultWorkers.length === workerEnum.size) ok(`x-result-by-worker covers all ${workerEnum.size} workers`);
      else fail(`x-result-by-worker covers ${mappedResultWorkers.length}/${workerEnum.size} workers`);
      if (resultDrift === 0) ok("x-result-by-worker is consistent with work-result.schema.json + WorkerName");
      const verdictHolders = mappedResultWorkers.filter((w) => (byWorkerResult[w] || []).includes("verdict"));
      const taskResultHolders = mappedResultWorkers.filter((w) => (byWorkerResult[w] || []).includes("task_results"));
      if (verdictHolders.length === 1 && verdictHolders[0] === "spec-evaluator" &&
          taskResultHolders.length === 1 && taskResultHolders[0] === "task-executor")
        ok("result authority boundaries hold: verdict = spec-evaluator only, task_results = task-executor only");
      else fail(`result authority drift: verdict → [${verdictHolders}], task_results → [${taskResultHolders}]`);

      // The x-erd relationship map must exist and reference only registered entity names
      // (loose check: 'from' side, minus the two envelope roots and prose-annotated targets).
      const rels = domain["x-erd"]?.relationships || [];
      if (rels.length >= 10 && rels.every((r) => r.from && r.to && r.cardinality && r.via))
        ok(`x-erd carries ${rels.length} annotated relationships (from/to/cardinality/via)`);
      else fail("x-erd relationships missing or malformed (need from/to/cardinality/via each)");

      // Validation must DISCRIMINATE through the $ref chain — deep fields, not just top level.
      const { validate: veValidate3 } = await import(vePath);
      const orderSchema3 = readJSON(orderSchemaPath);
      const resultSchema3 = readJSON(resultSchemaPath);
      const badDeepOrder = {
        schema_version: 1, order_id: "demo/r1-a1", worker: "task-executor", mode: "orchestrated",
        operation: "execute",
        payload: { lens: "extreme", scope_contract: { scope_id: "cart", topology_type: "SPAGHETTI" } },
      };
      const bo = veValidate3(badDeepOrder, orderSchema3);
      if (!bo.valid && bo.errors.some((e) => e.includes("lens")) && bo.errors.some((e) => e.includes("topology_type")))
        ok("order validation rejects a bad lens + topology_type THROUGH the $ref chain");
      else fail(`order validation did not discriminate deep $ref'd fields: ${JSON.stringify(bo.errors)}`);
      const badDeepResult = {
        schema_version: 1, order_id: "demo/r1-a1", status: "done",
        discoveries: [{ marker: "!", line: "x" }],
        verdict: { overall: "PASS", t0_citations: [{ scope_id: "cart", path: "p", sha256: "not-a-hash" }] },
      };
      const br = veValidate3(badDeepResult, resultSchema3);
      if (!br.valid && br.errors.some((e) => e.includes("marker")) && br.errors.some((e) => e.includes("sha256")))
        ok("result validation rejects a bad discovery marker + T0 sha256 THROUGH the $ref chain");
      else fail(`result validation did not discriminate deep $ref'd fields: ${JSON.stringify(br.errors)}`);
      // Positive control: a fully-loaded valid envelope pair still passes.
      const richOrder = {
        schema_version: 1, order_id: "demo/r2-a1", worker: "spec-evaluator", mode: "orchestrated",
        operation: "evaluate", interaction: { pause_gates: false },
        substrate: { allowed: [".shapeup/demo/evaluation/**"], frozen: ["docs/**"] },
        payload: { spec_folder: "shapeup/demo/spec", feature: "demo",
          dimensions: ["spec-conformance"], run_cmd: "pnpm dev", browser: "cli",
          t0_artifacts: [".shapeup/demo/t0/verdicts/r2-a1.json"] },
      };
      if (veValidate3(richOrder, orderSchema3).valid) ok("a fully-loaded valid order still PASSes (no false blocks from the registry)");
      else fail(`registry wrongly rejects a valid order: ${JSON.stringify(veValidate3(richOrder, orderSchema3).errors)}`);
    }
  } else {
    fail("domain.schema.json missing — the central domain registry is absent");
  }


  // =============================================================================
  section("30. stats.mjs is a read-only, schema-valid projection over the metrics shards");
  // =============================================================================
  {
    const statsPath = join(ROOT, "skills/tech-lead/scripts/stats.mjs");
    const d = mkdtempSync(join(tmpdir(), "stats-"));
    const mdir = join(d, ".shapeup/metrics");
    mkdirSync(mdir, { recursive: true });
    writeFileSync(join(mdir, "a.jsonl"), [
      JSON.stringify({ schema_version: 1, feature_slug: "demo", terminal_state: "shipped", round_count: 2, scope_cut_count: 0, qa_findings: { total: 3, promoted: 1, held: 2 }, slice_count: 4, sources: [] }),
      JSON.stringify({ schema_version: 1, at: "2026-07-10T00:00:00Z", feature_slug: "demo", terminal_state: "shipped", round_count: 3, scope_cut_count: 1, attempt_exhaustions: 1, qa_findings: { total: 2, promoted: 2, held: 0 }, slice_count: 4, sources: [] }),
      JSON.stringify({ schema_version: 1, kind: "pathology", pathology: "PA3", slug: "demo" }),
      "not json at all",
      "{}",
    ].join("\n") + "\n");
    writeFileSync(join(mdir, "b.jsonl"), JSON.stringify({ schema_version: 1, feature_slug: "other", terminal_state: "escalated", round_count: 4, sources: [] }) + "\n");

    const before = readdirSync(mdir).map((f) => `${f}:${statSync(join(mdir, f)).size}`).join(",");
    const r = spawnSync("node", [statsPath, "--cwd", d], { encoding: "utf8" });
    let report = null;
    try { report = JSON.parse(r.stdout); } catch { /* handled below */ }
    if (r.status === 0 && report) ok("stats exits 0 and emits parseable JSON");
    else fail(`stats failed: status=${r.status} ${r.stderr}`);

    const { validate: veValidateStats } = await import(join(ROOT, "skills/tech-lead/scripts/validate-envelope.mjs"));
    const repCheck = report ? veValidateStats(report, { $ref: "domain.schema.json#/$defs/StatsReport" }) : { valid: false, errors: ["no report"] };
    if (repCheck.valid) ok("report validates against domain.schema.json#/$defs/StatsReport");
    else fail(`report fails its own registry def: ${repCheck.errors.join("; ")}`);

    const demo = report?.per_slug?.find((s) => s.feature_slug === "demo");
    if (demo?.runs === 2 && demo.rounds.avg === 2.5 && demo.hammer_cut_rate === 0.5 && demo.attempt_exhaustions === 1)
      ok("aggregates are right (runs 2, rounds.avg 2.5, cut-rate 0.5, exhaustions 1)");
    else fail(`demo aggregate wrong: ${JSON.stringify(demo)}`);
    if (report?.rows_malformed === 2 && report?.rows_pathology === 1 && report?.pathologies?.PA3 === 1)
      ok("malformed rows skipped+counted; pathology rows partitioned, not errors");
    else fail(`row accounting wrong: malformed=${report?.rows_malformed} pathology=${report?.rows_pathology}`);

    const rTable = spawnSync("node", [statsPath, "--cwd", d, "--format", "table"], { encoding: "utf8" });
    if (rTable.status === 0 && rTable.stdout.includes("demo")) ok("--format table renders and names the slug");
    else fail(`table render failed: ${rTable.stderr}`);

    const after = readdirSync(mdir).map((f) => `${f}:${statSync(join(mdir, f)).size}`).join(",");
    if (before === after) ok("metrics dir is byte-identical after both runs (read-only proof)");
    else fail(`stats WROTE to the metrics dir: before=${before} after=${after}`);

    const emptyDir = mkdtempSync(join(tmpdir(), "statsempty-"));
    const rEmpty = spawnSync("node", [statsPath, "--cwd", emptyDir], { encoding: "utf8" });
    let emptyReport = null;
    try { emptyReport = JSON.parse(rEmpty.stdout); } catch { /* handled below */ }
    if (rEmpty.status === 0 && emptyReport?.rows_total === 0) ok("missing metrics dir → valid empty report, exit 0");
    else fail(`empty-dir case wrong: status=${rEmpty.status}`);
    rmSync(d, { recursive: true, force: true });
    rmSync(emptyDir, { recursive: true, force: true });
  }


  // =============================================================================
  section("31. trace-lint.mjs is the covers-closure + reachability oracle (spine v1.3)");
  // =============================================================================
  // The plan's governing rule: if a script can't check it, it's decoration. This section proves
  // the oracle actually goes RED on the two audit findings it exists to catch — a dropped clause
  // and an orphaned engine — is ADVISORY by default (exit 0) yet BLOCKS under --gate, and is a
  // true non-regression on legacy specs (no spine artifacts → green). It also guards the schema
  // registration surface the plan requires (worker/operation/$def/payload) against drift.
  {
    const tlPath = join(ROOT, "skills/tech-lead/scripts/trace-lint.mjs");
    if (!existsSync(tlPath)) fail("skills/tech-lead/scripts/trace-lint.mjs missing — the traceability oracle is absent");
    else {
      const run = (slug, cwd, extra = []) => {
        const r = spawnSync("node", [tlPath, "--slug", slug, "--cwd", cwd, "--quiet", ...extra], { encoding: "utf8" });
        let report = null;
        try { report = readJSON(join(cwd, ".shapeup", slug, "trace", "report.json")); } catch { /* handled by caller */ }
        return { status: r.status, report };
      };

      // Fixture A: a dropped clause (REQ covered-status, no AC), a dangling covers, an orphan engine.
      const A = mkdtempSync(join(tmpdir(), "tracelint-red-"));
      mkdirSync(join(A, "shapeup/demo"), { recursive: true });
      mkdirSync(join(A, ".shapeup/demo/tasks"), { recursive: true });
      mkdirSync(join(A, "src"), { recursive: true });
      writeFileSync(join(A, "shapeup/demo/requirements.md"),
        "| REQ-id | clause | source | status | note |\n|--|--|--|--|--|\n" +
        "| REQ-1 | lure enemies into traps | p §2.1 | covered | |\n" +
        "| REQ-2 | side-step enemies | p §2.2 | covered | |\n" +
        "| REQ-3 | low-res textures | p §2.3 | CUT (PO-approved) | absorbed |\n");
      writeFileSync(join(A, ".shapeup/demo/tasks/TASK-001.md"),
        "---\nid: TASK-001\nstatus: ready\npriority: 1\n---\n- [ ] enemy lured into a trap (covers: REQ-1)\n- [ ] trap resets (covers: REQ-9)\n");
      // MARKDOWN contracts (ADR-0001): frontmatter for the scalars, a table for `entries`.
      // Written in the real on-disk form so trace-lint is exercised through the actual parser.
      writeFileSync(join(A, "shapeup/demo/project-profile.md"),
        "---\nschema_version: 1\narchetype: client-only-game\nentry_point: main.js\n---\n");
      writeFileSync(join(A, "shapeup/demo/wiring-map.md"), [
        "---", "schema_version: 1", "feature: demo", "---",
        "## Wiring",
        "| use_case | engine | affordance |",
        "|---|---|---|",
        "| UC-01 | src/trap.js | trap fires |",
        "| UC-02 | src/asset-pipeline.js | textures |",
        "",
      ].join("\n"));
      writeFileSync(join(A, "main.js"), 'import { fire } from "./src/trap.js";\nfire();\n');
      writeFileSync(join(A, "src/trap.js"), "export function fire(){ return 1; }\n");
      writeFileSync(join(A, "src/asset-pipeline.js"), "export function load(){ return 631; }\n");

      const advisory = run("demo", A);
      if (advisory.status === 0) ok("trace-lint is advisory by default (exit 0 even when red)");
      else fail(`advisory run should exit 0, got ${advisory.status}`);
      const cc = advisory.report?.covers_closure, rc = advisory.report?.reachability;
      if (advisory.report?.overall === "red") ok("trace-lint reports overall red on dropped clause + orphan");
      else fail(`expected overall red, got ${advisory.report?.overall}`);
      if (cc?.uncovered?.includes("REQ-2")) ok("covers-closure flags the dropped clause REQ-2 (no AC covers it)");
      else fail(`REQ-2 not flagged uncovered: ${JSON.stringify(cc?.uncovered)}`);
      if (cc?.dangling_covers?.includes("REQ-9")) ok("covers-closure flags the dangling covers: REQ-9 (not in the registry)");
      else fail(`REQ-9 not flagged dangling: ${JSON.stringify(cc?.dangling_covers)}`);
      if (!cc?.uncovered?.includes("REQ-3")) ok("a CUT (PO-approved) clause is NOT counted uncovered (governance, not a gap)");
      else fail("REQ-3 (CUT) wrongly flagged uncovered");
      if (rc?.unreachable?.some((u) => u.use_case === "UC-02")) ok("reachability flags the orphaned engine (UC-02, 0 import sites)");
      else fail(`UC-02 orphan not flagged: ${JSON.stringify(rc?.unreachable)}`);
      if (!rc?.unreachable?.some((u) => u.use_case === "UC-01")) ok("reachability does NOT flag the wired engine (UC-01 reaches entry_point)");
      else fail("UC-01 wrongly flagged unreachable");

      const gated = run("demo", A, ["--gate"]);
      if (gated.status === 1) ok("--gate turns the same red report into a blocking failure (exit 1)");
      else fail(`--gate should exit 1 on red, got ${gated.status}`);

      // Fixture B: a legacy spec with no spine artifacts must be green even under --gate.
      const B = mkdtempSync(join(tmpdir(), "tracelint-legacy-"));
      mkdirSync(join(B, ".shapeup/legacy/tasks"), { recursive: true });
      writeFileSync(join(B, ".shapeup/legacy/tasks/TASK-001.md"),
        "---\nid: TASK-001\nstatus: ready\npriority: 1\n---\n- [ ] something works\n");
      const legacy = run("legacy", B, ["--gate"]);
      if (legacy.status === 0 && legacy.report?.overall === "green") ok("legacy spec (no requirements/wiring/profile) is green even under --gate (non-regression)");
      else fail(`legacy run should be green/exit0, got status=${legacy.status} overall=${legacy.report?.overall}`);
      if (legacy.report?.covers_closure?.checked === false && legacy.report?.reachability?.checked === false) ok("both spine arms self-skip when their artifacts are absent");
      else fail("legacy run did not self-skip the spine arms");

      rmSync(A, { recursive: true, force: true });
      rmSync(B, { recursive: true, force: true });
    }

    // Schema registration surface the plan mandates (§2, §5) — guard against half-wired drift.
    const domain = readJSON(join(ROOT, "skills/tech-lead/schemas/domain.schema.json"));
    const wn = new Set(domain.$defs?.WorkerName?.enum || []);
    const ops = new Set(domain.$defs?.Operation?.enum || []);
    if (wn.has("solution-architect")) ok("WorkerName enum registers solution-architect");
    else fail("solution-architect missing from WorkerName enum");
    for (const op of ["wire", "coverage"]) {
      if (ops.has(op)) ok(`Operation enum registers ${op}`);
      else fail(`Operation enum missing ${op}`);
    }
    for (const def of ["RequirementClause", "WiringMap", "WiringEntry", "ProjectProfile"]) {
      if (domain.$defs?.[def]) ok(`$defs registers ${def}`);
      else fail(`$defs missing ${def}`);
    }
    // The new $defs must carry the writer/tier annotations the registry discipline requires.
    const writers = { RequirementClause: "ba-pitch-analyzer", WiringMap: "solution-architect", ProjectProfile: "tech-lead" };
    for (const [def, who] of Object.entries(writers)) {
      if ((domain.$defs?.[def]?.["x-writer"] || "").includes(who)) ok(`${def} x-writer is ${who}`);
      else fail(`${def} x-writer must name ${who}`);
    }
    // ProjectProfile.archetype must be a closed enum (a typo must fail, not silently disable reachability).
    if (Array.isArray(domain.$defs?.ProjectProfile?.properties?.archetype?.enum)) ok("ProjectProfile.archetype is a closed enum");
    else fail("ProjectProfile.archetype must be an enum");
    // acceptance_criteria must be the additive union (string | {text, covers?}).
    const acItems = domain.$defs?.TaskRef?.properties?.acceptance_criteria?.items;
    if (Array.isArray(acItems?.anyOf) && acItems.anyOf.some((s) => s.type === "string") && acItems.anyOf.some((s) => s.type === "object"))
      ok("TaskRef.acceptance_criteria accepts the additive string | {text, covers?} union");
    else fail("acceptance_criteria is not the additive union the plan requires");

    // parseTaskFile must extract covers[] while keeping .text byte-identical (ingest tick-back safe).
    const cwd2 = mkdtempSync(join(tmpdir(), "covers-parse-"));
    mkdirSync(join(cwd2, ".shapeup/px/tasks"), { recursive: true });
    writeFileSync(join(cwd2, ".shapeup/px/tasks/TASK-001.md"),
      "---\nid: TASK-001\nstatus: ready\npriority: 1\n---\n- [ ] does A (covers: REQ-3, REQ-7)\n- [ ] plain B\n");
    const { readBoard } = await import(join(ROOT, "skills/tech-lead/scripts/compile-order.mjs"));
    const board = readBoard(cwd2, "px");
    const acs = board[0]?.acceptance_criteria || [];
    const withCovers = acs.find((a) => typeof a === "object");
    if (withCovers && withCovers.text === "does A (covers: REQ-3, REQ-7)" && withCovers.covers.join(",") === "REQ-3,REQ-7")
      ok("parseTaskFile extracts covers[] and keeps .text byte-identical to the checkbox");
    else fail(`covers parse wrong: ${JSON.stringify(withCovers)}`);
    if (acs.some((a) => a === "plain B")) ok("an AC with no covers: stays a plain string (non-regression)");
    else fail("plain AC was not left as a string");
    rmSync(cwd2, { recursive: true, force: true });
  }

  // =============================================================================
  section("32. JSDoc coverage — tech-lead scripts + test-lib helpers carry input/output contracts");
  // =============================================================================
  // The orchestrator scripts are the harness's executable contracts (single-writer ingest-result,
  // hook-validated compile-order, the trace-lint oracle); their signatures are the seams other
  // skills depend on, so every top-level/exported function must document its input/output shape
  // (skills-optimization plan, Track D). Counted into the checks-floor so it can't silently regress.
  assertJsdocCoverage(ctx, [
    "skills/tech-lead/scripts/compile-order.mjs",
    "skills/tech-lead/scripts/ingest-result.mjs",
    "skills/tech-lead/scripts/validate-envelope.mjs",
    "skills/tech-lead/scripts/t0-verify.mjs",
    "skills/tech-lead/scripts/run-snapshot.mjs",
    "skills/tech-lead/scripts/stats.mjs",
    "skills/tech-lead/scripts/aegis-digest.mjs",
    "skills/tech-lead/scripts/trace-lint.mjs",
    "tests/lib/harness.mjs",
    "tests/lib/jsdoc.mjs",
  ].map((f) => join(ROOT, f)), (p) => p.replace(ROOT + "/", ""));
}
