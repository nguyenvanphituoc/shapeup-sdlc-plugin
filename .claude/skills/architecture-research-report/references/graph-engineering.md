# Graph engineering — analysis lenses for agent and LLM systems

Distilled from *Graph Engineering — The Karpathy Loop, Improved 1000x by Itself: The Anthropic
Playbook* (Agentic Software Engineering Practice, July 2026), an independent synthesis of
Karpathy's autoresearch/AgentHub work and Anthropic's Building Effective Agents, Dynamic
Workflows, and Knowledge Graph Construction Cookbook material.

Read this when reviewing an agent, multi-agent, orchestration, or LLM-pipeline architecture. Cite
it by section (`§VI.G`, `§VIII.A`) — the numbering below matches the paper.

Contents:
1. How to use these lenses
2. The six selection questions (§VIII.A) — the primary lens
3. The five planes (§VI.G)
4. The six-rung ladder (§VI)
5. What each architecture externalises (§I)
6. The graph as shared memory (§V)
7. When a graph is the wrong answer (§VIII.C)
8. Evaluation metrics by layer, and their misreadings (§VII)
9. The production checklist (Table VI)
10. Limitations worth quoting (§IX)

---

## 1. How to use these lenses

The paper's real value in a review is that it converts "is this architecture right?" — unanswerable
— into a set of questions with checkable answers. The single most reusable artifact is §VIII.A.
Run it first; it usually locates the finding.

Its central claim, worth holding through any review:

> The bottleneck is often not the next model call. It is the placement of memory and evaluation.

And its statement of what a reliable system makes true — a strong closing standard for any review
of an autonomous system:

> Every important output can be traced to an objective, a plan, an artifact, a source, a graph
> path, an evaluator decision, and a bounded execution record.

Auditing a system against that one sentence, clause by clause, is a complete review structure.

---

## 2. The six selection questions (§VIII.A) — the primary lens

Answer each for the system under review, and state the consequence. The consequence column is
where the finding lives.

| # | Question | If yes | If no |
|---|---|---|---|
| 1 | **Can success be verified?** | Autonomy is legitimate | Do not begin with autonomy — define a test, rubric, source requirement, or human decision first |
| 2 | **Are the steps stable?** | Use a chain — predictable, testable stages | Use planning or an orchestrator |
| 3 | **Are subtasks independent?** | Parallelise | Model dependencies explicitly and limit concurrent writes |
| 4 | **Must alternative lineages stay available?** | Use a DAG, not one branch | A single branch is fine |
| 5 | **Must facts survive the run?** | Persist artifacts and graph state | Transcript summaries suffice |
| 6 | **Can the org afford the cost and latency?** | Proceed | Set budgets before adding workers |

Question 1 is the gate — a system that cannot verify its own output should not be autonomous,
regardless of how sophisticated the rest is. Question 5 is the one most often answered "no" by
accident: a system that gitignores its execution record has answered "no" without anyone deciding
to, and that is a finding worth leading with.

**Complexity budget (§VIII.B).** Every run should declare: max model calls, max sub-agents, max
concurrent workers, max tool calls, max wall-clock, max tokens, max cost, max retries, max graph
writes, and minimum evidence required to finalise. When the budget is exhausted, return the best
current artifact, completed work, unresolved issues, and a reason for stopping —

> Do not hide partial failure behind a fluent final answer.

That line is a directly usable review criterion: check what the system returns on budget
exhaustion. A fluent summary with no failure accounting is a defect.

---

## 3. The five planes (§VI.G)

A production architecture separates five planes. The separation exists to prevent one failure:

> The separation prevents one chat transcript from becoming the database, workflow engine, and
> audit log.

| Plane | Responsibility |
|---|---|
| **Control** | Receives objectives, creates plans, allocates budgets, starts workflows, decides when to stop |
| **Execution** | Runs tools, tests, training jobs, code modifications, sub-agents in isolated environments |
| **Artifact** | Stores plans, drafts, code changes, reports, metrics, evaluations as **immutable versions** |
| **Graph** | Stores entities, claims, relations, provenance, experiment lineage, task dependencies |
| **Evaluation** | Deterministic checks, model evaluators, statistical scorers, human review |

**As a review instrument:** name the component that implements each plane in the system under
review. Planes with no owner, or planes collapsed into one another, are the finding. The most
common collapse is Artifact into Execution — outputs written to a scratch directory that is
deleted at run end, which silently answers question 5 "no".

---

## 4. The six-rung ladder (§VI)

The progression is **directional but not mandatory** — each rung addresses a specific limitation of
the previous one, and a rung you do not have that limitation for is a rung you should not climb.
Say this when recommending against a rung; it is the paper's own position, not a hedge.

| Rung | Time | Exit criterion | Externalises | Addresses |
|---|---|---|---|---|
| Loop | Day 1 | Measured quality improvement | Iteration + evaluation | Single-pass errors |
| Tools | Day 2 | Tool reduces a known error class | Knowledge gaps | Knowledge gaps |
| Planning | Week 1 | Variable tasks complete | Complexity | Complexity |
| Multi-agent | Week 2 | Role split beats single agent | Perspective limits | Perspective limits |
| Graph | Month 1 | Cross-session queries work | Lineage + shared memory | Persistent shared memory |
| Swarm | Month 2 | Wall-clock gain, no quality loss | Parallel search | Parallel search |

