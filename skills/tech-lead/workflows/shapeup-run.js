// shapeup-run — the BUILD-phase pipeline as one script on the native Dynamic Workflow runtime.
//
// WHAT THIS FILE OWNS.
//   ORIENT → GATE L1a → ANALYZE → WIRE → GATE L1a.5 → MAP SCOPES → GATE L1b →
//   rounds of (BUILD → GATE L2 → EVAL → GATE L3) bounded by budgets.maxRounds →
//   QA → GATE H → ship report → RunReturn.
//
// THE THREE PLANES THIS FILE RESPECTS, because collapsing them is what the previous version cost:
//   CONTROL (here)   — sequences phases and branches on structured returns. Owns NO I/O: no shell,
//                      no filesystem, no stdout parsing. Nothing in this file reads a model's prose.
//   EXECUTION        — the sub-agents. Each has a real shell and a real filesystem, runs the kernel
//                      itself, and returns a SCHEMA-VALIDATED object. The runtime enforces the
//                      shape, so every branch below reads a real typed field.
//   ARTIFACT         — the kernel. `harness compile` writes the order and `harness reduce ingest`
//                      applies the result; those remain the only writers of shared state.
//
// BOTH LANES ARE THIS CODE. The unattended lane launches it headlessly; the interactive lane pauses
// at each gate a human answers and relaunches. There is no prose runbook that can drift from what
// executes.
//
// EVERY PHASE HAS A POST-CONDITION. A phase is complete when its ARTIFACT is on disk, never when a
// result record says so — `requirePhase()` below. A WorkResult may legitimately report `escalated`
// with an empty artifacts list, which satisfies ingest; without the post-condition the run walks to
// the next gate as though the phase landed, and every relaunch re-dispatches it.
//
// DELIBERATE OMISSIONS, stated rather than hidden:
//   - No mid-round ESCALATE resolution and no discovered-task reconciliation mid-BUILD. Both stay
//     on the prose path in references/round-protocol.md and references/delegation.md.
//   - QA runs once after the first PASS; its findings are a count for GATE H's census, never
//     re-probed inside this run. Promoting a finding to a fix round is a live PO's decision.
//   - The `tiny` lane and pre-scope-contract specs are out of scope here; SKILL.md's tiny-lane
//     reference keeps that path.
//
// args — RunArgs (domain.schema.json $defs/RunArgs):
//   slug, autoLevel (interactive|auto|unattended), answers (preset name or path),
//   models {exec, eval, qa?}, budgets {maxRounds, attemptBudget, wallClockS?}, pluginRoot,
//   startedAt, and the optional switches noEval / noQa / adversarialVerify /
//   maxParallelScopes (default 4).
//
// return — RunReturn (domain.schema.json $defs/RunReturn), the full union:
//   { status: "shipped", verdict, rounds_used, dims_not_evaluated, qa_findings, report }
//   { status: "paused",  paused_at, block, valid_decisions, context }
//   { status: "aborted", aborted_at, reason }
//   { status: "gate_h",  breaker: "outer"|"inner"|"deadline", hammer_proposals, green_scopes }

// meta must be a PURE LITERAL — the runtime parses it statically, before the body ever runs, and
// rejects the whole script on anything it has to evaluate. A `+`-joined description is a
// BinaryExpression, so the concatenation that reads better in source costs the file its ability to
// load at all. Keep every value here a plain literal, however long the line gets.
export const meta = {
  name: "shapeup-run",
  description: "BUILD-phase pipeline: ORIENT → ANALYZE → WIRE → MAP SCOPES → rounds of BUILD/EVAL → QA → GATE H → ship. Gates resolve by the kernel's exit code; every dispatch is WorkOrder in / WorkResult out; the fast-forward is derived from artifacts on disk.",
  phases: [
    { title: "Preflight", detail: "one canary dispatch — can this session resolve a worker skill" },
    { title: "Orient" }, { title: "Analyze" }, { title: "Wire" }, { title: "MapScopes" },
    { title: "Build" }, { title: "Eval" }, { title: "Refute" }, { title: "QA" }, { title: "Ship" },
  ],
};

// Some callers hand args as a JSON string.
if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }

// ---------------------------------------------------------------------------------------------
// ARGS — validated here because nothing validates the C1 boundary for us. A run that starts with a
// below-floor model or a missing budget produces work nobody can trust, and finding that out at
// GATE L3 costs the whole run.
// ---------------------------------------------------------------------------------------------
const MODEL_FLOOR = new Set(["sonnet", "opus"]);
const belowFloor = (m) => !MODEL_FLOOR.has(String(m || "").toLowerCase());

function validateArgs(a) {
  const problems = [];
  for (const k of ["slug", "autoLevel", "models", "budgets", "pluginRoot"]) {
    if (a?.[k] === undefined || a[k] === null || a[k] === "") problems.push(`missing args.${k}`);
  }
  if (a && !["interactive", "auto", "unattended"].includes(a.autoLevel)) {
    problems.push(`args.autoLevel="${a.autoLevel}" must be interactive|auto|unattended`);
  }
  if (a?.budgets && (!a.budgets.maxRounds || !a.budgets.attemptBudget)) {
    problems.push("args.budgets must carry maxRounds and attemptBudget");
  }
  if (a?.models) {
    for (const role of ["exec", "eval"]) {
      if (role === "eval" && a.noEval) continue;
      if (belowFloor(a.models[role])) problems.push(`args.models.${role} is below the model floor (sonnet or above)`);
    }
  }
  return problems;
}

const argProblems = validateArgs(args);
if (argProblems.length) return { status: "aborted", aborted_at: "args", reason: argProblems.join("; ") };

const slug          = args.slug;
const KERNEL        = `${args.pluginRoot}/kernel/harness.mjs`;
const execModel     = args.models.exec;
const evalModel     = args.models.eval;
const qaModel       = args.models.qa || args.models.exec;
const maxRounds     = args.budgets.maxRounds;
const attemptBudget = args.budgets.attemptBudget;

// How many scopes may build at once. A dial rather than a constant because concurrency is a COST
// question before it is a speed one: every extra leg is another worker's full context. 4 is the
// default because a feature is rarely cut into more independent slices than that; 1 restores the
// sequential behaviour for a project whose workers are not safe to run side by side.
//
// It is a CAP, not a group size. The window refills the instant any leg settles, so the dial bounds
// spend without ever quantising the schedule — see the scheduler below for what the difference cost.
const maxParallelScopes = Math.max(1, Number(args.maxParallelScopes ?? 4) || 1);

// ---- SCHEDULER REGION START ------------------------------------------------------------------
// BUILD's fan-out, as three separable decisions instead of one list operation:
//
//     WAVES ORDER the scopes.   EDGES RELEASE them.   THE DIAL CAPS them.
//
// Fusing the three into `waves.flatMap((w) => chunk(w, maxParallelScopes))` cost wall-clock twice
// over, and both costs are structural rather than incidental:
//
//   1. `chunk` turns the dial from a CAP into a QUANTUM. A wave of six at a dial of four runs four,
//      then idles three workers until the SLOWEST of those four lands, then runs two. Nothing about
//      the scopes asked for that; it falls out of splitting a list instead of scheduling it.
//   2. A wave is a LEVEL, and a level says when a scope is definitely safe to start, never when it
//      BECAME safe. The scope that wires the others to the entry point waits for the slowest command
//      scope even when the one scope it actually consumes went green minutes earlier.
//
// Everything the previous loop bought with blood survives, and each is named at the line that keeps
// it: a scope never starts beside a scope it consumes; no scope is ever dropped; a dead builder is a
// spent attempt rather than a dead run; the dial is honoured exactly.
//
// This region is self-contained on purpose. The scheduling decision is PURE — no dispatch, no clock,
// no randomness — so it is the one part of this file that can be executed against a fixture instead
// of reasoned about, and the round loop below injects the real dispatcher as `launch`.

