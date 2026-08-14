// shapeup-run.native — the BUILD-phase orchestrator on Claude's NATIVE Dynamic Workflow runtime.
// ============================================================================================
// This is a TARGETED REWORK of skills/tech-lead/workflows/shapeup-run.js, per the review's
// improvements 1–5. It keeps your phase order, gate/breaker semantics, RunReturn union, worker
// roster, and envelope port. What changes is the SUBSTRATE:
//
//   1. Runs on the native `Workflow` tool — no run-workflow.mjs, no `claude -p` spawns, no
//      hand-rolled semaphore. Launch with:  /ship "..."  ->  Workflow({ scriptPath, args })
//      (the tech-lead skill writes RunArgs and hands the path to Workflow, not to Bash.)
//
//   2. NO COURIER. The old file ran shell by asking a "mech" sub-agent to run it and report
//      stdout, then hand-parsed the reply (parseMechJson / mechEnvelope / EXIT-marker prompts /
//      resultFor). None of that exists here. Every step is either:
//        (a) an agent() that returns a SCHEMA-VALIDATED object — the runtime enforces the shape,
//            the script branches on real fields, never on a model's prose; or
//        (b) a mechanical call the WORKER performs in its own real shell and reports back as
//            structured fields (the worker has a filesystem; this control script does not, and
//            per the five-plane split it should not).
//
//   3. SCOPES FAN OUT. The old `for (const scope of scopes)` is now pipeline(scopes, build,
//      verify): every scope builds concurrently (capped by the runtime), its attempt-ratchet runs
//      inside the build stage, and T0 verifies each the moment its build lands. isolation:
//      'worktree' keeps parallel builds from colliding — which RETIRES the manual branch-per-scope
//      checkout. The single-writer reducer (your ingest) is what makes this safe; you already had it.
//
//   4. ONE RUN GRAPH as the read model. A `reduce` step per phase appends nodes/edges to a typed
//      run graph (the reducer = ingest, reframed). Resume reads the graph back through ONE
//      structured probe — a bounded subgraph query, not a directory re-scan. See graphProbe().
//
//   5. OPT-IN REFUTE WAVE. When args.adversarialVerify is set, each EVAL FAIL finding is checked by
//      one independent refuter before it costs a fix round (article: "a verification wave helps
//      only if reviewers have a different prompt, evidence set, or role").
//
// DESIGN-SKETCH MARKERS. Lines tagged `// [ADD]` name the only new pipeline scripts this rework
// needs on disk (a graph reducer + a graph query, replacing resume-state's directory walk). Lines
// tagged `// [REQ]` name a precondition on the workers (worktree-parallel-safe). Everything else
// is drop-in against your existing skills, operations (domain.schema.json $defs/Operation), and
// gate-answers exit-code convention (0 cross / 4 pause / 5 abort).
//
// WHAT THIS FILE OWNS (unchanged from today):
//   ORIENT -> L1a -> ANALYZE -> WIRE -> L1a.5 -> MAP SCOPES -> L1b ->
//   rounds of (BUILD[fan-out] -> L2 -> EVAL -> L3) bounded by budgets.maxRounds ->
//   QA -> GATE H -> ship-report -> RunReturn.
// ============================================================================================

export const meta = {
  name: "shapeup-run-native",
  description:
    "BUILD-phase pipeline on the native Workflow runtime: ORIENT -> ANALYZE -> WIRE -> MAP SCOPES " +
    "-> rounds of BUILD(fan-out)/EVAL -> QA -> GATE H -> ship. Gates resolve via gate-answers.mjs " +
    "exit codes; scopes build in parallel with per-scope ratchets; state is one typed run graph.",
  phases: [
    { title: "Orient" }, { title: "Analyze" }, { title: "Wire" }, { title: "MapScopes" },
    { title: "Build" }, { title: "Verify" }, { title: "Eval" }, { title: "Refute" },
    { title: "QA" }, { title: "Ship" },
  ],
};

