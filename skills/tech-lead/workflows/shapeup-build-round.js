// shapeup-build-round — one BUILD round as a Workflow (v1.0 pure-skill architecture, C1-C4).
//
// WHY THIS FILE EXISTS.
//
// This is Stage 1 of the tech-lead-orchestrator -> Workflow migration
// (docs/workflow_migration_plan.md, docs/workflow_extraction_review.md §6 Stage 1,
// docs/workflow_architecture_design.md). The inner loop — per-scope isolated attempt loop,
// T0-verified, breaker-bounded, then the single EVAL — moves from SKILL.md prose (a runbook a
// model reads and narrates) into code (a runbook that runs). Every invariant that mattered in
// the prose is now either a line below or unrepresentable:
//   - EVAL exactly once per round        -> one dispatch, after the scope loop, never inside it.
//   - the inner circuit breaker          -> attempt_budget / stagnation -> a hammer PROPOSAL,
//                                           never a blocked round (three-level breaker, AGENTS.md).
//   - gate sign-off is a file, not prose -> every gate resolves via gate-answers.mjs's exit code
//                                           (0 cross / 4 pause / 5 abort), branched on in code.
//   - the model floor (D5, PO decision 2026-08-06) — every agent in this file, including the
//     mechanical courier, runs at sonnet or above. No exceptions, no per-call override below the
//     floor. Enforced here by ALLOWLISTING the tiers this file may pass to `agent()` rather than
//     denylisting the ones it may not — a floor stated as "anything not on this list is too low"
//     cannot be defeated by a model name this file's author never anticipated.
//
// WHAT THIS FILE DOES NOT DO (scaffolding, not a shipped surface — Stage 3 deletes the asymmetry
// this creates in SKILL.md, this file's existence is not itself a dual path to preserve).
//   - It never touches a filesystem path directly. A Workflow script has none (design doc §1 —
//     "the workflow touches no file"). Every read/write goes through a pipeline script, run by a
//     mechanical agent (`mech()` below) exactly the way `${CLAUDE_PLUGIN_ROOT}`-rooted Bash calls
//     do in SKILL.md today. The one storage-root fact this file ever needs (where the
//     `.shapeup/active-scope` pointer lives) is resolved by asking `lib/paths.mjs` itself, inside
//     a `mech()` call, and read back from that call's stdout — never spelled out here (test-#45
//     discipline, extended: every path literal in this file is `${args.pluginRoot}`-rooted or
//     produced by a script's stdout).
//   - It never dispatches a worker without the order path — the WorkOrder is the payload; the
//     dispatch prompt below carries nothing else (C3, the zero-memory-handoff boundary, PA6).
//   - It never runs GATE L2/L3 sign-off prose. `gate-answers.mjs`'s exit code IS the decision; a
//     human-readable block is composed only for the two branches (`paused`, `aborted`) where a
//     human is actually going to read one.
//
// args (validated in code, not in the central schema registry — this round-scoped shape nests
// inside the C1 launch args `$defs.RunArgs` domain.schema.json now carries for the full run;
// see that file's RunArgs/RunReturn description for why the split is deliberate):
//   slug            string   the feature slug this round builds
//   round           number   the round number (>=1)
//   scopes          array    [{ scope_id, path, branch? }] — this round's L1b sequence, in order
//   attemptBudget   number   per-scope attempt cap (the inner breaker's first term)
//   models          object   { exec, eval } — resolved once at GATE L0.8, sonnet-or-above only
//   pluginRoot      string   ${CLAUDE_PLUGIN_ROOT} — the only thing this file ever roots a path in
//   startedAt       string   ISO timestamp (Date.now() is unavailable in-script by design)
//   answers         string   gate-answers preset name ("ci"|"guarded"|"interactive") or a path
//                            to a gate-answers.json file — defaults to "interactive"
//
// return — a subset of the C1 RunReturn union (domain.schema.json), the shapes this inner round
// can itself produce; the outer round loop (Stage 2's shapeup-run) reads `status` and branches:
//   { status: "ok", round, verdict: "pass"|"fail", hammer_proposals: [...], green_scopes: [...] }
//   { status: "paused", paused_at: "L2"|"L3", block, valid_decisions, context }
//   { status: "aborted", aborted_at, reason }
//   { status: "gate_h", breaker: "inner", hammer_proposals: [...], green_scopes: [] }
//     — every scope in this round exhausted its attempt budget with nothing green: there is
//       nothing a GATE L2 board-green precheck could pass and nothing to EVAL, so the round
//       returns the breaker signal directly instead of attempting a doomed gate/eval pair. A
//       round with at least one green scope still carries its hammer proposals through to the
//       normal "ok" return (AGENTS.md: "an exhausted scope queues a GATE H proposal, it never
//       blocks the round") — GATE H's own census (scope-hammer) is where those proposals land.