/**
 * The dependency relation the fan-out releases on, as `scope_id → the scope_ids it waits for`.
 *
 * Three rungs, each a strict non-regression on the next. The edge list is used only when it
 * re-levels to the SAME waves: both fields are projections of one graph the kernel parsed once, so
 * each validates the other, and an edge dropped or invented in transit lands on the wave rung rather
 * than releasing a scope early — which is the one direction this must never fail in.
 *
 * @param {*} rawDeps - `probe resume`'s `scope_deps`: `[dependant, dependency]` path pairs.
 * @param {Array[]} waves - Validated dependency waves, arrays of scope objects.
 * @param {Array} list - Every scope in the round.
 * @returns {Map<string,Set<string>>} One entry per scope; an empty set means "ready immediately".
 */
function scopeEdges(rawDeps, waves, list) {
  const known = new Set(list.map((s) => s.scope_id));
  const idOf = (p) => String(p).split("/").pop().replace(/\.(md|json)$/, "");
  const blank = () => new Map(list.map((s) => [s.scope_id, new Set()]));

  // Kahn. A CYCLE IS THE ONE INPUT THAT TURNS THIS SCHEDULER INTO A HANG rather than a failure: two
  // scopes awaiting each other produce no error, no log line and no artifact, which a list-chunking
  // loop could not do. So an edge set is used only when every node peels.
  const levelsOf = (m) => {
    const done = new Set(), out = [];
    for (;;) {
      const ready = list.filter((s) => !done.has(s.scope_id) && [...m.get(s.scope_id)].every((d) => done.has(d)));
      if (!ready.length) break;
      out.push(ready.map((s) => s.scope_id).sort());
      for (const s of ready) done.add(s.scope_id);
    }
    return done.size === list.length ? out : undefined;
  };
  const shape = (levels) => (levels ? JSON.stringify(levels) : "");

  if (Array.isArray(rawDeps) && rawDeps.length) {
    const m = blank();
    let edges = 0;
    for (const pair of rawDeps) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const to = idOf(pair[0]), from = idOf(pair[1]);
      if (to === from || !known.has(to) || !known.has(from)) continue;
      m.get(to).add(from);
      edges++;
    }
    const want = shape(waves.map((w) => w.map((s) => s.scope_id).sort()));
    if (edges && shape(levelsOf(m)) === want) return m;
    log(`BUILD order — the dependency edge list does not re-derive the wave order (${edges} usable ` +
        `edge(s)); releasing per wave instead, which is what a wave-stepped fan-out did.`);
  }

  // WAVE RUNG. "Everything in wave i waits for everything in wave i-1" — the exact release points a
  // wave-stepped loop had, and acyclic by construction. An absent or unusable edge list costs the
  // per-edge release and nothing else; a single wave yields no edges at all, which is the fully
  // unscheduled fan-out. A scheduler that refuses to run is worse than one that runs unscheduled.
  const m = blank();
  for (let i = 1; i < waves.length; i++) {
    for (const to of waves[i]) for (const from of waves[i - 1]) m.get(to.scope_id).add(from.scope_id);
  }
  return m;
}

/**
 * Run `launch` over every item, at most `width` at once, releasing each item as soon as ITS OWN
 * dependencies have settled rather than when its whole wave has.
 *
 * Release is on SETTLED, not on green, which is deliberate and matches what a wave-stepped loop did.
 * Gating on green is strictly stronger and costs more than it buys: a dependency that fails would
 * starve every dependant of any attempt at all, and those scopes would leave the round's census
 * entirely — an outcome class the gate, the hill projection and the ledger have no reading for. What
 * must never happen is a scope building CONCURRENTLY with a scope it consumes, and that is what the
 * dependency await forbids.
 *
 * No race, no timer, no clock — deliberately. `Promise.race` over the in-flight legs would tighten
 * the schedule marginally and is disqualified for the same reason a clock read is: it makes the
 * schedule a function of real time, so a relaunch reschedules differently.
 *
 * @param {Array} items - The scopes, in the order the waves put them.
 * @param {Map<string,Set<string>>} edges - scope_id → the scope_ids it waits for.
 * @param {number} width - Concurrency cap.
 * @param {function(object): Promise<object>} launch - Dispatches one scope. May reject; may not be
 *   trusted to return anything.
 * @returns {Promise<object[]>} Exactly one settled record per item, in input order. Never rejects.
 */
async function scheduleScopes(items, edges, width, launch) {
  let free = Math.max(1, Number(width) || 1);
  const waiting = [];
  const acquire = () => (free > 0 ? (free--, Promise.resolve()) : new Promise((r) => waiting.push(r)));
  const release = () => { const next = waiting.shift(); if (next) next(); else free++; };

  const started = new Map();

  async function runOne(item) {
    // THE DEPENDENCY WAIT HAPPENS BEFORE THE SLOT ACQUIRE, and that ordering is the whole reason
    // the window cannot deadlock against the edges: a waiting scope occupies no capacity, so the
    // window can never fill with scopes that are all waiting on one another.
    const deps = [...(edges.get(item.scope_id) || [])].map((d) => started.get(d)).filter(Boolean);
    if (deps.length) await Promise.all(deps);
    await acquire();
    try {
      const res = await launch(item);
      // The runtime drops an item whose stage returned no value and leaves an empty slot in the
      // settled list. Name that by itself: an empty slot and a dead worker are different repairs.
      return res || { scope_id: item.scope_id, __failed: "the runtime dropped this leg — a pipeline stage returned no value" };
    } catch (e) {
      // A DEAD BUILDER IS A SPENT ATTEMPT, NOT A DEAD RUN. Rethrowing would reject every other
      // scope's promise through the settle below and discard a whole round of green work.
      return { scope_id: item.scope_id, __failed: `${item.scope_id}: ${(e && e.message) || String(e)}` };
    } finally {
      // In `finally`, so a leg that dies before returning does not narrow the window permanently.
      release();
    }
  }

  // TWO PHASES, because one phase is a silently dropped edge. A body reads its dependencies' promises
  // out of `started` on its first line; built in a single pass, a dependency declared LATER in the
  // list is not there yet, its edge is discarded as unknown, and the scope that edge was protecting
  // starts early — the exact failure the edge exists to prevent, with no diagnostic anywhere.
  const begin = [];
  for (const item of items) {
    let open;
    const gate = new Promise((r) => { open = r; });
    started.set(item.scope_id, gate.then(() => runOne(item)));
    begin.push(open);
  }
  for (const open of begin) open();

  // ONE ENTRY PER ITEM, IN INPUT ORDER, structurally — the result is a map over `items`, so no edge,
  // no failure and no dial setting can drop a scope out of the round's census.
  return Promise.all(items.map((s) => started.get(s.scope_id)));
}
// ---- SCHEDULER REGION END --------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// SCHEMAS — the only contract between this control script and a sub-agent. The runtime forces the
// agent's final message to validate against these, which is the entire reason no stdout is parsed
// anywhere in this file.
// ---------------------------------------------------------------------------------------------
const nullable = (t) => ({ type: [t, "null"] });

/** A kernel subcommand a sub-agent ran in its own shell, reported as data. */
const CMD = {
  type: "object",
  properties: {
    exit_code: { type: "integer" },
    ok: { type: "boolean" },
    detail: { type: "string" },
    // The machine value, copied CHARACTER FOR CHARACTER out of the command's own JSON. Separate
    // from `detail` on purpose: `detail` is prose for a human to read, this is a token the control
    // plane branches on, and collapsing the two is what made every gate comparison silently false.
    decision: { type: "string" },
  },
  required: ["exit_code", "ok"],
};

