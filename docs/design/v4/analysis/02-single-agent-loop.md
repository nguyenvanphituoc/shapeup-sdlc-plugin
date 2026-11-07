# 02 — What does the single-agent loop ask of a plugin that dispatches ten workers?

| | |
|---|---|
| **Date** | 2026-11-06 |
| **Baseline** | 3.18.4 |
| **Status** | draft — the kit's files read verbatim; the article and two related posts read through a summarizing fetch; the mapping to this repo is derived where marked and a first reading where not. No measurement was run. |
| **Origin** | The maintainer asked for the single-agent loop in `anthropics/single-agent-loop-kit` and its related documents to be recorded in v4. Continues the "own a thin layer" line in [`01`](01-rent-or-own-the-harness.md). |

## Question

Read against 3.18.4, what does the single-agent-loop pattern ask of a plugin whose orchestrator
dispatches ten workers, each a skill run in a fresh context?

## Evidence

### What was read, and how much to trust it

| Source | How it was read | Trust it as |
|---|---|---|
| Kit repo at `c437962` (2026-10-21, one commit) — `README.md`, `CLAUDE.md`, `skill/SKILL.md`, `skill/steps/00–05`, `skill/templates/{PLAN.md,subagent_response.schema.json,CONTRIBUTING-skills.md}`, `reference_loop/loop.py`, head of `skill/scripts/{compare,chain_coverage}.py`, both `example-run/` write-ups | Cloned and read in full, verbatim | What the kit says and does. Not a measurement of anything. |
| Article *Building agents: When to fold subagents into your main agent loop* | One summarizing fetch of the page; the page's date was not in the fetched text | Direction. Every figure is as relayed by the fetch and is **not cross-checked** against the page. |
| Anthropic engineering: *Harness design for long-running apps*, *How we built our multi-agent research system* | One summarizing fetch each | Same. Both were already listed, unopened, in the sources of `01`. |
| Search-result coverage of the article (blogs restating it) | Titles and snippets only | **Not relied on.** One snippet dates the article 2026-10-22; unconfirmed. |

### The pattern, as the kit and the article state it

A multi-agent system — a router in front of specialist subagents — is consolidated into **one model,
one context window, one open-ended tool loop**. The model emits a batch of tool calls each turn; the
harness runs them in parallel and returns raw results to the same model; the model plans on turn one
and revises. Procedure moves into **skills** (a one-line description always in the prompt, the body
loaded on demand); hard limits and mid-conversation lookups move into **tools**. Code keeps cheap,
always-relevant loading and mechanical work.

**It is a migration method, not a verdict that one agent wins.** The kit's own text: "Keeping a
subagent is a fine outcome. The goal is a system you have evidence for, not the smallest possible
number of agents" (`skill/SKILL.md`).

| Kit step | Does | Done when |
|---|---|---|
| 0 Audit | Inventory every subagent; give each a verdict, with evidence and a confidence | The person has agreed the verdicts |
| 1 Baseline | Reuse or build one end-to-end eval; probe, then score the unchanged system with 2–3 reps; check chain coverage and a "break map" | The person trusts the score |
| 2 Merge | Merge two subagents that chain, share data, or run together | One pair merged and compared |
| 3 Fold | Subagent → skill + tools; sort its prompt line by line | One subagent folded and compared |
| 4 As-tool | Keep the subagent, call it as a tool with a fixed response shape | One call-as-tool compared |
| 5 Upkeep | Shrink the prompt, prune skills, settle ownership | Prompt, skills and owners tidy |

**Verdicts:** `main` · `fold` (the default) · `merge:<other>` · `as-tool` · `keep` (rare). A subagent
earns its own context only if one of three is true, and the audit must write the number or line that
shows it: (1) it reads far more than the main agent needs afterwards, (2) parallel or independent
work — fresh contexts, or one agent checking another's work without seeing how it was produced,
(3) tool overload or contradiction that skills cannot fix. **Not** reasons: another team owns it, it
has a persona, its prompt is long, it has many tools, its steps are fixed.

**Rules that hold in every step** (`skill/SKILL.md`): one change per eval run; no change without an
eval task on its chains; score the system you would keep, and keep the old code until the person
says keep; read routes, not only scores; ask before every paid run, with a token estimate; every
verdict cites evidence; stop at four named check-ins and let the person decide.