// Some callers hand args as a JSON string. Normalize once. (Kept — this is a runtime fact, not a
// courier defense.)
if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }

// --------------------------------------------------------------------------------------------
// Model floor — allowlist, fail closed on an unknown name (unchanged policy).
// --------------------------------------------------------------------------------------------
const MODEL_FLOOR = new Set(["sonnet", "opus"]);
const belowFloor = (m) => !MODEL_FLOOR.has(String(m || "").toLowerCase());

function validateArgs(a) {
  const p = [];
  for (const k of ["slug", "autoLevel", "models", "budgets", "pluginRoot"]) {
    if (a?.[k] === undefined || a[k] === null || a[k] === "") p.push(`missing args.${k}`);
  }
  if (a && !["interactive", "auto", "unattended"].includes(a.autoLevel)) {
    p.push(`args.autoLevel="${a.autoLevel}" must be interactive|auto|unattended`);
  }
  if (a?.budgets && (!a.budgets.maxRounds || !a.budgets.attemptBudget)) {
    p.push("args.budgets must carry maxRounds and attemptBudget");
  }
  if (a?.models) for (const role of ["exec", "eval"]) {
    if (role === "eval" && a.noEval) continue;
    if (belowFloor(a.models[role])) p.push(`args.models.${role} below floor (sonnet+)`);
  }
  return p;
}

const argProblems = validateArgs(args);
if (argProblems.length) return { status: "aborted", aborted_at: "args", reason: argProblems.join("; ") };

const slug       = args.slug;
const R          = args.pluginRoot;                 // ${CLAUDE_PLUGIN_ROOT}
const execModel  = args.models.exec;
const evalModel  = args.models.eval;
const qaModel    = args.models.qa || args.models.exec;
const maxRounds  = args.budgets.maxRounds;
const attemptBudget = args.budgets.attemptBudget;

// --------------------------------------------------------------------------------------------
// SCHEMAS — the ONLY contract between this control script and the workers. The native runtime
// forces the worker's final message to validate against these, so every branch below reads a real
// typed field. This is the whole reason the courier disappears.
// --------------------------------------------------------------------------------------------
// A worker that ran a pipeline script reports its outcome as data (exit + the fields we branch on).
// The worker runs the command in ITS OWN shell — control never shells out.
const CMD = {
  type: "object",
  properties: { exit_code: { type: "integer" }, ok: { type: "boolean" }, detail: { type: "string" } },
  required: ["exit_code", "ok"],
};
const ORIENT = {
  type: "object",
  properties: {
    ok: { type: "boolean" }, artifact_written: { type: "boolean" },
    spiked_area: { type: "string" }, spike_result: { type: "string" },
    riskiest_unknowns: { type: "array", items: { type: "string" } },
  },
  required: ["ok", "artifact_written", "spiked_area", "spike_result"],
};
const PHASE_OK = {  // analyze / wire — "did the artifact land?"
  type: "object",
  properties: { ok: { type: "boolean" }, artifact_written: { type: "boolean" } },
  required: ["ok", "artifact_written"],
};
const MAPSCOPES = {
  type: "object",
  properties: {
    ok: { type: "boolean" }, artifact_written: { type: "boolean" },
    scopes: {
      type: "array",
      items: {
        type: "object",
        properties: { scope_id: { type: "string" }, path: { type: "string" } },
        required: ["scope_id", "path"],
      },
    },
  },
  required: ["ok", "artifact_written", "scopes"],
};
// One scope's whole attempt-ratchet, run INSIDE the worker leg (see buildScope). The worker loops
// build->T0 up to attemptBudget, ratcheting against the last kept trial, and reports the outcome.
const SCOPE_RESULT = {
  type: "object",
  properties: {
    scope_id: { type: "string" },
    green: { type: "boolean" },
    t0_artifact: { type: "string" },
    attempts_used: { type: "integer" },
    breaker: { type: "string", enum: ["none", "stagnation", "attempt_budget"] },
    reason: { type: "string" },
  },
  required: ["scope_id", "green", "attempts_used", "breaker"],
};
const EVAL = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    overall: { type: "string", enum: ["PASS", "FAIL"] },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, criterion: { type: "string" }, evidence: { type: "string" } },
        required: ["id", "criterion", "evidence"],
      },
    },
  },
  required: ["ok", "overall"],
};
const VERDICT_REFUTE = {
  type: "object",
  properties: { id: { type: "string" }, refuted: { type: "boolean" }, why: { type: "string" } },
  required: ["id", "refuted"],
};
const QA = { type: "object", properties: { ok: { type: "boolean" }, findings_count: { type: "integer" } }, required: ["ok", "findings_count"] };
const HAMMER = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    verdict: { type: "string", enum: ["ship-now", "ship-after-fixes", "cannot-ship"] },
    cut_list: { type: "array", items: { type: "string" } },
  },
  required: ["ok", "verdict", "cut_list"],
};
// The run-graph subgraph a resume reads back — replaces resume-state.mjs's directory walk. [ADD]
const SUBGRAPH = {
  type: "object",
  properties: {
    has_orient: { type: "boolean" }, has_spec_tree: { type: "boolean" },
    has_wiring: { type: "boolean" }, scopes: { type: "array", items: MAPSCOPES.properties.scopes.items },
    eval_rounds_done: { type: "array", items: { type: "integer" } },
    green_scope_ids: { type: "array", items: { type: "string" } },
    // context the phases need, sourced from the graph, not re-derived by a courier:
    intake_path: { type: "string" }, spec_folder: { type: "string" }, orient_dir: { type: "string" },
    project_profile: { type: "string" }, lens: { type: "string" }, stack: { type: "string" },
    eval_dimensions: { type: "array", items: { type: "string" } },
    run_cmd: { type: "string" }, app_url: { type: "string" },
  },
  required: ["has_orient", "has_spec_tree", "has_wiring", "scopes", "eval_rounds_done", "green_scope_ids"],
};