/** `harness probe resume` — the fast-forward derivation, every field artifact-derived. */
const RESUME = {
  type: "object",
  properties: {
    intake_path: nullable("string"), spec_folder: nullable("string"), orient_dir: nullable("string"),
    project_profile_path: nullable("string"), status: nullable("string"),
    lens: nullable("string"), stack: nullable("string"),
    run_cmd: nullable("string"), app_url: nullable("string"),
    eval_dimensions: { type: "array", items: { type: "string" } },
    has_orient_artifacts: { type: "boolean" },
    has_spec_tree: { type: "boolean" },
    has_wiring_map: { type: "boolean" },
    has_project_profile: { type: "boolean" },
    scope_files: { type: "array", items: { type: "string" } },
    // Additive: the same scopes grouped into dependency waves. Absent or unusable → one wave.
    scope_waves: { type: "array", items: { type: "array", items: { type: "string" } } },
    // The same relation as edges — `[dependant, dependency]` pairs. A wave says when a scope is
    // definitely safe to start; an edge says when it BECAME safe. Absent or unusable → the waves'
    // own release points, which is what a wave-stepped fan-out had.
    scope_deps: { type: "array", items: { type: "array", items: { type: "string" } } },
    eval_rounds_done: { type: "array", items: { type: "integer" } },
    next_phase: nullable("string"),
  },
  required: ["has_orient_artifacts", "has_spec_tree", "has_wiring_map", "scope_files", "eval_rounds_done"],
};

/** `harness reduce graph --subgraph run` — the bounded read model a round opens with. */
const SUBGRAPH = {
  type: "object",
  properties: {
    run: nullable("string"),
    scopes: { type: "array", items: { type: "string" } },
    requirements: { type: "array", items: { type: "string" } },
    orders: { type: "integer" },
    pending_orders: { type: "array", items: { type: "string" } },
    rounds_with_green: { type: "array", items: { type: "integer" } },
    green_scopes_by_round: { type: "object" },
    trials: { type: "integer" },
    edges: { type: "integer" },
  },
  required: ["scopes", "rounds_with_green", "green_scopes_by_round"],
};

/** `harness probe t0` — has this scope already gone green in this round? */
const T0CHECK = {
  type: "object",
  properties: { green: { type: "boolean" }, path: nullable("string") },
  required: ["green"],
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

/** analyze / wire — "did the artifact land?" is all a gate needs from them. */
const PHASE_OK = {
  type: "object",
  properties: { ok: { type: "boolean" }, artifact_written: { type: "boolean" }, detail: { type: "string" } },
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

/** One scope's whole attempt ratchet, run inside the worker leg (see buildScope). */
const SCOPE_RESULT = {
  type: "object",
  properties: {
    scope_id: { type: "string" },
    green: { type: "boolean" },
    t0_artifact: nullable("string"),
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

const REFUTATION = {
  type: "object",
  properties: { id: { type: "string" }, refuted: { type: "boolean" }, why: { type: "string" } },
  required: ["id", "refuted"],
};

const QA_REPORT = {
  type: "object",
  properties: { ok: { type: "boolean" }, findings_count: { type: "integer" } },
  required: ["ok", "findings_count"],
};

const HAMMER = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    verdict: { type: "string", enum: ["ship-now", "ship-after-fixes", "cannot-ship"] },
    cut_list: { type: "array", items: { type: "string" } },
  },
  required: ["ok", "verdict", "cut_list"],
};

// ---------------------------------------------------------------------------------------------
// DISPATCH — three shapes, and none of them parses text.
//
// A sub-agent can be skipped by the operator or die on a terminal API error, in which case the
// runtime hands back `null`. A null is a NAMED failure here, never a crash: `status: "failed"` is
// not a member of the RunReturn union, so every call site converts it to one that is.
// ---------------------------------------------------------------------------------------------
const nullFail = (label) => ({ __failed: `${label}: sub-agent skipped, blocked, or died after retries` });

/**
 * Run one kernel subcommand in a sub-agent's own shell and get its outcome as data.
 *
 * @param {string} verbs - Kernel verb words plus flags, e.g. `reduce hill --slug x`.
 * @param {string} phaseName - Progress group.
 * @param {string} label - Display label.
 * @returns {Promise<{exit_code:number, ok:boolean, detail?:string}>} Never rejects.
 */
async function cmd(verbs, phaseName, label) {
  const r = await agent(
    `Run exactly this command and nothing else:\n\n  node "${KERNEL}" ${verbs}\n\n` +
    `Report its exit code as exit_code, ok=true if and only if exit_code is 0, and one line of ` +
    `detail. If the command printed JSON carrying a top-level "decision" key, copy that value into ` +
    `decision EXACTLY as it appears — one bare token, no sentence, no quotes, no rephrasing. ` +
    `Otherwise omit decision. Do not interpret, summarise or act on the command's output beyond that.`,
    { model: "sonnet", effort: "low", phase: phaseName, label, schema: CMD },
  );
  return (r && typeof r === "object") ? r : { exit_code: -1, ok: false, detail: `${label}: no result` };
}

/**
 * Run a kernel subcommand whose outcome is advisory — a projection or a lint that informs but does
 * not stop the run.
 *
 * It still LOOKS at the exit code. A command whose result nobody reads is a command whose failure
 * is indistinguishable from its success, which is the defect class this whole file is arranged
 * against; "advisory" means the run continues, not that nothing is recorded.
 *
 * @param {string} verbs - Kernel verb words plus flags.
 * @param {string} phaseName - Progress group.
 * @param {string} label - Display label.
 * @returns {Promise<void>} Settles when the command has run.
 */
async function advisory(verbs, phaseName, label) {
  const r = await cmd(verbs, phaseName, label);
  if (!r.ok) log(`${label} — did not complete (${r.detail || `exit ${r.exit_code}`}). The run continues; this output is a projection, not a gate.`);
}

/**
 * Run a kernel subcommand whose stdout is a JSON document this script needs the fields of.
 *
 * The sub-agent re-reports the document against `schema`, so what reaches this file is validated by
 * the runtime rather than parsed here.
 *
 * @param {string} verbs - Kernel verb words plus flags.
 * @param {object} schema - The shape the caller branches on.
 * @param {string} phaseName - Progress group.
 * @param {string} label - Display label.
 * @returns {Promise<(object|null)>} The validated document, or null when the agent produced none.
 */
async function query(verbs, schema, phaseName, label) {
  const r = await agent(
    `Run exactly this command and nothing else:\n\n  node "${KERNEL}" ${verbs}\n\n` +
    `It prints one JSON document on stdout. Return that document's fields as the schema names ` +
    `them, verbatim — do not add, rename, summarise or infer any value.`,
    { model: "sonnet", effort: "low", phase: phaseName, label, schema },
  );
  return (r && typeof r === "object") ? r : null;
}

// A payload field that is not known yet is ABSENT, never `null`.
//
// The two contracts either side of this line disagree about how to say "unknown", and the
// disagreement is load-bearing: `probe resume` declares `stack`, `lens`, `run_cmd` and `app_url`
// nullable — null is its legitimate answer on a fresh run — while `WorkOrderPayload` types them
// `string` and marks every one of them OPTIONAL. So the contract already models unknown as an
// absent key, and forwarding the probe's `null` into it produces an order that fails its own schema
// before a worker ever sees it. Four of the seven operations this file dispatches — orient, analyze,
// evaluate, hunt — carry such a field, ORIENT among them, so the first dispatch of every fresh run
// was refused at compile. The three that carry none (wire, map-scopes, hammer) always compiled,
// which is why the fault looked intermittent rather than total.
//
// Dropping the key is the correct direction. Widening the schema to accept null would make
// `"stack": null` a valid order and push the null downstream into every worker's prompt, where each
// one would have to re-decide what a null stack means.
const compact = (payload) =>
  Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null && v !== undefined));