**The decision rule, in code** (`skill/scripts/compare.py`): a change *holds* if it completes at
least as many tasks and no task got worse; a drop in one rep of one task is flagged as possible
noise and answered with more reps on both sides, not a verdict.

**Break map** (`skill/steps/01-baseline.md`) — what a migration breaks, and what notices:
dropped handoff, lost rule, shortcut, wrong pick, unwanted write, lost thread, unhappy path, cost
creep, route drift. The last two have no task; they are read from token counts and changed routes.

### What the kit does not show

- `README.md`: two runs of one example, by one person, on one model. Not run on a real model: the
  merge and upkeep steps, the finished `single_loop/` version, starting from a repo with no eval,
  any system other than the example.
- `example-run/README.md`: the runs used `claude-opus-5`, 2 reps, on 2026-10-08 and 2026-10-09, and
  "the measured results and the findings drawn from them were removed from this write-up". The kit
  publishes traces and a method, **no measured effect of folding**.
- The article's own quantitative content, as relayed: a ~2× latency gain at one unnamed customer, a
  system prompt cut by over 80% for newer models, "10 golden examples are enough to start", tool
  choice degrading past 30–50 definitions. It calls the guidance model-dependent and expects it to
  change.

### The counterweight, from the related posts (as relayed)

| Post | Says | Bears on this plugin |
|---|---|---|
| Harness design for long-running apps | Agents "skew positive when grading their own work"; a separate evaluator is more tractable to tune. Context resets dropped at Opus 4.5, sprints at Opus 4.6; the planner was kept. Solo ≈ $9 / 20 min did not work; full harness ≈ $200 / 6 h did. "Every component in a harness encodes an assumption about what the model can't do on its own." | The separate judge is the one separation both Anthropic lines keep. The "assumption per component" test is the same ablation rule as `01`. |
| Multi-agent research system | Orchestrator + subagents beat a single agent by 90.2% on an internal research eval; ~4× tokens for an agent, ~15× for multi-agent; poor fit where agents share context or have many dependencies — "most coding tasks" named. | Evidence for *keeping* parallel fresh contexts, and a cost the fold argument leaves out. |

The two lines do not contradict. Research is breadth-first and parallel (keep subagents); a
conversational support desk is sequential and shares context (fold). Which side a software-delivery
pipeline falls on is the open part.

### What this repo shows (derived — re-run these)

