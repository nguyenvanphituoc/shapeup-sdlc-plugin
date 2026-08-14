# ShapeUp SDLC Plugin — Architecture Review

**Lens:** *Graph Engineering — The Karpathy Loop, Improved 1000x by Itself* (Anthropic Playbook synthesis, July 2026)
**Subject:** `nguyenvanphituoc/shapeup-sdlc-plugin` @ v1.7.0 (~45,500 LOC, 12 skills, 10 hooks, 16 orchestration scripts)
**Scope of this review:** bad things, improvements, and the workflow — reworked to run on **Claude's native Dynamic Workflow** runtime. Evaluation/measurement machinery is intentionally out of scope per your request; where a finding brushes the evaluator it is an *architectural* observation, not a scoring one.
**Companion file:** `shapeup-run.native.js` — a drop-in-shaped rewrite of the BUILD-phase orchestrator in native Workflow format.

---

## TL;DR

Your harness has the *right ideas* and the *wrong substrate*. The planner→generator→judge split, the artifact-contract envelope, the single-writer reducer, measured-not-claimed progress, reversibility, and gate-by-hook enforcement are all exactly what the article argues a graph-grounded agent system should have. You are at the article's "Week 2 → Month 1" maturity on *concept*.

But three structural decisions pull hard against the article:

1. **You re-implemented the Dynamic Workflow runtime by hand** (`run-workflow.mjs`) instead of using the native `Workflow` tool — and a large fraction of the codebase's cleverness exists only to survive failure modes that home-rolled runtime creates.
2. **The workflow is a strict sequential chain** (`for (const scope of scopes)`) even though you built — and pay for — all the scope-isolation machinery that exists precisely to make scopes run *in parallel*. You bought the swarm and run the chain.
3. **You stopped one step short of the graph.** Your provenance ("which order produced which verdict, which trial superseded which, which scope covers which requirement") is real but scattered across markdown + JSON and re-scanned by directory walks. The article's entire thesis is that this should be a *queryable graph read once*, not a history *replayed every relaunch*.

Fixing #1 deletes code. Fixing #2 is the biggest wall-clock win you have. Fixing #3 makes true the one sentence the article says a reliable system must be able to make.

---

## What the article actually argues (the yardstick)

So the findings below have a fixed reference, here is the article compressed to its load-bearing claims:

- **Each architecture externalizes one bottleneck.** A *loop* externalizes iteration; a *chain* externalizes order; a *swarm* externalizes parallel search; a *DAG* externalizes lineage; a *knowledge graph* externalizes shared memory. The progression is *directional, not mandatory* — you add a layer only when it earns its cost.
- **Four conditions make an autonomous loop safe:** output verifiable, action reversible, horizon short, environment bounded.
- **Dynamic Workflows** = Claude writes a JS orchestration program the *native runtime* executes: ≤16 concurrent sub-agents, hard cap 1000, **fresh context per sub-agent**, **structured outputs are the only "training data,"** resume-from-journal, worktree isolation.
- **The graph is the shared-memory layer** that lets multi-agent systems scale *without copying every worker transcript into the orchestrator's context*. Keep two graphs, deliberately un-collapsed: the **commit DAG** (work lineage — "what changed, which run produced it") and the **knowledge graph** (domain knowledge — "which entities exist, how they relate").
- **Five planes**, never collapsed into one transcript: control, execution, artifact, graph, evaluation. "The separation prevents one chat transcript from becoming the database, the workflow engine, and the audit log."
- **Six decision questions:** verifiable? steps stable? subtasks independent? alternative lineages needed? must facts survive the run? can you afford the cost?
- **The reliability invariant (the thesis):** *"Every important output can be traced to an objective, a plan, an artifact, a source, a graph path, an evaluator decision, and a bounded execution record."* When that is false, adding agents increases opacity.
- **Costs are real:** dynamic fan-out is expensive (a 1,000-sub-agent run is tens of dollars); fragmentation degrades tasks that need one coherent context; a graph is only justified when connected queries, provenance, evolving relations, or shared world state are genuinely central — *"do not introduce a knowledge graph merely because the system has agents."*

---

## Part 1 — The bad things

### BAD-1 · You rebuilt the runtime you were supposed to stand on

`run-workflow.mjs` (~380 lines) is a hand-rolled re-implementation of the native Workflow runtime: it re-derives the semaphore, `agent()`, `parallel()`, `pipeline()`, `phase()`, `log()`, the `budget` object, JSON extraction, shallow schema validation, the one-retry loop, and SIGTERM/SIGKILL timeout handling. Every `agent()` call it services is a **cold `claude -p` subprocess**. Meanwhile `shapeup-run.js` is written in the *exact* native Workflow script format (`export const meta`, top-level `await`/`return`) — so you wrote a Workflow script and then wrote a second runtime to avoid running it on the first.