/**
 * Dispatch one worker through the envelope port and get back the fields a gate needs.
 *
 * The sub-agent compiles its own WorkOrder with `harness compile`, calls the Skill against it, and
 * applies its WorkResult with `harness reduce ingest` — all in its own shell. This script never
 * couriers those commands, and the `verify envelope` hook still denies a dispatch whose order is
 * missing or schema-invalid, because that hook fires on the Skill call the sub-agent makes.
 *
 * @param {object} spec - `{skill, operation, payload, schema, phase, label, model, extra}`.
 * @returns {Promise<object>} The validated worker report, or a `__failed` marker.
 */
async function worker({ skill, operation, payload, schema, phase: phaseName, label, model = execModel, extra = "", compile, round }) {
  // The compile line is overridable because not every dispatch can be addressed the same way.
  // `--operation <op> --slug <slug>` resolves its worker from `compile`'s OP_OWNER table, which
  // covers the planner/judge/QA operations and NOT `execute`: a build order is addressed by scope,
  // round and attempt, so the generic form exits 2 ("could not resolve --worker/--operation") for
  // exactly the leg that runs most often. It used to be emitted for build legs anyway, contradicted
  // one line later by `extra`'s correct `--scope …` instruction — a prompt arguing with itself.
  // `--round` when the dispatch belongs to one. `compile` already suffixes the order id with it
  // (`evaluate-r2`), and `probe resume` already reads `evaluate-r<N>.json` back to learn which EVAL
  // rounds are done — writer and reader agreed all along and only this caller omitted the flag. The
  // cost of that omission is two facts, both silent: every relaunch restarted the round counter at
  // 1, because `eval_rounds_done` could never match `evaluate.json`; and round 2's evaluate result
  // OVERWROTE round 1's, so a run kept only its last round's envelope.
  const roundFlag = round ? ` --round ${round}` : "";
  // A CALLER-SUPPLIED PAYLOAD ONLY REACHES THE ORDER ON THE GENERIC LINE. Overriding `compile`
  // replaces the whole command, `--payload` included, so a caller that passes both is writing a
  // field nobody will ever read — which is exactly how `payload.bugs` came to be built, filtered,
  // and discarded on every fix round for the life of this file. Loud rather than fatal: the order
  // is still valid, and killing a build leg over a discarded field would cost more than it saves.
  if (compile && payload && Object.keys(compact(payload)).length) {
    log(`DISPATCH — ${label}: payload dropped (${Object.keys(compact(payload)).join(", ")}). This ` +
        `dispatch overrides its compile line, so --payload is not emitted; the order must derive ` +
        `those fields itself (see harness compile).`);
  }
  const compileCmd = compile
    || `compile --operation ${operation} --slug ${slug}${roundFlag} --payload '${JSON.stringify(compact(payload))}'`;
  const r = await agent(
    `You are running one step of an orchestrated build over feature slug "${slug}".\n\n` +
    `1. Compile the WorkOrder:\n` +
    `     node "${KERNEL}" ${compileCmd}\n` +
    `   It prints the order path on stdout.\n` +
    `2. Dispatch the worker against that order:\n` +
    `     Skill(shapeup-sdlc-plugin:${skill}) --order "<the path from step 1>"\n` +
    `   If the Skill dispatch fails or returns an error, STOP and report the error. Never work ` +
    `around a failed dispatch by doing the craft yourself — the run has a receipt gate and an ` +
    `improvised result is refused at step 3 anyway.\n` +
    `   ${extra}\n` +
    `3. Apply its WorkResult, naming the ORDER from step 1 — not any path the worker reports:\n` +
    `     node "${KERNEL}" reduce ingest --order <the path from step 1>\n\n` +
    `Then report ONLY the fields the schema names. Nothing else crosses this boundary — no ` +
    `narration, no file contents, no summary of the work.`,
    { model, phase: phaseName, label, schema, effort: "medium" },
  );
  return (r && typeof r === "object") ? r : nullFail(label);
}

// ---------------------------------------------------------------------------------------------
// GATES — the kernel's exit-code convention, unchanged: 0 cross · 4 pause · 5 abort. The resolved
// decision travels in `decision`, copied verbatim out of the kernel's own JSON.
//
// IT USED TO BE READ OUT OF `detail`, which is free prose a sub-agent writes. What came back was a
// sentence — "Command exited 0; gate QA resolved decision=run from …" — and every comparison
// downstream is against a token, so `decision === "run"` and `decision === "stop"` were false on
// every run that has ever executed. The observable effect was a documented phase that silently
// never ran and a PO answer at L3 that did nothing, with no error and no artifact to notice the
// absence by. This file's own header says nothing here reads a model's prose; this was the one
// place that did, and every gate decision passed through it.
//
// An unreadable decision now ABORTS rather than defaulting. A default is what made the original
// defect invisible: "proceed" is a plausible answer at four of these gates, so the run continued
// and read as healthy. Stopping converts a silent skip into a first-run error.
// ---------------------------------------------------------------------------------------------
const PRESETS = new Set(["ci", "guarded", "interactive"]);
const answersFlag = (a) => (!a ? "" : PRESETS.has(a) ? `--preset ${a}` : `--file ${a}`);

const TITLES = {
  L1a: "Orient Review", "L1a.5": "Wiring Review", L1b: "Board Review",
  L2: "Build Round Complete", L3: "Verdict & Loop", QA: "QA Edge Hunt", H: "Decide When to Stop",
};
const gateBlock = (g, ctx) =>
  [`⏸ GATE ${g} — ${TITLES[g] || g}`, ...Object.entries(ctx).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)].join("\n");
const paused  = (g, valid, ctx) => ({ status: "paused", paused_at: g, block: gateBlock(g, ctx), valid_decisions: valid, context: ctx });
const aborted = (g, why) => ({ status: "aborted", aborted_at: g, reason: why });
const diedAt  = (g, r) => ({ status: "aborted", aborted_at: g, reason: r.__failed });

/**
 * Resolve one gate: cross, pause, or abort.
 *
 * @param {string} gateId - Gate id (L1a, L2, …).
 * @param {string} phaseName - Progress group.
 * @param {string[]} validDecisions - What a human may answer if this pauses.
 * @param {object} ctx - The facts the gate block shows.
 * @returns {Promise<{stop?: object, decision?: string}>} `stop` carries a terminal RunReturn.
 */
async function crossGate(gateId, phaseName, validDecisions, ctx) {
  const g = await cmd(`gate --resolve ${gateId} --slug ${slug} ${answersFlag(args.answers)}`.trim(), phaseName, `gate:${gateId}`);
  if (g.exit_code === 4) return { stop: paused(gateId, validDecisions, ctx) };
  if (g.exit_code === 5) return { stop: aborted(gateId, g.detail || `GATE ${gateId} aborted`) };
  const decision = String(g.decision ?? "").trim();
  if (!validDecisions.includes(decision)) {
    return {
      stop: aborted(gateId,
        `GATE ${gateId} exited 0 but its decision did not come back as one of ` +
        `${validDecisions.join(" | ")} — got ${JSON.stringify(g.decision ?? null)}. The kernel prints ` +
        `the decision as a top-level JSON key; a run must not guess it. Re-run this gate, or answer ` +
        `it directly with --answers.`),
    };
  }
  return { decision };
}

/**
 * The phase post-condition: the artifact is on disk, or the run stops here.
 *
 * Deliberately the SAME derivation the fast-forward uses, asked about one phase. Two readings of
 * "is this phase done" that can disagree is the defect class, not a safeguard against it.
 *
 * @param {string} gate - The gate name to report the abort under.
 * @param {string} phaseKey - The phase `probe resume --require` knows.
 * @param {string} phaseName - Progress group.
 * @returns {Promise<(object|null)>} An aborted RunReturn, or null when the artifact is there.
 */