| Claim | Command or `file:line` | Result |
|---|---|---|
| Ten workers | `node -p "require('./kernel/schemas/domain.schema.json').\$defs.WorkerName.enum.length"` | `10`: task-executor, spec-evaluator, ba-pitch-analyzer, scope-architect, solution-architect, orient, qa-edge-hunter, translator, scope-hammer, coach |
| Thirteen skills ship; three are not workers | `ls skills` | 13 entries; `hill-chart`, `shapeup`, `tech-lead` are outside the enum |
| Orchestration is code, not an LLM router | `tech-lead/SKILL.md:70–95` | The run launches a workflow script; gates "resolve via `harness gate`'s exit code, in code"; sub-agents "share this session's prompt cache" |
| A dispatch is checked at the tool call | `grep -o '"matcher": "[^"]*"' hooks/hooks.json \| sort \| uniq -c` | `Skill` ×1 and `Skill\|Agent` ×2 among the matchers; the two `Skill\|Agent` entries run `verify envelope` and `hooks/dispatch-receipt.mjs` |
| The handoff is a schema, not a summary | `kernel/schemas/work-order.schema.json`, `work-result.schema.json` | Order requires `schema_version, order_id, worker, mode, payload`; result requires `schema_version, order_id, status`, and carries `verdict, artifacts, assumptions, deviations, discoveries` |
| The kit's equivalent response shape | `skill/templates/subagent_response.schema.json` | `conclusion, evidence, actions_taken, confidence, caveats` — all required, no extras. `WorkResult` has no `confidence` field. |
| Budget axes in the run | `RunArgs.properties.budgets` in `kernel/schemas/domain.schema.json` | `maxRounds`, `attemptBudget`; wall-clock is typed at `init run`. No token or cost axis in the schema. |
| The export carries no cost; wall-clock is on the leg row | `kernel/report/facts.mjs:22–23`; `legRow` in `kernel/reduce/ingest.mjs` | The module's comment says "no cost or wall-clock instrumentation", but the leg row carries `dispatched_at`, `ingested_at` and `duration_ms`, and the export joins it (**corrected 2026-11-07**; the comment is stale). Tokens and cost have no source. Tables: `run, dispatch, ac_result, discovery, file_touched, trial, t0_verdict, criterion_verdict, hook_decision, gate_decision, build_gate, leg` |
| An A/B exists on record | `traces/phase3/`, commits `5ebb6b6`, `c013325` | `--parallel-scopes` 4 vs 1 on one pitch, 2026-08-17, wave 1 −62.0%. A scheduling dial, not a component's value — but a first-party with/without, and the source of the plan-regeneration confound. No planning-chain comparison file exists yet |
| No token budget in code | `grep -rn -i -E "token_budget\|max_tokens\|token budget" kernel hooks skills` | no match |
| No pass^k or ablation in code | `grep -rn -E "pass\^k\|pass_k\|passk\|ablation" kernel hooks skills` | no match (`docs/` and `tests/` not searched) |
| Failure posture differs from the kit's | `hooks/sandbox-guard.mjs:66` vs `reference_loop/loop.py:122–125` | The hook "fail-OPEN whenever there is nothing to enforce"; the kit's `Agent.__init__` raises when a writing tool has no write gate. Different layer, opposite default. |
| A verifier retry ends differently | `reference_loop/loop.py:266–275` vs the AGENTS.md "sent back once" rules | Kit: rejected twice → the answer is withheld (`verify_failed`). Harness: sent back once, then continues with a warning or a `not-hunted` label. |
| The model-in-the-loop instruments on record | `CLAUDE.md`, "The soak"; `traces/` | The soak, which it says finds defects and "is not a release gate"; and the archived runs under `traces/`, of one small feature. `npm test` is Tier-0 structural. |

## Finding

The single-agent loop is a **measured-migration discipline** — audit, baseline, one change per eval,
keep what holds — and its fold-by-default is a conclusion the kit itself has not published numbers
for. For this plugin the discipline transfers; the prescription does not follow from it. Read against
3.18.4, the ten workers are already the kit's `as-tool` shape (a brief in, a schema-checked result
out, no conversation with the user), orchestrated by code rather than by a model-driven router, and
the two places the kit's criteria would keep a separate context — an independent judge and
concurrent scope builds — are also where AGENTS.md puts its invariants. What is genuinely open is
the sequential planning chain, and **it cannot be closed from this repo's records**: there is no
behavioural eval of it, no ablation of a component and no cost axis on file (table above). One
first-party A/B does exist, on a scheduling dial, and the confound it exposed shapes how a
planning-chain comparison must be built (no such comparison is written yet; it is an open question below).

### First reading of the roster against the kit's three criteria

From AGENTS.md prose only — which this repo's own rule says is not evidence. Every row is the kit's
"low" confidence until the audit supplies the number or line.

| Worker | Kit criterion that could apply | What the audit would have to show |
|---|---|---|
| `spec-evaluator` | (2) independent: checks work it did not produce | Nothing to fold; the question is only the shape of its result |
| `task-executor` | (2) parallel: scopes build concurrently, default 4, in separate substrates | That concurrency needs a fresh context, not only a fresh write fence |
| `qa-edge-hunter` | (2) independent exploration, six lenses | That the hunt finds what a pass inside the main loop would not |
| `orient` | (1) reads far more than the planner needs afterwards | Tokens read per Orient call against the size of the map it returns |
| `ba-pitch-analyzer`, `solution-architect`, `scope-architect` | none evident — they chain on one another's output and share the spec tree: the kit's `merge` or `fold` | A trace of what survives each handoff. Not yet done: the handoffs are files rather than summaries, but no trace of what the consumer omits is on record |
| `scope-hammer`, `coach`, `translator` | none evident from prose | Read each skill and its call volume first |

Two caveats that keep this from being a plan to fold:

- **The kit's target is a runtime product agent** with a persona'd router and free-text handoffs.
  This plugin is a development-process orchestrator with a human at every gate. The eval method
  transfers; the router-and-persona pathology it removes is mostly absent here.