export const meta = {
  name: "shapeup-build-round",
  description: "One BUILD round: per-scope isolated attempt loop, T0-verified, breaker-bounded, then the single EVAL, all gate resolution via gate-answers.mjs exit codes (0 cross / 4 pause / 5 abort).",
  phases: [{ title: "Build" }, { title: "Eval" }],
};

// Some callers hand `args` through as a JSON-encoded string rather than the object itself
// (measured against the real Workflow runtime during this file's own Stage 1 verification —
// see docs/migration/stage1-evidence.md). Normalize once, defensively, so every reference below
// works regardless of which shape a given caller produced.
if (typeof args === "string") {
  try { args = JSON.parse(args); } catch { args = {}; }
}

// ---------------------------------------------------------------------------------------------
// The model floor (D5). Allowlist, not a denylist — see the file banner above for why.
// ---------------------------------------------------------------------------------------------
const MODEL_FLOOR_ALLOWED = new Set(["sonnet", "opus"]);
const belowFloor = (m) => !MODEL_FLOOR_ALLOWED.has(String(m || "").toLowerCase());

// ---------------------------------------------------------------------------------------------
// Argument validation — this file's own job (no central schema entry for a round-scoped shape;
// see the banner above). A malformed launch aborts before a single agent() is spent.
// ---------------------------------------------------------------------------------------------
function validateArgs(a) {
  const problems = [];
  for (const k of ["slug", "round", "attemptBudget", "models", "pluginRoot", "startedAt"]) {
    if (a[k] === undefined || a[k] === null || a[k] === "") problems.push(`missing args.${k}`);
  }
  if (!Array.isArray(a.scopes) || a.scopes.length === 0) problems.push("args.scopes must be a non-empty array");
  if (a.models) {
    for (const role of ["exec", "eval"]) {
      if (belowFloor(a.models[role])) {
        problems.push(`args.models.${role}="${a.models[role]}" is below the model floor (D5) — sonnet or above only`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// C2 — the mechanical channel (design doc §2). One helper, one schema, sonnet — the D5 floor —
// on every call including this courier. It adds no judgment: the schema forces it to hand back
// the script's own words, and every branch on those words happens below, in code.
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

// `agent()` returns null when a subagent is skipped mid-run or dies on a terminal error after
// retries (the Workflow runtime documents this). Dereferencing `.stdout` on null kills the whole
// workflow with `status: "failed"` — not a member of the return union, so the caller has no arm
// for it. Measured in shapeup-run.js during run 3; the same shape is here, so the same guard is.
// A dead courier is a failed COMMAND, which every call site below already knows how to read.
const mechEnvelope = (r, label) => (
  r && typeof r === "object"
    ? r
    : { exit_code: -1, stdout: "", stderr: `mech courier returned no result (skipped, blocked, or died) for: ${label}` }
);

const mech = async (cmd, label) => mechEnvelope(await agent(
  "Run exactly this command, change nothing about it, and report its outcome as data: the exit " +
  "code, everything printed to stdout, and everything printed to stderr, verbatim, byte for " +
  "byte. Do not summarize, do not truncate, do not interpret it.\n\n" +
  "`stdout` must contain ONLY what the command itself printed to stdout. Do not append an " +
  "exit-status marker, do not add `; echo EXIT:$?` or any similar suffix to the command, and do " +
  "not add commentary — the exit status belongs in `exit_code` and nowhere else. Report the " +
  "command's exit status in `exit_code`; if you cannot observe it, use 0 when the command " +
  `produced no error output and 1 when it did.\n\n${cmd}`,
  { model: "sonnet", effort: "low", schema: MECH_SCHEMA, phase: "Build", label: String(label || cmd).slice(0, 40) },
), String(label || cmd).slice(0, 40));

// A courier is a model, not a pipe. Asked for an exit code it has no sanctioned way to observe,
// it reaches for `cmd; echo "EXIT:$?"` and hands back the combined text — measured, run 3, where
// a trailing "EXIT:0" aborted an unattended run through shapeup-run.js's probe. Here the same
// noise would read a GREEN T0 report as red and burn the attempt budget on a passing scope, so
// every JSON fact this file reads off a courier comes through the same extraction: take the first
// balanced {...} / [...] and ignore what the courier wrapped it in. A command that genuinely
// printed no JSON still yields null, and callers still treat null as the failure it is.
function parseMechJson(stdout) {
  if (typeof stdout !== "string") return null;
  const s = stdout.trim();
  try { return JSON.parse(s); } catch { /* fall through to extraction */ }
  const start = s.search(/[{[]/);
  if (start < 0) return null;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// C3 — the dispatch channel: the zero-memory boundary. A fresh agent() per call IS the isolation
// the attempt loop assumes (PA6) — the prompt below carries only the order path, matching
// references/delegation.md's "Standard shape" verbatim; the payload travels on C4 (the order
// file), never in the prompt.
// ---------------------------------------------------------------------------------------------
const BUILD_DISPATCH_SCHEMA = {
  type: "object",
  properties: { result_path: { type: "string" } },
  required: ["result_path"],
};
const EVAL_DISPATCH_SCHEMA = {
  type: "object",
  properties: { result_path: { type: "string" }, overall: { type: "string", enum: ["PASS", "FAIL"] } },
  required: ["result_path", "overall"],
};

// WHERE A DISPATCH'S RESULT IS — derived from the order, never taken from the worker's report.
// compile-order.mjs writes `orders/<suffix>.json`; every worker writes `results/<suffix>.json` (its
// own SKILL.md says so). The pairing is a fact of the envelope port. Measured cost of trusting the
// report instead, Stage A3 probe leg 1: ORIENT wrote its result correctly, reported a DIRECTORY as
// its path, and the run aborted at the first phase on EISDIR. Same helper as shapeup-run.js.
const baseOf = (p) => String(p || "").trim().split("/").pop();
const resultFor = (orderPath, reported, label) => {
  const derived = orderPath.replace("/orders/", "/results/");
  if (reported && baseOf(reported) !== baseOf(derived)) {
    log(`${label} — the worker reported result_path "${reported}", which is not "${baseOf(derived)}". Ingesting the derived path; the order's own name is the fact.`);
  }
  return derived;
};

// Same null contract as mech() — a worker that is skipped or dies yields null, and reading
// `.result_path` off it kills the round. `__failed` is checked at both call sites instead.
const dispatchBuild = async (orderPath, model, label) => {
  const r = await agent(
    `Call Skill(shapeup-sdlc-plugin:task-executor) --order ${orderPath}. Implement the order's ` +
    "acceptance criteria exactly. Report back: the WorkResult path you wrote (your ONLY pipeline " +
    "output) — { result_path }.",
    { model, phase: "Build", label, schema: BUILD_DISPATCH_SCHEMA },
  );
  return (r && typeof r === "object") ? r : { __failed: `task-executor dispatch returned no result at ${label}` };
};

const dispatchEval = async (orderPath, model, label) => {
  const r = await agent(
    `Call Skill(shapeup-sdlc-plugin:spec-evaluator) --order ${orderPath}. Evaluate the running ` +
    "feature against the order's acceptance criteria and Done-when. Report back: the WorkResult " +
    "path you wrote and the overall verdict — { result_path, overall }.",
    { model, phase: "Eval", label, schema: EVAL_DISPATCH_SCHEMA },
  );
  return (r && typeof r === "object") ? r : { __failed: `spec-evaluator dispatch returned no result at ${label}` };
};

// ---------------------------------------------------------------------------------------------
// The one storage-root fact this file needs, resolved through lib/paths.mjs itself instead of
// spelled out here (test-#45 discipline, extended to workflow scripts per the migration
// contract's guardrails). The import path is ${args.pluginRoot}-rooted; the LOCAL root string
// itself is never typed in this file — it is produced by paths.mjs at runtime and read back from
// this call's stdout.
// ---------------------------------------------------------------------------------------------
// The pointer sandbox-guard reads to decide which substrate a worker may write. Promoted out of
// an inline `node -e` blob at Stage A2.1, for the reasons resume-state.mjs's own banner gives:
// the inline form matched no permissions.allow entry, and its outcome was discarded — which is how
// a whole run built scope 2 with the whitelist still pointed at scope 1, silently.
const writeActiveScope = (slug, scopeId) => mech(
  `node "${args.pluginRoot}/skills/tech-lead/scripts/resume-state.mjs" --slug ${slug} --set-active-scope ${scopeId}`,
  `active-scope:${scopeId}`,
);

// ---------------------------------------------------------------------------------------------
// Gate resolution — every gate crosses through gate-answers.mjs's exit code, never through a
// model's reading of a paragraph (the file this project fixed the consent-by-prose failure with).
// ---------------------------------------------------------------------------------------------
const PRESET_NAMES = new Set(["ci", "guarded", "interactive"]);
const answersFlag = (answers) => {
  if (!answers) return "";
  return PRESET_NAMES.has(answers) ? `--preset ${answers}` : `--file ${answers}`;
};

const resolveGate = (slug, answers, gate) => mech(
  `node "${args.pluginRoot}/skills/tech-lead/scripts/gate-answers.mjs" --resolve ${gate} --slug ${slug} ${answersFlag(answers)}`.trim(),
  `gate:${gate}`,
);

const GATE_TITLES = { L2: "Build Round Complete", L3: "Verdict & Loop" };
const gateBlock = (gate, ctx) => [
  `⏸ GATE ${gate} — ${GATE_TITLES[gate] || gate}`,
  ...Object.entries(ctx).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
].join("\n");

// =================================================================================================
// The round.
// =================================================================================================

const argProblems = validateArgs(args);
if (argProblems.length) {
  return { status: "aborted", aborted_at: "args", reason: `shapeup-build-round: ${argProblems.join("; ")}` };
}

phase("Build");

const hammerProposals = [];
const greenScopes = [];
const t0ArtifactPaths = [];

for (const scope of args.scopes) {
  log(`scope ${scope.scope_id} — starting attempt loop (budget ${args.attemptBudget})`);

  // Branch-per-scope isolation (PA3/PA5, design doc D3: sequential in v1) — optional: a scope
  // whose contract names no branch runs in the caller's current tree as-is.
  if (scope.branch) {
    const checkout = await mech(`git checkout ${scope.branch}`, `checkout:${scope.scope_id}`);
    if (checkout.exit_code !== 0) {
      return { status: "aborted", aborted_at: "BUILD", reason: `could not check out branch "${scope.branch}" for scope ${scope.scope_id}: ${(checkout.stderr || checkout.stdout || `exit ${checkout.exit_code}`).toString().trim()}` };
    }
  }

  // The pointer sandbox-guard reads to enforce this scope's substrate on every Edit/Write this
  // round (C5 — the hook layer is unchanged by this migration). A failed write does not degrade to
  // "unguarded", it degrades to guarding the WRONG scope, so it is not survivable.
  const pointer = await writeActiveScope(args.slug, scope.scope_id);
  if (pointer.exit_code !== 0) {
    return { status: "aborted", aborted_at: "BUILD", reason: `could not point the active-scope pointer at ${scope.scope_id}: ${(pointer.stderr || pointer.stdout || `exit ${pointer.exit_code}`).toString().trim()} — refusing to build against another scope's substrate` };
  }

  let green = false;
  let stagnant = false;
  let lastT0Path = null;

  for (let attempt = 1; attempt <= args.attemptBudget && !green; attempt++) {
    const compiled = await mech(
      `node "${args.pluginRoot}/skills/tech-lead/scripts/compile-order.mjs" --scope ${scope.path} --round ${args.round} --attempt ${attempt}`,
      `compile:${scope.scope_id}-a${attempt}`,
    );
    // The stagnation breaker reports on stderr, never on stdout (compile-order.mjs's own
    // discipline) — stdout stays the order path this loop consumes next.
    if (compiled.stderr.includes('"breaker":"stagnation"')) {
      log(`scope ${scope.scope_id} — stagnation breaker on attempt ${attempt}: ${compiled.stderr.trim()}`);
      stagnant = true;
      break;
    }
    if (compiled.exit_code !== 0) {
      log(`scope ${scope.scope_id} — compile-order exited ${compiled.exit_code} on attempt ${attempt}, treating as an inner-breaker trip`);
      stagnant = true;
      break;
    }
    const orderPath = compiled.stdout.trim();
    // t0-verify.mjs's own default `--out` is dirname(dirname(<scope contract path>)) — the
    // COMMITTED (shapeup/) tree next to the scope contract, not the LOCAL (.shapeup/) tree T0
    // artifacts actually belong under (measured against the real runtime during this file's own
    // Stage 1 verification, docs/migration/stage1-evidence.md: without an explicit --out, verdicts
    // landed in the SHARED tree). Derive the LOCAL root from compile-order's own stdout instead of
    // spelling out ".shapeup" here — a string operation on a runtime value, not a path literal.
    const localRoot = orderPath.slice(0, orderPath.lastIndexOf("/orders/"));

    const built = await dispatchBuild(orderPath, args.models.exec, `build:${scope.scope_id}-a${attempt}`);
    // A dead builder is a spent attempt, not a dead round — the attempt budget is the instrument
    // for exactly this, and the inner breaker still proposes the scope to GATE H if all die.
    if (built.__failed) { log(`scope ${scope.scope_id} — attempt ${attempt} lost its worker: ${built.__failed}`); continue; }

    // ingest-result.mjs is the single writer of the board and the ledger; an ingest that failed
    // unnoticed leaves this attempt's work invisible to everything downstream. A spent attempt,
    // not a dead round — the same policy a dead builder takes, two lines above.
    const ingested = await mech(
      `node "${args.pluginRoot}/skills/tech-lead/scripts/ingest-result.mjs" ${resultFor(orderPath, built.result_path, `ingest:${scope.scope_id}-a${attempt}`)}`,
      `ingest:${scope.scope_id}-a${attempt}`,
    );
    if (ingested.exit_code !== 0) {
      log(`scope ${scope.scope_id} — attempt ${attempt} discarded, its result did not apply: ${(ingested.stderr || ingested.stdout || `exit ${ingested.exit_code}`).toString().trim()}`);
      continue;
    }

    const t0 = await mech(
      `node "${args.pluginRoot}/skills/tech-lead/scripts/t0-verify.mjs" ${scope.path} --round ${args.round} --attempt ${attempt} --out "${localRoot}" --no-seesaw`,
      `t0:${scope.scope_id}-a${attempt}`,
    );
    // An unparsable T0 report is a red, never a crash-the-loop — but courier noise around a GREEN
    // report must not read as red either, or the budget burns down a scope that actually passed.
    const verdict = parseMechJson(t0.stdout);
    // THE RATCHET (t0-verify.mjs owns the comparison and the tree action already — this loop only
    // reads `overall`, per the architectural rule "never branch on red/green directly, read
    // status"). A `kept`-but-red attempt still isn't green; the loop keeps trying within budget.
    green = verdict?.overall === "green";
    if (verdict?.path) lastT0Path = verdict.path;
  }

  if (green) {
    greenScopes.push(scope.scope_id);
    if (lastT0Path) t0ArtifactPaths.push(lastT0Path);
    log(`scope ${scope.scope_id} — T0 green`);
  } else {
    // Inner circuit breaker (attempt_budget exhausted OR stagnation) — queue a GATE H proposal,
    // do NOT block the round (AGENTS.md three-level circuit breaker).
    hammerProposals.push({ scope_id: scope.scope_id, t0_artifact: lastT0Path, reason: stagnant ? "stagnation breaker" : "attempt_budget exhausted without a green T0" });
    log(`scope ${scope.scope_id} — inner breaker tripped, queued a GATE H proposal, moving on`);
  }
}

// Every scope in this round exhausted its budget with nothing green: there is no board-green
// state for GATE L2 to check and nothing to EVAL. Return the breaker signal directly instead of
// attempting a doomed gate/eval pair — the "round NOT blocked" the contract asks for is this
// typed return, not a hang.
if (greenScopes.length === 0 && hammerProposals.length > 0) {
  return { status: "gate_h", breaker: "inner", hammer_proposals: hammerProposals.map((h) => h.scope_id), green_scopes: [] };
}

// ---------------------------------------------------------------------------------------------
// GATE L2 — Build Round Complete. The single most important gate: nothing unlocks EVAL without
// crossing it. Resolution is the exit code, never a model's reading of the board.
// ---------------------------------------------------------------------------------------------
const l2 = await resolveGate(args.slug, args.answers, "L2");
if (l2.exit_code === 4) {
  return {
    status: "paused", paused_at: "L2",
    block: gateBlock("L2", { round: args.round, green_scopes: greenScopes, hammer_proposals: hammerProposals.map((h) => h.scope_id) }),
    valid_decisions: ["proceed", "ask", "abort"],
    context: { round: args.round, scopes: args.scopes.length },
  };
}
if (l2.exit_code === 5) {
  let reason = l2.stderr.trim() || "GATE L2 aborted";
  reason = parseMechJson(l2.stdout)?.reason || reason;
  return { status: "aborted", aborted_at: "L2", reason };
}

// ---------------------------------------------------------------------------------------------
// EVAL round r — delegate to spec-evaluator ONCE. Not per task, not inside the scope loop, not
// before GATE L2 — this is the single point where the evaluator runs in a round.
// ---------------------------------------------------------------------------------------------
phase("Eval");

const evalPayload = JSON.stringify({ dimensions: ["spec-conformance"], t0_artifacts: t0ArtifactPaths });
const evalOrder = await mech(
  `node "${args.pluginRoot}/skills/tech-lead/scripts/compile-order.mjs" --operation evaluate --slug ${args.slug} --worker spec-evaluator --round ${args.round} --payload '${evalPayload}'`,
  `compile:evaluate-r${args.round}`,
);
const evalResult = await dispatchEval(evalOrder.stdout.trim(), args.models.eval, `eval:r${args.round}`);
// The single judge died — the round has no verdict, and inventing one is the exact thing the
// single-judge rule forbids. Abort with the phase named, never a crash.
if (evalResult.__failed) return { status: "aborted", aborted_at: "L3", reason: evalResult.__failed };
const evalIngest = await mech(
  `node "${args.pluginRoot}/skills/tech-lead/scripts/ingest-result.mjs" ${resultFor(evalOrder.stdout.trim(), evalResult.result_path, `ingest:evaluate-r${args.round}`)}`,
  `ingest:evaluate-r${args.round}`,
);
// The verdict record IS the round's output. If it did not apply, the round has no verdict on disk
// and returning one from memory is the single-judge rule broken by a different route.
if (evalIngest.exit_code !== 0) {
  return { status: "aborted", aborted_at: "L3", reason: `the round's verdict did not apply: ${(evalIngest.stderr || evalIngest.stdout || `exit ${evalIngest.exit_code}`).toString().trim()}` };
}

// ---------------------------------------------------------------------------------------------
// GATE L3 — Verdict & Loop.
// ---------------------------------------------------------------------------------------------
const l3 = await resolveGate(args.slug, args.answers, "L3");
if (l3.exit_code === 4) {
  return {
    status: "paused", paused_at: "L3",
    block: gateBlock("L3", { round: args.round, verdict: evalResult.overall, hammer_proposals: hammerProposals.map((h) => h.scope_id) }),
    valid_decisions: ["loop", "stop", "ask"],
    context: { round: args.round },
  };
}
if (l3.exit_code === 5) {
  let reason = l3.stderr.trim() || "GATE L3 aborted";
  reason = parseMechJson(l3.stdout)?.reason || reason;
  return { status: "aborted", aborted_at: "L3", reason };
}

return {
  status: "ok",
  round: args.round,
  verdict: evalResult.overall === "PASS" ? "pass" : "fail",
  hammer_proposals: hammerProposals,
  green_scopes: greenScopes,
};