async function requirePhase(gate, phaseKey, phaseName) {
  const r = await cmd(`probe resume --slug ${slug} --require ${phaseKey}`, phaseName, `require:${phaseKey}`);
  if (r.exit_code === 0) return null;
  return aborted(gate,
    `${gate} produced no artifact: the ${phaseKey} artifact is not on disk after the phase ran and its ` +
    `result was ingested. The phase did not complete — its worker most likely escalated (a WorkResult ` +
    `may report "escalated" with an empty artifacts list) — and because completion is derived from the ` +
    `artifact, every relaunch would re-dispatch this phase and escalate again. Read the phase's result ` +
    `to see what it could not complete, resolve it, then relaunch.`);
}

// The ledger's `status` field is bookkeeping, not this file's resume oracle — the fast-forward reads
// artifacts. It survives because `reduce snapshot` and the the ship report's census hook read it to tell
// a run in flight from a finished one. A lost write is a degraded digest, not a corrupted build, so
// it warns and continues — and the warning travels in the RunReturn, because a headless stdout
// carries only the final message and a diagnostic on a channel nobody reads is not a diagnostic.
const stateWarnings = [];
async function setRunStatus(status, phaseName) {
  const r = await cmd(`probe resume --slug ${slug} --set-status ${status}`, phaseName, `status:${status}`);
  if (!r.ok) {
    const why = (r.detail || `exit ${r.exit_code}`).trim();
    log(`RUN STATE — status="${status}" did not take: ${why}. The run continues (resume is derived from ` +
        `artifacts, not from this field), but the snapshot and the the ship report's census hook will read ` +
        `this run as unfinished.`);
    stateWarnings.push(`status="${status}" did not take: ${why}`);
  }
}
const withWarnings = (ret) => (stateWarnings.length ? { ...ret, state_warnings: stateWarnings } : ret);

// =============================================================================================
// THE RUN
// =============================================================================================
phase("Preflight");

// CANARY — can THIS SESSION resolve a worker skill at all?
//
// `init run` already refused if the SKILL.md files are not on disk. That is the cheap half and it
// is not the failure: in the session that produced this defect the files were sitting right there
// in the repo, and the dispatch still returned "Unknown skill" because the plugin was not loaded.
// A file check passes green on both states that actually happen — installed-but-disabled, and a
// different version loaded — because those copies have all ten SKILL.md files too.
//
// So one real dispatch, before any worker is paid for. Deliberately with NO `--order`: this is
// testing name resolution, not doing work, and an order would leave a compiled order with no result
// in `orders/` that every reader of that directory would then have to know about. A canary that
// perturbs the run it is clearing is not a preflight.
//
// The evidence is not the sub-agent's report — it is the hook layer's. A Skill call whose name does
// not resolve fires no hook at all, so a decision row naming the skill is proof the name resolved,
// and `verify dispatch` reads that row. The sub-agent cannot write it, so it cannot fake it.
const canarySkill = "orient";
await agent(
  `Make exactly ONE tool call and nothing else: Skill(shapeup-sdlc-plugin:${canarySkill}).\n\n` +
  `Pass no arguments. Do NOT act on anything the skill returns — this is a preflight that checks ` +
  `the skill can be reached, not a request to do its work. Do not use any other tool.\n\n` +
  `Then report whether the call returned or errored, in one line.`,
  { model: "sonnet", effort: "low", phase: "Preflight", label: `canary:${canarySkill}` },
);
const canary = await cmd(`verify dispatch --skill ${canarySkill} --within 900`, "Preflight", "canary-evidence");
if (!canary.ok) {
  return aborted("preflight",
    `the ${canarySkill} skill did not resolve in this session — no dispatch reached the hook layer. ` +
    `A run would report phases completing while the sub-agents improvised every worker's craft. ` +
    `Load the plugin (\`claude --plugin-dir <repo>\`, or install and enable it) and relaunch. ` +
    `(${canary.detail || `exit ${canary.exit_code}`})`);
}

phase("Orient");

const rs = await query(`probe resume --slug ${slug}`, RESUME, "Orient", "resume-state");
// A probe that produced nothing is not an EMPTY run — it is an unknown one. Treating it as empty
// would re-dispatch every phase from the top, over a run that may be in progress.
if (!rs) {
  return aborted("probe", "the fast-forward derivation returned no state — refusing to re-dispatch a run that may already be in progress");
}

const specFolder = rs.spec_folder || `shapeup/${slug}/spec/`;
const evalDims = rs.eval_dimensions?.length ? rs.eval_dimensions : ["spec-conformance"];

// ---- ORIENT + GATE L1a ----------------------------------------------------------------------
let spikedArea = "~", spikeResult = "~", riskiest = [];
if (!rs.has_orient_artifacts) {
  log(`ORIENT — dispatching (slug ${slug})`);
  await setRunStatus("orienting", "Orient");
  const o = await worker({
    skill: "orient", operation: "orient", schema: ORIENT, phase: "Orient", label: "orient",
    payload: { pitch: rs.intake_path, spec_folder: specFolder, feature: slug, stack: rs.stack },
    // NAME THE FILES. "write the orient/ artifacts" was the whole instruction, while completion is
    // decided by four exact filenames — so a leg that did the work and called its output
    // `code-surface-map.md` and `discovered-tasks.md` aborted the run at the post-condition, having
    // spiked real code and written four genuinely useful files. The skill doc states these names
    // four times over; the dispatch prose stated them zero. Cheap to say, and the phase's completion
    // contract belongs where the worker reads it, not only where it is enforced.
    extra:
      "Read and spike real code before any board exists. The phase is COMPLETE only when the run's " +
      "orient directory — the one this order's substrate permits — contains all four of these, " +
      "named exactly: `code-surface.md`, " +
      "`discovered-seed.md`, `hill-signal.md`, and one `spike-<area>.md` (or `spike-not-needed.md` " +
      "when the risk scan came back rank 0). Any other filename leaves the phase incomplete and " +
      "the run aborts, however good the contents are.",
  });
  if (o.__failed) return diedAt("ORIENT", o);
  const post = await requirePhase("ORIENT", "orient", "Orient");
  if (post) return withWarnings(post);
  await advisory(`reduce graph --slug ${slug}`, "Orient", "graph:orient");
  spikedArea = o.spiked_area; spikeResult = o.spike_result; riskiest = o.riskiest_unknowns || [];
} else {
  log("ORIENT — artifacts already on disk, fast-forwarding past it");
}

{
  const g = await crossGate("L1a", "Orient", ["proceed", "ask", "abort"],
    { spiked_area: spikedArea, spike_result: spikeResult, riskiest_unknowns: riskiest });
  if (g.stop) return withWarnings(g.stop);
}

// ---- ANALYZE (spec tree + board) — ahead of WIRE, which reads its use cases -------------------
phase("Analyze");
if (!rs.has_spec_tree) {
  log(`ANALYZE — dispatching (slug ${slug})`);
  // "mapping", not "analyzing": the kernel's RUN_STATUSES enum is deliberately COARSER than this
  // file's phases — one value covers ANALYZE through MAP SCOPES, the stretch where the run is
  // working out the shape. `analyzing` is not a member and never was, so this call failed on every
  // single run since the cutover. It is advisory, so nothing stopped; the ledger simply stayed on
  // the previous phase and the snapshot under-reported where the run had got to.
  await setRunStatus("mapping", "Analyze");
  const a = await worker({
    skill: "ba-pitch-analyzer", operation: "analyze", schema: PHASE_OK, phase: "Analyze", label: "analyze",
    payload: { pitch: rs.intake_path, spec_folder: specFolder, feature: slug, lens: rs.lens, orient_dir: rs.orient_dir },
    extra: "Write the spec tree and the board from the orient artifacts — do not re-scan the code.",
  });
  if (a.__failed) return diedAt("ANALYZE", a);
  const post = await requirePhase("ANALYZE", "analyze", "Analyze");
  if (post) return withWarnings(post);
  await advisory(`reduce graph --slug ${slug}`, "Analyze", "graph:analyze");
} else {
  log("ANALYZE — spec tree already on disk, fast-forwarding past it");
}

