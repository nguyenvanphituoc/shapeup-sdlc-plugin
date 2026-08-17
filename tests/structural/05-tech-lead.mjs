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

  // Every deterministic step is a subcommand of one entry point (kernel/harness.mjs), so a spawn
  // names the verb rather than a script path — the same string a permission rule sees. Modules are
  // still imported by path when a check wants a pure function out of one.
  const K = (words) => [join(ROOT, "kernel/harness.mjs"), ...words.split(" ")];

  // =============================================================================
  section("18. T0 mechanical layer (harness verify t0) computes a discriminating verdict + writes a citable artifact");
  // =============================================================================
  const t0Path = join(ROOT, "kernel/verify/t0.mjs");
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
      ["a tie on a RED scope is NOT better (a sawtooth must not read as a ratchet)", better(S(0, 2, 5, 1), S(0, 2, 5, 1)), false],
      // The green tie is the other half, and its absence cost a live run. At 5/5 there is no score
      // left to win, so every attempt ties by construction and `false` restores the tree every time
      // — the scope can never change again. That is the state a spec-conformance round is in: EVAL
      // cites bugs T0's fixtures do not test, the workers fix them, T0 ties, and the ratchet throws
      // the fix away. Measured: round 2 produced 6 trials, 0 kept, 6 reverted, the entry point
      // byte-for-byte unchanged, all three cited bugs still reproducing.
      ["a tie on a GREEN scope KEEPS (else EVAL's findings can never be fixed)", better(S(0, 5, 5, 1), S(0, 5, 5, 1)), true],
      ["a green tie with an outstanding regression is still not better", better(S(1, 5, 5, 1), S(1, 5, 5, 1)), false],
      ["a zero-fixture 'tie' is not green and does not keep", better(S(0, 0, 0, null), S(0, 0, 0, null)), false],
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

    // ---- the writer and the reader must agree on WHERE ------------------------------------
    //
    // Everything above tests T0's functions in process. None of it asks the question that actually
    // decided a live run: when `verify t0` is invoked the way a build leg invokes it — through the
    // CLI, with no `--out` — does `probe t0` find what it wrote?
    //
    // For the life of the v2 branch it did not. `verify t0` defaulted its output to
    // `dirname(dirname(<contract path>))`, which was "the parent of scopes/" and correct until
    // ADR-0001 moved scope contracts to the COMMITTED tier; after that every verdict landed in
    // `shapeup/<slug>/t0/` while `probe t0` resolved `verdictsDir()` to `.shapeup/<slug>/t0/`.
    // A live run wrote six verdicts — one of them `foundation`, 2/2 fixtures, `kept`, a real green —
    // and the build round still reported ZERO green scopes, tripped the inner breaker and returned
    // `gate_h`. The measurement was taken, was correct, and was thrown away.
    //
    // This is the "measured, not claimed" invariant's own load-bearing seam, and both halves passed
    // their unit checks while the pair was broken. So the check is an EXECUTION of the pair.
    const t0box = mkdtempSync(join(tmpdir(), "t0-tier-"));
    try {
      const wr = (rel, body) => { mkdirSync(dirname(join(t0box, rel)), { recursive: true }); writeFileSync(join(t0box, rel), body); };
      wr("shapeup/demo/scopes/sc-01.md", [
        "---", "scope_id: sc-01", "topology_type: LAYER_CAKE", "tasks: [TASK-001]",
        "allowed_file_substrate: [src/a.js]",
        `e2e_verification_fixtures: ["node -e \\"process.exit(0)\\""]`,
        "hill_phase: UPHILL_UNKNOWN", "---", "", "# Scope: sc-01", "",
      ].join("\n"));
      const rv = spawnSync("node", [...K("verify t0"), join(t0box, "shapeup/demo/scopes/sc-01.md"),
        "--round", "1", "--attempt", "1", "--cwd", t0box, "--no-seesaw", "--no-ratchet"], { encoding: "utf8" });
      const rp = spawnSync("node", [...K("probe t0"), "--slug", "demo", "--scope", "sc-01", "--round", "1", "--cwd", t0box], { encoding: "utf8" });
      let seen = null;
      try { seen = JSON.parse(rp.stdout); } catch { /* asserted below */ }
      if (rv.status === 0 && seen?.green === true && seen.path) {
        ok("`verify t0` with no --out writes where `probe t0` reads — the confirm stage can see a green verdict");
      } else {
        fail(`the T0 writer and reader disagree on location: verify exit ${rv.status}, probe said ${rp.stdout.trim()}. ` +
          `A green verdict that probe t0 cannot find makes every scope not-green, so BUILD reports 0 green and trips the inner breaker.`);
      }
      // And it must be the LOCAL tier specifically: AGENTS.md puts T0 artifacts in the gitignored
      // root, and a verdict committed to `shapeup/<slug>/` would travel with the repo.
      if (existsSync(join(t0box, ".shapeup/demo/t0/verdicts")) && !existsSync(join(t0box, "shapeup/demo/t0"))) {
        ok("T0 verdicts land in the LOCAL tier, never beside the committed scope contracts");
      } else {
        fail(`T0 verdicts are in the wrong storage tier: local=${existsSync(join(t0box, ".shapeup/demo/t0/verdicts"))} ` +
          `committed=${existsSync(join(t0box, "shapeup/demo/t0"))}`);
      }
    } finally {
      rmSync(t0box, { recursive: true, force: true });
    }
  } else {
    console.log("  (t0-verify.mjs not found — skipping)");
  }


  // =============================================================================
  section("19. AEGIS digester distills raw logs into {file, line, core_message} triples");
  // =============================================================================
  const digestPath = join(ROOT, "kernel/probe/digest.mjs");
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
  const vePath = join(ROOT, "kernel/verify/envelope.mjs");
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
          const r = spawnSync("node", [...K("verify envelope")], { encoding: "utf8", input: JSON.stringify({ tool_name: tool, cwd: d, tool_input: { prompt } }) });
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
    const wired = /harness\.mjs\\?"? verify envelope/.test(JSON.stringify(hooksManifest2));
    if (wired) ok("hooks.json wires `harness verify envelope` as a PreToolUse hook");
    else fail("hooks.json does not wire the envelope gate — malformed orders would reach workers");
  } else {
    fail("validate-envelope.mjs or schemas/ missing — the P0 envelope layer is absent");
  }


  // =============================================================================
  section("21. compile-order.mjs assembles a schema-valid, fact-only WorkOrder (pure-skill P1)");
  // =============================================================================
  const coPath = join(ROOT, "kernel/compile.mjs");
  const irPath = join(ROOT, "kernel/reduce/ingest.mjs");
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

      const r = spawnSync("node", [...K("compile"), "--scope", "shapeup/demo/scopes/cart.md", "--round", "1", "--attempt", "2", "--cwd", d], { encoding: "utf8" });
      const orderPath = (r.stdout || "").trim();
      if (r.status === 0 && existsSync(orderPath)) ok("compile-order writes the order to orders/<scope>-r<N>-a<M>.json");
      else fail(`compile-order failed (exit ${r.status})\n${r.stdout}${r.stderr}`);

      // A BUILD order's id must carry its scope. Without it every scope in a round compiles to the
      // same filename, so scope 2's order overwrites scope 1's — which is what made an
      // `orders/ minus results/ is empty` acceptance row read GREEN on a kill/resume probe that
      // was, at that moment, re-dispatching a completed phase. An order file that is not
      // self-identifying is not an audit trail.
      if (/(^|\/)cart-r1-a2\.json$/.test(orderPath)) {
        ok("a build order's filename names its scope, so two scopes in one round cannot overwrite each other");
      } else {
        fail(`a build order is addressed as "${orderPath.split("/").pop()}" — without a scope id, scope 2's order overwrites scope 1's`);
      }
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

      const rh = spawnSync("node", [...K("compile"), "--scope", "shapeup/demo/scopes/cart.md", "--round", "2", "--attempt", "3", "--cwd", d], { encoding: "utf8" });
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
      const rs = spawnSync("node", [...K("compile"), "--scope", "shapeup/demo/scopes/cart.md", "--round", "2", "--attempt", "4", "--cwd", d], { encoding: "utf8" });
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
      const rn = spawnSync("node", [...K("compile"), "--next", "--slug", "demo", "--cwd", d], { encoding: "utf8" });
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
      };
      w(".shapeup/demo/results/r1-a2.json", JSON.stringify(result));
      const ri = spawnSync("node", [...K("reduce ingest"), join(d, ".shapeup/demo/results/r1-a2.json"), "--cwd", d], { encoding: "utf8" });
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

      // Verdict path: refuted box un-ticked + verdict JSONL appended.
      const evalResult = {
        schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator", status: "done",
        verdict: { overall: "FAIL",
          // A FAIL now REQUIRES a file:line locator (domain.schema.json CriterionVerdict). The
          // placeholder this used to carry ("broke") is precisely the unactionable finding the
          // constraint exists to reject, so the fixture states a real one.
          criteria: [{ criterion: "first criterion", verdict: "FAIL", confidence: "high", evidence: "throws on click — src/app/Pay.tsx:84" }],
          refuted: [{ task_id: "TASK-001", ac: "first criterion" }] },
      };
      w(".shapeup/demo/results/evaluate-r1.json", JSON.stringify(evalResult));
      const rv = spawnSync("node", [...K("reduce ingest"), join(d, ".shapeup/demo/results/evaluate-r1.json"), "--cwd", d], { encoding: "utf8" });
      const t1b = read(join(d, ".shapeup/demo/tasks/TASK-001-a.md"));
      if (rv.status === 0 && /- \[ \] first criterion/.test(t1b) && /eval_verdict: fail/.test(t1b))
        ok("ingest un-ticks refuted AC boxes + sets eval_verdict from the judge's data");
      else fail("ingest did not apply the judge's refuted list");
      if (existsSync(join(d, ".shapeup/demo/evaluation/.verdicts-evaluate-r1.jsonl")))
        ok("ingest appends the verdict-ledger JSONL");
      else fail("ingest did not write the verdict ledger");
      // Negative control: malformed result must be rejected without mutating anything.
      w(".shapeup/demo/results/bad.json", JSON.stringify({ schema_version: 1, order_id: "demo/x", status: "nope" }));
      const rb = spawnSync("node", [...K("reduce ingest"), join(d, ".shapeup/demo/results/bad.json"), "--cwd", d], { encoding: "utf8" });
      if (rb.status === 1) ok("ingest-result REJECTS a malformed WorkResult (a bad envelope never mutates the board)");
      else fail("ingest-result accepted a malformed result — the board can be corrupted");

      // --- the attestation gate ------------------------------------------------------------
      // THE DEFECT THESE EXIST FOR, observed live: a Skill dispatch failed with "Unknown skill",
      // the sub-agent did the craft itself from the prose in its own prompt, the artifacts landed
      // inside the substrate the order permitted, and ingest accepted the result. Every wall passed
      // and the run advanced having applied none of the shipped craft. The receipt is the only fact
      // that separates the two, and ingest is the only place it is load-bearing.
      //
      // Note what makes the checks ABOVE stay green without being weakened: their results sit in a
      // fixture tree with no `orders/`, so there is no orchestrated claim to attest. That is the
      // scoping, asserted here rather than assumed.
      const attOrder = (over = {}) => ({
        schema_version: 1, order_id: "demo/attest", run_id: "demo-20260815T000000Z-deadbeef",
        compiled_at: "2026-08-15T12:00:00.000Z", worker: "task-executor", mode: "orchestrated",
        substrate: { allowed: ["src/**"] }, payload: { feature: "demo" }, ...over,
      });
      const attResult = { schema_version: 1, order_id: "demo/attest", worker: "task-executor", status: "done" };
      const attReceipt = (over = {}) => JSON.stringify({
        at: "2026-08-15T12:30:00.000Z", order_id: "demo/attest", run_id: "demo-20260815T000000Z-deadbeef",
        worker_declared: "task-executor", skill_invoked: "task-executor", dispatch_ok: true, ...over,
      }) + "\n";
      const ingestAttest = (...extra) => spawnSync("node",
        [...K("reduce ingest"), "--order", join(d, ".shapeup/demo/orders/attest.json"), "--cwd", d, ...extra],
        { encoding: "utf8" });

      w(".shapeup/demo/orders/attest.json", JSON.stringify(attOrder()));
      w(".shapeup/demo/results/attest.json", JSON.stringify(attResult));

      const a1 = ingestAttest();
      if (a1.status === 1 && /no dispatch receipts|no receipt for/.test(a1.stderr))
        ok("ingest REFUSES an orchestrated result with no dispatch receipt (the D2 false green)");
      else fail(`ingest accepted an unattested orchestrated result (exit ${a1.status})\n${a1.stdout}${a1.stderr}`);

      // The escape hatch has to actually work, or the gate is a wall with no door and the first
      // environmental failure gets the whole channel disabled.
      const a2 = ingestAttest("--no-receipt-check");
      if (a2.status === 0) ok("--no-receipt-check is a real way through the attestation gate");
      else fail(`--no-receipt-check did not bypass the gate (exit ${a2.status})\n${a2.stdout}${a2.stderr}`);

      // Wrong skill: a receipt exists, for a dispatch that ran something else. Existence alone
      // must not satisfy the gate.
      w(".shapeup/demo/receipts/dispatch.jsonl", attReceipt({ skill_invoked: "orient" }));
      const a3 = ingestAttest();
      if (a3.status === 1 && /ran a different skill/.test(a3.stderr))
        ok("ingest REFUSES a receipt whose skill_invoked is not the worker the order declares");
      else fail(`ingest accepted a wrong-skill receipt (exit ${a3.status})\n${a3.stdout}${a3.stderr}`);

      // Stale: the right skill, for the right order id, from BEFORE this order was compiled —
      // exactly what a relaunch produces, because `orders/<name>.json` is reused verbatim.
      w(".shapeup/demo/receipts/dispatch.jsonl", attReceipt({ at: "2026-08-15T09:00:00.000Z" }));
      const a4 = ingestAttest();
      if (a4.status === 1 && /predates the order/.test(a4.stderr))
        ok("ingest REFUSES a receipt older than the order it claims to answer (the relaunch case)");
      else fail(`ingest accepted a stale receipt (exit ${a4.status})\n${a4.stdout}${a4.stderr}`);

      // The positive. Without it, a gate that refuses everything would pass every check above.
      w(".shapeup/demo/receipts/dispatch.jsonl", attReceipt({ at: "2026-08-15T09:00:00.000Z" }) + attReceipt());
      const a5 = ingestAttest();
      if (a5.status === 0 && /✓ attested/.test(a5.stdout))
        ok("ingest ACCEPTS an orchestrated result carrying a matching receipt, and says so");
      else fail(`ingest refused a properly attested result (exit ${a5.status})\n${a5.stdout}${a5.stderr}`);

      // The gate must not be opt-out-able by aiming the ingest the other documented way. A result
      // named positionally is mirrored back to its order, so `orders/` decides, not the flag.
      w(".shapeup/demo/orders/attest2.json", JSON.stringify(attOrder({ order_id: "demo/attest2" })));
      w(".shapeup/demo/results/attest2.json", JSON.stringify({ ...attResult, order_id: "demo/attest2" }));
      const a6 = spawnSync("node", [...K("reduce ingest"), join(d, ".shapeup/demo/results/attest2.json"), "--cwd", d], { encoding: "utf8" });
      if (a6.status === 1 && /no receipt for demo\/attest2/.test(a6.stderr))
        ok("a positionally-named result is held to the same attestation — omitting --order is not an escape");
      else fail(`the positional ingest path skipped the attestation gate (exit ${a6.status})\n${a6.stdout}${a6.stderr}`);

      // --- the identity gate ---------------------------------------------------------------
      // A RESULT MUST CLAIM THE ORDER IT ANSWERS. `order_id` is the only join in the record set —
      // a WorkResult carries no `run_id` and reaches it through this field — so a result echoing
      // the wrong id is not mislabelled, it is detached from its run and its round.
      //
      // Observed on a live two-round run: the round-1 evaluate order was `todo-cli/evaluate-r1`
      // and its result came back claiming `todo-cli/evaluate`, an order that has never existed.
      // Nothing downstream complained, because the result FILE is named after the order; only the
      // run graph disagreed, and only because it keys nodes off the envelope rather than the
      // filename. Round 2's ids matched, so a single-round run cannot surface this at all.
      w(".shapeup/demo/orders/ident.json", JSON.stringify(attOrder({ order_id: "demo/ident-r1" })));
      w(".shapeup/demo/receipts/dispatch.jsonl", attReceipt({ order_id: "demo/ident-r1" }));
      w(".shapeup/demo/results/ident.json", JSON.stringify({ ...attResult, order_id: "demo/ident" }));
      const i1 = spawnSync("node", [...K("reduce ingest"), "--order", join(d, ".shapeup/demo/orders/ident.json"), "--cwd", d], { encoding: "utf8" });
      if (i1.status === 1 && /claims/.test(i1.stderr) && /demo\/ident-r1/.test(i1.stderr)) {
        ok("ingest REFUSES a result whose order_id names a different order than the one it answers");
      } else {
        fail(`ingest accepted a result claiming the wrong order_id (exit ${i1.status}) — the record ` +
          `joins to nothing, so its run and round are lost\n${i1.stdout}${i1.stderr}`);
      }
      // The positive, so a gate that refuses everything cannot pass the check above.
      w(".shapeup/demo/results/ident.json", JSON.stringify({ ...attResult, order_id: "demo/ident-r1" }));
      const i2 = spawnSync("node", [...K("reduce ingest"), "--order", join(d, ".shapeup/demo/orders/ident.json"), "--cwd", d], { encoding: "utf8" });
      if (i2.status === 0) ok("ingest ACCEPTS a result whose order_id matches its order");
      else fail(`ingest refused a correctly-identified result (exit ${i2.status})\n${i2.stdout}${i2.stderr}`);

      // Non-regression, stated rather than assumed: a standalone order is not held to any of this.
      w(".shapeup/demo/orders/solo.json", JSON.stringify(attOrder({ order_id: "demo/solo", mode: "standalone" })));
      w(".shapeup/demo/results/solo.json", JSON.stringify({ ...attResult, order_id: "demo/solo" }));
      const a7 = spawnSync("node", [...K("reduce ingest"), "--order", join(d, ".shapeup/demo/orders/solo.json"), "--cwd", d], { encoding: "utf8" });
      if (a7.status === 0) ok("a standalone order needs no receipt — the gate is scoped to orchestrated dispatches");
      else fail(`the attestation gate caught a standalone ingest (exit ${a7.status})\n${a7.stdout}${a7.stderr}`);
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
    const statsPath = join(ROOT, "kernel/probe/stats.mjs");
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
    const r = spawnSync("node", [...K("probe stats"), "--cwd", d], { encoding: "utf8" });
    let report = null;
    try { report = JSON.parse(r.stdout); } catch { /* handled below */ }
    if (r.status === 0 && report) ok("stats exits 0 and emits parseable JSON");
    else fail(`stats failed: status=${r.status} ${r.stderr}`);

    const { validate: veValidateStats } = await import(join(ROOT, "kernel/verify/envelope.mjs"));
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

    const rTable = spawnSync("node", [...K("probe stats"), "--cwd", d, "--format", "table"], { encoding: "utf8" });
    if (rTable.status === 0 && rTable.stdout.includes("demo")) ok("--format table renders and names the slug");
    else fail(`table render failed: ${rTable.stderr}`);

    const after = readdirSync(mdir).map((f) => `${f}:${statSync(join(mdir, f)).size}`).join(",");
    if (before === after) ok("metrics dir is byte-identical after both runs (read-only proof)");
    else fail(`stats WROTE to the metrics dir: before=${before} after=${after}`);

    const emptyDir = mkdtempSync(join(tmpdir(), "statsempty-"));
    const rEmpty = spawnSync("node", [...K("probe stats"), "--cwd", emptyDir], { encoding: "utf8" });
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
    const tlPath = join(ROOT, "kernel/verify/trace.mjs");
    if (!existsSync(tlPath)) fail("skills/tech-lead/scripts/trace-lint.mjs missing — the traceability oracle is absent");
    else {
      const run = (slug, cwd, extra = []) => {
        const r = spawnSync("node", [...K("verify trace"), "--slug", slug, "--cwd", cwd, "--quiet", ...extra], { encoding: "utf8" });
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
    for (const op of ["wire"]) {
      if (ops.has(op)) ok(`Operation enum registers ${op}`);
      else fail(`Operation enum missing ${op}`);
    }
    for (const def of ["RequirementClause", "WiringMap", "WiringEntry", "ProjectProfile"]) {
      if (domain.$defs?.[def]) ok(`$defs registers ${def}`);
      else fail(`$defs missing ${def}`);
    }
    // The new $defs must carry the writer/tier annotations the registry discipline requires.
    const writers = { WiringMap: "solution-architect", ProjectProfile: "tech-lead" };
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
    const { readBoard } = await import(join(ROOT, "kernel/compile.mjs"));
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
    "kernel/compile.mjs",
    "kernel/reduce/ingest.mjs",
    "kernel/verify/envelope.mjs",
    "kernel/verify/t0.mjs",
    "kernel/reduce/snapshot.mjs",
    "kernel/probe/stats.mjs",
    "kernel/probe/digest.mjs",
    "kernel/verify/trace.mjs",
    "tests/lib/harness.mjs",
    "tests/lib/jsdoc.mjs",
  ].map((f) => join(ROOT, f)), (p) => p.replace(ROOT + "/", ""));

  // =============================================================================
  section("60. A producer's own output validates against its own schema, and an unpassable fixture is caught at L1b");
  // =============================================================================
  // TWO DEFECTS FROM ONE RUN, both of the same shape: a rule that existed in exactly one place and
  // was contradicted by the other.
  //
  // (a) `probe digest` emits `{file: null, line: null}` for a failure whose log carried no location
  //     — deliberately, and its schema's own field description SAYS so ("null/absent when the log
  //     line carried no location — never invented"). The TYPE said `string`/`integer`. So the
  //     digester's honest output could not pass its own registry, `compile` refused every order
  //     carrying it, and the consequences were invisible and severe: no scope could reach attempt 2
  //     once it had a red trial, and `evaluate` orders carry the same field — so spec-evaluator was
  //     NEVER DISPATCHED, in either round. A run with no verdict at all, from a type annotation.
  //
  // (b) `verify t0` passes a fixture iff it exits 0. That rule lived only in the scorer; the
  //     contract said "commands that drive this scope end-to-end". The architect duly wrote the
  //     error paths as bare invocations (`todo done abc  # E_INVALID_INDEX, exit 1`), which cannot
  //     pass by construction — four of six scopes burned their budget on already-correct code.
  const { validate: v60 } = await import(join(ROOT, "kernel/verify/envelope.mjs"));
  const triple = (over) => v60({ core_message: "boom", kind: "error-message", ...over },
    { $ref: "domain.schema.json#/$defs/AegisTriple" });
  if (triple({ file: null, line: null }).valid) {
    ok("a location-less AegisTriple validates — the digester's own output passes its own registry");
  } else {
    fail("AegisTriple rejects {file: null, line: null}, which is exactly what probe digest emits for a " +
      "location-less failure. compile then refuses every order carrying it: no second attempt for any " +
      "scope with a red trial, and no evaluate order at all — a run that cannot produce a verdict.");
  }
  if (triple({ file: "src/a.js", line: 12 }).valid) ok("a located AegisTriple still validates");
  else fail("AegisTriple rejects a normal located triple");
  if (!triple({ file: 42, line: "x" }).valid) ok("AegisTriple still rejects genuinely wrong types — nullable is not permissive");
  else fail("AegisTriple accepts a number for file and a string for line — the nullable widening went too far");

  // (c) THE FALSE GREEN AT THE BOTTOM OF "MEASURED, NOT CLAIMED".
  //
  // `[].every(...)` is `true`, so a scope with no fixtures scored `pass: true` and the verdict came
  // back `overall: "green"` — certified having executed nothing. Not hypothetical: an architect
  // wrote perfectly good fixtures as a markdown `## e2e_verification_fixtures` SECTION instead of a
  // frontmatter key, the field reached the scorer as `undefined`, and all six scopes of a live run
  // were about to go green on zero evidence. The substrate list beside it, written as a frontmatter
  // block list, parsed perfectly — one field silently vanished.
  //
  // This is the same defect class as D2 (a green run consistent with no work) in the one layer the
  // evaluator is required to cite. Both directions are checked, because refusing everything would
  // be just as wrong as certifying everything.
  const { runFixtures, computeVerdict } = await import(join(ROOT, "kernel/verify/t0.mjs"));
  const verdictFor = (fx) => computeVerdict({ fixtures: runFixtures(fx, ROOT), dbProbe: null, seesaw: { ran: false, pass: true } });
  for (const [label, fx] of [["absent", undefined], ["empty", []]]) {
    const r = runFixtures(fx, ROOT);
    if (!r.pass && r.ran === false && verdictFor(fx).overall === "red") {
      ok(`a scope with ${label} fixtures is NOT green — an absence is not a pass`);
    } else {
      fail(`a scope with ${label} fixtures scores pass=${r.pass}, overall=${verdictFor(fx).overall}. ` +
        `Nothing ran and the scope is certified: "measured, not claimed" inverted into "nothing measured, therefore green".`);
    }
  }
  if (runFixtures(['node -e "process.exit(0)"'], ROOT).pass && verdictFor(['node -e "process.exit(0)"']).overall === "green") {
    ok("a scope whose fixtures RUN and pass is still green — the refusal is about absence, not strictness");
  } else {
    fail("a passing fixture no longer scores green — the absence fix over-corrected and no scope can ever pass");
  }
  if (!runFixtures(['node -e "process.exit(1)"'], ROOT).pass) ok("a failing fixture is still red (the check still discriminates)");
  else fail("a failing fixture scores green");

  const { lintScopes } = await import(join(ROOT, "kernel/verify/spec.mjs")).then((m) => ({ lintScopes: m.lintScopes }))
    .catch(() => ({ lintScopes: null }));
  if (typeof lintScopes !== "function") {
    console.log("  (verify/spec.mjs exports no lintScopes — fixture lint checked via the CLI in §21)");
  } else {
    const scope = (id, fixtures) => ({ scope_id: id, allowed_file_substrate: ["src/a.js", "test/a.test.js"],
      topology_type: "LAYER_CAKE", e2e_verification_fixtures: fixtures });
    const hits = (fx) => lintScopes([scope("s", fx)], []).filter((f) => f.rule === "T0-UNPASSABLE");
    if (hits(["node bin/todo.js done abc  # E_INVALID_INDEX, exit 1"]).length === 1) {
      ok("the L1b lint flags a fixture whose own comment declares a non-zero exit — caught before BUILD spends an attempt");
    } else {
      fail("an error-path fixture is not flagged at L1b, so a scope that cannot go green burns its whole attempt budget first");
    }
    if (hits(["node --test test/commands/done.test.js"]).length === 0) {
      ok("a test-file fixture is not flagged — the lint reads the author's own declaration, it does not guess");
    } else {
      fail("the lint flags an ordinary test-file fixture, which would cry wolf at every L1b");
    }
    // And the fixture-less scope is caught one gate before T0 refuses it, where the fix is editing
    // a contract rather than burning a build round.
    const unverifiable = lintScopes([scope("s", [])], []).filter((f) => f.rule === "T0-UNVERIFIABLE");
    if (unverifiable.length === 1 && unverifiable[0].level === "red") {
      ok("a scope with no parsed fixtures is RED at L1b — an unverifiable scope never reaches BUILD");
    } else {
      fail(`a scope with no fixtures is not flagged red at L1b (got ${JSON.stringify(unverifiable)}). ` +
        `Its fixtures silently vanished and nothing said so before the build spent on it.`);
    }
    if (lintScopes([scope("s", ["node --test test/a.test.js"])], []).filter((f) => f.rule === "T0-UNVERIFIABLE").length === 0) {
      ok("a scope WITH fixtures is not flagged unverifiable");
    } else {
      fail("the unverifiable lint fires on a scope that has fixtures — it would block every run");
    }
  }

  // =============================================================================
  section("62. A FAIL verdict reaches the round that must fix it (payload.bugs)");
  // =============================================================================
  //
  // `bugs` was registered in `x-payload-by-worker`, declared in task-executor's input contract, and
  // defined in `WorkOrderPayload` — three artifacts in perfect agreement, and NOTHING WROTE IT. The
  // measured cost: EVAL returned FAIL citing five defects at file:line, and round 2 dispatched six
  // build legs that were never told, kept all six trees and changed none of them. §50 could not see
  // it (it checks the registry against the worker's prose, not against a producer), and no
  // single-round run can see it at all.
  //
  // So this section compiles a REAL round-2 order over a fixture whose round 1 failed, and asserts
  // the bug is in the file that gets written. Producer-side, because the two ways the orchestrator
  // tried to deliver these both type-check and both deliver nothing: a build order overrides its
  // compile line (so `--payload` is never emitted), and a variable does not survive the relaunch
  // that separates two rounds.
  {
    const { verdictBugs, bugLocations, electOwner, bugsForScope, scopeSubstrates } =
      await import(join(ROOT, "kernel/compile.mjs"));
    const d = mkdtempSync(join(tmpdir(), "bugs-"));
    const w = (rel, body) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), body); };
    const contract = (id, allowed, shared) => [
      "---", `scope_id: ${id}`, "topology_type: LAYER_CAKE",
      `allowed_file_substrate: [${allowed.join(", ")}]`, `shared_substrate: [${shared.join(", ")}]`,
      "---", "## Why this slice", "x", "",
    ].join("\n");
    try {
      // Two scopes sharing an entry point, one owning a module exclusively — the shape the measured
      // run had, and the one that decides whether an election is needed at all.
      w("shapeup/demo/scopes/alpha.md", contract("alpha", ["bin/app.js", "lib/alpha.js"], ["bin/app.js"]));
      w("shapeup/demo/scopes/beta.md", contract("beta", ["bin/app.js", "lib/beta.js"], ["bin/app.js"]));
      // `zeta` claims the entry point OUTRIGHT — allowed, not shared. It sorts last, so it is only
      // ever elected if exclusivity actually outranks the alphabetical tie-break.
      w("shapeup/demo/scopes/zeta.md", contract("zeta", ["bin/app.js", "lib/zeta.js"], []));
      w(".shapeup/demo/tasks/_index.md", "| ID | Title | Status |\n|---|---|---|\n");
      const bugs = [
        { id: "BUG-A", severity: "high", criterion: "c1", location: "lib/beta.js:12", repro: "r", expected: "e", actual: "a" },
        { id: "BUG-B", severity: "high", criterion: "c2", location: "bin/app.js:5, bin/app.js:9", repro: "r", expected: "e", actual: "a" },
        { id: "BUG-C", severity: "low", criterion: "c3", location: "docs/readme.md:1", repro: "r", expected: "e", actual: "a" },
        { id: "BUG-D", severity: "low", criterion: "withdrawn", location: "lib/alpha.js:3", repro: "r", expected: "e", actual: "a" },
      ];
      w(".shapeup/demo/results/evaluate-r1.json", JSON.stringify({
        schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator", status: "done",
        artifacts: [], verdict: { overall: "FAIL", bugs, refuted: [{ id: "BUG-D" }] },
      }));

      // ---- the derivation ---------------------------------------------------------------
      const got = verdictBugs(d, "demo", 2);
      if (got.length === 3 && !got.some((b) => b.id === "BUG-D")) {
        ok("verdictBugs reads the previous round's FAIL verdict and drops the refuted entry");
      } else {
        fail(`verdictBugs returned ${JSON.stringify(got.map((b) => b.id))} — expected BUG-A/B/C with the refuted BUG-D removed`);
      }
      if (verdictBugs(d, "demo", 1).length === 0) ok("round 1 carries no bugs — there is no previous verdict to carry");
      else fail("verdictBugs returned entries for round 1, which has no predecessor");

      // A multi-site locator is the common case, not the exception: the judge writes every line it
      // found. A parser that reads only a lone `file:line` returned nothing for two of the five
      // bugs on the measured verdict, and "nothing" means "belongs to no scope".
      if (JSON.stringify(bugLocations(bugs[1])) === JSON.stringify(["bin/app.js"])) {
        ok("a locator naming several sites resolves to the distinct files it cites");
      } else {
        fail(`bugLocations lost a multi-site locator: ${JSON.stringify(bugLocations(bugs[1]))}`);
      }

      // ---- the election -----------------------------------------------------------------
      const scopes = scopeSubstrates(d, "demo");
      if (electOwner("lib/beta.js", scopes) === "beta") ok("a file inside exactly one substrate elects that scope");
      else fail(`exclusive ownership not elected: ${electOwner("lib/beta.js", scopes)}`);
      // The shared entry point is the whole reason this is an election. Addressing it to everyone
      // who matches hands one fix to every scope building concurrently against the same file.
      const shared = scopes.filter((s) => bugsForScope(got, s.scope_id, scopes).some((b) => b.id === "BUG-B"));
      if (shared.length === 1) ok(`a defect in a SHARED file goes to exactly one scope (${shared[0].scope_id}), not to all that may write it`);
      else fail(`a shared-file defect was addressed to ${shared.length} scopes — concurrent legs would race on one file`);
      // WHICH one, not just how many. Picking the lowest id alone would elect `alpha`, a scope that
      // only co-writes the file; the scope that owns it outright is the one that can fix it without
      // colliding with anybody. Sorting is the tie-break, never the rule.
      if (electOwner("bin/app.js", scopes) === "zeta") {
        ok("a file one scope owns outright elects that scope over an alphabetically-earlier co-writer");
      } else {
        fail(`a shared file elected "${electOwner("bin/app.js", scopes)}" over its exclusive owner "zeta" — ` +
          `the fix is addressed to a scope that shares the file with two others`);
      }
      if (electOwner("docs/readme.md", scopes) === null) ok("a file no scope may write elects nobody");
      else fail("electOwner invented an owner for a file outside every substrate");

      // ---- nothing is dropped -----------------------------------------------------------
      const delivered = new Set(scopes.flatMap((s) => bugsForScope(got, s.scope_id, scopes).map((b) => b.id)));
      if (got.every((b) => delivered.has(b.id))) {
        ok("every cited defect reaches at least one scope — an unowned one is marked, never dropped");
      } else {
        fail(`${got.filter((b) => !delivered.has(b.id)).map((b) => b.id).join(", ")} reached no scope at all — ` +
          `a judged defect the run paid to find, silently forgotten before the round that must fix it`);
      }
      const unowned = bugsForScope(got, "alpha", scopes).find((b) => b.id === "BUG-C");
      if (unowned?.unowned === true) ok("an unowned defect is flagged as such, so the worker can tell it apart from its own");
      else fail("an unowned defect arrives unmarked — indistinguishable from one the scope owns");

      // ---- and it survives the actual compile --------------------------------------------
      const r2 = spawnSync("node", [...K("compile"), "--scope", "shapeup/demo/scopes/beta.md",
        "--round", "2", "--attempt", "1", "--cwd", d], { encoding: "utf8" });
      const p2 = (r2.stdout || "").trim();
      if (r2.status === 0 && existsSync(p2)) {
        const order = readJSON(p2);
        const ids = (order.payload.bugs || []).map((b) => b.id);
        if (ids.includes("BUG-A")) ok("a compiled round-2 order carries the defect cited against the file this scope owns");
        else fail(`the compiled order's payload.bugs is ${JSON.stringify(ids)} — the fix round is dispatched blind, which is the defect itself`);
        if ((order.payload.bugs || []).every((b) => b.repro && b.expected && b.actual)) {
          ok("the bug entries arrive whole — repro, expected and actual, straight off the ledgered verdict");
        } else {
          fail("payload.bugs lost fields in transit — a repro that was rewritten is a repro that may not reproduce");
        }
        // AND THE ORDER HAS TO SAY IT IS A FIX. task-executor's input contract binds `payload.bugs`
        // to one operation — "`fix` (only the bugs in `payload.bugs` — touch nothing else)" — under
        // a Zero-memory rule that treats anything not in the order as unknown. An `execute` order
        // carrying bugs hands the worker a field its own contract assigns to a different operation.
        if (order.operation === "fix") {
          ok("a round carrying cited defects compiles as `fix`, the operation the worker's contract binds bugs to");
        } else {
          fail(`a round carrying ${(order.payload.bugs || []).length} cited defect(s) compiled as ` +
            `"${order.operation}" — the worker's contract binds payload.bugs to \`fix\`, so the evidence ` +
            `arrives under an operation that does not claim it`);
        }
        // The substrate must be untouched by that switch, or the fix round is fenced differently
        // from the build round that preceded it.
        if (order.substrate.allowed.includes("lib/beta.js")) ok("switching to `fix` leaves the write contract identical");
        else fail(`the fix round's substrate differs from the build round's: ${JSON.stringify(order.substrate.allowed)}`);
      } else {
        fail(`compiling a round-2 order failed (exit ${r2.status})\n${r2.stdout}${r2.stderr}`);
      }
      // Non-regression: a first round must be byte-identical to what it always was.
      const r1 = spawnSync("node", [...K("compile"), "--scope", "shapeup/demo/scopes/beta.md",
        "--round", "1", "--attempt", "1", "--cwd", d], { encoding: "utf8" });
      const p1 = (r1.stdout || "").trim();
      if (r1.status === 0 && existsSync(p1) && readJSON(p1).payload.bugs === undefined) {
        ok("a first-round order omits payload.bugs entirely (non-regression)");
      } else {
        fail("a first-round order carries a bugs field — round 1 has no verdict to carry");
      }
      if (r1.status === 0 && existsSync(p1) && readJSON(p1).operation === "execute") {
        ok("a round with nothing cited stays `execute` — the switch is driven by evidence, not by round number");
      } else {
        fail(`a first round compiled as "${existsSync(p1) ? readJSON(p1).operation : "?"}" — a build with no ` +
          `cited defects is not a fix round, and telling the worker otherwise invites it to look for bugs that do not exist`);
      }
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }

  await runLaunchRecord(ctx);
}

