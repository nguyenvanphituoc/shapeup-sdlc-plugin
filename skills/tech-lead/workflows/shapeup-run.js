// shapeup-run — the outer BUILD-phase pipeline as a Workflow (v1.0 pure-skill architecture,
// C1-C6, docs/workflow_architecture_design.md). Stage 2 of the tech-lead-orchestrator ->
// Workflow migration (docs/workflow_migration_plan.md, docs/workflow_extraction_review.md §6
// Stage 2). This is the ship gate of the cutover: once this file and the thin SKILL.md exist,
// BOTH the unattended lane (this file launched headlessly) and the interactive lane (this file
// paused and relaunched at every gate a human answers) run the SAME code — there is no longer a
// prose runbook that can drift from what actually executes.
//
// WHAT THIS FILE OWNS.
//   ORIENT -> GATE L1a -> WIRE -> GATE L1a.5 -> MAP SCOPES -> GATE L1b ->
//   rounds of (BUILD -> GATE L2 -> EVAL -> GATE L3) bounded by budgets.maxRounds ->
//   QA -> GATE H -> ship-report -> { status: "shipped", ... }
// Every worker dispatch is the SAME four-call shape used throughout this codebase (C4, the
// envelope port) and by shapeup-build-round.js (Stage 1): compile-order --operation <op> ->
// Agent (fresh subagent, schema-forced report) -> ingest-result. The operation vocabulary and
// worker ownership are the central registry's (domain.schema.json $defs/Operation) — this file
// never re-derives which worker owns which operation; it just names the operation.
//
// WHY THE ROUND LOOP IS INLINED HERE RATHER THAN CALLING shapeup-build-round.js.
// The migration plan's own Stage 2 sketch leaves this open ("shapeup-build-round-equivalent
// inline or via workflow() child"). This file inlines it, deliberately: shapeup-build-round.js
// (Stage 1) always attempts every scope in `args.scopes` from attempt 1, with no awareness of
// what a PRIOR invocation already finished — correct for a round dispatched exactly once, wrong
// for an outer loop that must survive a mid-BUILD kill and resume without re-work (this
// migration's own kill/resume probe, docs/migration/stage2-evidence.md). The loop below adds
// exactly one thing shapeup-build-round.js does not have: before opening a scope's attempt loop,
// it asks whether THIS ROUND already has a green T0 verdict for that scope on disk, and skips
// the scope entirely when it does. Nothing else about the per-attempt mechanics differs from
// Stage 1's own verified design (docs/migration/stage1-evidence.md) — same mech()/dispatch
// shapes, same ratchet discipline, same inner-breaker semantics.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO (documented simplifications, not silent gaps — the
// same posture Stage 1 took for ESCALATE/advisor-protocol, which shapeup-build-round.js also
// does not dispatch):
//   - No mid-round ESCALATE adjudication (advisor-protocol) and no discovered-task reconciliation
//     mid-BUILD. Both remain the prose-only path in references/round-protocol.md and
//     references/delegation.md §3b — non-regression for a spec whose workers never escalate or
//     discover mid-attempt, which is the shape of every fixture this migration's own verification
//     runs use. A future stage can add them the same way this file adds anything else: a fresh
//     dispatch + a branch on its schema-forced report.
//   - No QA `--recheck` promoted-item loop (round-protocol.md "QA edge hunt"): QA runs once after
//     the first PASS; its findings are reported as a count for GATE H's census, never re-probed
//     inside this run. Promoting a finding to a fix round is a decision only a live PO makes, and
//     a headless lane (`ci`/`guarded`) never promotes — this is the common path both benchmark
//     lanes exercise.
//   - The `tiny` lane and pre-scope-contract specs are OUT OF SCOPE for this file, exactly as for
//     shapeup-build-round.js — see that file's own banner. SKILL.md's Hard Rules / tiny-lane.md
//     keep the prose path for those, verbatim, non-regression.
//   - This file does not append rows to the committed `round-ledger.md` (references/state-model.md
//     "Two ledgers") on a gate crossing — a gap it inherits unchanged from shapeup-build-round.js
//     (Stage 1 also never wrote that ledger). `gate-answers.mjs`'s own resolution IS the audit
//     record (source + authorized_by on every resolved gate, readable from `decisions.jsonl` and
//     the gate's own JSON output); promoting that into a committed per-run ledger row is follow-on
//     work, not a Stage 2 regression.
//
// args (RunArgs, domain.schema.json $defs/RunArgs — the central-registry shape; this file
// validates its own subset in code, no runtime schema check at the C1 boundary itself):
//   slug          string   the feature slug this run builds (a receipt for it must already exist
//                          — tech-lead's init-run.mjs, GATE L0.1, runs BEFORE this launch)
//   autoLevel     string   interactive | auto | unattended
//   answers       string   gate-answers preset name ("ci"|"guarded"|"interactive") or a path
//   models        object   { exec, eval, qa? } — sonnet-or-above only (D5 floor)
//   budgets       object   { maxRounds, attemptBudget, wallClockS? } — the three-level breaker
//   pluginRoot    string   ${CLAUDE_PLUGIN_ROOT} — the only thing this file ever roots a path in
//   startedAt     string   ISO timestamp (Date.now() is unavailable in-script by design)
//
// return (RunReturn, domain.schema.json $defs/RunReturn) — the FULL union this file can produce:
//   { status: "shipped", verdict: "pass", rounds_used, dims_not_evaluated, qa_findings, report }
//   { status: "paused", paused_at, block, valid_decisions, context }
//   { status: "aborted", aborted_at, reason }
//   { status: "gate_h", breaker: "outer"|"inner"|"deadline", hammer_proposals, green_scopes }