// --------------------------------------------------------------------------------------------
// DISPATCH HELPERS. Two shapes, both native, both courier-free.
//
//   worker()  — spawn a fresh sub-agent that runs a Skill worker via the envelope port and returns
//               a schema-validated report. This replaces the old compile-order -> Agent ->
//               ingest-result three-call dance AT THE SCRIPT LEVEL: the worker itself compiles its
//               order context from the graph, does the craft, and the REDUCE stage below applies
//               the result to the graph. (You can keep compile/ingest as scripts the worker calls;
//               the point is the control script no longer couriers them.)
//
//   reduce()  — the single writer. One sub-agent runs graph-reduce.mjs to append this phase's
//               nodes/edges to the run graph. It is the ONLY thing that mutates shared state,
//               exactly as ingest-result.mjs is today. [ADD graph-reduce.mjs]
// --------------------------------------------------------------------------------------------
const nullFail = (label) => ({ __failed: `${label}: sub-agent skipped, blocked, or died after retries` });

async function worker(skill, operation, payload, schema, phaseName, label, model = execModel, extra = "") {
  // The runtime returns null if the sub-agent is skipped/blocked/dies after retries. A null is a
  // NAMED failure, never a crash — every call site converts it to an aborted RunReturn member.
  const r = await agent(
    `Call Skill(shapeup-sdlc-plugin:${skill}) for operation "${operation}", slug "${slug}". ` +
    `Compile your WorkOrder from the run graph for this slug, do the work, and have ingest apply your ` +
    `WorkResult to the graph. ${extra} ` +
    `Payload: ${JSON.stringify(payload)}. ` +
    `Report back ONLY the fields the schema names — nothing else crosses this boundary.`,
    { model, phase: phaseName, label, schema, effort: "medium" },
  );
  return (r && typeof r === "object") ? r : nullFail(label);
}

