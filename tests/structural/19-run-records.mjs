// Structural test module: the run key, and the fact tables projected from the records it joins.
// Sections: 53, 54.
//
// THE DEFECT THIS MODULE EXISTS FOR, measured against the records the pipeline writes.
//
// Every boundary already emitted JSON — orders in, results out, a journal row per agent call with
// `cost_usd` and `wall_ms`, a decision row per hook evaluation, a trial row per T0 run. None of it
// was joinable. The nearest thing to a key was `order_id`, which is `<slug>/r<N>-a<M>`: unique
// WITHIN a run and IDENTICAL across every run of the same slug. So the harness held a complete
// dataset and could not answer either question you would ask it first — "compare this run to the
// last one" and "what did this run cost" — because the cost rows and the verdict rows had no
// field in common.
//
// WHAT THIS MODULE ASSERTS, by EXECUTING the shipped writers rather than reading their source:
//
//   §53  Every writer stamps the key. The failure this repo keeps rediscovering is the change that
//        LOOKS complete: stamp four of five sites and nothing errors, the fifth just quietly
//        produces unjoinable rows. So each writer is run and its output inspected, and the
//        collision `order_id` alone still has is PINNED — a later "simplification" back onto it
//        must fail here rather than silently unpick the join.
//
//   §54  The projection never invents. A dispatch with no agent call must report `cost_usd: null`
//        and `agent_join: null`, never `0` — a zero that means "absent" is the same
//        indistinguishability that let 26 enforcement points sit inert behind green checks, one
//        layer up. And the export must be READ-ONLY over the trace it reads, because a measurement
//        step that mutates its subject is not a measurement.

import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** Read a JSONL file into rows. */
const rows = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);

/** A recursive snapshot of `dir` as `relative path -> mtimeMs:size`, for proving nothing was written. */
function fingerprint(dir, base = dir, acc = {}) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) fingerprint(p, base, acc);
    else { const s = statSync(p); acc[p.slice(base.length)] = `${s.mtimeMs}:${s.size}`; }
  }
  return acc;
}

/**
 * Open a real run in a scratch workspace by executing init-run, exactly as the orchestrator does.
 * @param {string} ROOT - Repo root.
 * @param {string} ws - Workspace directory.
 * @param {string} slug - Feature slug.
 * @param {string} intake - The requirement text.
 * @returns {{status:number, stdout:string, receipt:(object|null)}} The spawn result and receipt.
 */