export const meta = {
  name: "shapeup-run",
  description: "The outer BUILD-phase pipeline: ORIENT -> WIRE -> MAP SCOPES -> rounds of BUILD/EVAL -> QA -> GATE H -> ship-report. Every gate resolves via gate-answers.mjs exit codes (0 cross / 4 pause / 5 abort); a pause returns and a relaunch fast-forwards from disk, never from memory.",
  phases: [
    { title: "Orient" }, { title: "Wire" }, { title: "MapScopes" },
    { title: "Build" }, { title: "Eval" }, { title: "QA" }, { title: "Ship" },
  ],
};

// Some callers hand `args` through as a JSON-encoded string rather than the object itself
// (measured against the real Workflow runtime during shapeup-build-round.js's own Stage 1
// verification — docs/migration/stage1-evidence.md). Normalize once, defensively.
if (typeof args === "string") {
  try { args = JSON.parse(args); } catch { args = {}; }
}

// ---------------------------------------------------------------------------------------------
// The model floor (D5). Allowlist, not a denylist — see shapeup-build-round.js's banner for why.
// ---------------------------------------------------------------------------------------------
const MODEL_FLOOR_ALLOWED = new Set(["sonnet", "opus"]);
const belowFloor = (m) => !MODEL_FLOOR_ALLOWED.has(String(m || "").toLowerCase());