// A mechanical pipeline command, run by a cheap worker in a real shell, reported as {exit_code,ok}.
// (Formerly a mech courier. Now: the worker runs it and returns typed fields — no stdout parsing.)
async function cmd(script, flags, phaseName, label) {
  const r = await agent(
    `Run exactly: node "${R}/${script}" ${flags}\n` +
    `Report its exit code as exit_code, ok=true iff exit_code===0, and one line of detail. ` +
    `Do not interpret or summarize the command's output beyond that.`,
    { model: "sonnet", effort: "low", phase: phaseName, label, schema: CMD },
  );
  return (r && typeof r === "object") ? r : { exit_code: -1, ok: false, detail: `${label}: no result` };
}

async function reduce(phaseKey, phaseName) {
  // The single-writer graph append for a completed phase. Fatal if it fails: shared state would
  // describe work that never landed. [ADD] graph-reduce.mjs reads results/ for <slug>,<phaseKey>.
  const r = await cmd("skills/tech-lead/scripts/graph-reduce.mjs", `--slug ${slug} --phase ${phaseKey}`, phaseName, `reduce:${phaseKey}`);
  return r.ok ? null : { status: "aborted", aborted_at: phaseKey.toUpperCase(), reason: `graph-reduce failed for ${phaseKey}: ${r.detail || `exit ${r.exit_code}`}` };
}

async function graphProbe() {
  // THE fast-forward — one bounded subgraph query, replacing resume-state.mjs's directory walk. [ADD]
  const r = await agent(
    `Run: node "${R}/skills/tech-lead/scripts/graph-query.mjs" --slug ${slug} --subgraph run\n` +
    `Return the run subgraph for this slug as the schema names it. If the graph has no node for ` +
    `this slug yet, return every boolean false and every array empty.`,
    { model: "sonnet", effort: "low", phase: "Orient", label: "graph-probe", schema: SUBGRAPH },
  );
  return (r && typeof r === "object") ? r : null;
}

// --------------------------------------------------------------------------------------------
// GATE RESOLUTION — unchanged convention: gate-answers.mjs exit code 0 cross / 4 pause / 5 abort.
// The decision string (loop|stop|run|skip|accept-cut-list) is what the worker reports in `detail`.
// --------------------------------------------------------------------------------------------
const PRESETS = new Set(["ci", "guarded", "interactive"]);
const answersFlag = (a) => (!a ? "" : PRESETS.has(a) ? `--preset ${a}` : `--file ${a}`);

async function gate(gateId, phaseName) {
  const r = await agent(
    `Run: node "${R}/skills/tech-lead/scripts/gate-answers.mjs" --resolve ${gateId} --slug ${slug} ${answersFlag(args.answers)}\n` +
    `Report exit_code, ok=(exit_code===0), and put the resolved decision string (e.g. loop|stop|run|` +
    `skip|accept-cut-list|proceed) in detail. Exit 4 = pause, exit 5 = abort.`,
    { model: "sonnet", effort: "low", phase: phaseName, label: `gate:${gateId}`, schema: CMD },
  );
  return (r && typeof r === "object") ? r : { exit_code: 5, ok: false, detail: "gate resolver returned no result" };
}

const TITLES = {
  L1a: "Orient Review", "L1a.5": "Wiring Review", L1b: "Board Review",
  L2: "Build Round Complete", L3: "Verdict & Loop", QA: "QA Edge Hunt", H: "Decide When to Stop",
};
const gateBlock = (g, ctx) =>
  [`⏸ GATE ${g} — ${TITLES[g] || g}`, ...Object.entries(ctx).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)].join("\n");
const paused   = (g, valid, ctx) => ({ status: "paused", paused_at: g, block: gateBlock(g, ctx), valid_decisions: valid, context: ctx });
const aborted  = (g, why) => ({ status: "aborted", aborted_at: g, reason: why });
const diedAt   = (g, r) => ({ status: "aborted", aborted_at: g, reason: r.__failed });