**Rung 1 preconditions (§II.D)** — the four conditions that made Karpathy's autoresearch loop work
with an autonomous agent. Check them before endorsing any autonomous loop:

1. **The output is verifiable** — there is a measurable result
2. **The action is reversible** — a reset returns to the last retained state
3. **The horizon is short** — frequent feedback (his runs were ~5 minutes)
4. **The environment is bounded** — the action space is narrow

A loop missing any of these is not a loop that will improve; it is one that will drift.

**"Programming the program" (§II.B).** The control specification (`program.md`) declares: mutable
and protected files, the metric and its direction, the experiment budget, the run command, output
parsing, crash handling, commit/revert rules, human escalation policy, and exhaustion criteria.
A useful audit is to ask which of those nine a given system states explicitly versus leaves to a
prompt paragraph — anything living only in prose gets paraphrased instead of enforced.

---

## 5. What each architecture externalises (§I)

The synthesis worth quoting when a reader asks "why would we add this?":

- A **loop** externalises iteration and evaluation
- A **chain** externalises task order
- A **swarm** externalises parallel search and role specialisation
- A **DAG** externalises experiment lineage
- A **knowledge graph** externalises shared facts, provenance, and cross-session memory

Each architecture is a bottleneck being moved out of the model's context and into a structure.
If you cannot name which bottleneck a proposed component externalises, it is decoration.

**The DAG is the graph (§III.D).** In AgentHub, commits are nodes and parent links are directed
edges; a commit carries the agent, hypothesis, diff, metric, runtime, keep/discard status. This
lets you ask questions a branch model cannot: which retained result has the best metric under a
memory limit? which agents independently rediscovered the same optimisation? which leaves have no
evaluation? which lineages improve then stagnate?

**Commit DAG and knowledge graph are complementary, not interchangeable (§V.A).** The commit DAG
answers *what changed, which experiment is the parent, which lineages remain active*. The knowledge
graph answers *which entities exist, how they relate, which claims conflict*. Collapsing them is a
design error worth flagging.

---

## 6. The graph as shared memory (§V)

Three roles: **shared memory** (workers write structured updates; a synthesiser traverses to
combine findings even though no worker saw all sources), **grounding layer** (an evaluator checks
claims against edges and returns structured feedback naming the *missing* edge rather than a
free-form critique), and **persistent world model** —

> The agent forgets, the graph does not.

**The four graph-write invariants (Appendix).** These make an excellent audit checklist, because
each has a checkable yes/no answer:

1. Every claim has a source or is marked inference
2. Every artifact has an authoring run and version
3. Every evaluation identifies a rubric
4. Every superseded object remains addressable

**Node types:** `Entity, Claim, Source, Artifact, AgentRun, Evaluation, Task, Commit, Metric`.
**Edge types:** `MENTIONS, SUPPORTS, CONTRADICTS, DERIVED_FROM, PRODUCED, EVALUATES, REVISES,
SUPERSEDES, DEPENDS_ON, PARENT_OF, RESOLVED_TO`.

A system that has all the node types scattered across ad-hoc file formats, with edge semantics
written down but never assembled into a queryable instance, is *an ERD without a database* — a
diagnosis that recurs often enough to be worth naming directly.

**Context construction from a graph (§VI.B).** The graph must not become a new form of context
dumping. Each worker needs a task-specific subgraph: resolve entities mentioned in the task, expand
one or two hops over allowed edge types, include current artifact versions, prioritise recent
verified claims, include conflicts and uncertainty, serialise within a token budget, attach stable
edge identifiers for citation.

**Construction pipeline (§IV.C)** — the cookbook's four stages, with model tiering that is itself a
cost argument: Extraction (cheap model, schema-constrained S-P-O) → Resolution (stronger model,
candidates clustered by type and context) → Assembly (NetworkX MultiDiGraph; nodes carry type,
source, count; edges carry predicate and provenance) → Querying (serialise a bounded subgraph as
triples; reason with edge-level citations). Resolution must be **additive and inspectable** —
a canonical entity retains its aliases, source documents, rationale, confidence, and the run that
created the merge, so an incorrect merge is reversible without rebuilding the pipeline.

---

## 7. When a graph is the wrong answer (§VIII.C)

Quote this when recommending against one — it is the paper arguing against its own thesis, which
makes it credible.

> Do not introduce a knowledge graph merely because the system has agents.

A graph is unnecessary when: tasks are independent; no cross-session state is required; answers
depend on one document; relations are fixed and simple; a relational table answers every query;
provenance is not needed; or extraction errors would outweigh traversal value.

> A graph earns its cost when connected queries, evolving relations, provenance, or shared world
> state are central.

The clean test: count how many of those four are central to the system under review. Fewer than
two, and the recommendation is a relational table plus durable artifacts.

---

## 8. Evaluation metrics by layer, and their misreadings (§VII)