- **A fold can move hard limits — depending on what is folded.** The kit puts a hard limit into a
  tool, where it is enforced. Here the limits sit in hooks keyed to the live *order* (single
  writer, substrate fence, receipt), not to the sub-agent window. Folding two operations into one
  combined order, or running them hand-driven, drops that enforcement; letting one window run both
  orders in sequence keeps all of it. *(Corrected 2026-11-07 — this bullet first read "removes a
  boundary those hooks are keyed to", which holds only for the first two.)*

### What transfers regardless of any fold

1. **A per-component verdict with evidence and a confidence.** The audit inventory is a form the
   ablation rule in `01` has been missing.
2. **A "holds" rule written down** before the run: at least as many tasks complete, none worse, a
   single-rep flip answered with reps — a measurement rule `README.md` here already demands of v4
   ("measurements carry a model and a date").
3. **Chain and break coverage** as a precondition: no change measured on an eval that cannot see its
   chains. The harness has a chain (requirements → analyze → wire → scopes) and no eval of it.
4. **A token axis** counted across everything the loop spawns, as a hard budget beside rounds,
   attempts and wall clock.
5. **Retiring on a model upgrade:** rerun each skill's with/without check and delete what the model
   no longer needs — the kit's upkeep step, and the Opus 4.5 → 4.6 removals above.

## Candidate requirements

*(none yet.)* The sources argue a method; they do not name a change to this plugin. The questions
below are what they turn into once read against 3.18.4. Each is answered by its own analysis file
before any row is written to `../requirements.md`.

1. **Which of the kit's three criteria can the run export evidence for, per worker?** Partly. The
   `dispatch` table holds `compiled_at`, `tasks_ordered`, `files_touched`, `lines_touched`,
   `assumptions`, `deviations` and `answered`, and the `leg` table adds `dispatched_at`,
   `ingested_at` and `duration_ms`, so criterion (2) has both ends. Criterion (1), tokens read, has
   no source: the export carries no cost, and no actual-read record exists. The local run trace is
   deleted when an experiment ends; what remains is the archived runs under `traces/`, all of one
   small feature. Output, when it is written: the audit inventory, with the unanswerable cells marked as such.
2. **Can one with/without comparison be run and held to the kit's rule?** The smallest case is the
   planning chain on a fixed pitch, one model, one date, ≥2 reps. This is the concrete form of
   `01`'s open question on ablations.
3. **Does the planning chain lose anything at its handoffs?** Read the artifacts one worker leaves
   and the next one uses; the answer decides whether `merge` is even a candidate.
4. **Does a token or cost axis belong beside `round_budget`, `attempt_budget` and the wall clock?**
   Overlaps `01`'s question on per-run cost; settle them together.
5. **Does any skill have a retirement trigger?** The maintenance audit covers doc drift; whether
   anything asks "does the model still need this skill" at an upgrade is a question about artifacts.

## What would change this answer

- A **first-party** run on this plugin — named model, dated — showing the planning chain folded into
  one context matches the pipeline on requirements covered and scopes green, at lower cost. That
  would move the planning workers toward `fold`, and outranks every figure above.
- A trace showing real loss at a planning handoff (an id, a clause, a seam that did not survive).
  That would argue for `merge`, not `fold`.
- The article's figures failing a read of the page itself. The finding rests on the method's shape
  (measure first, fold what holds), not on the 2× or the 80%.
- The kit publishing measured results, or a reproduction of its example on a model other than the
  one it ran on.
- Evidence that this plugin's gates need the dispatch boundary — which would make the fold question
  moot for the workers the hooks are keyed to.

## Sources

Opened directly (cloned, `c437962`):

- [anthropics/single-agent-loop-kit](https://github.com/anthropics/single-agent-loop-kit) — Apache-2.0,
  "reference implementation, not maintained and not accepting contributions"

Opened through a summarizing fetch (figures as relayed, not verified against the page):

- [Building agents: When to fold subagents into your main agent loop](https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop)
- [Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)

Seen only as search results, not used: blog restatements of the article (mindstudio.ai,
fourweekmba.com, smartscope.blog, besthub.dev and others).