// A phase resolves through its gate: cross (proceed), pause (return), or abort (return).
async function crossGate(gateId, phaseName, validDecisions, ctx) {
  const g = await gate(gateId, phaseName);
  if (g.exit_code === 4) return { stop: paused(gateId, validDecisions, ctx) };
  if (g.exit_code === 5) return { stop: aborted(gateId, g.detail || `GATE ${gateId} aborted`) };
  return { decision: g.detail || "proceed" };
}

// =============================================================================================
// THE RUN
// =============================================================================================
phase("Orient");
const gx = await graphProbe();
if (!gx) return aborted("probe", "run graph could not be queried — refusing to re-dispatch a run that may be in progress");

// ---- ORIENT (step 7) + GATE L1a -------------------------------------------------------------
let spikedArea = "~", spikeResult = "~", riskiest = [];
if (!gx.has_orient) {
  log(`ORIENT — dispatching (slug ${slug})`);
  const o = await worker(
    "orient", "orient",
    { pitch: gx.intake_path, spec_folder: gx.spec_folder, feature: slug, stack: gx.stack },
    ORIENT, "Orient", "orient", execModel,
    "Read and spike real code before any board exists; write the orient/ artifacts.",
  );
  if (o.__failed) return diedAt("ORIENT", o);
  if (!o.artifact_written) return aborted("ORIENT", "orient produced no artifact on disk — the worker most likely could not complete; read its result, resolve, relaunch");
  const red = await reduce("orient", "Orient"); if (red) return red;
  spikedArea = o.spiked_area; spikeResult = o.spike_result; riskiest = o.riskiest_unknowns || [];
} else log("ORIENT — already in graph, skipping (fast-forward)");

{
  const g = await crossGate("L1a", "Orient", ["proceed", "ask", "abort"],
    { spiked_area: spikedArea, spike_result: spikeResult, riskiest_unknowns: riskiest });
  if (g.stop) return g.stop;
}

// ---- ANALYZE (spec tree + board) — runs AHEAD of WIRE (solution-architect needs the spec) -----
phase("Analyze");
if (!gx.has_spec_tree) {
  log(`ANALYZE — dispatching (slug ${slug})`);
  const a = await worker(
    "ba-pitch-analyzer", "analyze",
    { pitch: gx.intake_path, spec_folder: gx.spec_folder, feature: slug, lens: gx.lens, orient_dir: gx.orient_dir },
    PHASE_OK, "Analyze", "analyze", execModel,
    "Write the spec tree + board from the orient artifacts (no re-scan of code).",
  );
  if (a.__failed) return diedAt("ANALYZE", a);
  if (!a.artifact_written) return aborted("ANALYZE", "analyze produced no spec tree on disk");
  const red = await reduce("analyze", "Analyze"); if (red) return red;
} else log("ANALYZE — spec tree already in graph, skipping");

// ---- WIRE (step 7.5) + GATE L1a.5 -----------------------------------------------------------
phase("Wire");
if (!gx.has_wiring) {
  log(`WIRE — dispatching (slug ${slug})`);
  const w = await worker(
    "solution-architect", "wire",
    { feature: slug, spec_folder: gx.spec_folder, project_profile: gx.project_profile },
    PHASE_OK, "Wire", "wire", execModel,
    "Write the wiring map: per-UC engine -> seam -> entry-point call site -> affordance.",
  );
  if (w.__failed) return diedAt("WIRE", w);
  if (!w.artifact_written) return aborted("WIRE", "wire produced no wiring map on disk");
  const red = await reduce("wire", "Wire"); if (red) return red;
} else log("WIRE — wiring map already in graph, skipping");

{
  const g = await crossGate("L1a.5", "Wire", ["proceed", "ask", "abort"], { wiring_map: "written" });
  if (g.stop) return g.stop;
}