/**
 * Run the launch-record parity check (section 67).
 *
 * Every artifact the schema says tech-lead writes must be named in tech-lead's own instructions.
 * @param {object} ctx - Shared structural-test context from tests/lib/harness.mjs (makeCtx).
 * @returns {Promise<void>} Resolves when section 67 has been recorded on ctx.
 */
export async function runLaunchRecord(ctx) {
  const { ROOT, ok, fail, section, read, readJSON } = ctx;

  // =============================================================================
  section("67. Every artifact the schema names tech-lead as the writer of is named in its own instructions");
  // =============================================================================

  // The schema is a registry of who writes what. It is not an instruction: a `$defs` entry can say
  // `x-writer: tech-lead` and `x-location: .shapeup/<slug>/run-args.json` while nothing anywhere
  // tells tech-lead to write it, and then the file simply never exists.
  //
  // Measured on a live run: `run-args.json` was declared by the schema, described as "written fresh
  // by tech-lead on every launch AND every relaunch", named in no SKILL.md and no reference, and
  // absent from the run root. The consequence is not cosmetic — the launch flags reach the workflow
  // as a value in memory, so with no file on disk the run has NO evidence of the models, budgets or
  // fan-out width it used, and every claim about its configuration is unfalsifiable afterwards.
  //
  // Scoped to entries whose `x-location` names a concrete file. The EMBEDDED ones legitimately have
  // no path (`Lane` rides in frontmatter, `HillShard` is a projection), and demanding a filename of
  // them would be demanding the schema lie.
  const domain = readJSON(join(ROOT, "skills/tech-lead/schemas/domain.schema.json"));
  const instructions = [
    read(join(ROOT, "skills/tech-lead/SKILL.md")),
    ...readdirSync(join(ROOT, "skills/tech-lead/references"))
      .map((f) => read(join(ROOT, "skills/tech-lead/references", f))),
  ].join("\n");

  let checked = 0;
  for (const [name, def] of Object.entries(domain.$defs || {})) {
    if (!/tech-lead/.test(String(def["x-writer"] || ""))) continue;
    const file = (String(def["x-location"] || "").match(/([A-Za-z0-9_.<>-]+\.(?:json|md|jsonl))/) || [])[1];
    if (!file) continue;                       // no concrete path — nothing to name
    checked++;
    if (instructions.includes(file)) {
      ok(`$defs/${name}: tech-lead's instructions name ${file}, the artifact the schema makes it responsible for`);
    } else {
      fail(`$defs/${name} names tech-lead as the writer of ${file}, and no line of tech-lead's SKILL.md or ` +
        `references ever tells it to write one. A registry entry is not an instruction: the artifact is ` +
        `simply never produced, and every fact it was supposed to carry is unrecoverable after the run.`);
    }
  }
  if (checked === 0) fail("no $defs entry names tech-lead as the writer of a concrete file — the check verified nothing");
  else ok(`${checked} tech-lead-written artifact(s) are each named in its own instructions`);
}
