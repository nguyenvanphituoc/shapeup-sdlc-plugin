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
  // `init run` writes the launch record in the same act as the receipt: the dials ride on it.
  const open = sh("init run", ["--slug", SLUG, "--intake-text", "Add a todo list", "--auto-level", "interactive",
    "--exec-model", "sonnet", "--eval-model", "sonnet", "--max-rounds", "2", "--attempts", "3", "--cwd", base]);
  if (open.status !== 0) { fail(`could not open the fixture run: ${open.stderr}`); return; }

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
  const buildOrder = (ws, scope, round, o = {}) => order(ws, `${scope}-r${round}-a${o.attempt ?? 1}`, { receipts: 1, ...o, leg: { scope_id: scope, round }, body: { scope: scope } });
  /** Every attempt of the launch's budget (3) spent and answered red: the scope is exhausted, not merely returned. */
  const exhaustedRed = (ws, scope = "alpha", round = 1) => [1, 2, 3].forEach((a) => buildOrder(ws, scope, round, { attempt: a, result: { green: false }, applied: true }));
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
    }, (s) => is("terminal", "abort.args")(s) && /models\.exec "claude-haiku-4" is below the model floor/.test(s.reason));
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
      (s) => is("command", "ingest.orient")(s) && s.on_fail_close.includes("single writer refused"));
    row("an orient that answered and left no artifact aborts at ORIENT", (ws) => { profile(ws); order(ws, "orient", { receipts: 1, result: {}, applied: true }); },
      (s) => is("terminal", "abort.ORIENT")(s) && /produced no artifact/.test(s.reason));
    row("an orient order dispatched and never answered is dispatched again (the session died)", (ws) => { profile(ws); order(ws, "orient", { receipts: 1 }); },
      is("dispatch", "orient.dispatch"));
    row("an orient dispatched three times with no answer is named dead, not dispatched a fourth time", (ws) => { profile(ws); order(ws, "orient", { receipts: 3 }); },
      (s) => is("terminal", "abort.ORIENT")(s) && /did not answer after 3/.test(s.reason));
    // The generic "a result that is not a WorkResult is sent back once, then stops the run" rule lives
    // in the kernel for every DISPATCHED worker. It was exercised through `wire` while wire was one;
    // planning no longer dispatches, so the rule is pinned through orient, which still does.
    row("a result that is not a WorkResult (status \"complete\") is sent back once with the reason, not applied and not a stop", (ws) => {
      profile(ws); order(ws, "orient", { receipts: 1, result: { status: "complete" } });
    }, (s) => is("dispatch", "orient.dispatch")(s) && /refused before it was applied/.test(s.note) && /status/.test(s.note) && /done \| partial \| escalated \| failed/.test(s.note));
    row("a result still not a WorkResult after the send-back stops the run, naming what was refused", (ws) => {
      profile(ws); order(ws, "orient", { receipts: 2, result: { status: "complete" } });
    }, (s) => is("terminal", "abort.ORIENT")(s) && /not a valid WorkResult after one send-back/.test(s.reason));
    row("orient artifacts with a receipt and no WorkResult send the envelope back once", (ws) => { profile(ws); orient(ws); order(ws, "orient", { receipts: 1 }); },
      (s) => is("dispatch", "orient.dispatch")(s) && /returned NO WorkResult/.test(s.note));
    row("orient artifacts with no receipt and no WorkResult are not sent back — the worker never ran", (ws) => { profile(ws); orient(ws); order(ws, "orient", { receipts: 0 }); },
      (s) => is("gate", "gate.L1a")(s) && !/WorkResult/.test(JSON.stringify(s)));
    row("an orient envelope already sent back once is not sent back again", (ws) => { profile(ws); orient(ws); order(ws, "orient", { receipts: 2 }); },
      (s) => s.step === "gate.L1a");
    row("orient artifacts and a complete leg reach GATE L1a, with the spiked area", (ws) => { profile(ws); orient(ws); order(ws, "orient", { receipts: 1, result: {}, applied: true }); },
      (s) => is("gate", "gate.L1a")(s) && /persistence/.test(s.block) && /⏸ GATE L1a — Orient Review/.test(s.block));
    row("GATE L1a carries the answer set the run was launched with", (ws) => {
      profile(ws); orient(ws); const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.answers = "ci"; json(f, a);
    }, (s) => is("gate")(s) && s.command.includes("--preset ci") && s.answer_command.includes("--answer <decision>"));

    // ---- PLAN -----------------------------------------------------------------------------------
    // Planning is one activity the loop does in its own context, in four substeps; the kernel keeps the
    // fence (a `plan` order) and the post-conditions. A plan order has no dispatch receipt, so the
    // receipt-count rows the dispatched planners had are retired, not ported: there is no dispatch to
    // count. "Sent back once" is the number of times the single writer closed the order (its leg rows),
    // and "open" is a leg row older than the order's own compiled_at.
    const isPlan = (step) => (s) => is("plan", `plan.${step}`)(s) && s.substep === step && s.resource === "resources/plan.md"
      && s.open.includes("--operation plan") && s.open.includes(`"step":"${step}"`) && s.close.includes("--close-plan") && !s.open.includes("\n") && !s.close.includes("\n");
    row("no requirements registry opens the requirements substep once the orient gate is crossed", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); },
      (s) => isPlan("requirements")(s) && /requirements\.md$/.test(s.produces) && s.order_open === false && s.checks.length === 0);
    row("a plan step carries the knowledge-base files that exist, under any name the activity was filed as", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); put(join(ws, "shapeup", "knowledge-base", "ba-pitch-analyzer.md"), "- a rule\n");
    }, (s) => isPlan("requirements")(s) && s.guidance.length === 1 && s.guidance[0] === "shapeup/knowledge-base/ba-pitch-analyzer.md");
    row("a requirements order closed over no registry continues with a warning, never loops", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); order(ws, "plan-requirements", { result: {}, applied: true });
    }, (s) => s.step === "plan.spec" && s.warnings.some((w) => /COVERAGE/.test(w)));
    row("a requirements order opened and not closed is still open: the loop closes it, it does not open it again", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); order(ws, "plan-requirements", {});
    }, (s) => isPlan("requirements")(s) && s.order_open === true && /open and has not been closed/.test(s.reason));
    row("a plan result that was written and never applied is applied before anything else", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); order(ws, "plan-spec", { result: {} });
    }, (s) => is("command", "ingest.plan-spec")(s) && s.on_fail_close.includes("single writer refused"));
    row("an order re-opened after its last close is open again, though a leg row for it exists", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws);
      order(ws, "plan-spec", { applied: true, body: { compiled_at: "2099-01-01T00:00:00.000Z" } });
    }, (s) => isPlan("spec")(s) && s.order_open === true);
    row("no spec tree opens the spec substep in full, then derives the board and lints", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); },
      (s) => isPlan("spec")(s) && s.mode === undefined && !s.open.includes('"mode"') && /Write the spec tree and the board/.test(s.note)
        && s.checks.some((c) => /reduce board --slug demo --write/.test(c.command)) && s.checks.some((c) => /verify spec --slug demo/.test(c.command))
        && s.inputs.pitch.endsWith("intake.md"));
    row("a spec order closed over no tree aborts at ANALYZE", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); order(ws, "plan-spec", { result: {}, applied: true });
    }, (s) => is("terminal", "abort.ANALYZE")(s) && /produced no artifact/.test(s.reason));
    row("a committed spec tree and no board opens the spec substep board-only: the tree is frozen", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); put(shared(ws, "spec", "usecases", "UC-01-add.md"), "# uc\n");
    }, (s) => isPlan("spec")(s) && s.mode === "board-only" && s.open.includes('"mode":"board-only"') && /without re-deriving it/.test(s.note)
      && s.checks.some((c) => /reduce board --slug demo --write/.test(c.command)));
    row("a board-only order closed over no tasks aborts at ANALYZE", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); put(shared(ws, "spec", "usecases", "UC-01-add.md"), "# uc\n"); order(ws, "plan-spec", { result: {}, applied: true });
    }, is("terminal", "abort.ANALYZE"));
    const uncovered = (ws, closes) => {
      profile(ws); orient(ws); gate(ws, "L1a");
      put(shared(ws, "requirements.md"), "# requirements\n\n| ID | Requirement | Source | Priority | Status |\n|---|---|---|---|---|\n| REQ-1 | one thing | pitch | must | open |\n");
      put(shared(ws, "spec", "usecases", "UC-01-add.md"), "# uc\n");
      put(local(ws, "tasks", "TASK-001.md"), "---\nid: TASK-001\nstatus: todo\nscope_id: alpha\n---\n\n# t\n\n- [ ] it works\n");
      for (let i = 0; i < closes; i++) order(ws, "plan-spec", { result: {}, applied: true });
    };
    row("a board whose criteria cover no requirement is sent back once, naming the reason, tree frozen", (ws) => uncovered(ws, 1),
      (s) => isPlan("spec")(s) && s.mode === "board-only" && /Your previous result was refused/.test(s.note) && /covers: REQ/.test(s.note) && /sent back once/.test(s.reason));
    row("…and after that one send-back it continues with a warning, never loops", (ws) => {
      uncovered(ws, 1); const f = local(ws, "legs.jsonl"); appendFileSync(f, readFileSync(f, "utf8").split("\n")[0] + "\n");
    }, (s) => s.step === "plan.wire" && s.warnings.some((w) => /ANALYZE plan-spec/.test(w) && /after one send-back/.test(w)));
    row("a spec tree and a board with no wiring map opens the wire substep with the profile path and the advisory trace check", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); },
      (s) => isPlan("wire")(s) && /project-profile\.md$/.test(s.inputs.project_profile) && s.checks.length === 1 && s.checks[0].advisory === true && /verify trace/.test(s.checks[0].command));
    row("a wire order open over a wiring map already on disk is closed, not redone", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); order(ws, "plan-wire", {});
    }, (s) => isPlan("wire")(s) && s.order_open === true && /open and has not been closed/.test(s.reason));
    row("a wire order closed over no map aborts at WIRE", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); order(ws, "plan-wire", { result: {}, applied: true });
    }, (s) => is("terminal", "abort.WIRE")(s) && /produced no artifact/.test(s.reason));
    row("a wiring map reaches GATE L1a.5 — after the wire substep and before the scopes substep", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); },
      is("gate", "gate.L1a.5"));
    row("no scope contracts after the wiring gate opens the scopes substep with the exit-0 fixture rule", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); gate(ws, "L1a.5"); },
      (s) => isPlan("scopes")(s) && /EXIT 0/.test(s.note) && s.checks.some((c) => /verify spec --slug demo/.test(c.command)));
    row("a scopes order closed over no contracts aborts at MAP SCOPES", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); gate(ws, "L1a.5"); order(ws, "plan-scopes", { result: {}, applied: true });
    }, (s) => is("terminal", "abort.MAP SCOPES")(s));
    row("planning resumes from artifacts alone: every artifact on disk and no plan order at all reaches the wiring gate, not a re-plan", (ws) => {
      profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws);
    }, is("gate", "gate.L1a.5"));
    row("red spec-lint findings abort at L1b before the gate is shown", (ws) => { profile(ws); orient(ws); gate(ws, "L1a"); requirements(ws); tree(ws); wiring(ws); gate(ws, "L1a.5"); scopes(ws); },
      (s) => is("terminal", "abort.L1b")(s) && /spec-lint reported red findings/.test(s.reason));

    // ---- BUILD ----------------------------------------------------------------------------------
    row("a crossed board gate opens round 1 and releases the scope, status line first", (ws) => planned(ws),
      (s) => is("build", "build.r1")(s) && s.release.length === 1 && s.release[0].compile.includes("--round 1 --attempt 1")
        && /attempt ratchet/.test(s.release[0].note) && !/FIX ROUND/.test(s.release[0].note));
    row("every released scope carries its own ingest command, addressed to its first-attempt order", (ws) => planned(ws),
      (s) => is("build")(s) && s.release.every((r) => r.ingest === `node "${KERNEL}" reduce ingest --order "${r.order_path}"` && r.order_path.endsWith("alpha-r1-a1.json")));
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
    row("a scope that answered red with budget left is released again at its next attempt, with the spent count in its note", (ws) => { planned(ws); buildOrder(ws, "alpha", 1, { result: { green: false }, applied: true }); },
      (s) => is("build", "build.r1")(s) && s.release[0].attempt === 2 && s.release[0].compile.includes("--attempt 2") && s.release[0].order_path.endsWith("alpha-r1-a2.json")
        && /Attempts 1 to 1 .* already spent .* 2 left/.test(s.release[0].note));
    row("a dependent is not released over a dependency that is red with budget left", (ws) => {
      planned(ws, { ids: ["alpha", "beta"] });
      put(shared(ws, "scopes", "beta.md"), "---\nscope_id: beta\ndepends_on: [alpha]\n---\n");
      buildOrder(ws, "alpha", 1, { result: { green: false }, applied: true });
    }, (s) => is("build")(s) && s.release.map((r) => r.scope_id).join() === "alpha" && s.release[0].attempt === 2 && s.waiting.includes("beta"));
    row("a dependent is released once its dependency has spent its whole budget", (ws) => {
      planned(ws, { ids: ["alpha", "beta"] });
      put(shared(ws, "scopes", "beta.md"), "---\nscope_id: beta\ndepends_on: [alpha]\n---\n");
      exhaustedRed(ws);
    }, (s) => is("build")(s) && s.release.map((r) => r.scope_id).join() === "beta");
    row("a scope that spent its whole budget red and is the only scope trips the nothing-green breaker", (ws) => { planned(ws); exhaustedRed(ws); },
      (s) => is("stop", "stop.census")(s) && /breaker \(none\)|breaker \(attempt_budget\)/.test(s.reason) && s.inputs.breaker !== null && s.inputs.hammer_proposals.includes("alpha"));
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
    }, (s) => is("stop", "stop.census")(s) && /outer/.test(s.reason));
    row("a FAIL in the last round of the budget goes to the census as an outer breaker", (ws) => {
      planned(ws); gate(ws, "L3", { round: 1, decision: "loop", verdict: "fail" }); gate(ws, "L3", { round: 2, decision: "loop", verdict: "fail" });
    }, (s) => is("stop", "stop.census")(s) && /outer/.test(s.reason));
    row("a spent wall-clock budget routes to the census before a round opens", (ws) => {
      planned(ws);
      const f = local(ws, "receipt.json"); const r = JSON.parse(readFileSync(f, "utf8")); r.started_at = "2020-01-01T00:00:00.000Z"; r.config = { ...(r.config || {}), wall_clock_budget_s: 60 }; json(f, r);
    }, (s) => is("stop", "stop.census")(s) && /deadline/.test(s.reason));

    // ---- QA, census, ship ---------------------------------------------------------------------------
    const passed = (ws) => { planned(ws); roundGreen(ws); gate(ws, "L2", { round: 1 }); passResult(ws); gate(ws, "L3", { round: 1, decision: "loop", verdict: "pass" }); };
    row("a PASS round reaches GATE QA over that verdict", passed, (s) => is("gate", "gate.QA.r1")(s) && s.command.includes("--verdict pass"));
    row("QA answered run dispatches the hunter", (ws) => { passed(ws); gate(ws, "QA", { round: 1, decision: "run", verdict: "pass" }); },
      (s) => is("dispatch", "qa.hunt")(s) && s.skill.endsWith("qa-edge-hunter"));
    row("a hunt that returned done over a reachable app with no charter is sent back once", (ws) => {
      passed(ws); gate(ws, "QA", { round: 1, decision: "run", verdict: "pass" });
      order(ws, "hunt", { receipts: 1, body: { payload: { app_url: "http://localhost:1" } }, result: { status: "done" }, applied: true });
    }, (s) => is("dispatch", "qa.hunt")(s) && /Your previous result was refused/.test(s.note));
    row("a hunt dispatched three times with no answer is given up on: QA is a level-up, so the run goes to the census", (ws) => {
      passed(ws); gate(ws, "QA", { round: 1, decision: "run", verdict: "pass" });
      order(ws, "hunt", { receipts: 3 });
    }, (s) => is("stop", "stop.census")(s) && s.inputs.qa_findings === 0);
    row("a hunt result that nothing applied is named in warnings and never stops the run (QA never gates)", (ws) => {
      passed(ws); gate(ws, "QA", { round: 1, decision: "run", verdict: "pass" });
      order(ws, "hunt", { receipts: 1, result: { status: "done" } });
    }, (s) => is("stop", "stop.census")(s) && s.warnings.some((w) => /hunt's result was never applied/.test(w)));
    row("QA answered skip goes to the census with no hunt", (ws) => { passed(ws); gate(ws, "QA", { round: 1, decision: "skip", verdict: "pass" }); },
      (s) => is("stop", "stop.census")(s) && s.inputs.qa_findings === 0 && s.inputs.breaker === null);
    row("--no-qa skips the hunt even when the gate says run", (ws) => {
      passed(ws); gate(ws, "QA", { round: 1, decision: "run", verdict: "pass" });
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.noQa = true; json(f, a);
    }, is("stop", "stop.census"));
    const reached = (ws) => { passed(ws); gate(ws, "QA", { round: 1, decision: "skip", verdict: "pass" }); };
    const reachedStop = reached;
    row("a census that is on disk is not asked for again — a relaunch after GATE H does not redo the census", (ws) => { reached(ws); census(ws, {}); },
      (s) => is("gate", "gate.H")(s) && s.command.includes("--verdict ship-now"));
    // THE STOP STEP IS AN ACTIVITY, NOT A DISPATCH. Its step names the resource, the probes every claim cites,
    // and the file it is done on; nothing is compiled and no sub-agent is told anything.
    row("the stop step is an activity: it names the resource, the three probe commands (one per proposal scope for attempts), the census file and its required fields, and dispatches nothing", (ws) => {
      planned(ws); exhaustedRed(ws);
    }, (s) => is("stop", "stop.census")(s) && s.resource === "resources/stop.md" && s.section === "Census" && !("compile" in s) && !("skill" in s)
      && s.produces.path === ".shapeup/demo/reports/hammer-census.json" && ["schema_version", "verdict", "cut_list"].every((f) => s.produces.required.includes(f))
      && JSON.stringify(s.produces.verdicts) === JSON.stringify(["ship-now", "ship-after-fixes", "cannot-ship"])
      && [s.probes.owner, s.probes.requirements, ...s.probes.attempts.map((a) => a.command), s.close].every((c) => !c.includes("\n") && c.startsWith(`node "${KERNEL}"`))
      && s.probes.owner.includes("probe owner --slug demo") && s.probes.requirements.includes("probe requirements --slug demo")
      && s.probes.attempts.length === 1 && s.probes.attempts[0].scope === "alpha" && /probe attempts --slug demo --scope alpha --round 1 --attempt-budget 3$/.test(s.probes.attempts[0].command)
      && s.close.endsWith("reduce ingest --close-census --slug demo") && s.pre.length === 0);
    row("with no scope in proposal the stop step hands out no attempts probe (nothing to cite)", reachedStop, (s) => is("stop", "stop.census")(s) && s.probes.attempts.length === 0 && s.inputs.green_scopes.includes("alpha"));
    row("a census that is on disk but not a census (a verdict outside the three) is refused: the step comes back once, with the reason, and records the refusal first", (ws) => {
      reachedStop(ws); census(ws, { verdict: "maybe" });
    }, (s) => is("stop", "stop.census")(s) && /Your previous census was refused/.test(s.note) && /verdict/.test(s.note) && /sent back once/.test(s.reason)
      && s.pre.length === 1 && s.pre[0].advisory === true && s.pre[0].command.endsWith("--close-census --slug demo"));
    row("a census with no cut_list is refused by shape, even though its verdict is one the gate would read", (ws) => {
      reachedStop(ws); json(local(ws, "reports", "hammer-census.json"), { schema_version: 1, verdict: "ship-now" });
    }, (s) => is("stop", "stop.census")(s) && /cut_list/.test(s.note));
    row("a census that is not JSON is refused with that reason", (ws) => { reachedStop(ws); put(local(ws, "reports", "hammer-census.json"), "ship it\n"); },
      (s) => is("stop", "stop.census")(s) && /not readable JSON/.test(s.note));
    row("a census with a wrong schema_version is refused", (ws) => { reachedStop(ws); census(ws, { schema_version: 2 }); },
      (s) => is("stop", "stop.census")(s) && /schema_version/.test(s.note));
    row("the same refused census asked again is the same send-back, not a second refusal (the file's hash is the key)", (ws) => {
      reachedStop(ws); census(ws, { verdict: "maybe" });
      const text = readFileSync(local(ws, "reports", "hammer-census.json"), "utf8");
      append(local(ws, "reports", "census-refusals.jsonl"), JSON.stringify({ at: new Date().toISOString(), run_id: RUN_ID, sha256: createHash("sha256").update(text).digest("hex"), reason: "r" }) + "\n");
    }, (s) => is("stop", "stop.census")(s) && s.pre.length === 0 && /sent back once/.test(s.reason));
    row("a second, different invalid census after one recorded refusal stops the run with the real reason", (ws) => {
      reachedStop(ws); census(ws, { verdict: "maybe" });
      append(local(ws, "reports", "census-refusals.jsonl"), JSON.stringify({ at: new Date().toISOString(), run_id: RUN_ID, sha256: "0".repeat(64), reason: "the first one" }) + "\n");
    }, (s) => is("terminal", "abort.H")(s) && /refused twice/.test(s.reason) && /verdict/.test(s.reason));
    row("a refusal recorded in another run does not count against this one", (ws) => {
      reachedStop(ws); census(ws, { verdict: "maybe" });
      append(local(ws, "reports", "census-refusals.jsonl"), JSON.stringify({ at: new Date().toISOString(), run_id: "other-20200101T000000Z-deadbeef", sha256: "0".repeat(64), reason: "an old run" }) + "\n");
    }, (s) => is("stop", "stop.census")(s));
    row("a refused census that was then removed is asked for again, and the note says why the last one was refused", (ws) => {
      reachedStop(ws);
      append(local(ws, "reports", "census-refusals.jsonl"), JSON.stringify({ at: new Date().toISOString(), run_id: RUN_ID, sha256: "0".repeat(64), reason: "cut_list must be an array" }) + "\n");
    }, (s) => is("stop", "stop.census")(s) && /cut_list must be an array/.test(s.note));
    row("a valid census with extra fields and a null baseline is accepted — the shape names what is required, not everything", (ws) => { reachedStop(ws); census(ws, { ship_blocking: [], breaker: null, baseline: null, extra: 1 }); },
      (s) => is("gate", "gate.H")(s));
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
    row("an unattended run with no answer set anywhere stops at preflight, naming the fix, instead of stalling at a gate", (ws) => {
      profile(ws); orient(ws);
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.autoLevel = "unattended"; json(f, a);
    }, (s) => is("terminal", "abort.preflight")(s) && /no gate answer set/.test(s.reason));
    row("an unattended run whose ledger names an answer set resolves through it, though the launch record did not", (ws) => {
      profile(ws); orient(ws);
      const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.autoLevel = "unattended"; json(f, a);
      const h = local(ws, "harness-run.md"); writeFileSync(h, readFileSync(h, "utf8").replace(/^gate_answers:.*$/m, "gate_answers: ci"));
    }, (s) => is("gate", "gate.L1a")(s) && s.command.includes("--preset ci"));
    row("a compiled payload carries no bare null — a field the run does not have is left out of it", profile,
      (s) => is("dispatch", "orient.dispatch")(s) && /--payload '\{/.test(s.compile) && !/:null/.test(s.compile));
    row("every command a step carries is one line, and names the kernel by absolute path", (ws) => { profile(ws); orient(ws); },
      (s) => s.kind === "gate" && [s.command, s.answer_command, s.abort_close].every((c) => !c.includes("\n") && c.startsWith(`node "${KERNEL}"`)));

    // ---- run them ---------------------------------------------------------------------------------
    const statefulRows = [], unclosed = [];
    let terminals = 0;
    for (const c of cases) {
      const ws = fresh();
      let step;
      try { c.plant(ws); step = next(ws, c.extra || []); } catch (e) { fail(`next: ${c.name} — fixture threw: ${e.message}`); continue; }
      let good = false;
      try { good = Boolean(c.expect(step)); } catch { good = false; }
      if (good) ok(`next: ${c.name}`);
      else fail(`next: ${c.name} — got ${JSON.stringify(step).slice(0, 360)}`);
      // EVERY ENDING RECORDS A CLOSE. A terminal step is closed through the kernel's arm map, so the step
      // itself must carry the command that does it — the property a run script's "every terminal return is
      // wrapped" guard used to protect, now checked over every planted row that reaches one.
      if (step?.kind === "terminal") { terminals++; if (!/--close-arm (aborted|gate_h|shipped)\b/.test(step.close_command || "")) unclosed.push(c.name); }
      // THE STATE MACHINE REMEMBERS NOTHING. Asked a second time over the same tree — what a relaunched
      // session does — it answers identically; a census, a count or a green set held anywhere but the
      // artifacts would make the second answer differ. Checked over every row, not a chosen few.
      try { if (JSON.stringify(next(ws, c.extra || [])) !== JSON.stringify(step)) statefulRows.push(c.name); } catch { statefulRows.push(c.name); }
    }
    if (!unclosed.length) ok(`next: every terminal step among the ${terminals} rows that reach one carries a close command (\`probe resume --close-arm\`) — no ending is left without a recorded close`);
    else fail(`next: these terminal steps carry no close command: ${unclosed.join("; ")}`);
    if (!statefulRows.length) ok(`next: asked twice over the same tree, every one of ${cases.length} rows answers identically — nothing is carried in memory between asks`);
    else fail(`next: these rows answered differently the second time (state held outside the artifacts): ${statefulRows.join("; ")}`);

    // ---- the census refusal, driven through the real kernel -----------------------------------------
    // The rows above plant the refusal ledger by hand; this drives the three acts for real, because the
    // count that makes "sent back once" true is one the KERNEL writes (`reduce ingest --close-census`), and a
    // planted row proves nothing about whether the writer writes it.
    {
      const ws2 = fresh(); reached(ws2);
      const censusPath = local(ws2, "reports", "hammer-census.json");
      const closeCensus = () => sh("reduce ingest", ["--close-census", "--slug", SLUG, "--cwd", ws2]);
      const rows = () => { try { return readFileSync(local(ws2, "reports", "census-refusals.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
      const c0 = closeCensus();
      if (c0.status === 1 && /no census on disk/.test(c0.stderr) && rows().length === 0) ok("census: closing with no file is exit 1 and records nothing — a missing census is not a refusal");
      else fail(`census: closing over no file exited ${c0.status}, rows ${rows().length}: ${c0.stderr}`);
      json(censusPath, { schema_version: 1, verdict: "maybe", cut_list: [] });
      const c1 = closeCensus();
      if (c1.status === 1 && /refused/.test(c1.stderr) && rows().length === 1 && rows()[0].run_id === RUN_ID) ok("census: closing over an invalid census exits 1, names the reason and records one refusal carrying the run key");
      else fail(`census: invalid close exited ${c1.status}, rows ${JSON.stringify(rows())}: ${c1.stderr}`);
      closeCensus();
      if (rows().length === 1) ok("census: closing the same refused file again records nothing new");
      else fail(`census: the same file was recorded ${rows().length} times`);
      const afterOne = next(ws2);
      if (is("stop", "stop.census")(afterOne) && /sent back once/.test(afterOne.reason) && afterOne.pre.length === 0) ok("census: after one recorded refusal the step comes back with the reason and no second recording");
      else fail(`census: after one refusal got ${JSON.stringify(afterOne).slice(0, 300)}`);
      json(censusPath, { schema_version: 1, verdict: "ship-now", cut_list: ["x"], ship_blocking: [], breaker: null, baseline: null });
      const c2 = closeCensus();
      const afterFix = next(ws2);
      if (c2.status === 0 && is("gate", "gate.H")(afterFix) && afterFix.command.includes("--verdict ship-now")) ok("census: a valid census after one send-back closes exit 0 and the run goes on to GATE H");
      else fail(`census: valid-after-refusal exited ${c2.status}, next ${JSON.stringify(afterFix).slice(0, 200)}`);

      // …and the second refusal stops the run, whichever way it arrives.
      const ws3 = fresh(); reached(ws3);
      const cp3 = local(ws3, "reports", "hammer-census.json");
      const close3 = () => sh("reduce ingest", ["--close-census", "--slug", SLUG, "--cwd", ws3]);
      json(cp3, { schema_version: 1, verdict: "maybe", cut_list: [] }); close3();
      json(cp3, { schema_version: 1, verdict: "perhaps", cut_list: [] });
      const unclosed = next(ws3);      // the loop rewrote it and did not close: the kernel judges it itself
      if (is("terminal", "abort.H")(unclosed) && /refused twice/.test(unclosed.reason) && /perhaps/.test(unclosed.reason)) ok("census: a second, different invalid census stops the run with the real reason — even if the loop never ran the close");
      else fail(`census: a second invalid census got ${JSON.stringify(unclosed).slice(0, 300)}`);
      close3();
      if (is("terminal", "abort.H")(next(ws3))) ok("census: …and the same once the close has recorded it");
      else fail("census: a recorded second refusal did not stop the run");
      const gone = next(ws3);
      if (/refused twice/.test(gone.reason ?? "")) ok("census: the abort names both the count and the reason");
      else fail(`census: abort reason ${gone.reason}`);
    }

    // ---- the retro's gate is a command the shipped step hands out ---------------------------------------
    {
      const shipped = (ws, answers = null) => {
        reached(ws); census(ws, {}); gate(ws, "H", { decision: "accept-cut-list" }); gate(ws, "L4", { decision: "ship" });
        if (answers) { const f = local(ws, "run-args.json"); const a = JSON.parse(readFileSync(f, "utf8")); a.answers = answers; json(f, a); }
        return next(ws);
      };
      const wsA = fresh(), wsB = fresh();
      const sA = shipped(wsA, "ci"), sB = shipped(wsB);
      if (is("terminal", "terminal.shipped")(sA) && sA.retro?.resource === "resources/retro.md" && /gate --resolve COACH-1 --slug demo --preset ci$/.test(sA.retro.gate) && sA.retro.gate.startsWith(`node "${KERNEL}"`)) ok("retro: the shipped step carries the COACH-1 gate command, with the run's own answer set, by absolute kernel path");
      else fail(`retro: shipped step ${JSON.stringify(sA).slice(0, 300)}`);
      const runGate = (ws, cmd) => spawnSync(cmd, { shell: true, cwd: ws, encoding: "utf8" }).status;
      const ledgerRows = (ws) => { try { return readFileSync(local(ws, "gates.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
      const exitA = runGate(wsA, `${sA.retro.gate} --cwd ${wsA}`);
      const rowA = ledgerRows(wsA).find((r) => r.gate === "COACH-1");
      if (exitA === 0 && rowA?.decision === "skip" && /preset:ci/.test(rowA.source)) ok("retro: in a ci run that command resolves skip (exit 0) and ledgers it — an unattended lane files nothing and asks nobody");
      else fail(`retro: ci COACH-1 exit ${exitA}, row ${JSON.stringify(rowA)}`);
      if (is("terminal", "terminal.shipped")(sB) && /--preset interactive$/.test(sB.retro.gate)) ok("retro: a run with no answer set resolves COACH-1 through the interactive preset");
      else fail(`retro: no-answers shipped step carried ${sB.retro?.gate}`);
      const exitB = runGate(wsB, `${sB.retro.gate} --cwd ${wsB}`);
      const rowB = ledgerRows(wsB).find((r) => r.gate === "COACH-1");
      if (exitB === 4 && rowB?.decision === "ask" && rowB?.status === "ask") ok("retro: interactively it resolves ask (exit 4) and ledgers it — the categorization conversation is the answer");
      else fail(`retro: interactive COACH-1 exit ${exitB}, row ${JSON.stringify(rowB)}`);
    }

    // ---- statelessness: the verb is read-only and repeatable --------------------------------------
    const ws = fresh(); planned(ws);
    const before = JSON.stringify(readFileSync(local(ws, "gates.jsonl"), "utf8"));
    const a = next(ws), b = next(ws);
    if (JSON.stringify(a) === JSON.stringify(b)) ok("next: two calls over one tree return the same step — nothing is remembered between them");
    else fail("next: two calls over one tree returned different steps");
    if (JSON.stringify(readFileSync(local(ws, "gates.jsonl"), "utf8")) === before) ok("next: the verb writes nothing");
    else fail("next: the verb wrote to the gate ledger");

    // ---- the Stop check knows the loop's front door -----------------------------------------------
    const { dispatchedOrchestrator } = await import(join(ROOT, "hooks/gate-zerowork.mjs"));
    const skillEv = (skill) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] } });
    if (dispatchedOrchestrator([skillEv("shapeup-sdlc-plugin:building")])) ok("next: a Skill(building) dispatch counts as reaching the orchestrator, so a receipt-less stop is blocked");
    else fail("next: Skill(building) is invisible to the Stop check — a session that dispatched the loop and left no receipt would stop clean");
    if (!dispatchedOrchestrator([{ type: "user", message: { content: "how does the building skill decide what comes next?" } }])) ok("next: merely discussing the loop is not a dispatch");
    else fail("next: a session that only talked about the loop was counted as having dispatched it");

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