// ---- MAP SCOPES (step 8) + GATE L1b ---------------------------------------------------------
phase("MapScopes");
let scopes = gx.scopes || [];
if (scopes.length === 0) {
  log(`MAP SCOPES — dispatching (slug ${slug})`);
  const m = await worker(
    "scope-architect", "map-scopes", { feature: slug },
    MAPSCOPES, "MapScopes", "map-scopes", execModel,
    "Write scope contracts (substrate whitelists, fixtures) and report the riskiest-first sequence.",
  );
  if (m.__failed) return diedAt("MAP SCOPES", m);
  if (!m.artifact_written) return aborted("MAP SCOPES", "map-scopes produced no scope contracts on disk");
  const red = await reduce("map-scopes", "MapScopes"); if (red) return red;
  scopes = m.scopes;
} else log(`MAP SCOPES — ${scopes.length} scope(s) already in graph, skipping`);

// Advisory lints at L1b (unchanged): trace-lint + spec-lint (hard) + hill-derive.
const specLint = await cmd("skills/ba-pitch-analyzer/scripts/spec-lint.mjs", `--slug ${slug}`, "MapScopes", "spec-lint");
if (!specLint.ok) return aborted("L1b", `spec-lint reported a disjointness/size problem before BUILD: ${specLint.detail}`);
await cmd("skills/tech-lead/scripts/hill-derive.mjs", `--slug ${slug}`, "MapScopes", "hill-derive");

{
  const g = await crossGate("L1b", "MapScopes", ["proceed", "ask", "abort"], { scopes: scopes.map((s) => s.scope_id) });
  if (g.stop) return g.stop;
}

// =============================================================================================
// ROUNDS of BUILD(fan-out) -> L2 -> EVAL -> L3, bounded by maxRounds.
// =============================================================================================
let round = gx.eval_rounds_done.length ? Math.max(...gx.eval_rounds_done) + 1 : 1;
let verdict = null;
const allGreen = [...gx.green_scope_ids];
const allHammer = [];