// ---- WIRE + GATE L1a.5 ------------------------------------------------------------------------
phase("Wire");
if (!rs.has_wiring_map) {
  log(`WIRE — dispatching (slug ${slug})`);
  const w = await worker({
    skill: "solution-architect", operation: "wire", schema: PHASE_OK, phase: "Wire", label: "wire",
    payload: { feature: slug, spec_folder: specFolder, project_profile: rs.project_profile_path },
    extra: "Write the wiring map: per use case, engine → seam → entry-point call site → affordance.",
  });
  if (w.__failed) return diedAt("WIRE", w);
  const post = await requirePhase("WIRE", "wire", "Wire");
  if (post) return withWarnings(post);
  await advisory(`reduce graph --slug ${slug}`, "Wire", "graph:wire");
} else {
  log("WIRE — wiring map already on disk, fast-forwarding past it");
}

{
  const g = await crossGate("L1a.5", "Wire", ["proceed", "ask", "abort"], { wiring_map: "written" });
  if (g.stop) return withWarnings(g.stop);
}

// ---- MAP SCOPES + GATE L1b --------------------------------------------------------------------
phase("MapScopes");
let scopes = (rs.scope_files || []).map((p) => ({ path: p, scope_id: p.split("/").pop().replace(/\.(md|json)$/, "") }));
const mappedThisRun = scopes.length === 0;
if (scopes.length === 0) {
  log(`MAP SCOPES — dispatching (slug ${slug})`);
  const m = await worker({
    skill: "scope-architect", operation: "map-scopes", schema: MAPSCOPES, phase: "MapScopes", label: "map-scopes",
    payload: { feature: slug },
    // SAY THE PASS RULE, for the same reason ORIENT's filenames are named above: the rule lives in
    // `verify t0` (a fixture passes iff it exits 0) and the architect never saw it. Given a contract
    // that said only "commands that drive this scope end-to-end", it wrote the scope's error paths
    // as bare invocations — `todo done abc  # E_INVALID_INDEX, exit 1` — which cannot pass by
    // construction, so four of six scopes could never go T0-green however correct their code was.
    // The two that did go green were the two whose fixtures happened to be `node --test …`.
    extra:
      "Write the scope contracts (substrate whitelists, verification fixtures) and report the " +
      "riskiest-first sequence. EVERY e2e_verification_fixture MUST EXIT 0 when the scope is " +
      "correct — T0 scores any non-zero exit as a failure, so a fixture written as a bare " +
      "error-path invocation can never pass and its scope can never go green. Put expected " +
      "non-zero exits INSIDE a test file that itself exits 0, and name that test file as the " +
      "fixture. Write `e2e_verification_fixtures` as a FRONTMATTER key holding bare command " +
      "strings — a `## e2e_verification_fixtures` markdown section is not parsed, and a command " +
      "with prose appended to it is not runnable. A scope whose fixtures do not parse has nothing " +
      "to verify it and is refused at the board review.",
  });
  if (m.__failed) return diedAt("MAP SCOPES", m);
  const post = await requirePhase("MAP SCOPES", "map-scopes", "MapScopes");
  if (post) return withWarnings(post);
  await advisory(`reduce graph --slug ${slug}`, "MapScopes", "graph:map-scopes");
  scopes = m.scopes;
} else {
  log(`MAP SCOPES — ${scopes.length} scope contract(s) already on disk, fast-forwarding past it`);
}

// DEPENDENCY ORDER — a scope is never built beside a scope it consumes.
//
// The fan-out used to chunk scopes by a fixed width over the directory's alphabetical order. On the
// criterion-1 run that scheduled `cli-integration` — the scope that wires every other scope's module
// to the entry point — SECOND, beside the very scopes it consumes. It failed both rounds, and its
// failure was the whole of the run's failure: five of six scopes went green, `bin/todo.js` stayed a
// placeholder, and four individually T0-green command modules were unreachable.
//
// Both facts are derived by the kernel from the contracts' `tasks` and the board's `depends_on`, so
// nothing here declares either one. The waves fix the ORDER scopes are considered in; the edges fix
// when each one is RELEASED. Concurrency is never constrained by either — only dependency edges are.
const wavesFrom = (raw, list) => {
  const byId = new Map(list.map((s) => [s.scope_id, s]));
  const idOf = (p) => String(p).split("/").pop().replace(/\.(md|json)$/, "");
  const w = (raw || []).map((g) => g.map((p) => byId.get(idOf(p))).filter(Boolean)).filter((g) => g.length);
  // Every scope must appear exactly once, or the grouping is not trustworthy and one wave — today's
  // behavior — is the safe answer. A scheduler that drops a scope is worse than an unscheduled one.
  return w.length && w.reduce((a, g) => a + g.length, 0) === list.length ? w : [list];
};
let waves = wavesFrom(rs.scope_waves, scopes);
let rawDeps = rs.scope_deps;
if (mappedThisRun && scopes.length > 1) {
  // The contracts were written THIS run, so the state probed before MAP SCOPES could not have seen
  // them. One cheap re-derivation, on the fresh-run path only.
  const rs2 = await query(`probe resume --slug ${slug}`, RESUME, "MapScopes", "scope-waves");
  if (rs2?.scope_waves?.length) { waves = wavesFrom(rs2.scope_waves, scopes); rawDeps = rs2.scope_deps; }
}
// The waves flattened ARE the build order: dependencies first, input order within a level. At a dial
// of 1 the window degrades to exactly this sequence, which is the sequential lane unchanged.
const buildOrder = waves.flat();
const scopeReleases = scopeEdges(rawDeps, waves, scopes);
if (waves.length > 1) {
  const edgeCount = [...scopeReleases.values()].reduce((a, s) => a + s.size, 0);
  log(`BUILD order — ${waves.length} dependency wave(s): ${waves.map((w) => w.map((s) => s.scope_id).join("+")).join(" → ")}` +
      ` · ${edgeCount} release edge(s), window ${maxParallelScopes}`);
}

// Advisory lints at L1b. spec-lint is hard — a substrate overlap makes parallel builds unsafe;
// trace-lint stays advisory until `covers:` is populated; hill-derive is a projection.
const specLint = await cmd(`verify spec --slug ${slug}`, "MapScopes", "spec-lint");
if (!specLint.ok) {
  return aborted("L1b", `spec-lint reported a disjointness or size problem before BUILD: ${specLint.detail || `exit ${specLint.exit_code}`}`);
}
await advisory(`verify trace --slug ${slug} --quiet`, "MapScopes", "trace-lint");
await advisory(`reduce hill --slug ${slug}`, "MapScopes", "hill-derive");

{
  const g = await crossGate("L1b", "MapScopes", ["proceed", "ask", "abort"], { scopes: scopes.map((s) => s.scope_id) });
  if (g.stop) return withWarnings(g.stop);
}