function openRun(ROOT, ws, slug, intake) {
  const r = spawnSync(process.execPath, [
    join(ROOT, "skills/tech-lead/scripts/init-run.mjs"),
    "--slug", slug, "--intake-text", intake, "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 30_000 });
  const p = join(ws, ".shapeup", slug, "receipt.json");
  return { status: r.status, stdout: r.stdout || "", receipt: existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null };
}

/**
 * Run the run-key and fact-table checks.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section bodies finish.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  const { RUN_ID_PATTERN, mintRunId, runIdFromReceipt, resolveRunId } =
    await import(join(ROOT, "skills/tech-lead/scripts/lib/run-id.mjs"));

  // =============================================================================
  section("53. Every record carries the run key — order_id alone collides across runs");
  // =============================================================================

  // (a) The key is DERIVED, so the same receipt always yields the same id. A random key would pass
  //     every other check here and fail this one, and with it the ability to key history that was
  //     never stamped.
  {
    const legacy = { slug: "budgets", started_at: "2026-08-13T09:12:33.456Z", intake_sha256: "abc" };
    const a = runIdFromReceipt(legacy), b = runIdFromReceipt({ ...legacy });
    if (a && a === b) ok("the run key is derived, not drawn — the same receipt mints the same id twice");
    else fail(`run key is not deterministic: ${a} vs ${b}`);
    if (a && RUN_ID_PATTERN.test(a)) ok("a backfilled key matches RUN_ID_PATTERN — pre-v1.8 traces are joinable");
    else fail(`backfilled key does not match the declared pattern: ${a}`);
    // A different intake for the same slug and second is a different run, and must not collide.
    const other = runIdFromReceipt({ ...legacy, intake_sha256: "def" });
    if (other && other !== a) ok("two runs of one slug in the same second differ — the intake digest breaks the tie");
    else fail("two distinct intakes minted the same run key");
    if (mintRunId({ slug: "x", startedAt: "not-a-date" }) === null) {
      ok("an unparseable timestamp yields NO key rather than a partial one — a wrong join beats no join only in a demo");
    } else fail("mintRunId produced an id from a malformed timestamp");
  }

  // (b) THE WRITERS. Each is executed; the stamp is read off the artifact it actually wrote.
  const ws = mkdtempSync(join(tmpdir(), "runkey-"));
  try {
    const opened = openRun(ROOT, ws, "budgets", "Add category budgets with a monthly rollover");
    if (opened.status !== 0 || !opened.receipt) {
      fail(`init-run did not open a run in the sandbox: exit ${opened.status}`);
    } else {
      const runId = opened.receipt.run_id;
      if (runId && RUN_ID_PATTERN.test(runId)) ok("init-run stamps a well-formed run_id into the receipt");
      else fail(`receipt.run_id missing or malformed: ${runId}`);
      if (JSON.parse(opened.stdout).run_id === runId) ok("init-run echoes the key on stdout — the orchestrator need not re-read the receipt");
      else fail("init-run's stdout run_id disagrees with the receipt");

      // compile-order: the one place every lane passes through.
      const co = spawnSync(process.execPath, [
        join(ROOT, "skills/tech-lead/scripts/compile-order.mjs"),
        "--operation", "analyze", "--slug", "budgets", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 30_000 });
      const orderPath = join(ws, ".shapeup", "budgets", "orders", "analyze.json");
      if (co.status === 0 && existsSync(orderPath)) {
        const order = JSON.parse(readFileSync(orderPath, "utf8"));
        if (order.run_id === runId) ok("compile-order stamps the run key onto the WorkOrder");
        else fail(`order.run_id is "${order.run_id}", expected "${runId}"`);
        if (order.compiled_at) ok("the order carries compiled_at — a dispatch on the prose lane is not timeless");
        else fail("order has no compiled_at");
      } else fail(`compile-order failed in the sandbox: ${co.stderr || co.stdout}`);

      // t0-verify: the evidence layer, whose (round, attempt, trial) address repeats every run.
      const contract = join(ws, "sc-01.json");
      writeFileSync(contract, JSON.stringify({ scope_id: "sc-01", e2e_verification_fixtures: ["node -e \"process.exit(0)\""] }));
      const t0 = spawnSync(process.execPath, [
        join(ROOT, "skills/tech-lead/scripts/t0-verify.mjs"), contract,
        "--round", "1", "--attempt", "1", "--cwd", ws,
        "--out", join(ws, ".shapeup", "budgets"), "--no-seesaw", "--no-ratchet",
      ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
      const verdictDir = join(ws, ".shapeup", "budgets", "t0", "verdicts");
      const artifacts = existsSync(verdictDir) ? readdirSync(verdictDir) : [];
      if (t0.status === 0 && artifacts.length) {
        const art = JSON.parse(readFileSync(join(verdictDir, artifacts[0]), "utf8"));
        if (art.run_id === runId) ok("t0-verify stamps the run key onto the verdict artifact");
        else fail(`T0 artifact run_id is "${art.run_id}", expected "${runId}"`);
        const trial = rows(join(ws, ".shapeup", "budgets", "t0", "trials.jsonl"))[0];
        if (trial?.run_id === runId) ok("t0-verify stamps the run key onto the trial row — ratchet history splits by run");
        else fail(`trial row run_id is "${trial?.run_id}", expected "${runId}"`);
      } else fail(`t0-verify produced no artifact in the sandbox: exit ${t0.status} ${t0.stderr}`);

      // The hook receipt leg. Executed with the sandbox as cwd, and with the runner's redirect
      // cleared, because per-workspace resolution IS what carries the key here.
      const env = { ...process.env };
      delete env.SHAPEUP_DECISIONS_PATH;
      spawnSync(process.execPath, [join(ROOT, "hooks/gate-l2.mjs")], {
        input: JSON.stringify({ tool_name: "Read", tool_input: { file_path: join(ws, "x.md") }, cwd: ws }),
        cwd: ws, encoding: "utf8", timeout: 30_000, env,
      });
      const decision = rows(join(ws, ".shapeup", "decisions.jsonl")).pop();
      if (decision?.run_id === runId) ok("a hook decision row names the run it fired inside");
      else fail(`decision row run_id is "${decision?.run_id}", expected "${runId}"`);

      // (c) THE COLLISION, pinned. Re-opening the same slug must produce a DIFFERENT key while the
      //     order id stays the same — this is the whole reason the key exists, and a later change
      //     that keys on order_id or on the slug has to fail here.
      const ws2 = mkdtempSync(join(tmpdir(), "runkey2-"));
      try {
        const second = openRun(ROOT, ws2, "budgets", "Add category budgets with a DIFFERENT rollover rule");
        if (second.receipt && second.receipt.run_id !== runId) {
          ok("a second run of the same slug gets a different key — while its order_id would be byte-identical");
        } else fail("two runs of the same slug produced the same run key — the join is back to colliding");
      } finally { rmSync(ws2, { recursive: true, force: true }); }
    }

    // (d) FAIL-OPEN. An analytic field must never be able to block a build, so a workspace with no
    //     run yields an order with no key rather than an error — and a hook outside a run records
    //     `null`, which is the true answer and not a defect.
    {
      const bare = mkdtempSync(join(tmpdir(), "runkey-bare-"));
      try {
        if (resolveRunId(bare) === null) ok("resolveRunId reports null outside a run — 'belongs to no run' is a recordable fact");
        else fail("resolveRunId invented a key in a workspace with no run");
      } finally { rmSync(bare, { recursive: true, force: true }); }
    }
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // =============================================================================
  section("54. The fact tables project the records and never invent a join");
  // =============================================================================

  const facts = await import(join(ROOT, "skills/tech-lead/scripts/lib/facts.mjs"));
  const { dispatchFacts, economics, agentCallRow, parseOrderStem, TABLES } = facts;

  // (a) The join, and the two shapes it must keep distinguishable.
  {
    const orders = [
      { order_id: "budgets/sc-01-r1-a1", run_id: "budgets-20260813T113537Z-c714ea8d", worker: "task-executor", operation: "execute", payload: { tasks: [{ id: "TASK-001" }] } },
      { order_id: "budgets/analyze", run_id: "budgets-20260813T113537Z-c714ea8d", worker: "ba-pitch-analyzer", operation: "analyze", payload: {} },
    ];
    const results = [{
      order_id: "budgets/sc-01-r1-a1", worker: "task-executor", status: "done",
      task_results: [{ task_id: "TASK-001", ac_results: [{ ac: "a", result: "pass", evidence: "ran" }, { ac: "b", result: "fail", evidence: "" }] }],
      files_touched: [{ path: "src/a.ts", change: "modified", lines: 10 }],
      discoveries: [{ marker: "~", line: "tz edge", repro: "TZ=UTC+13" }],
    }];
    const journal = [{ seq: 3, label: "execute", model: "claude-opus-5", wall_ms: 1000, attempts: 2, ok: true, sessions: [{ cost_usd: 0.3 }, { cost_usd: 1.2 }], result: { result_path: ".shapeup/budgets/results/sc-01-r1-a1.json" } }];

    const f = dispatchFacts({ orders, results, journal });
    const build = f.dispatch.find((d) => d.order_id === "budgets/sc-01-r1-a1");
    const analyze = f.dispatch.find((d) => d.order_id === "budgets/analyze");

    if (build.cost_usd === 1.5 && build.agent_join === "result_path" && build.model === "claude-opus-5") {
      ok("a dispatch joins to its agent call through result_path — cost and model reach the fact row");
    } else fail(`the agent-call join failed: ${JSON.stringify({ cost: build.cost_usd, join: build.agent_join })}`);

    // THE CENTRAL ASSERTION of this section: an absent cost is null, never zero.
    if (analyze.cost_usd === null && analyze.agent_join === null) {
      ok("a dispatch with no agent call reports cost_usd:null and agent_join:null — absent and zero stay distinguishable");
    } else fail(`an unjoined dispatch reported cost ${analyze.cost_usd} / join ${analyze.agent_join} — a fabricated zero`);

    if (analyze.answered === false && analyze.result_status === null) ok("a dispatch with no result is answered:false — the row you most need is filterable as an absence");
    else fail("an unanswered dispatch was not marked as such");

    if (build.ac_pass === 1 && build.ac_fail === 1 && f.ac_result.length === 2) ok("AC outcomes fan out into the ac_result child table and roll up onto the dispatch");
    else fail(`ac projection wrong: ${build.ac_pass}/${build.ac_fail}, ${f.ac_result.length} child rows`);
    if (f.ac_result.find((r) => r.result === "fail").has_evidence === false) ok("ac_result records WHETHER evidence exists, not the prose — 'no evidence = fail' becomes checkable");
    else fail("has_evidence did not discriminate an empty evidence string");
    if (f.discovery.length === 1 && f.discovery[0].has_repro === true) ok("discoveries project with their repro presence — QA's mandatory field is countable");
    else fail("discovery projection lost the repro flag");
    if (f.file_touched.length === 1 && build.lines_touched === 10) ok("files_touched fans out and its line count rolls up");
    else fail("file_touched projection is wrong");
    if (f.dispatch.every((d) => d.run_id && d.order_id) && f.ac_result.every((r) => r.run_id)) {
      ok("every child row carries run_id + order_id — each table stands alone in the warehouse");
    } else fail("a projected row is missing its keys");
  }

  // (b) The id is the authority on round/attempt/scope, because every other record references it.
  {
    const b = parseOrderStem("budgets/sc-01-r1-a2");
    const o = parseOrderStem("budgets/analyze");
    const r = parseOrderStem("budgets/evaluate-r2");
    if (b.scope_id === "sc-01" && b.round === 1 && b.attempt === 2) ok("a build order's stem yields scope_id + round + attempt");
    else fail(`build stem mis-parsed: ${JSON.stringify(b)}`);
    if (o.round === null && o.attempt === null && r.round === 2 && r.attempt === null) {
      ok("a non-build operation has null round/attempt, and a round-scoped one has a round only");
    } else fail(`operation stems mis-parsed: ${JSON.stringify(o)} / ${JSON.stringify(r)}`);
  }

  // (c) Absence must survive summation. A run whose journal recorded no cost at all must report
  //     null — a $0.0000 total reads as "this run was free", which is a measurement, and a false one.
  {
    const noCost = [agentCallRow({ seq: 1, model: "m", sessions: [{ session_id: "s" }] })];
    const e = economics({ agent_call: noCost, dispatch: [] });
    if (e.cost_usd === null) ok("a run whose sessions recorded no cost reports null, not $0 — absence is not a measurement");
    else fail(`economics manufactured a cost total of ${e.cost_usd} from rows that carried none`);
  }

  // (d) Row 4 of the measurement table: the figures the design doc says have no instrument.
  {
    const dispatch = [
      { order_id: "s/analyze", stem: "analyze", files_touched: 0, answered: true, cost_usd: 0.5 },
      { order_id: "s/x-r1-a1", stem: "x-r1-a1", files_touched: 2, answered: true, cost_usd: 1.5 },
    ];
    const agent_call = [
      agentCallRow({ seq: 1, model: "m", started_at: "2026-08-13T00:00:10.000Z", wall_ms: 10, sessions: [{ cost_usd: 0.004 }] }),
      agentCallRow({ seq: 2, model: "m", started_at: "2026-08-13T00:00:20.000Z", wall_ms: 20, sessions: [{ cost_usd: 0.5 }], result: { result_path: "a/analyze.json" } }),
      agentCallRow({ seq: 3, model: "m", started_at: "2026-08-13T00:01:00.000Z", wall_ms: 30, sessions: [{ cost_usd: 1.5 }], result: { result_path: "a/x-r1-a1.json" } }),
    ];
    const e = economics({ agent_call, dispatch, run: { started_at: "2026-08-13T00:00:00.000Z" } });
    if (e.calls_to_first_write === 3 && e.seconds_to_first_write === 60) {
      ok("turns-to-first-write is measured in agent calls AND seconds — a chatty run and a slow one stay separable");
    } else fail(`first-write measure wrong: ${e.calls_to_first_write} calls / ${e.seconds_to_first_write}s`);
    if (e.cost_attributed_usd === 2 && e.cost_unattributed_usd === 0.004) {
      ok("attributed and unattributed cost are reported separately — a partial total cannot pass as a full one");
    } else fail(`cost partition wrong: ${e.cost_attributed_usd} / ${e.cost_unattributed_usd}`);
  }

  // (e) THE EXPORT. It must write every declared table, count what it could not parse, and — the
  //     load-bearing one — leave the trace it read byte-for-byte untouched.
  {
    const ws = mkdtempSync(join(tmpdir(), "export-"));
    try {
      const opened = openRun(ROOT, ws, "budgets", "Add category budgets");
      const runId = opened.receipt?.run_id;
      const runRoot = join(ws, ".shapeup", "budgets");
      mkdirSync(join(runRoot, "results"), { recursive: true });
      writeFileSync(join(runRoot, "orders", "analyze.json"), JSON.stringify({
        schema_version: 1, order_id: "budgets/analyze", run_id: runId, worker: "ba-pitch-analyzer",
        mode: "orchestrated", operation: "analyze", payload: {},
      }));
      writeFileSync(join(runRoot, "results", "analyze.json"), JSON.stringify({
        schema_version: 1, order_id: "budgets/analyze", worker: "ba-pitch-analyzer", status: "done",
      }));
      // One deliberately corrupt record: the export must survive it and SAY it survived it.
      writeFileSync(join(runRoot, "orders", "torn.json"), "{ not json");

      const before = fingerprint(runRoot);
      const r = spawnSync(process.execPath, [
        join(ROOT, "skills/tech-lead/scripts/export-run.mjs"), "--slug", "budgets", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 30_000 });

      if (r.status !== 0) { fail(`export-run failed: ${r.stderr || r.stdout}`); }
      else {
        const manifest = JSON.parse(r.stdout);
        const outDir = join(ws, ".shapeup", "exports", runId);
        const missing = TABLES.filter((t) => !existsSync(join(outDir, `${t}.jsonl`)));
        if (!missing.length) ok(`the export writes all ${TABLES.length} declared tables`);
        else fail(`export omitted table file(s): ${missing.join(", ")}`);
        if (manifest.run_id === runId) ok("the export is keyed by run_id — a second run of a slug cannot overwrite the first");
        else fail(`manifest run_id is "${manifest.run_id}", expected "${runId}"`);
        if (manifest.records_skipped === 1) ok("a record that will not parse is COUNTED in the manifest, not fatal and not silent");
        else fail(`records_skipped is ${manifest.records_skipped}, expected 1 for the torn record`);
        if (manifest.tables.find((t) => t.name === "dispatch").rows === 1) ok("the torn record is skipped while the readable one still exports");
        else fail("the export lost a readable record alongside the torn one");
        if (manifest.economics && "cost_usd" in manifest.economics) ok("the manifest carries the run's economics block — row 4 without a second tool");
        else fail("manifest has no economics block");
      }

      const after = fingerprint(runRoot);
      if (JSON.stringify(before) === JSON.stringify(after)) {
        ok("the export leaves the run trace byte-for-byte untouched — a measurement that mutates its subject is not one");
      } else fail("export-run modified the run trace it read");
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }
}