Your own header explains why: the native `Workflow` tool is denied by default in a headless session, and the only grant that unblocks it is the unscoped `"Workflow"` token (which permits *every* dynamic script in the project), whereas Bash has a path-scoped prefix grant `npx shapeup-sdlc init` already writes. That is a genuine and well-reasoned constraint. But look at what it costs you against the article:

- **You lose every property the article credits to Dynamic Workflows.** Native resume-from-journal, native worktree isolation, the in-process 16-concurrency cap, and — critically — **prompt-cache-warm sub-agents**. Your `claude -p` spawns pay full cold input-token cost on *every* dispatch. The article's headline limitation is "Dynamic Workflows are expensive"; your substitution makes each sub-agent maximally expensive.
- **The re-implementation has already drifted in five documented ways** (USD budget not tokens; `Date.now()`/`Math.random()` not banned so no replay-safe resume; `workflow()` throws; `isolation:'worktree'` throws; validation is one level deep). Each divergence is debt that will silently diverge further from the real runtime you're emulating.
- **It forced an entire sub-genre of your own bugs** — see BAD-2.

**This is the finding to act on first, because fixing it deletes code rather than adding it.** The article's framing — "gates the agent cannot talk its way past" — is *better* served by the native runtime plus one documented permission grant than by a parallel runtime that must be kept bug-for-bug in sync with the platform. The path-scoping worry is legitimate; the right answer is to treat the `"Workflow"` grant as a documented install option (you already half-acknowledge this) rather than to own a runtime.

### BAD-2 · Most of the "cleverness" is self-inflicted — the courier pattern

Because the orchestrator runs as a script with no filesystem and no shell of its own, it executes every command by asking a *sub-agent* ("mech courier") to run the shell command and report stdout back as data. That single decision spawns a whole defense industry inside your codebase:

- `parseMechJson` — a hand-written balanced-brace scanner to recover JSON a chatty model wrapped in prose.
- `mechEnvelope` / the "dead courier" handling — because a courier can be safety-blocked and return `null`, which crashes the workflow with a `status:"failed"` that isn't in your `RunReturn` union.
- The multi-paragraph prompt engineering telling the courier *not* to append `; echo EXIT:$?` (a real measured run aborted on a trailing `EXIT:0`).
- The `resultFor` / `baseOf` directory-vs-file path guessing, because workers "guess differently" where to write results.

**None of this class of bug exists in a native Workflow script.** There, the orchestrator branches on the *structured return value of `agent()`* — a validated object — and never parses a model's free text at all. The mechanical `node …` calls that today go through a courier either (a) move into the worker skills where a real shell exists, or (b) become a structured `agent()` that returns typed fields. You are spending real engineering to defend against "a courier is a model, not a pipe" — a problem you created by using a model as a pipe.

Through the article: this is the **five-planes collapse**. Your control plane (the script) is also trying to be the execution plane (run shell) and the artifact plane (read state files) at once, so it reaches for couriers to do I/O it shouldn't be doing. Separate them and the couriers vanish.

### BAD-3 · A sequential chain wearing a swarm's armor

`shapeup-run.js` is `ORIENT → ANALYZE → WIRE → MAP SCOPES → for(scope of scopes){ build → verify } → EVAL → QA → SHIP`. The scope loop is strictly sequential — one scope, one attempt at a time — and the file's own comment concedes "shapeup-run.js is sequential today." It never issues a single concurrent `agent()`: no `parallel()`, no `pipeline()`.

Now hold that against what you *built to support parallelism*: disjoint per-scope substrate whitelists, a `sandbox-guard` hook that enforces them, branch-per-scope checkout, and a single-writer `ingest-result.mjs` reducer. Your README sells exactly this: *"Parallel work can't corrupt shared state… → Prevents: two parallel executors both rewriting the board."* **There are no two parallel executors.** You pay the entire cost of making scopes safely parallel and then run them one at a time.

The article's decision question #3 is blunt: *"Are subtasks independent? If yes, parallelize."* Scopes are independent *by construction* — that's the definition of a scope contract. This is the textbook Workflow anti-pattern (a `for` loop over independent items where a `pipeline()` belongs), and it's your single biggest wall-clock loss. Month 2 of the article's build path describes your exact situation: *"select one embarrassingly parallel workload… set a concurrency limit, define a reducer before fan-out."* You have the reducer (ingest). You have the concurrency machinery (the semaphore, unused at the script level). You just never fan out.

### BAD-4 · You stopped one step short of the graph — and the graph is the whole point

The article is titled *Graph Engineering*, and your harness is graph-shaped everywhere but never actually a graph:

- **A commit-DAG-equivalent already exists, flattened:** `orders/` → `results/` → `verdicts/`, `trial_history[]`, T0 artifacts with re-hashed sha256 citations, `round-ledger.md`, `harness-run.md`. This *is* work lineage — "every artifact has an authoring run and version; every evaluation identifies a rubric." But it lives as scattered markdown and JSON, and is read by **ad-hoc directory scans** (`resume-state.mjs` walks folders on every relaunch). That is *replaying history*, which is precisely the failure the article's shared-memory layer exists to end: *"retrieve the connected state needed for the current decision rather than replay the entire history."*
- **A knowledge graph already exists, flattened:** the DDD spec tree (`domain-model.md`, `usecases/`, `wiring-map`, `requirements.md`, `use_case_refs`, `## Test Surface`) is a typed entity/relation graph serialized as linked prose. Your **wiring map** — per-UC `engine → seam → entry-point → affordance` — is literally a graph written as a table.

Because there's no queryable graph, your orchestrator has "no filesystem of its own" and must re-derive everything through couriers (BAD-2) — the fast-forward probe re-scans the entire run state on every launch. Introduce one typed, append-only **run graph** and three things happen at once: the fast-forward becomes a *bounded subgraph query* instead of a full re-scan; the orchestrator's working set becomes a small subgraph instead of a re-read of all state; and provenance becomes first-class and inspectable.

Crucially, the article's own caution *supports* the graph here rather than warning against it: *"do not introduce a knowledge graph merely because the system has agents… a graph earns its cost when connected queries, provenance, evolving relations, or shared world state are central."* For most harnesses that's a reason to skip the graph. For *yours* — whose entire resumability and audit story is provenance and cross-round/cross-session state — the graph is *earned*. You already believe the thesis; you just haven't made it queryable. Today the reliability invariant ("every output traces to an objective, a plan, an artifact, a source, a graph path, an evaluator decision, a bounded record") is true *in spirit and false in practice*, because "trace" means "grep several markdown files," not "walk an edge."

### BAD-5 · Cold sub-agents defeat the cost model

Related to BAD-1 but worth isolating: the article praises "fresh context per sub-agent," meaning a sub-agent that doesn't inherit the orchestrator's *polluted* context — **within one runtime that still shares the session prompt cache.** Your `claude -p` dispatch gives you fresh context by launching a fresh *operating-system process* with a cold cache. That's the wrong kind of fresh: you get the isolation benefit and throw away the caching benefit, so every worker pays full freight on its system prompt and skill instructions each time. On a real multi-scope, multi-round, multi-attempt run this is the dominant cost, and it's invisible in a single-leg test.

### BAD-6 · Over-narrated code is archaeology, not architecture

`shapeup-run.js` is ~900 lines, and a large share is paragraph-length comments narrating *past* defects ("measured, run 3…", "the kill/resume probe found…", "two workers guessed differently and both legs died at phase one"). This is a real maintenance smell: the code documents the *history of its bugs* rather than its *current contract*. A new maintainer can't tell which comments describe an active invariant and which memorialize a fixed bug. The article's build path is incremental for exactly this reason — each layer stays legible. When you move to the native runtime, resist porting the archaeology; the native runtime removes the failure classes those paragraphs defend against, so they should be *deleted*, not translated.

### BAD-7 (minor, and de-scoped) · The single-judge bottleneck

You de-prioritized evaluation, so this is one paragraph. Your "single judge" invariant is defensible on cost, but note the *architectural* tension: the article's Evaluator-Optimizer and the Workflow tool's own guidance both push toward *perspective-diverse verification* — "a verification wave helps only if reviewers have a different prompt, evidence set, or role." Once you have cheap parallelism (BAD-3 fixed), verifying each EVAL *FAIL finding* with one independent refuter before it costs a whole fix round is nearly free and catches plausible-but-wrong failures. The companion script includes this as an opt-in wave you can leave off.

---

## Part 2 — What you got right (so the review is honest)

These are not filler; they are the reasons the fixes above are *small* rather than a rewrite:

- **Planner → generator → judge with artifact contracts** is the article's Week-2 recommendation verbatim ("planner, implementer, test author, reviewer… every handoff should be an artifact contract").
- **The envelope port** (WorkOrder in / WorkResult out, schema-validated, hook-denied when malformed) *is* "structured outputs are the only training data" plus "every handoff is an artifact contract."
- **Single-writer `ingest-result.mjs`** is "define a reducer before fan-out" — you defined it before you needed it, which is exactly right.
- **Measured-not-claimed progress** (T0 re-hashed artifacts, evaluator must cite them, hill phase derived mechanically) is the article's "progress is measured, not claimed" and "every claim has a source."
- **Reversibility** via branch-per-scope + `git reset` is loop condition #2, done properly.
- **The three-level circuit breaker + budgets** is the "complexity budget… return best current work when exhausted, don't hide partial failure behind a fluent answer."
- **Gate-by-hook enforcement** ("hook-denials, not arguments") is genuinely the right way to build "gates the agent cannot talk its way past."