// =============================================================================================
// ROUNDS of BUILD → GATE L2 → EVAL → GATE L3, bounded by maxRounds.
//
// The round loop is inlined here rather than dispatched round-by-round because a round dispatched
// once can attempt every scope from attempt 1, while an outer loop must survive a mid-BUILD kill
// and resume without re-work. So before opening a scope's attempt loop this file asks whether THIS
// ROUND already has a green T0 verdict for it on disk, and skips the scope entirely when it does.
// =============================================================================================
let round = rs.eval_rounds_done?.length ? Math.max(...rs.eval_rounds_done) + 1 : 1;
let verdict = null;
const allGreen = [];
const allHammer = [];
// OUTSIDE the loop, because its whole purpose is to cross a round boundary: round r's verdict is
// what round r+1 has to act on. Declared inside, it was in the temporal dead zone at the BUILD that
// needed it — a runtime error no static check can see, since nothing but a real second round ever
// reaches that line.
let findings = [];

while (round <= maxRounds) {
  phase("Build");
  await setRunStatus("building", "Build");

  // The wall-clock breaker, opt-in, checked at each round boundary. Exit 6 is "tripped": route to
  // GATE H and ship what is green, never kill the run from outside.
  const budget = await cmd(`verify budget --slug ${slug} --strict`, "Build", `budget:r${round}`);
  if (budget.exit_code === 6) {
    await advisory(`reduce hill --slug ${slug}`, "Build", "hill-derive");
    return withWarnings({ status: "gate_h", breaker: "deadline", hammer_proposals: allHammer, green_scopes: allGreen });
  }

  log(`BUILD round ${round} — ${scopes.length} scope(s), up to ${maxParallelScopes} at once, attempt budget ${attemptBudget}`);
  const roundGreen = [], roundHammer = [];

  // ONE bounded query opens the round, instead of one probe per scope. The graph is a projection of
  // the same verdict artifacts `probe t0` reads, so this is the identical fact asked once — which is
  // the difference between a read model and a directory walk.
  const g = await query(`reduce graph --slug ${slug} --subgraph run`, SUBGRAPH, "Build", `graph:r${round}`);
  const alreadyGreen = new Set(g?.green_scopes_by_round?.[String(round)] || []);
  if (alreadyGreen.size) log(`BUILD r${round} — ${alreadyGreen.size} scope(s) already green in the graph, skipping them`);

  // SCOPES FAN OUT. A scope contract is the definition of an independent subtask — disjoint
  // substrate, own fixtures, own ratchet — so the loop that ran them one at a time was leaving the
  // whole point of the contract on the floor. `pipeline()` has NO barrier between its stages: a
  // fast scope is being confirmed while a slow one is still on attempt 3. One pipeline per scope,
  // so that property is now GLOBAL rather than per group — nothing waits on a group boundary, and
  // the window refills the instant any leg settles.
  //
  // Three stages, because each answers a different question about the same scope:
  //   check   — is it already green on disk from a killed round? (resume, no re-work)
  //   build   — the attempt ratchet, inside the worker's own shell
  //   confirm — MEASURED, NOT CLAIMED: the worker says green; the T0 artifact has to agree.
  //             A green with no artifact on disk is a claim, and the evaluator that must cite that
  //             artifact would find nothing.
  // NEVER RETURN `null` FROM A STAGE TO MEAN "carry on". The runtime reads a null stage result as
  // DROP THIS ITEM and skips its remaining stages — measured directly, not inferred:
  //
  //     stage1 → null    ⇒ stage2 ran 0/3 times, settled = [NULL, NULL, NULL]
  //     stage1 → {…}     ⇒ stage2 ran 3/3 times
  //
  // This stage used to return `null` for "not green yet — stage 2, please build it", which meant
  // every scope that was not ALREADY green was dropped before `buildScope` could run. On a fresh
  // run that is every scope, so the round ended with 0 green and 6 queued, the inner breaker tripped
  // and the run returned `gate_h` having dispatched no builder at all. BUILD could never dispatch;
  // the failure looked exactly like six genuinely hard scopes.
  const settled = await scheduleScopes(buildOrder, scopeReleases, maxParallelScopes, async (scope) => {
    const done = await pipeline(
      [scope],
      async (s) => (alreadyGreen.has(s.scope_id)
        ? { scope_id: s.scope_id, green: true, resumed: true }
        : { scope_id: s.scope_id, pending: true }),   // not green yet → stage 2 builds it
      async (pre, s) => (pre?.pending ? buildScope(s, round) : pre),
      async (res, s) => {
        if (!res || res.__failed) return res;
        if (res.resumed || !res.green) return res;
        const confirmed = await query(`probe t0 --slug ${slug} --scope ${s.scope_id} --round ${round}`,
          T0CHECK, "Build", `t0confirm:${s.scope_id}-r${round}`);
        if (confirmed?.green) return res;
        log(`BUILD r${round} — ${s.scope_id} reported green but no T0 verdict is on disk for this ` +
            `round; treating it as not green (the evaluator cites that artifact, and it is not there).`);
        return { ...res, green: false, reason: "reported green with no T0 verdict artifact on disk" };
      },
    );
    return done[0];
  });

  for (const [i, res] of settled.entries()) {
    const scopeId = buildOrder[i].scope_id;
    // A dead builder is a SPENT ATTEMPT, not a dead run: the scope goes to GATE H's census and
    // the round continues. Killing the run here would discard every other scope's green work.
    if (!res || res.__failed) {
      log(`BUILD r${round} — ${scopeId} lost its worker: ${res?.__failed || "no result"}`);
      roundHammer.push(scopeId);
    } else if (res.green) {
      roundGreen.push(res.scope_id || scopeId);
    } else {
      roundHammer.push(res.scope_id || scopeId);
    }
  }

  allGreen.push(...roundGreen);
  allHammer.push(...roundHammer);

  // INNER breaker: nothing green and something queued → GATE H. The census is scope-hammer's job.
  if (roundGreen.length === 0 && roundHammer.length > 0) {
    await advisory(`reduce hill --slug ${slug}`, "Build", "hill-derive");
    return withWarnings({ status: "gate_h", breaker: "inner", hammer_proposals: allHammer, green_scopes: allGreen });
  }

  await advisory(`reduce hill --slug ${slug}`, "Build", "hill-derive");
  {
    const g = await crossGate("L2", "Build", ["proceed", "ask", "abort"],
      { round, green_scopes: roundGreen, hammer_proposals: roundHammer });
    if (g.stop) return withWarnings(g.stop);
  }

  // ---- EVAL — exactly one feature-level pass per round (the single-judge invariant) ------------
  phase("Eval");
  await setRunStatus("evaluating", "Eval");
  if (args.noEval) {
    log("EVAL — skipped (--no-eval)");
    verdict = "pass";
  } else {
    const e = await worker({
      skill: "spec-evaluator", operation: "evaluate", schema: EVAL, phase: "Eval", label: `eval:r${round}`,
      model: evalModel, round,
      payload: { dimensions: evalDims, run_cmd: rs.run_cmd, round },
      extra: "Evaluate the running feature against every acceptance criterion and Done-when. One feature-level pass; cite the T0 artifact you re-hash yourself.",
    });
    if (e.__failed) return diedAt("L3", e);
    verdict = e.overall === "PASS" ? "pass" : "fail";
    findings = e.findings || [];
  }

  // ---- REFUTE WAVE (opt-in) — one independent skeptic per FAIL finding, BEFORE it costs a whole
  // fix round. Perspective-diverse by prompt: the refuter is told to try to refute and to default to
  // "real" when it cannot. A pure addition; off unless args.adversarialVerify.
  if (verdict === "fail" && args.adversarialVerify && findings.length) {
    phase("Refute");
    const checks = await parallel(findings.map((f) => () =>
      agent(
        `A single judge marked this acceptance criterion FAILED for slug "${slug}":\n` +
        `  criterion: ${f.criterion}\n  evidence: ${f.evidence}\n\n` +
        `Independently try to REFUTE the failure by exercising the running feature yourself. ` +
        `Return refuted=true ONLY if you can show it actually passes; otherwise refuted=false.`,
        { model: evalModel, phase: "Refute", label: `refute:${f.id}`, schema: REFUTATION },
      )));
    const overturned = new Set(checks.filter(Boolean).filter((c) => c.refuted).map((c) => c.id));
    if (overturned.size) log(`REFUTE — ${overturned.size}/${findings.length} FAIL finding(s) overturned by an independent skeptic`);
    if (overturned.size === findings.length) {
      verdict = "pass";
      log("REFUTE — every finding was overturned; treating this round as PASS");
    }
  }

  await advisory(`reduce graph --slug ${slug}`, "Eval", `graph:eval-r${round}`);
  await advisory(`reduce hill --slug ${slug}`, "Eval", "hill-derive");
  const g3 = await crossGate("L3", "Eval", ["loop", "stop", "ask"], { round, verdict });
  if (g3.stop) return withWarnings(g3.stop);

  if (verdict === "pass") break;                                  // → QA → GATE H → ship
  if (g3.decision === "stop" || round >= maxRounds) {
    return withWarnings({ status: "gate_h", breaker: "outer", hammer_proposals: allHammer, green_scopes: allGreen });
  }
  round += 1;
}