while (round <= maxRounds) {
  // DEADLINE breaker (opt-in) — checked at each round boundary.
  const budget = await cmd("skills/tech-lead/scripts/budget-check.mjs", `--slug ${slug} --strict`, "Build", `budget:r${round}`);
  if (budget.exit_code === 6) {
    await cmd("skills/tech-lead/scripts/hill-derive.mjs", `--slug ${slug}`, "Build", "hill-derive");
    return { status: "gate_h", breaker: "deadline", hammer_proposals: allHammer, green_scopes: allGreen };
  }

  // ---- BUILD: FAN OUT over scopes (improvement 3). Each scope runs its own attempt-ratchet
  // inside buildScope, T0-verifies as it lands, worktree-isolated so parallel writes can't collide.
  // The pipeline has NO barrier: a fast scope verifies while a slow one is still on attempt 3.
  phase("Build");
  log(`BUILD round ${round} — ${scopes.length} scope(s) IN PARALLEL, attempt budget ${attemptBudget}`);

  // Skip scopes already green THIS round (resume from graph, no re-work).
  const greenThisRound = new Set(gx.eval_rounds_done.includes(round) ? gx.green_scope_ids : []);
  const todo = scopes.filter((s) => !greenThisRound.has(s.scope_id));

  const scopeResults = await pipeline(
    todo,
    // stage 1 — BUILD + ratchet, isolated per scope. [REQ] workers must be worktree-parallel-safe.
    (scope) => buildScope(scope, round),
    // stage 2 — apply this scope's result to the graph the moment it lands (single-writer reduce,
    // keyed to this scope so parallel reduces don't contend — your ingest is already the one writer).
    async (res, scope) => {
      if (!res || res.__failed) return res || nullFail(`build:${scope.scope_id}`);
      await cmd("skills/tech-lead/scripts/graph-reduce.mjs", `--slug ${slug} --phase build --scope ${scope.scope_id} --round ${round}`, "Verify", `reduce:${scope.scope_id}`); // [ADD]
      return res;
    },
  );

  const roundGreen = [], roundHammer = [];
  for (const r of scopeResults) {
    if (!r || r.__failed) continue;            // a dead builder is a spent attempt, not a dead run
    if (r.green) roundGreen.push(r.scope_id);
    else roundHammer.push(r.scope_id);
  }
  allGreen.push(...roundGreen);
  allHammer.push(...roundHammer);

  // INNER breaker: nothing green, something queued -> GATE H (census is scope-hammer's job).
  if (roundGreen.length === 0 && roundHammer.length > 0) {
    await cmd("skills/tech-lead/scripts/hill-derive.mjs", `--slug ${slug}`, "Build", "hill-derive");
    return { status: "gate_h", breaker: "inner", hammer_proposals: allHammer, green_scopes: allGreen };
  }

  await cmd("skills/tech-lead/scripts/hill-derive.mjs", `--slug ${slug}`, "Build", "hill-derive");
  {
    const g = await crossGate("L2", "Build", ["proceed", "ask", "abort"],
      { round, green_scopes: roundGreen, hammer_proposals: roundHammer });
    if (g.stop) return g.stop;
  }

  // ---- EVAL — one feature-level pass per round (unchanged single-judge invariant).
  phase("Eval");
  let findings = [];
  if (args.noEval) { log("EVAL — skipped (--no-eval)"); verdict = "pass"; }
  else {
    const e = await worker(
      "spec-evaluator", "evaluate",
      { dimensions: gx.eval_dimensions, run_cmd: gx.run_cmd, round },
      EVAL, "Eval", `eval:r${round}`, evalModel,
      "Evaluate the running feature against ALL acceptance criteria + Done-when. ONE feature-level pass.",
    );
    if (e.__failed) return diedAt("L3", e);
    const red = await reduce("evaluate", "Eval"); if (red) return red;
    verdict = e.overall === "PASS" ? "pass" : "fail";
    findings = e.findings || [];
  }

  // ---- REFUTE WAVE (improvement 5, opt-in) — each FAIL finding gets one independent skeptic
  // BEFORE it costs a fix round. A finding a refuter overturns is dropped from the next round's
  // work list. Perspective-diverse by prompt: the refuter is told to try to REFUTE, default to
  // "real" only when it cannot. Pure addition; off unless args.adversarialVerify.
  if (verdict === "fail" && args.adversarialVerify && findings.length) {
    phase("Refute");
    const checks = await parallel(findings.map((f) => () =>
      agent(
        `A single judge marked this acceptance criterion FAILED for slug "${slug}":\n` +
        `  criterion: ${f.criterion}\n  evidence: ${f.evidence}\n` +
        `Independently try to REFUTE the failure by exercising the running feature yourself. ` +
        `Return refuted=true ONLY if you can show it actually passes; otherwise refuted=false.`,
        { model: evalModel, phase: "Refute", label: `refute:${f.id}`, schema: VERDICT_REFUTE },
      )));
    const overturned = new Set(checks.filter(Boolean).filter((c) => c.refuted).map((c) => c.id));
    if (overturned.size) log(`REFUTE — ${overturned.size}/${findings.length} FAIL finding(s) overturned by an independent skeptic`);
    if (overturned.size === findings.length && findings.length) { verdict = "pass"; log("REFUTE — all findings overturned; treating round as PASS"); }
  }

  await cmd("skills/tech-lead/scripts/hill-derive.mjs", `--slug ${slug}`, "Eval", "hill-derive");
  const g3 = await crossGate("L3", "Eval", ["loop", "stop", "ask"], { round, verdict });
  if (g3.stop) return g3.stop;

  if (verdict === "pass") break;                         // -> QA -> GATE H -> ship
  if (g3.decision === "stop" || round >= maxRounds) {
    return { status: "gate_h", breaker: "outer", hammer_proposals: allHammer, green_scopes: allGreen };
  }
  round += 1;
}

if (verdict !== "pass") {
  return { status: "gate_h", breaker: "outer", hammer_proposals: allHammer, green_scopes: allGreen };
}