// ---------------------------------------------------------------------------------------------
// Argument validation — this file's own job for the round-scoped subset it reads (mirrors
// shapeup-build-round.js). A malformed launch aborts before a single agent() is spent.
// ---------------------------------------------------------------------------------------------
function validateArgs(a) {
  const problems = [];
  for (const k of ["slug", "autoLevel", "models", "budgets", "pluginRoot", "startedAt"]) {
    if (a[k] === undefined || a[k] === null || a[k] === "") problems.push(`missing args.${k}`);
  }
  if (!["interactive", "auto", "unattended"].includes(a.autoLevel)) {
    problems.push(`args.autoLevel="${a.autoLevel}" must be interactive|auto|unattended`);
  }
  if (a.budgets && (!a.budgets.maxRounds || !a.budgets.attemptBudget)) {
    problems.push("args.budgets must carry maxRounds and attemptBudget");
  }
  if (a.models) {
    for (const role of ["exec", "eval"]) {
      if (belowFloor(a.models[role])) {
        problems.push(`args.models.${role}="${a.models[role]}" is below the model floor (D5) — sonnet or above only`);
      }
    }
    if (a.models.qa !== undefined && belowFloor(a.models.qa)) {
      problems.push(`args.models.qa="${a.models.qa}" is below the model floor (D5) — sonnet or above only`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// C2 — the mechanical channel (design doc §2). Identical shape to shapeup-build-round.js: one
// helper, one schema, sonnet — the D5 floor — on every call including this courier.
// ---------------------------------------------------------------------------------------------
const MECH_SCHEMA = {
  type: "object",
  properties: {
    exit_code: { type: "integer" },
    stdout: { type: "string" },
    stderr: { type: "string" },
  },
  required: ["exit_code", "stdout", "stderr"],
};

const mech = (cmd, label) => agent(
  "Run exactly this command, change nothing about it, and report its outcome as data: the exit " +
  "code, everything printed to stdout, and everything printed to stderr, verbatim, byte for " +
  `byte. Do not summarize, do not truncate, do not interpret it.\n\n${cmd}`,
  { model: "sonnet", effort: "low", schema: MECH_SCHEMA, phase: "Orient", label: String(label || cmd).slice(0, 40) },
);

// A workflow script has no filesystem of its own (design doc §1). Every path fact this file
// needs comes from a `${args.pluginRoot}`-rooted node one-liner that imports the SAME
// lib/paths.mjs the rest of the harness uses, never a storage-root literal typed here (test-#45
// discipline, extended — 16-workflows.mjs enforces this mechanically over every file in this
// directory). The one-liner is wrapped in a double-quoted shell argument so every JS string
// literal INSIDE it can use single quotes with no escaping (the pattern shapeup-build-round.js's
// writeActiveScope already verified against the real runtime).
const mechNode = (statements, label) => mech(
  `node --input-type=module -e "${statements.join("")}"`,
  label,
);

// ---------------------------------------------------------------------------------------------
// The one-time probe: every path/status fact this file needs, in one courier call, resolved
// entirely through lib/paths.mjs imports (never a literal here). Re-run at the top of the run
// (fresh or relaunch alike) — this IS the fast-forward derivation (design doc §4): "jump to the
// first phase whose artifacts are incomplete", read from files, never from memory.
// ---------------------------------------------------------------------------------------------
async function probe(slug) {
  const r = await mechNode([
    `import { existsSync, readdirSync, readFileSync } from 'node:fs';`,
    `import { intake, harnessRun, wiringMap, projectProfile, scopesDir, resultsDir, ordersDir } `,
    `  from '${args.pluginRoot}/skills/tech-lead/scripts/lib/paths.mjs';`,
    `const cwd = process.cwd(); const slug = '${slug}';`,
    `function fm(t) { const m = /^---\\n([\\s\\S]*?)\\n---/.exec(t || ''); if (!m) return {}; `,
    `  const o = {}; for (const l of m[1].split('\\n')) { const kv = /^([A-Za-z_][\\w-]*):\\s*(.*)$/.exec(l.trim()); `,
    `  if (kv) o[kv[1]] = kv[2].replace(/^['\\x22]|['\\x22]$/g, ''); } return o; }`,
    `const hrPath = harnessRun(cwd, slug);`,
    `const hr = existsSync(hrPath) ? fm(readFileSync(hrPath, 'utf8')) : {};`,
    `const scopeFiles = existsSync(scopesDir(cwd, slug)) `,
    `  ? readdirSync(scopesDir(cwd, slug)).filter((f) => f.endsWith('.md')).sort() : [];`,
    `const resultFiles = existsSync(resultsDir(cwd, slug)) ? readdirSync(resultsDir(cwd, slug)) : [];`,
    `const orderFiles = existsSync(ordersDir(cwd, slug)) ? readdirSync(ordersDir(cwd, slug)) : [];`,
    `console.log(JSON.stringify({`,
    `  intake_path: intake(cwd, slug), spec_folder: hr.spec_folder || null, status: hr.status || null,`,
    `  has_wiring_map: existsSync(wiringMap(cwd, slug)), project_profile_path: projectProfile(cwd, slug),`,
    `  has_project_profile: existsSync(projectProfile(cwd, slug)), scope_files: scopeFiles,`,
    `  pending_orders: orderFiles.filter((f) => f.endsWith('.json') && !resultFiles.includes(f)),`,
    `  eval_rounds_done: resultFiles.filter((f) => /^evaluate-r\\d+\\.json$/.test(f)).map((f) => Number(f.match(/\\d+/)[0])),`,
    `}));`,
  ], "probe");
  try { return JSON.parse(r.stdout); } catch { return {}; }
}

/** Has this scope already reached T0-green for THIS round? Files only, never memory — the one
 * piece of resumability shapeup-build-round.js's own attempt loop does not have (see banner).
 * Returns { green, path } so a resumed round can still cite the pre-kill T0 artifact at EVAL. */
async function checkScopeGreen(slug, scopeId, round) {
  const r = await mechNode([
    `import { existsSync, readdirSync, readFileSync } from 'node:fs';`,
    `import { verdictsDir } from '${args.pluginRoot}/skills/tech-lead/scripts/lib/paths.mjs';`,
    `const dir = verdictsDir(process.cwd(), '${slug}');`,
    `let green = false; let path = null;`,
    `if (existsSync(dir)) { for (const f of readdirSync(dir)) { if (!f.endsWith('.json')) continue; `,
    `  const fp = dir + '/' + f;`,
    `  try { const b = JSON.parse(readFileSync(fp, 'utf8')); `,
    `  if (b.scope_id === '${scopeId}' && b.round === ${round} && b.overall === 'green') { green = true; path = fp; break; } } catch {} } }`,
    `console.log(JSON.stringify({ green, path }));`,
  ], `t0check:${scopeId}-r${round}`);
  try { return JSON.parse(r.stdout); } catch { return { green: false, path: null }; }
}

const setRunStatus = (slug, status) => mechNode([
  `import { readFileSync, writeFileSync } from 'node:fs';`,
  `import { harnessRun } from '${args.pluginRoot}/skills/tech-lead/scripts/lib/paths.mjs';`,
  `const p = harnessRun(process.cwd(), '${slug}');`,
  `const body = readFileSync(p, 'utf8').replace(/^status:.*$/m, 'status: ${status}');`,
  `writeFileSync(p, body); console.log('ok');`,
], `status:${status}`);

// ---------------------------------------------------------------------------------------------
// The uniform dispatch shape (C3/C4) — identical structure for every worker in the Operation
// vocabulary (domain.schema.json $defs/Operation): compile an order, dispatch a fresh agent that
// reports back a schema-forced subset of what it wrote, ingest the result. The schema is the
// only thing that varies per worker — it is what a gate needs to know, nothing more (the
// zero-memory-handoff boundary, PA6: the prompt below carries only the order path).
// ---------------------------------------------------------------------------------------------
const compile = (flags, label) => mech(
  `node "${args.pluginRoot}/skills/tech-lead/scripts/compile-order.mjs" ${flags}`,
  label,
);
const ingest = (resultPath, label) => mech(
  `node "${args.pluginRoot}/skills/tech-lead/scripts/ingest-result.mjs" ${resultPath}`,
  label,
);
const dispatch = (skill, orderPath, model, phase, label, schema, extra) => agent(
  `Call Skill(shapeup-sdlc-plugin:${skill}) --order ${orderPath}. ${extra || ""} ` +
  "Report back exactly the fields requested — nothing else travels outside the order/result files.",
  { model, phase, label, schema },
);

const ORIENT_SCHEMA = {
  type: "object",
  properties: {
    result_path: { type: "string" },
    spiked_area: { type: "string" },
    spike_result: { type: "string" },
    riskiest_unknowns: { type: "array", items: { type: "string" } },
  },
  required: ["result_path", "spiked_area", "spike_result"],
};
const RESULT_ONLY_SCHEMA = { type: "object", properties: { result_path: { type: "string" } }, required: ["result_path"] };
const MAPSCOPES_SCHEMA = {
  type: "object",
  properties: {
    result_path: { type: "string" },
    scopes: { type: "array", items: { type: "object", properties: { scope_id: { type: "string" }, path: { type: "string" } }, required: ["scope_id", "path"] } },
  },
  required: ["result_path", "scopes"],
};
const QA_SCHEMA = {
  type: "object",
  properties: { result_path: { type: "string" }, findings_count: { type: "integer" } },
  required: ["result_path", "findings_count"],
};
const HAMMER_SCHEMA = {
  type: "object",
  properties: {
    result_path: { type: "string" },
    verdict: { type: "string", enum: ["ship-now", "ship-after-fixes", "cannot-ship"] },
    cut_list: { type: "array", items: { type: "string" } },
  },
  required: ["result_path", "verdict", "cut_list"],
};

// ---------------------------------------------------------------------------------------------
// Gate resolution — every gate crosses through gate-answers.mjs's exit code (0 cross / 4 pause /
// 5 abort), identical convention to shapeup-build-round.js.
// ---------------------------------------------------------------------------------------------
const PRESET_NAMES = new Set(["ci", "guarded", "interactive"]);
const answersFlag = (answers) => (!answers ? "" : (PRESET_NAMES.has(answers) ? `--preset ${answers}` : `--file ${answers}`));

const resolveGate = (slug, answers, gate) => mech(
  `node "${args.pluginRoot}/skills/tech-lead/scripts/gate-answers.mjs" --resolve ${gate} --slug ${slug} ${answersFlag(answers)}`.trim(),
  `gate:${gate}`,
);
const GATE_TITLES = {
  L1a: "Orient Review", "L1a.5": "Wiring Review", L1b: "Board Review",
  L2: "Build Round Complete", L3: "Verdict & Loop", QA: "QA Edge Hunt", H: "Decide When to Stop",
};
const gateBlock = (gate, ctx) => [
  `⏸ GATE ${gate} — ${GATE_TITLES[gate] || gate}`,
  ...Object.entries(ctx).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
].join("\n");
const paused = (gate, valid_decisions, ctx) => ({ status: "paused", paused_at: gate, block: gateBlock(gate, ctx), valid_decisions, context: ctx });
const abortedFrom = (gate, resolved, fallback) => {
  let reason = resolved.stderr.trim() || fallback;
  try { reason = JSON.parse(resolved.stdout).reason || reason; } catch { /* keep fallback */ }
  return { status: "aborted", aborted_at: gate, reason };
};

// =================================================================================================
// The run.
// =================================================================================================

const argProblems = validateArgs(args);
if (argProblems.length) {
  return { status: "aborted", aborted_at: "args", reason: `shapeup-run: ${argProblems.join("; ")}` };
}

const slug = args.slug;
const qaModel = args.models.qa || args.models.exec;
const allHammerProposals = [];
const allGreenScopes = [];
let dispatchedOrient = false, dispatchedWire = false, dispatchedMapScopes = false;

phase("Orient");
const facts = await probe(slug);

// ---------------------------------------------------------------------------------------------
// ORIENT (step 7) + GATE L1a — skipped when orient/ already produced its four artifacts for a
// PRIOR call this run (fast-forward: never re-dispatch a phase whose artifacts already exist).
// ---------------------------------------------------------------------------------------------
let spikedArea = "~", spikeResult = "~", riskiestUnknowns = [];
if (facts.status === null || facts.status === "orienting") {
  log(`ORIENT — dispatching (slug ${slug})`);
  const orientOrder = await compile(
    `--operation orient --slug ${slug} --payload '${JSON.stringify({ pitch: facts.intake_path, spec_folder: facts.spec_folder, feature: slug })}'`,
    "compile:orient",
  );
  const orientResult = await dispatch(
    "orient", orientOrder.stdout.trim(), args.models.exec, "Orient", "orient",
    ORIENT_SCHEMA, "Read/spike real code before any board exists; write the orient/ artifacts.",
  );
  await ingest(orientResult.result_path, "ingest:orient");
  spikedArea = orientResult.spiked_area; spikeResult = orientResult.spike_result;
  riskiestUnknowns = orientResult.riskiest_unknowns || [];
  dispatchedOrient = true;
  await setRunStatus(slug, "mapping");
} else {
  log("ORIENT — artifacts already present, skipping dispatch (fast-forward)");
}

const l1a = await resolveGate(slug, args.answers, "L1a");
if (l1a.exit_code === 4) return paused("L1a", ["proceed", "ask", "abort"], { spiked_area: spikedArea, spike_result: spikeResult, riskiest_unknowns: riskiestUnknowns, dispatched: dispatchedOrient });
if (l1a.exit_code === 5) return abortedFrom("L1a", l1a, "GATE L1a aborted");

// ---------------------------------------------------------------------------------------------
// WIRE (step 7.5) + GATE L1a.5 — project-profile.md is written by tech-lead itself at GATE L0,
// BEFORE this launch (gates.md "WIRE" step 1: "you write it at L0 — compile-order stays
// pipeline-blind"); this file only dispatches solution-architect and checks trace-lint.
// ---------------------------------------------------------------------------------------------
phase("Wire");
let seamCoverage = "n/a";
if (!facts.has_wiring_map) {
  log(`WIRE — dispatching (slug ${slug})`);
  const wireOrder = await compile(
    `--operation wire --slug ${slug} --payload '${JSON.stringify({ feature: slug, spec_folder: facts.spec_folder, project_profile: facts.project_profile_path })}'`,
    "compile:wire",
  );
  const wireResult = await dispatch(
    "solution-architect", wireOrder.stdout.trim(), args.models.exec, "Wire", "wire",
    RESULT_ONLY_SCHEMA, "Write the wiring map: per-UC engine -> seam -> entry-point call site -> affordance.",
  );
  await ingest(wireResult.result_path, "ingest:wire");
  dispatchedWire = true;
} else {
  log("WIRE — wiring-map.md already present, skipping dispatch (fast-forward)");
}
const traceLint = await mech(`node "${args.pluginRoot}/skills/tech-lead/scripts/trace-lint.mjs" --slug ${slug}`, "trace-lint");
seamCoverage = traceLint.stdout.includes("🟢 green") ? "green" : "red (advisory)";

const l1a5 = await resolveGate(slug, args.answers, "L1a.5");
if (l1a5.exit_code === 4) return paused("L1a.5", ["proceed", "ask", "abort"], { seam_coverage: seamCoverage, dispatched: dispatchedWire });
if (l1a5.exit_code === 5) return abortedFrom("L1a.5", l1a5, "GATE L1a.5 aborted");

// ---------------------------------------------------------------------------------------------
// MAP SCOPES (step 8) + GATE L1b — two dispatches, one gate. scope-architect reports back the
// riskiest-first sequence it computed (its own authority — this file never re-derives ordering
// on a fresh run). On fast-forward past this phase, the ordering is re-derived from the scope
// files already on disk (alphabetical — a documented approximation; scope CORRECTNESS is
// unaffected, only sequencing quality on a resumed run).
// ---------------------------------------------------------------------------------------------
phase("MapScopes");
let scopes = facts.scope_files.map((f) => ({ scope_id: f.replace(/\.md$/, ""), path: f }));
if (scopes.length === 0) {
  log(`MAP SCOPES — dispatching (slug ${slug})`);
  const analyzeOrder = await compile(
    `--operation analyze --slug ${slug} --payload '${JSON.stringify({ pitch: facts.intake_path, spec_folder: facts.spec_folder, feature: slug })}'`,
    "compile:analyze",
  );
  const analyzeResult = await dispatch(
    "ba-pitch-analyzer", analyzeOrder.stdout.trim(), args.models.exec, "MapScopes", "analyze",
    RESULT_ONLY_SCHEMA, "Write the spec tree + board from the orient artifacts (no re-scan).",
  );
  await ingest(analyzeResult.result_path, "ingest:analyze");

  const mapScopesOrder = await compile(`--operation map-scopes --slug ${slug}`, "compile:map-scopes");
  const mapScopesResult = await dispatch(
    "scope-architect", mapScopesOrder.stdout.trim(), args.models.exec, "MapScopes", "map-scopes",
    MAPSCOPES_SCHEMA, "Write the scope contracts (substrate whitelists, fixtures) and report the riskiest-first build sequence.",
  );
  await ingest(mapScopesResult.result_path, "ingest:map-scopes");
  scopes = mapScopesResult.scopes;
  dispatchedMapScopes = true;
} else {
  log(`MAP SCOPES — ${scopes.length} scope contract(s) already present, skipping dispatch (fast-forward)`);
}

const specLint = await mech(`node "${args.pluginRoot}/skills/ba-pitch-analyzer/scripts/spec-lint.mjs" --slug ${slug}`, "spec-lint");
if (specLint.exit_code !== 0) {
  return { status: "aborted", aborted_at: "L1b", reason: `spec-lint reported a disjointness/size problem before BUILD could start: ${specLint.stdout.trim() || specLint.stderr.trim()}` };
}

const l1b = await resolveGate(slug, args.answers, "L1b");
if (l1b.exit_code === 4) return paused("L1b", ["proceed", "ask", "abort"], { scopes: scopes.map((s) => s.scope_id), dispatched: dispatchedMapScopes });
if (l1b.exit_code === 5) return abortedFrom("L1b", l1b, "GATE L1b aborted");
if (dispatchedMapScopes) await setRunStatus(slug, "building");

// ---------------------------------------------------------------------------------------------
// Rounds of BUILD -> GATE L2 -> EVAL -> GATE L3, bounded by budgets.maxRounds (the OUTER
// breaker) with budget-check.mjs consulted at every round boundary (the DEADLINE breaker).
// ---------------------------------------------------------------------------------------------
phase("Build");
let round = facts.eval_rounds_done.length ? Math.max(...facts.eval_rounds_done) + 1 : 1;
let verdict = null;

while (round <= args.budgets.maxRounds) {
  const budget = await mech(`node "${args.pluginRoot}/skills/tech-lead/scripts/budget-check.mjs" --slug ${slug} --strict`, `budget:r${round}`);
  if (budget.exit_code === 6) {
    return { status: "gate_h", breaker: "deadline", hammer_proposals: allHammerProposals, green_scopes: allGreenScopes };
  }

  log(`BUILD round ${round} — ${scopes.length} scope(s), attempt budget ${args.budgets.attemptBudget}`);
  const roundGreen = [];
  const roundHammer = [];
  const roundT0Artifacts = [];

  for (const scope of scopes) {
    const already = await checkScopeGreen(slug, scope.scope_id, round);
    if (already.green) {
      log(`scope ${scope.scope_id} — already T0-green this round (resumed from disk, no re-work)`);
      roundGreen.push(scope.scope_id);
      if (already.path) roundT0Artifacts.push(already.path);
      continue;
    }

    log(`scope ${scope.scope_id} — starting attempt loop (budget ${args.budgets.attemptBudget})`);
    if (scope.branch) await mech(`git checkout ${scope.branch}`, `checkout:${scope.scope_id}`);
    await mechNode([
      `import { activeScope } from '${args.pluginRoot}/skills/tech-lead/scripts/lib/paths.mjs';`,
      `import { mkdirSync, writeFileSync } from 'node:fs'; import { dirname } from 'node:path';`,
      `const p = activeScope(process.cwd()); mkdirSync(dirname(p), { recursive: true });`,
      `writeFileSync(p, JSON.stringify({ slug: '${slug}', scope_id: '${scope.scope_id}' }, null, 2) + '\\n');`,
      `console.log(p);`,
    ], `active-scope:${scope.scope_id}`);

    let green = false, stagnant = false, lastT0Path = null;
    for (let attempt = 1; attempt <= args.budgets.attemptBudget && !green; attempt++) {
      const compiled = await compile(`--scope ${scope.path} --round ${round} --attempt ${attempt}`, `compile:${scope.scope_id}-a${attempt}`);
      if (compiled.stderr.includes('"breaker":"stagnation"') || compiled.exit_code !== 0) {
        log(`scope ${scope.scope_id} — inner breaker on attempt ${attempt}: ${(compiled.stderr || `exit ${compiled.exit_code}`).trim()}`);
        stagnant = true;
        break;
      }
      const orderPath = compiled.stdout.trim();
      // t0-verify.mjs's own default --out lands verdicts in the SHARED tree next to the scope
      // contract; the LOCAL (.shapeup/) tree is derived from compile-order's own stdout, never
      // spelled out here (the same fix shapeup-build-round.js's Stage 1 verification found —
      // docs/migration/stage1-evidence.md).
      const localRoot = orderPath.slice(0, orderPath.lastIndexOf("/orders/"));
      const built = await dispatch(
        "task-executor", orderPath, args.models.exec, "Build", `build:${scope.scope_id}-a${attempt}`,
        RESULT_ONLY_SCHEMA, "Implement the order's acceptance criteria exactly.",
      );
      await ingest(built.result_path, `ingest:${scope.scope_id}-a${attempt}`);
      const t0 = await mech(
        `node "${args.pluginRoot}/skills/tech-lead/scripts/t0-verify.mjs" ${scope.path} --round ${round} --attempt ${attempt} --out "${localRoot}" --no-seesaw`,
        `t0:${scope.scope_id}-a${attempt}`,
      );
      let v = null;
      try { v = JSON.parse(t0.stdout); } catch { /* an unparsable T0 report is a red, never a crash-the-loop */ }
      green = v?.overall === "green";
      if (v?.path) lastT0Path = v.path;
    }

    if (green) { roundGreen.push(scope.scope_id); if (lastT0Path) roundT0Artifacts.push(lastT0Path); log(`scope ${scope.scope_id} — T0 green`); }
    else {
      roundHammer.push({ scope_id: scope.scope_id, t0_artifact: lastT0Path, reason: stagnant ? "stagnation breaker" : "attempt_budget exhausted without a green T0" });
      log(`scope ${scope.scope_id} — inner breaker tripped, queued a GATE H proposal`);
    }
  }

  allGreenScopes.push(...roundGreen);
  allHammerProposals.push(...roundHammer.map((h) => h.scope_id));

  if (roundGreen.length === 0 && roundHammer.length > 0) {
    return { status: "gate_h", breaker: "inner", hammer_proposals: allHammerProposals, green_scopes: allGreenScopes };
  }

  const l2 = await resolveGate(slug, args.answers, "L2");
  if (l2.exit_code === 4) return paused("L2", ["proceed", "ask", "abort"], { round, green_scopes: roundGreen, hammer_proposals: roundHammer.map((h) => h.scope_id) });
  if (l2.exit_code === 5) return abortedFrom("L2", l2, "GATE L2 aborted");

  phase("Eval");
  await setRunStatus(slug, "evaluating");
  const evalOrder = await compile(
    `--operation evaluate --slug ${slug} --round ${round} --payload '${JSON.stringify({ dimensions: ["spec-conformance"], t0_artifacts: roundT0Artifacts })}'`,
    `compile:evaluate-r${round}`,
  );
  const EVAL_SCHEMA = { type: "object", properties: { result_path: { type: "string" }, overall: { type: "string", enum: ["PASS", "FAIL"] } }, required: ["result_path", "overall"] };
  const evalResult = await dispatch(
    "spec-evaluator", evalOrder.stdout.trim(), args.models.eval, "Eval", `eval:r${round}`,
    EVAL_SCHEMA, "Evaluate the running feature against ALL acceptance criteria + Done-when. ONE feature-level pass.",
  );
  await ingest(evalResult.result_path, `ingest:evaluate-r${round}`);
  verdict = evalResult.overall === "PASS" ? "pass" : "fail";

  const l3 = await resolveGate(slug, args.answers, "L3");
  if (l3.exit_code === 4) return paused("L3", ["loop", "stop", "ask"], { round, verdict, hammer_proposals: allHammerProposals });
  if (l3.exit_code === 5) return abortedFrom("L3", l3, "GATE L3 aborted");

  if (verdict === "pass") break; // out of the round loop, into QA -> GATE H -> ship
  if (l3.decision === "stop" || round >= args.budgets.maxRounds) {
    return { status: "gate_h", breaker: "outer", hammer_proposals: allHammerProposals, green_scopes: allGreenScopes };
  }
  await setRunStatus(slug, "building");
  round += 1;
}

if (verdict !== "pass") {
  // Fell out of the loop without a PASS and without hitting the explicit outer-breaker return
  // above — only reachable if budgets.maxRounds was already exceeded on entry (a resumed run).
  return { status: "gate_h", breaker: "outer", hammer_proposals: allHammerProposals, green_scopes: allGreenScopes };
}

// ---------------------------------------------------------------------------------------------
// QA (post-PASS, pre-ship) — a level-up, never a gate that blocks; --no-qa is a preset that
// answers "QA" with "skip" (round-protocol.md).
// ---------------------------------------------------------------------------------------------
phase("QA");
let qaFindings = 0;
const qaGate = await resolveGate(slug, args.answers, "QA");
if (qaGate.exit_code === 4) return paused("QA", ["run", "skip", "ask"], { round, verdict });
if (qaGate.exit_code === 5) return abortedFrom("QA", qaGate, "GATE QA aborted");
if (qaGate.decision === "run") {
  const qaOrder = await compile(
    `--operation hunt --slug ${slug} --payload '${JSON.stringify({ feature: slug, spec_folder: facts.spec_folder })}'`,
    "compile:hunt",
  );
  const qaResult = await dispatch(
    "qa-edge-hunter", qaOrder.stdout.trim(), qaModel, "QA", "hunt",
    QA_SCHEMA, "Exploratory hunt over the shipped feature. No verdict, no score — findings only.",
  );
  await ingest(qaResult.result_path, "ingest:hunt");
  qaFindings = qaResult.findings_count;
}

// ---------------------------------------------------------------------------------------------
// GATE H — delegated to scope-hammer (census, baseline comparison, cut list). Runs on the
// normal-stop path here (a PASS); the two breaker paths return earlier, above, without a hammer
// dispatch of their own — GATE H's census there is the caller's job (the thin skill relays
// `hammer_proposals` to a fresh scope-hammer call, same as any other cut candidate).
// ---------------------------------------------------------------------------------------------
phase("Ship");
const hammerOrder = await compile(
  `--operation hammer --slug ${slug} --payload '${JSON.stringify({ feature: slug })}'`,
  "compile:hammer",
);
const hammerResult = await dispatch(
  "scope-hammer", hammerOrder.stdout.trim(), args.models.exec, "Ship", "hammer",
  HAMMER_SCHEMA, "Run the H0/H1/H2 census, baseline comparison, and cut list.",
);
await ingest(hammerResult.result_path, "ingest:hammer");

if (hammerResult.verdict === "cannot-ship") {
  return { status: "aborted", aborted_at: "H", reason: `scope-hammer verdict: CANNOT SHIP — ${hammerResult.cut_list.join(", ") || "a must-have item failed"}` };
}

const hGate = await resolveGate(slug, args.answers, "H");
if (hGate.exit_code === 4) return paused("H", ["accept-cut-list", "ship-all", "ask"], { verdict: hammerResult.verdict, cut_list: hammerResult.cut_list });
if (hGate.exit_code === 5) return abortedFrom("H", hGate, "GATE H aborted");

const shipReport = await mech(`node "${args.pluginRoot}/skills/tech-lead/scripts/ship-report.mjs" --slug ${slug} --verdict PASS --qa ${qaGate.decision === "run" ? "run" : "skipped"}`, "ship-report");
await setRunStatus(slug, "shipped");

return {
  status: "shipped",
  verdict: "pass",
  rounds_used: round,
  dims_not_evaluated: ["security", "performance"],
  qa_findings: qaFindings,
  report: shipReport.stdout.trim(),
};