You built the hard, correct parts. The problems are all *placement*: right mechanism, wrong plane or wrong concurrency.

---

## Part 3 — The improvements, ordered by payoff

1. **Adopt the native Workflow runtime; delete `run-workflow.mjs` and the courier layer.** Ship the `"Workflow"` grant as a documented, opt-in install step (with the path-scoping caveat stated honestly). Net effect: minus ~380 lines of runtime, minus `parseMechJson`/`mechEnvelope`/EXIT-marker/`resultFor` defenses, plus native resume + worktree + cache-warm sub-agents. *This is a subtraction.*

2. **Fan scopes out with `pipeline()`.** Replace `for (const scope of scopes)` with `pipeline(scopes, buildStage, verifyStage)`, the per-scope attempt-ratchet living inside `buildStage`, T0 verifying each scope the moment its build lands. Use `isolation:'worktree'` so parallel builds can't collide — which lets you *retire* the manual branch-per-scope checkout. Cap concurrency to your budget. This is the wall-clock win and the reducer already makes it safe.

3. **Introduce one typed run graph as the read model.** Nodes `{Objective, Scope, Task, Order, Result, Verdict, Trial, Requirement, UseCase, Discovery, GateDecision}`; edges `{DERIVED_FROM, EVALUATES, SUPERSEDES, COVERS, DEPENDS_ON, PRODUCED, BLOCKS}`. Persist append-only (JSONL, or a tiny SQLite as AgentHub does). Keep the two graphs *separate* per the article: a work-lineage graph (orders/results/verdicts/trials) and a domain graph (requirements/use-cases/scopes/wiring). Then:
   - `resume-state` becomes `graph.subgraph(slug)` — a bounded query, not a directory walk.
   - The orchestrator's context becomes a small subgraph, not a re-read of all state.
   - The reliability invariant becomes *literally true*: every node carries its authoring run, every verdict edges to the rubric and the T0 it cites, every scope edges to the requirements it covers.

4. **Separate the five planes explicitly.** Control = the workflow script (sequences, branches on structured returns, owns *no* I/O). Execution = the workers (real shell, real fs). Artifact + Graph = the reducer/ingest writing the run graph. Evaluation = spec-evaluator + optional refute wave. Once control does no I/O, the couriers are gone by construction.

5. **(Optional, cheap once parallel) Add a refute wave on EVAL FAIL findings** and a best-of-N attempt option for genuinely hard scopes. Both are pure additions the article's judge-panel / adversarial-verify patterns describe; both are guarded so cost stays opt-in.

6. **Prune the archaeology.** When porting, keep comments that state the *current* contract; drop the ones that narrate dead bugs. Target: the orchestrator readable in one sitting.

---

## Part 4 — The reworked workflow (`shapeup-run.native.js`)

The companion file is the BUILD-phase orchestrator rewritten in **native Dynamic Workflow format**, applying improvements 1–5. It is a *targeted rework*, not a clean-slate: it keeps your phase order, your gate/breaker semantics, your `RunReturn` union, your worker roster, and your envelope port. What changes is the substrate:

- **Runs on the native `Workflow` tool.** No `run-workflow.mjs`, no `claude -p` spawns, no semaphore of your own.
- **No courier.** Every step is either an `agent()` returning a validated object, or a mechanical call the *worker* performs and reports back structured. The script never parses a model's prose.
- **Scopes fan out** via `pipeline()`, each with its own attempt ratchet, T0-verifying as it lands, worktree-isolated.
- **A single `reduce` stage per phase** writes the run graph (the reducer = your ingest, reframed as a graph append). Resume reads the graph back through one structured probe.
- **Gates** still resolve to `paused` / `aborted` / `gate_h` / `shipped`, emitted verbatim, so your tech-lead Step-3 branch table is unchanged.
- **An opt-in refute wave** (improvement 5) sits behind `args.adversarialVerify`.

Inline comments state the *current* contract and flag every place that is a design sketch versus a byte-ready drop-in (chiefly: a small `graph-*.mjs` reducer/query pair you'd add, and workers being worktree-parallel-safe). Read it top-to-bottom; it's about a third shorter than today's `shapeup-run.js` (570 vs 911 lines) despite *adding* the fan-out and the refute wave — because the courier defenses are gone.

---

## The one-line test

The article says a reliable graph-engineering system must be able to make this true: *"Every important output can be traced to an objective, a plan, an artifact, a source, a graph path, an evaluator decision, and a bounded execution record."*

Today your answer is "yes, if you grep four markdown files and a directory of JSON." After improvements 2–4 it's "yes, walk one edge." That gap — from *replayed* history to *queried* graph — is the whole distance between what you built and what the article calls graph engineering. You're closer to it than almost anyone starting from a prompt-based harness, which is exactly why it's worth closing.