// ---- QA (post-PASS, pre-ship) — a level-up, never a gate. --no-qa answers it "skip". ---------
phase("QA");
let qaFindings = 0;
const qaG = await crossGate("QA", "QA", ["run", "skip", "ask"], { round, verdict });
if (qaG.stop) return qaG.stop;
if (qaG.decision === "run") {
  const q = await worker(
    "qa-edge-hunter", "hunt",
    { feature: slug, spec_folder: gx.spec_folder, app_url: gx.app_url, round },
    QA, "QA", "hunt", qaModel,
    "Exploratory hunt over the shipped feature. No verdict, no score — findings only.",
  );
  if (q.__failed) log(`QA hunt lost its worker: ${q.__failed} — shipping without QA findings (QA is a level-up)`);
  else { await reduce("hunt", "QA"); qaFindings = q.findings_count; }
}

// ---- GATE H — delegated to scope-hammer (census, baseline, cut list). -----------------------
phase("Ship");
const h = await worker(
  "scope-hammer", "hammer", { feature: slug },
  HAMMER, "Ship", "hammer", execModel,
  "Run the H0/H1/H2 census, baseline comparison, and cut list.",
);
if (h.__failed) return diedAt("H", h);
const redH = await reduce("hammer", "Ship"); if (redH) return redH;
if (h.verdict === "cannot-ship") return aborted("H", `scope-hammer: CANNOT SHIP — ${h.cut_list.join(", ") || "a must-have failed"}`);

{
  const g = await crossGate("H", "Ship", ["accept-cut-list", "ship-all", "ask"], { verdict: h.verdict, cut_list: h.cut_list });
  if (g.stop) return g.stop;
}

const ship = await cmd("skills/tech-lead/scripts/ship-report.mjs",
  `--slug ${slug} --verdict PASS --qa ${qaG.decision === "run" ? "run" : "skipped"}`, "Ship", "ship-report");

// Dimensions this evaluator ships, so GATE L4 can say what "shipped" did NOT cover.
const ALL_DIMS = ["spec-conformance", "tdd-surface", "integration", "completeness", "test-surface-conformance", "security", "performance"];
const dims_not_evaluated = ALL_DIMS.filter((d) => !(gx.eval_dimensions || []).includes(d));

return {
  status: "shipped",
  verdict: "pass",
  rounds_used: round,
  dims_not_evaluated,
  qa_findings: qaFindings,
  report: ship.detail || `shapeup/${slug}/REPORT.md`,
};

// =============================================================================================
// buildScope — ONE scope's full attempt-ratchet, run as a single worker leg so it fans out cleanly
// in the pipeline above. The ratchet lives HERE (inside the worker's own shell) rather than in the
// control script, because each attempt is build -> T0-verify and both need a real filesystem +
// git. The worker reports only the outcome the round loop branches on.
//
// [REQ] For true parallelism the task-executor + T0 must be worktree-parallel-safe: isolation:
// 'worktree' gives each scope its own checkout, so the old manual `git checkout <scope.branch>`
// and the shared active-scope pointer are no longer needed — the worktree IS the isolation, and
// the sandbox-guard hook still holds each worker to its scope's substrate whitelist.
// =============================================================================================
async function buildScope(scope, roundNo) {
  return worker(
    "task-executor", "execute",
    { scope_path: scope.path, scope_id: scope.scope_id, round: roundNo, attempt_budget: attemptBudget },
    SCOPE_RESULT, "Build", `build:${scope.scope_id}-r${roundNo}`, execModel,
    `Run the attempt ratchet for THIS scope only: up to ${attemptBudget} attempts of implement -> ` +
    `t0-verify, each scored against the last kept trial; stop on the first green T0 or when the ` +
    `attempt budget / stagnation breaker trips. Report green, attempts_used, the breaker, and the ` +
    `T0 artifact path. Write only inside this scope's substrate whitelist.`,
  );
}
// [note] isolation:'worktree' is requested per-scope by passing { isolation: 'worktree' } to the
// agent() call inside worker() when phaseName === "Build". Omitted from the shared helper to keep
// the non-build dispatches in-tree; add a param when you wire worktree isolation on.