if (verdict !== "pass") {
  return withWarnings({ status: "gate_h", breaker: "outer", hammer_proposals: allHammer, green_scopes: allGreen });
}

// ---- QA (post-PASS, pre-ship) — a level-up, never a gate. `--no-qa` answers it "skip". --------
phase("QA");
let qaFindings = 0;
const qaG = await crossGate("QA", "QA", ["run", "skip", "ask"], { round, verdict });
if (qaG.stop) return withWarnings(qaG.stop);
const qaRan = !args.noQa && qaG.decision === "run";
if (qaRan) {
  const q = await worker({
    skill: "qa-edge-hunter", operation: "hunt", schema: QA_REPORT, phase: "QA", label: "hunt", model: qaModel,
    payload: { feature: slug, spec_folder: specFolder, app_url: rs.app_url, round },
    extra: "Exploratory hunt over the shipped feature. No verdict and no score — findings only, each with a repro.",
  });
  // QA is a level-up: losing its worker costs the findings, not the run.
  if (q.__failed) log(`QA — the hunt lost its worker: ${q.__failed}. Shipping without QA findings.`);
  else qaFindings = q.findings_count;
}

// ---- GATE H — delegated to scope-hammer (census, baseline comparison, cut list) ----------------
phase("Ship");
const h = await worker({
  skill: "scope-hammer", operation: "hammer", schema: HAMMER, phase: "Ship", label: "hammer",
  payload: { feature: slug, qa_findings: qaFindings, hammer_proposals: allHammer },
  extra: "Run the census, compare against the BASELINE and never the ideal, and produce the cut list.",
});
if (h.__failed) return diedAt("H", h);
if (h.verdict === "cannot-ship") {
  return withWarnings(aborted("H", `scope-hammer: CANNOT SHIP — ${h.cut_list.join(", ") || "a must-have failed"}`));
}

{
  const g = await crossGate("H", "Ship", ["accept-cut-list", "ship-all", "ask"], { verdict: h.verdict, cut_list: h.cut_list });
  if (g.stop) return withWarnings(g.stop);
}

const ship = await cmd(`reduce ship --slug ${slug} --verdict PASS --qa ${qaRan ? "run" : "skipped"}`, "Ship", "ship-report");
await advisory(`report export --slug ${slug}`, "Ship", "export-run");
await setRunStatus("shipped", "Ship");

// The dimensions this run did NOT evaluate, so GATE L4 can say what "shipped" does not cover.
const ALL_DIMS = ["spec-conformance", "tdd-surface", "integration", "completeness",
                  "test-surface-conformance", "security", "performance"];

return withWarnings({
  status: "shipped",
  verdict: "pass",
  rounds_used: round,
  dims_not_evaluated: ALL_DIMS.filter((d) => !evalDims.includes(d)),
  qa_findings: qaFindings,
  report: ship.detail || `shapeup/${slug}/REPORT.md`,
});

// =============================================================================================
// buildScope — one scope's full attempt ratchet, as a single worker leg.
//
// The ratchet lives inside the worker's own shell rather than in this control script because each
// attempt is implement → `harness verify t0`, and both halves need a real filesystem and a real
// git. The worker reports only the outcome the round loop branches on.
// =============================================================================================
async function buildScope(scope, roundNo) {
  // THE VERDICT'S BUGS REACH THIS LEG THROUGH ITS ORDER, NOT THROUGH THIS FUNCTION.
  //
  // `WorkOrderPayload.bugs` is "the EVAL report's bug entries for this task — touch nothing else",
  // and AGENTS.md states the regression rule as "bugs + full Test Surface of touched UC". Nothing
  // populated it, so a round r+1 leg was dispatched with no idea the judge had cited anything: it
  // re-ran T0, found the scope still green, and reported done. Measured — EVAL returned FAIL naming
  // five defects at file:line; round 2 kept all six trees and changed none of them, and every bug
  // re-probed identically.
  //
  // Threading them from here was tried first and cannot work, twice over: a build order overrides
  // the compile line (below), and only the GENERIC line serialises `--payload`, so the field was
  // built and dropped; and the value lived in a variable, which a relaunch between two rounds
  // resets to empty. `harness compile` reads them off the ledgered verdict instead — see
  // `verdictBugs` — so a fresh round and a resumed one take the identical path.
  //
  // `digested_errors` could not cover this: it carries AEGIS triples from a RED T0, and a scope
  // whose fixtures pass while its behaviour contradicts the spec has no red trial to digest. That
  // gap is why EVAL is a separate layer, so the channel out of it has to be separate too.
  return worker({
    // No `operation` either, and for the same reason as the payload: the compile override below
    // replaces the whole command, so a declared operation here would be discarded — and it would
    // now be WRONG as well as dead. `harness compile` derives it: a round carrying cited defects
    // compiles as `fix`, which is the operation task-executor's own contract binds `payload.bugs`
    // to, and a round with nothing cited stays `execute`.
    skill: "task-executor", schema: SCOPE_RESULT, phase: "Build",
    label: `build:${scope.scope_id}-r${roundNo}`,
    // A build order is addressed by scope + round + attempt, never by operation: the attempt number
    // is part of its identity, so there is one order per attempt and the generic slug form cannot
    // express it. NOTE this override is why no `payload` is passed — it would be discarded.
    compile: `compile --scope ${scope.path} --round ${roundNo} --attempt 1`,
    extra:
      (roundNo > 1
        ? `THIS MAY BE A FIX ROUND. If your compiled order carries \`payload.bugs\`, the evaluator ` +
          `returned FAIL last round and those are the defects it cited against files you own — each ` +
          `with the criterion it broke and a file:line. Fix exactly those and touch nothing else. ` +
          `They are spec-conformance defects, so T0 already passes and will keep passing whether or ` +
          `not you fix them: a green T0 is NOT evidence you are done this round, and re-running the ` +
          `fixtures cannot tell you. Read the cited lines against the committed spec, change them, ` +
          `and keep T0 green. An entry marked \`unowned\` cites no file any scope owns — fix it only ` +
          `if it falls inside your substrate. `
        : "") +
      `Re-compile the order for every attempt after the first, with --attempt <n>. ` +
      `Run the attempt ratchet for THIS scope only: up to ${attemptBudget} attempts of implement → ` +
      `\`node "${KERNEL}" verify t0 ${scope.path} --round ${roundNo} --attempt <n>\`, each scored against ` +
      `the last kept trial. Stop on the first green T0, or when the attempt budget or the stagnation ` +
      `breaker trips. Write only inside this scope's substrate whitelist — the sandbox hook enforces it. ` +
      `Report green, attempts_used, which breaker (if any) tripped, and the T0 artifact path.`,
  });
}
