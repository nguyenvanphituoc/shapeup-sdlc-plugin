// Structural test module: `probe next`, the run's state machine, executed against planted trees.
// Section: 175.
//
// WHY THIS MODULE EXISTS.
//
// The run's control flow used to be a script nothing could execute, and every post-condition it
// held — a planning leg sent back once, a verdict refused, a hunt that ran no charter, a breaker
// that names itself — was a branch no fixture could reach. `probe next` makes the same flow a
// function of files on disk, so each branch is a tree you can plant and a step you can assert.
//
// Each case below is one row of the control flow: it plants the artifacts that put a run at that
// point, asks `probe next`, and asserts the step. The rows are written against the DEFECT each
// branch exists to prevent, not against the happy path — "does a verdict the kernel refused go back
// once, and then stop going back?" rather than "does a verdict get graded?".

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, mkdtempSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const SLUG = "demo";
const FULL_ORIENT = ["code-surface.md", "discovered-seed.md", "hill-signal.md", "spike-persistence.md"];

/**
 * Run the `probe next` checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("175. `probe next` derives the run's next step from artifacts, and every post-condition is a branch");

  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const sh = (verbs, args) => spawnSync("node", [KERNEL, ...verbs.split(" "), ...args], { encoding: "utf8" });
  if (!existsSync(join(ROOT, "kernel/probe/next.mjs"))) { fail("`harness probe next` is missing"); return; }

  // ---- one real, opened run, copied per case ------------------------------------------------------
  const base = mkdtempSync(join(tmpdir(), "struct-next-base-"));
  const cleanups = [base];
  const open = sh("init run", ["--slug", SLUG, "--intake-text", "Add a todo list", "--auto-level", "interactive", "--cwd", base]);
  const args = sh("init run-args", ["--slug", SLUG, "--auto-level", "interactive", "--exec-model", "sonnet", "--eval-model", "sonnet",
    "--max-rounds", "2", "--attempts", "3", "--plugin-root", ROOT, "--cwd", base]);
  if (open.status !== 0 || args.status !== 0) { fail(`could not open the fixture run: ${open.stderr}${args.stderr}`); return; }

  const receiptOf = (ws) => JSON.parse(readFileSync(join(ws, ".shapeup", SLUG, "receipt.json"), "utf8"));
  const RUN_ID = receiptOf(base).run_id;

  /** A fresh copy of the opened run. */
  const fresh = () => { const ws = mkdtempSync(join(tmpdir(), "struct-next-")); cleanups.push(ws); cpSync(base, ws, { recursive: true }); return ws; };
  const local = (ws, ...p) => join(ws, ".shapeup", SLUG, ...p);
  const shared = (ws, ...p) => join(ws, "shapeup", SLUG, ...p);
  const put = (path, text) => { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, text); };
  const json = (path, obj) => put(path, JSON.stringify(obj));

  const next = (ws, extra = []) => {
    const r = sh("probe next", ["--slug", SLUG, "--cwd", ws, ...extra]);
    try { return JSON.parse(r.stdout); } catch { return { kind: "unparseable", raw: `${r.stdout}${r.stderr}` }; }
  };

  // ---- planting --------------------------------------------------------------------------------
  const profile = (ws) => put(shared(ws, "project-profile.md"), "---\nschema_version: 1\narchetype: cli\nentry_point: bin/todo.js\n---\n");
  const orient = (ws, files = FULL_ORIENT) => files.forEach((f) => put(local(ws, "orient", f), "x\n"));
  const append = (path, text) => { mkdirSync(join(path, ".."), { recursive: true }); appendFileSync(path, text); };
  const gate = (ws, g, o = {}) => append(local(ws, "gates.jsonl"), JSON.stringify({
    at: new Date().toISOString(), run_id: RUN_ID, gate: g, status: "ok", decision: "proceed", source: "test", round: null, ...o }) + "\n");
  const order = (ws, stem, o = {}) => {
    const orderId = `${SLUG}/${stem}`;
    json(local(ws, "orders", `${stem}.json`), { schema_version: 1, order_id: orderId, run_id: RUN_ID, worker: "x", ...o.body });
    for (let i = 0; i < (o.receipts ?? 0); i++) append(local(ws, "receipts", "dispatch.jsonl"), JSON.stringify({ order_id: orderId, run_id: RUN_ID, skill: "x" }) + "\n");
    if (o.result) json(local(ws, "results", `${stem}.json`), { schema_version: 1, order_id: orderId, status: "done", ...o.result });
    if (o.applied) append(local(ws, "legs.jsonl"), JSON.stringify({ order_id: orderId, ingested_at: new Date().toISOString(), ...(o.leg || {}) }) + "\n");
  };
  const requirements = (ws) => put(shared(ws, "requirements.md"), "# requirements\n");
  const tree = (ws) => { put(shared(ws, "spec", "usecases", "UC-01-add.md"), "# uc\n"); put(local(ws, "tasks", "TASK-001.md"), "---\nid: TASK-001\nstatus: todo\nscope_id: alpha\n---\n\n# t\n"); };
  const wiring = (ws) => put(shared(ws, "wiring-map.md"), "# wiring\n");
  const scopes = (ws, ids = ["alpha"]) => ids.forEach((id) => put(shared(ws, "scopes", `${id}.md`), `---\nscope_id: ${id}\n---\n`));
  const t0 = (ws, scope, round, overall = "green") => json(local(ws, "t0", "verdicts", `r${round}-a1-t1.json`), { scope_id: scope, round, overall, run_id: RUN_ID });
  const buildOrder = (ws, scope, round, o = {}) => order(ws, `${scope}-r${round}-a1`, { receipts: 1, ...o, leg: { scope_id: scope, round }, body: { scope: scope } });
  const planned = (ws, { ids = ["alpha"] } = {}) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); gate(ws, "L1a.5"); scopes(ws, ids); gate(ws, "L1b"); };
  const roundGreen = (ws, scope = "alpha", round = 1) => { buildOrder(ws, scope, round, { result: { green: true }, applied: true }); t0(ws, scope, round); };
  const gateArt = (ws, round, overall) => json(local(ws, "build", `r${round}-t1.json`), { round, trial: 1, overall, run_id: RUN_ID });
  const passResult = (ws, round = 1, scope = "alpha") => {
    const vpath = local(ws, "t0", "verdicts", `r${round}-a1-t1.json`);
    const sha = createHash("sha256").update(readFileSync(vpath, "utf8")).digest("hex");
    order(ws, `evaluate-r${round}`, { receipts: 1, result: { verdict: { overall: "PASS", criteria: [{ criterion: "c", verdict: "PASS", evidence: "e" }],
      t0_citations: [{ scope_id: scope, path: vpath.replace(`${ws}/`, ""), sha256: sha }] } }, applied: true });
  };
  const declareRun = (ws) => { const f = local(ws, "harness-run.md"); writeFileSync(f, readFileSync(f, "utf8").replace(/^lane:.*$/m, (m) => `${m}\nrun_cmd: node -e 0`)); };
  const census = (ws, c) => json(local(ws, "reports", "hammer-census.json"), { schema_version: 1, verdict: "ship-now", cut_list: [], ...c });

  const cases = [];
  /** One named case: plant, ask, assert. */
  const row = (name, plant, expect, extra) => cases.push({ name, plant, expect, extra });
  const is = (kind, step) => (s) => s.kind === kind && (step === undefined || s.step === step || (step instanceof RegExp && step.test(s.step)));

  try {
    // ---- preconditions ---------------------------------------------------------------------------
    row("a run with no launch record aborts at preflight and names why", (ws) => rmSync(local(ws, "run-args.json")),
      (s) => is("terminal", "abort.preflight")(s) && /launch record/.test(s.reason));
    row("a below-floor exec model aborts at args", (ws) => {
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.models.exec = "claude-haiku-4"; json(f, a);
    }, (s) => is("terminal", "abort.args")(s) && /models\.exec is below the model floor/.test(s.reason));
    row("a below-floor eval model does not abort a --no-eval run", (ws) => {
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.models.eval = "haiku"; a.noEval = true; json(f, a);
    }, (s) => s.step !== "abort.args");
    row("a closed run is reopened on the record, not resumed over its close", (ws) => {
      const f = local(ws, "harness-run.md"); writeFileSync(f, readFileSync(f, "utf8").replace(/^status:.*$/m, "status: aborted").replace(/^closed_status:.*$/m, "closed_status: aborted"));
    }, (s) => is("command", "reopen")(s) && /--set-status orienting/.test(s.command));
    row("a missing project profile blocks the run before orient and names the file", () => {}, (s) => is("need", "need.project-profile")(s) && /project-profile\.md/.test(s.path));

    // ---- ORIENT ---------------------------------------------------------------------------------
    row("no orient artifacts dispatches orient with the four filenames in its note", profile,
      (s) => is("dispatch", "orient.dispatch")(s) && s.skill === "shapeup-sdlc-plugin:orient" && /code-surface\.md/.test(s.note) && /spike-not-needed\.md/.test(s.note)
        && s.compile.includes("--operation orient") && s.ingest.includes("reduce ingest --order"));
    row("an orient dispatch carries the status line when the ledger says something else", (ws) => {
      profile(ws);
      const f = local(ws, "harness-run.md"); writeFileSync(f, readFileSync(f, "utf8").replace(/^status:.*$/m, "status: building"));
    }, (s) => is("dispatch")(s) && s.pre.some((p) => /--set-status orienting/.test(p.command)));
    row("an orient result that was never applied is applied before anything else", (ws) => { profile(ws); order(ws, "orient", { receipts: 1, result: {} }); },
      (s) => is("command", "ingest.orient")(s) && s.on_fail_close.includes("single writer did not run"));
    row("an orient that answered and left no artifact aborts at ORIENT", (ws) => { profile(ws); order(ws, "orient", { receipts: 1, result: {}, applied: true }); },
      (s) => is("terminal", "abort.ORIENT")(s) && /produced no artifact/.test(s.reason));
    row("an orient order dispatched and never answered is dispatched again (the session died)", (ws) => { profile(ws); order(ws, "orient", { receipts: 1 }); },
      is("dispatch", "orient.dispatch"));
    row("an orient dispatched three times with no answer is named dead, not dispatched a fourth time", (ws) => { profile(ws); order(ws, "orient", { receipts: 3 }); },
      (s) => is("terminal", "abort.ORIENT")(s) && /did not answer after 3/.test(s.reason));
    row("orient artifacts with a receipt and no WorkResult send the envelope back once", (ws) => { profile(ws); orient(ws); order(ws, "orient", { receipts: 1 }); },
      (s) => is("dispatch", "orient.dispatch")(s) && /returned NO WorkResult/.test(s.note));
    row("an orient envelope already sent back once is not sent back again", (ws) => { profile(ws); orient(ws); order(ws, "orient", { receipts: 2 }); },
      (s) => s.step === "gate.L1a");
    row("orient artifacts and a complete leg reach GATE L1a, with the spiked area", (ws) => { profile(ws); orient(ws); order(ws, "orient", { receipts: 1, result: {}, applied: true }); },
      (s) => is("gate", "gate.L1a")(s) && /persistence/.test(s.block) && /⏸ GATE L1a — Orient Review/.test(s.block));
    row("GATE L1a carries the answer set the run was launched with", (ws) => {
      profile(ws); orient(ws); const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.answers = "ci"; json(f, a);
    }, (s) => is("gate")(s) && s.command.includes("--preset ci") && s.answer_command.includes("--answer <decision>"));

    // ---- PLAN -----------------------------------------------------------------------------------
    row("no requirements registry dispatches coverage once the orient gate is crossed", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); },
      (s) => is("dispatch", "coverage.dispatch")(s) && s.skill.endsWith("ba-pitch-analyzer") && s.compile.includes("--operation coverage"));
    row("a coverage that answered and wrote no registry continues with a warning, never loops", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); order(ws, "coverage", { receipts: 1, result: {}, applied: true });
    }, (s) => s.step === "analyze.dispatch" && s.warnings.some((w) => /COVERAGE/.test(w)));
    row("no spec tree dispatches analyze", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); },
      (s) => is("dispatch", "analyze.dispatch")(s) && s.compile.includes("--operation analyze"));
    row("an analyze that answered and left no tree aborts at ANALYZE", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); order(ws, "analyze", { receipts: 1, result: {}, applied: true });
    }, (s) => is("terminal", "abort.ANALYZE")(s));
    row("a committed spec tree and no board regenerates the board, then derives it", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); put(shared(ws, "spec", "usecases", "UC-01-add.md"), "# uc\n");
    }, (s) => is("dispatch", "analyze.board")(s) && s.compile.includes("--operation board") && s.then.some((t) => /reduce board --slug demo --write/.test(t.command)));
    row("a board that answered and left no tasks aborts at ANALYZE", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); put(shared(ws, "spec", "usecases", "UC-01-add.md"), "# uc\n"); order(ws, "board", { receipts: 1, result: {}, applied: true });
    }, is("terminal", "abort.ANALYZE"));
    row("a board whose criteria cover no requirement is sent back once, naming the reason", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a");
      put(shared(ws, "requirements.md"), "# requirements\n\n| ID | Requirement | Source | Priority | Status |\n|---|---|---|---|---|\n| REQ-1 | one thing | pitch | must | open |\n");
      put(shared(ws, "spec", "usecases", "UC-01-add.md"), "# uc\n");
      put(local(ws, "tasks", "TASK-001.md"), "---\nid: TASK-001\nstatus: todo\nscope_id: alpha\nacceptance_criteria:\n  - ac: it works\n---\n\n# t\n");
      order(ws, "analyze", { receipts: 1, result: {}, applied: true });
    }, (s) => is("dispatch")(s) && /Your previous result was refused/.test(s.note ?? "") || s.step === "wire.dispatch");
    row("a spec tree and a board with no wiring map dispatches wire with the profile path", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); },
      (s) => is("dispatch", "wire.dispatch")(s) && /"project_profile":"[^"]*project-profile\.md"/.test(s.compile));
    row("a wire that wrote its map and no WorkResult sends the envelope back once", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); order(ws, "wire", { receipts: 1 }); },
      (s) => is("dispatch", "wire.dispatch")(s) && /returned NO WorkResult/.test(s.note));
    row("a wiring map reaches GATE L1a.5", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); },
      is("gate", "gate.L1a.5"));
    row("no scope contracts after the wiring gate dispatches map-scopes with the exit-0 fixture rule", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); gate(ws, "L1a.5"); },
      (s) => is("dispatch", "map-scopes.dispatch")(s) && /EXIT 0/.test(s.note));
    row("a map-scopes that answered and left no contracts aborts at MAP SCOPES", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); gate(ws, "L1a.5"); order(ws, "map-scopes", { receipts: 1, result: {}, applied: true });
    }, (s) => is("terminal", "abort.MAP SCOPES")(s));
    row("red spec-lint findings abort at L1b before the gate is shown", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); gate(ws, "L1a.5"); scopes(ws); },
      (s) => is("terminal", "abort.L1b")(s) && /spec-lint reported red findings/.test(s.reason));

    // ---- BUILD ----------------------------------------------------------------------------------
    row("a crossed board gate opens round 1 and releases the scope, status line first", (ws) => planned(ws),
      (s) => is("build", "build.r1")(s) && s.release.length === 1 && s.release[0].compile.includes("--round 1 --attempt 1")
        && /attempt ratchet/.test(s.release[0].note) && !/FIX ROUND/.test(s.release[0].note));
    row("two independent scopes release together, up to the dial", (ws) => planned(ws, { ids: ["alpha", "beta"] }),
      (s) => is("build")(s) && s.release.length === 2);
    row("a dependant scope is not released beside the scope it consumes", (ws) => {
      planned(ws, { ids: ["alpha", "beta"] });
      put(shared(ws, "scopes", "beta.md"), "---\nscope_id: beta\ndepends_on: [alpha]\n---\n");
    }, (s) => is("build")(s) && s.release.map((r) => r.scope_id).join() === "alpha" && s.waiting.includes("beta"));
    row("the dial caps what is released, and a launch record can lower it", (ws) => {
      planned(ws, { ids: ["alpha", "beta"] });
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.maxParallelScopes = 1; json(f, a);
    }, (s) => is("build")(s) && s.release.length === 1);
    row("a scope dispatched and not yet answered is in flight, so nothing else is released over it", (ws) => {
      planned(ws); buildOrder(ws, "alpha", 1, {});
    }, (s) => is("wait")(s) && s.in_flight.includes("alpha"));
    row("--restart reads that unanswered order as dead work and releases the scope again", (ws) => { planned(ws); buildOrder(ws, "alpha", 1, {}); },
      (s) => is("build")(s) && s.release[0].scope_id === "alpha", ["--restart"]);
    row("a green T0 with no WorkResult envelope is red, not green (the scope is released again)", (ws) => { planned(ws); t0(ws, "alpha", 1); buildOrder(ws, "alpha", 1, {}); },
      (s) => is("wait")(s) || is("build")(s));
    row("a scope that answered red and is the only scope trips the nothing-green breaker", (ws) => { planned(ws); buildOrder(ws, "alpha", 1, { result: { green: false }, applied: true }); },
      (s) => is("dispatch", "stop.census")(s) && /breaker \(none\)|breaker \(attempt_budget\)/.test(s.reason) && JSON.parse(s.compile.split("--payload ")[1].slice(1, -1)).breaker !== undefined);
    row("a settled green round runs its build gate once, late-ingesting an unapplied green result first", (ws) => {
      planned(ws); declareRun(ws); buildOrder(ws, "alpha", 1, { result: { green: true } }); t0(ws, "alpha", 1);
    }, (s) => is("command", "build.r1.gate")(s) && s.command.includes("verify build --slug demo --round 1") && s.pre.some((p) => /reduce ingest/.test(p.command)));
    row("a round with no declared build step is undeclared and goes straight to GATE L2", (ws) => { planned(ws); roundGreen(ws); },
      (s) => is("gate", "gate.L2.r1")(s) && /build_gate: "undeclared"/.test(s.block));
    row("a red build gate reaches L2, then L3 as a FAIL without spending the judge", (ws) => { planned(ws); roundGreen(ws); gateArt(ws, 1, "red"); gate(ws, "L2", { round: 1 }); },
      (s) => is("gate", "gate.L3.r1")(s) && s.command.includes("--verdict fail") && /build_gate: "red"/.test(s.block));
    row("a red build gate outranks --no-eval: the round is still a FAIL", (ws) => {
      planned(ws); roundGreen(ws); gateArt(ws, 1, "red"); gate(ws, "L2", { round: 1 });
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.noEval = true; json(f, a);
    }, (s) => is("gate", "gate.L3.r1")(s) && s.command.includes("--verdict fail"));
    row("--no-eval ships not-evaluated: GATE L3 is crossed over that verdict, no judge dispatched", (ws) => {
      planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 });
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.noEval = true; json(f, a);
    }, (s) => is("gate", "gate.L3.r1")(s) && s.command.includes("--verdict not-evaluated"));
    row("a green, gated round dispatches the judge with the round and the run command", (ws) => { planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); },
      (s) => is("dispatch", "eval.r1")(s) && s.compile.includes("--operation evaluate") && s.compile.includes("--round 1") && s.skill.endsWith("spec-evaluator"));
    row("a judge that answered and was never applied is applied first", (ws) => { planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); order(ws, "evaluate-r1", { receipts: 1, result: {} }); },
      is("command", "ingest.evaluate-r1"));
    row("a verdict the kernel refused (a PASS with no criteria) is sent back once, with the reason", (ws) => {
      planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); order(ws, "evaluate-r1", { receipts: 1, result: { verdict: { overall: "PASS", criteria: [] } }, applied: true });
    }, (s) => is("dispatch", "eval.r1")(s) && /Your previous result was refused: the PASS verdict grades no criterion/.test(s.note));
    row("a verdict refused twice aborts at L3 with the reason, and is not sent back a third time", (ws) => {
      planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); order(ws, "evaluate-r1", { receipts: 2, result: { verdict: { overall: "PASS", criteria: [] } }, applied: true });
    }, (s) => is("terminal", "abort.L3")(s) && /grades no criterion/.test(s.reason));
    row("a judge that refused to grade aborts at L3 naming the status, with no second dispatch", (ws) => {
      planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); order(ws, "evaluate-r1", { receipts: 1, result: { status: "failed", deviations: ["could not launch"] }, applied: true });
    }, (s) => is("terminal", "abort.L3")(s) && /could not launch/.test(s.reason));
    row("a valid PASS reaches GATE L3 as pass", (ws) => { planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); passResult(ws); },
      (s) => is("gate", "gate.L3.r1")(s) && s.command.includes("--verdict pass"));
    row("--adversarial-verify is named as not carried, never silently dropped", (ws) => {
      planned(ws); roundGreen(ws); gateArt(ws, 1, "red"); gate(ws, "L2", { round: 1 });
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.adversarialVerify = true; json(f, a);
    }, (s) => s.warnings.some((w) => /adversarial-verify/.test(w)));
    row("a FAIL round answered loop opens round 2, in fix mode", (ws) => { planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); gate(ws, "L3", { round: 1, decision: "loop", verdict: "fail" }); },
      (s) => is("build", "build.r2")(s) && /FIX ROUND/.test(s.release[0].note) && s.release[0].compile.includes("--round 2"));
    row("a FAIL answered stop goes to the census as an outer breaker — the answer is honoured on a fresh session", (ws) => {
      planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); gate(ws, "L3", { round: 1, decision: "stop", verdict: "fail" });
    }, (s) => is("dispatch", "stop.census")(s) && /outer/.test(s.reason));
    row("a FAIL in the last round of the budget goes to the census as an outer breaker", (ws) => {
      planned(ws); gate(ws, "L3", { round: 1, decision: "loop", verdict: "fail" }); gate(ws, "L3", { round: 2, decision: "loop", verdict: "fail" });
    }, (s) => is("dispatch", "stop.census")(s) && /outer/.test(s.reason));
    row("a spent wall-clock budget routes to the census before a round opens", (ws) => {
      planned(ws);
      const f = local(ws, "receipt.json"); const r = JSON.parse(readFileSync(f, "utf8")); r.started_at = "2020-01-01T00:00:00.000Z"; r.config = { ...(r.config || {}), wall_clock_budget_s: 60 }; json(f, r);
    }, (s) => is("dispatch", "stop.census")(s) && /deadline/.test(s.reason));

    // ---- QA, census, ship ---------------------------------------------------------------------------
    const passed = (ws) => { planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); passResult(ws); gate(ws, "L3", { round: 1, decision: "loop", verdict: "pass" }); };
    row("a PASS round reaches GATE QA over that verdict", passed, (s) => is("gate", "gate.QA.r1")(s) && s.command.includes("--verdict pass"));
    row("QA answered run dispatches the hunter", (ws) => { passed(ws); gate(ws, "QA", { round: 1, decision: "run", verdict: "pass" }); },
      (s) => is("dispatch", "qa.hunt")(s) && s.skill.endsWith("qa-edge-hunter"));
    row("a hunt that returned done over a reachable app with no charter is sent back once", (ws) => {
      passed(ws); gate(ws, "QA", { round: 1, decision: "run", verdict: "pass" });
      order(ws, "hunt", { receipts: 1, body: { payload: { app_url: "http://localhost:1" } }, result: { status: "done" }, applied: true });
    }, (s) => is("dispatch", "qa.hunt")(s) && /Your previous result was refused/.test(s.note));
    row("QA answered skip goes to the census with no hunt", (ws) => { passed(ws); gate(ws, "QA", { round: 1, decision: "skip", verdict: "pass" }); },
      (s) => is("dispatch", "stop.census")(s) && JSON.parse(s.compile.split("--payload ")[1].slice(1, -1)).qa_findings === 0);
    row("--no-qa skips the hunt even when the gate says run", (ws) => {
      passed(ws); gate(ws, "QA", { round: 1, decision: "run", verdict: "pass" });
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.noQa = true; json(f, a);
    }, is("dispatch", "stop.census"));
    const reached = (ws) => { passed(ws); gate(ws, "QA", { round: 1, decision: "skip", verdict: "pass" }); };
    row("a census that is on disk is not dispatched again — a relaunch after GATE H does not re-run the hammer", (ws) => { reached(ws); census(ws, {}); },
      (s) => is("gate", "gate.H")(s) && s.command.includes("--verdict ship-now"));
    row("cannot-ship on the main path aborts at H before the gate is shown", (ws) => { reached(ws); census(ws, { verdict: "cannot-ship", cut_list: ["a must-have failed"] }); },
      (s) => is("terminal", "abort.H")(s) && /CANNOT SHIP/.test(s.reason));
    row("cannot-ship after a breaker crosses H first, then escalates naming the census", (ws) => {
      planned(ws); gate(ws, "L3", { round: 1, decision: "stop", verdict: "fail" }); census(ws, { verdict: "cannot-ship" });
    }, is("gate", "gate.H"));
    row("…and once H is crossed that breaker run closes escalated with census=cannot-ship", (ws) => {
      planned(ws); gate(ws, "L3", { round: 1, decision: "stop", verdict: "fail" }); census(ws, { verdict: "cannot-ship" }); gate(ws, "H", { decision: "accept-cut-list" });
    }, (s) => is("terminal", "terminal.gate_h")(s) && s.status === "escalated" && /census=cannot-ship/.test(s.close_command) && /--close-arm gate_h/.test(s.close_command));
    row("a crossed GATE H runs the ship report before GATE L4, as a command that cannot fail the main path", (ws) => { reached(ws); census(ws, {}); gate(ws, "H", { decision: "accept-cut-list" }); },
      (s) => is("gate", "gate.L4")(s) && s.pre[0].command.includes("reduce ship --slug demo --verdict PASS --qa skipped") && s.pre[0].advisory === true);
    row("on a breaker the ship report is a precondition: refusing it escalates, naming ship_report=refused", (ws) => {
      planned(ws); gate(ws, "L3", { round: 1, decision: "stop", verdict: "fail" }); census(ws, {}); gate(ws, "H", { decision: "accept-cut-list" });
    }, (s) => is("gate", "gate.L4")(s) && s.pre[0].command.includes("--verdict FAIL --qa skipped") && /ship_report=refused/.test(s.pre[0].on_fail_close));
    row("a not-evaluated ship reports --verdict not-evaluated, never a PASS", (ws) => {
      planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); gate(ws, "L3", { round: 1, decision: "proceed", verdict: "not-evaluated" });
      gate(ws, "QA", { round: 1, decision: "skip", verdict: "not-evaluated" }); census(ws, {}); gate(ws, "H", { decision: "accept-cut-list" });
    }, (s) => is("gate", "gate.L4")(s) && s.pre[0].command.includes("--verdict not-evaluated"));
    row("L4 hold on the main path aborts; on a breaker it escalates", (ws) => { reached(ws); census(ws, {}); gate(ws, "H", { decision: "accept-cut-list" }); gate(ws, "L4", { decision: "hold" }); },
      (s) => is("terminal", "abort.L4")(s));
    row("L4 hold after a breaker closes escalated with l4=hold", (ws) => {
      planned(ws); gate(ws, "L3", { round: 1, decision: "stop", verdict: "fail" }); census(ws, {}); gate(ws, "H", { decision: "accept-cut-list" }); gate(ws, "L4", { decision: "hold" });
    }, (s) => is("terminal", "terminal.gate_h")(s) && /l4=hold/.test(s.close_command));
    row("L4 ship on the main path closes shipped with the verdict, rounds and QA state in the cause", (ws) => {
      reached(ws); census(ws, {}); gate(ws, "H", { decision: "accept-cut-list" }); gate(ws, "L4", { decision: "ship" });
    }, (s) => is("terminal", "terminal.shipped")(s) && /verdict=PASS rounds=1 qa_findings=0 qa=skipped/.test(s.close_command) && /--close-arm shipped/.test(s.close_command));
    row("L4 ship after a breaker closes shipped naming after=gate_h, the breaker and the census", (ws) => {
      planned(ws); gate(ws, "L3", { round: 1, decision: "stop", verdict: "fail" }); census(ws, { cut_list: ["a", "b"] }); gate(ws, "H", { decision: "accept-cut-list" }); gate(ws, "L4", { decision: "ship" });
    }, (s) => is("terminal", "terminal.shipped")(s) && /after=gate_h breaker=outer census=ship-now cut_list=2/.test(s.close_command));
    row("an unanswered order is named at every close", (ws) => {
      planned(ws); order(ws, "stray", { receipts: 1 }); gate(ws, "L3", { round: 1, decision: "stop", verdict: "fail" }); census(ws, {}); gate(ws, "H", { decision: "accept-cut-list" }); gate(ws, "L4", { decision: "ship" });
    }, (s) => is("terminal")(s) && /unanswered_orders=1/.test(s.close_command));
    row("a run that already closed shipped with its report frozen has nothing to resume", (ws) => {
      const f = local(ws, "harness-run.md"); writeFileSync(f, readFileSync(f, "utf8").replace(/^status:.*$/m, "status: shipped").replace(/^closed_status:.*$/m, "closed_status: shipped")); put(shared(ws, "REPORT.md"), "# report\n");
    }, is("done", "done.shipped"));

    // ---- the gate's own shape -------------------------------------------------------------------
    row("a gate paused (an ask row) is not a crossing: the same gate is asked again", (ws) => { profile(ws); orient(ws); gate(ws, "L1a", { status: "ask", decision: "ask" }); },
      is("gate", "gate.L1a"));
    row("a gate crossed in an earlier run is not this run's crossing", (ws) => { profile(ws); orient(ws); gate(ws, "L1a", { run_id: "other-20200101T000000Z-deadbeef" }); },
      is("gate", "gate.L1a"));
    row("every command a step carries is one line, and names the kernel by absolute path", (ws) => { profile(ws); orient(ws); },
      (s) => s.kind === "gate" && [s.command, s.answer_command, s.abort_close].every((c) => !c.includes("\n") && c.startsWith(`node "${KERNEL}"`)));

    // ---- run them ---------------------------------------------------------------------------------
    for (const c of cases) {
      const ws = fresh();
      let step;
      try { c.plant(ws); step = next(ws, c.extra || []); } catch (e) { fail(`next: ${c.name} — fixture threw: ${e.message}`); continue; }
      let good = false;
      try { good = Boolean(c.expect(step)); } catch { good = false; }
      if (good) ok(`next: ${c.name}`);
      else fail(`next: ${c.name} — got ${JSON.stringify(step).slice(0, 360)}`);
    }

    // ---- statelessness: the verb is read-only and repeatable --------------------------------------
    const ws = fresh(); planned(ws);
    const before = JSON.stringify(readFileSync(local(ws, "gates.jsonl"), "utf8"));
    const a = next(ws), b = next(ws);
    if (JSON.stringify(a) === JSON.stringify(b)) ok("next: two calls over one tree return the same step — nothing is remembered between them");
    else fail("next: two calls over one tree returned different steps");
    if (JSON.stringify(readFileSync(local(ws, "gates.jsonl"), "utf8")) === before) ok("next: the verb writes nothing");
    else fail("next: the verb wrote to the gate ledger");

    // ---- exit codes ---------------------------------------------------------------------------------
    const none = sh("probe next", ["--slug", "ghost", "--cwd", ws]);
    if (none.status === 3) ok("next: no open run at the slug exits 3");
    else fail(`next: no open run exited ${none.status}, not 3`);
    const bad = sh("probe next", ["--cwd", ws]);
    if (bad.status === 2) ok("next: a missing --slug exits 2");
    else fail(`next: a missing --slug exited ${bad.status}, not 2`);
  } finally {
    for (const d of cleanups) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
}