The misreading column is the valuable half — each is a way a system can look healthy while failing.

| Layer | Metric | Common misreading |
|---|---|---|
| Extraction | Entity/relation F1 | High precision hides missing entities |
| Resolution | Pairwise precision/recall | Compression alone rewards over-merging |
| Graph | Components, density | One component is not always desirable |
| Query | Accuracy, cited paths | Fluent answers can cite irrelevant edges |
| Workflow | Task success, cost | More agents can increase activity without value |
| Operations | Recovery, corrections | Average success hides catastrophic cases |

**Graph autoresearch (§VII.A).** The evaluation harness has the same shape as the loop itself — the
artifact being optimised is the extraction prompt, ontology, resolution policy, or query serialiser
rather than `train.py`. Read current prompt and score history → propose one change → run on a gold
set → compute precision, recall, F1, cost, latency → keep if improved, revert if worse.

**Query evaluation (§VII.C)** grades the *path*, not only the answer: a valid answer resolves
question entities correctly, retrieves a relevant subgraph, uses supported edges, respects time and
source constraints, distinguishes fact from inference, cites the edges used, and identifies missing
evidence. Adversarial cases should include misleading aliases, contradictory dates, disconnected
paths.

**Monitoring (§VII.D)** tracks trends, not isolated scores: extraction rate by document type, schema
failure rate, resolution compression, connected-component changes, query latency, subgraph size,
cited-edge validity, token cost, stale entity count, graph update failures, agent retry rates. A
sudden rise in isolated nodes signals resolution regression; a sudden fall signals over-merging.

---

## 9. The production checklist (Table VI)

Nine rows, each with a failure mode. Directly usable as an architecture-review rubric — score the
system row by row and the gaps become §3 of the report.

| Element | Ask | Failure if missing |
|---|---|---|
| Objective | Is the task testable? | Agents optimise the wrong thing |
| Metric | Distinguish improvement? | Activity without progress |
| Reversibility | Can updates be undone? | Failed experiment damages state |
| Tool schema | Arguments typed? | Invalid calls, silent errors |
| Artifact contract | What must workers return? | Inconsistent prose |
| Provenance | Every claim has a source? | Outputs not auditable |
| Resolution policy | Decisions reversible? | False merges contaminate the graph |
| Budget | Limits explicit? | Unbounded resources |
| Monitoring | Metrics tracked? | Regressions invisible |
| Recovery | Resume from state? | Every interruption restarts |

**The graph-grounded task default (Appendix)**, useful as a reference pipeline to compare against:
receive objective and constraints → resolve task entities → retrieve bounded subgraph with
provenance → create typed plan, validate dependencies → assign independent steps to isolated
workers → require structured artifacts and evidence → publish candidate graph updates → validate
schemas, permissions, provenance → run deterministic tests → run evaluator agents against rubrics →
resolve conflicts or escalate uncertainty → publish versioned final artifact → link to sources,
graph paths, runs, evaluations → record cost, latency, failures, open questions.

---

## 10. Limitations worth quoting (§IX)

Use these when a report needs to resist enthusiasm — including its own.

- **A small loop does not prove frontier autonomy (§IX.A).** Autoresearch works because repo and
  metric are bounded. What transfers is the *architecture* — bounded changes, measurable
  evaluation, reversibility, durable history — not the autonomy claim.
- **Metrics can be gamed (§IX.B).** A ratchet improves the metric it can see; it may cut validation
  loss while raising inference cost or overfitting the eval set. Retain constraints on the axes the
  metric does not cover.
- **Dynamic workflows are expensive (§IX.D).** A 1,000-sub-agent run at high effort can cost tens of
  dollars. Parallel workers also produce *correlated* errors — a verification wave helps only if
  reviewers have a different prompt, evidence set, or role.
- **Fragmentation can reduce quality (§IX.E).** Some tasks need one coherent context: architecture
  design, narrative writing, tightly coupled refactors, subtle product decisions. These degrade
  when split across isolated units. A direct argument against fanning out certain work.
- **Graphs reflect their corpus (§IX.F).** A biased corpus produces a biased graph; missing
  documents produce missing edges. The graph preserves claims, sources, and relations so they can
  be inspected — *it does not convert claims into truth.*
- **Entity resolution can fail catastrophically (§IX.G).** One false merge contaminates every
  downstream traversal. Resolution must retain aliases, evidence, confidence, and reversible
  decisions.
- **The graph amplifies builder judgement (§IX.H).** A loop amplifies the objective and evaluator
  chosen; a graph amplifies the ontology and source policy. Automation scales whatever error is in
  the specification — which is why the architecture requires deliberate human ownership of
  specifications, quality bars, and correction mechanisms.

**The three-step framing (§X)** — useful for positioning any system on a maturity axis:
*vibe coding* (human expresses intent, model writes) → *agentic engineering* (human specifies,
orchestrates, verifies, remains responsible for quality) → *graph engineering* (agents share durable
state through typed, queryable graphs of work and knowledge).

> The path from loops to graphs is not a path from simplicity to complexity. It is a path from
> implicit state to explicit state, from volatile memory to durable memory, and from estimation to
> evidence.
