# 03 — System Design

[← Back to index](README.md)

## Components and their contracts

The tech-lead is the only stateful component. Every other skill is a **pure worker**: it
receives a structured order, does its craft, and returns a structured result — it never reads
or writes the run's shared files directly.

## 3.1 — The envelope port

Every worker dispatch is two JSON documents and three scripts, all living beside the
orchestrator skill (`kernel/`, schemas in `skills/tech-lead/schemas/`):

```mermaid
sequenceDiagram
    participant TL as tech-lead (orchestrator)
    participant CO as harness compile
    participant VE as harness verify envelope (hook)
    participant W as worker skill (fresh Agent)
    participant IR as harness reduce ingest
    participant FS as shared state<br/>(board · ledger · run trace)

    TL->>CO: compile order (scope, round, attempt, decisions, digested errors)
    CO->>FS: write orders/<id>.json
    TL->>W: Agent → Skill(worker) --order <path>
    W-->>VE: PreToolUse fires before the Skill call
    VE->>FS: read + schema-validate the order
    alt malformed or missing order
        VE--xTL: deny — never reaches the worker
    else valid
        VE-->>W: allow
        W->>FS: write results/<id>.json (WorkResult only)
        TL->>IR: node harness reduce ingest <result path>;
        IR->>FS: tick AC boxes, flip board status,<br/>append ledger, propagate unblocks
    end
```

Workers never write boards, ledgers, or run-state. Everything a worker used to write into
shared files directly, it now **returns as data** in its `WorkResult`; `harness reduce ingest` is
the single, deterministic writer. This closes what the project calls **D6** — "single-writer"
stops being a convention and becomes mechanically true, because no worker holds a path to
write to even if it wanted to.

### WorkOrder (in) — key fields

| Field | Purpose |
|---|---|
| `worker` | One of 10 enumerated worker skills — the order names its own destination |
| `operation` | Replaces ad-hoc flags (`--tasks-only`, `--from-discovered` …) — the caller knows the pipeline position, the worker never re-derives it |
| `substrate` | The write contract for this order — data the sandbox hook enforces, not prose asking the worker to behave |
| `payload` | Worker-specific inputs: scope contract, tasks, prior decisions, digested errors, KB rules path |

### WorkResult (out) — key fields

| Field | Purpose |
|---|---|
| `task_results[]` | Per-task status + AC pass/fail + evidence — `ingest-result` flips the board row from this alone |
| `discoveries[]` | Raw discovered lines — appended to the discovery ledger by ingest, never by the worker |
| `verdict` | `spec-evaluator` only — overall PASS/FAIL, per-criterion results, refuted AC boxes, T0 citation hashes |

## 3.1b — Operation routing: one compiler, the whole skill set

The envelope port above is drawn once, generically — but there is a *single* compiler
(`harness compile`) behind every worker in the harness. The order's **`operation` is the
routing key**: `compile-order` resolves the owning worker from the operation alone (its
`OP_OWNER` map, mirroring `domain.schema.json`'s `$defs/Operation` ownership), so a dispatch
never carries a redundant `--worker`, and each operation stamps a fixed `substrate` write
contract (from `substrateFor`) that the sandbox hook then enforces. One compiled order therefore
*is* the dataflow across the skill set — the 15 operations fan out to the 10 worker skills by
pipeline stage:

```mermaid
graph LR
    CO["harness compile<br/>operation → worker + substrate"]
    CO --> ORI["orient<br/>(orient)"]
    CO --> SA["solution-architect<br/>(wire)"]
    CO --> BA["ba-pitch-analyzer<br/>(analyze · reconcile ·<br/>retrofit-surface · coverage)"]
    CO --> SC["scope-architect<br/>(map-scopes)"]
    CO --> TE["task-executor<br/>(execute · fix · spike)"]
    CO --> SE["spec-evaluator<br/>(evaluate)"]
    CO --> QA["qa-edge-hunter<br/>(hunt)"]
    CO --> SH["scope-hammer<br/>(hammer)"]
    CO --> TR["translator<br/>(translate)"]
    CO --> CH["coach<br/>(coach)"]
    ORI --> IR["harness reduce ingest<br/>(single writer)"]
    SA --> IR
    BA --> IR
    SC --> IR
    TE --> IR
    SE --> IR
    QA --> IR
    SH --> IR
    TR --> IR
    CH --> IR
```

| Pipeline stage | Operation(s) | Worker skill | Order's `substrate.allowed` (write target) |
|---|---|---|---|
| Orient | `orient` | `orient` | `<local>/orient/**` |
| Analyze | `analyze` | `ba-pitch-analyzer` | `<spec>/**` + `<local>/**` |
| Wire (spine ✚) | `wire` | `solution-architect` | `<shared>/<slug>/wiring-map.md` |
| Map scopes | `map-scopes` | `scope-architect` | `<shared>/<slug>/scopes/*.md` + `scope-board.md` |
| Board upkeep | `reconcile` | `ba-pitch-analyzer` | `<local>/tasks/**` + `<spec>/scope-summary.md` + `<local>/working/**` (append-only: UC Invariants / Test Surface) |
| | `retrofit-surface` | `ba-pitch-analyzer` | *(nothing)* — append-only to `<spec>/usecases/*.md#Test Surface` |
| Coverage (spine ✚) | `coverage` | `ba-pitch-analyzer` | `<shared>/<slug>/requirements.md` |
| Build | `execute`, `fix`, `spike` | `task-executor` | the scope's own `allowed_file_substrate` + `<local>/spikes/**` |
| Evaluate | `evaluate` | `spec-evaluator` | `<local>/evaluation/**` |
| QA hunt | `hunt` | `qa-edge-hunter` | `<local>/qa/**` |
| Ship / triage | `hammer` | `scope-hammer` | `<shared>/<slug>/REPORT.md` + `<local>/reports/**` |
| Intake | `translate` | `translator` | `<shared>/<slug>/shaping/*.md` + `glossary.md` |
| Retro | `coach` | `coach` | `<shared>/knowledge-base/*.md` |

Every case also stamps `frozen` (and, where relevant, `append_only`) — the spec core
(`domain-model.md`, use-case `#Steps`, `contracts/**`, `ux-behavior.md`) is frozen for every
operation that is not `analyze`, so board upkeep can add a Test Surface row but can never rewrite
the contract it is graded against.

Two consequences fall out of routing *in the order* rather than in each skill: **(1)** adding a
worker is adding an operation, its `OP_OWNER` entry, and its `substrateFor` case — the
orchestrator owns the vocabulary and workers never re-derive their own pipeline position; and
**(2)** because the write contract travels inside the order, one `sandbox-guard.mjs` hook fences
every skill's writes with zero per-skill code — it reads the *order's* substrate block directly
(§3.2). The return leg is uniform too: whatever any of the 10 workers produces comes back as a
`WorkResult`, and `harness reduce ingest` is the sole writer that lands it into shared state (§3.1) —
except for the three operations whose product IS a committed design document (`wire`,
`map-scopes`, `coverage`), which write it directly under the substrate the hook enforces.

## 3.2 — Runtime-enforced guardrails (hooks)

Four `PreToolUse` hooks turn the harness's load-bearing rules from things the model is asked
to respect into things it cannot get past. All four deny:

| Hook | Fires on | Enforces |
|---|---|---|
| `safety-spine.mjs` | `Bash` / `Read` / `Edit` / `Write` / `MultiEdit` | Denies the provably destructive operations no session ever legitimately needs: `rm -rf` on unrecoverable targets, force-push and push-to-main, `git reset --hard`, `DROP TABLE`/`TRUNCATE`, and secret-file reads (`.env`, `*.pem`, ssh keys, cloud credentials) via shell readers or the `Read` tool. Unlike the other three, it guards the **machine**, not the pipeline. The only escape hatch is the human-authored `.shapeup/safety-overrides.json` (schema: `SafetyOverrides`) — mechanically self-protected, and every exercised override is logged to the metrics shard as a `SAFETY-OVERRIDE` pathology row. |
| `gate-intake.mjs` | `Skill → tech-lead` | Denies an orchestrator dispatch with no resolvable intake — no `--pitch`, no `--spec`, no `--from` resume, and no free requirement text. Closes the harness's own front door: a `tech-lead` reached as `args:"--unattended"` loses the requirement text on the hand-off and, with nothing to orchestrate, prints the gate names and a confident plan while writing no code — the same "claims done" pathology the harness exists to prevent, at its own entry point. Fails open on `--order` (the envelope port owns that path) and on any ambiguous arg shape. |
| `harness verify envelope` | `Skill` / `Agent` | Denies any worker dispatch whose `--order` file is missing or fails the WorkOrder schema — a malformed envelope never reaches a worker. |
| `sandbox-guard.mjs` | `Edit` / `Write` / `MultiEdit` | Denies a write that the **active order's own `substrate` block** does not permit. It follows the `.shapeup/active-order` pointer (written before each worker dispatch) to the compiled WorkOrder and enforces all three surfaces: `allowed` + `shared` permit, `append_only` permits `Edit` but denies `Write` (which would overwrite), and `frozen` denies outright and takes precedence over everything. Carve-out: the active feature's own local run-trace root, so a worker can still update its own board. |

All four are deliberately **fail-open** when there's nothing to verify (no active order, no
board, unparseable input) and **fail-closed** the instant they can prove a violation. A guard that broke legitimate standalone runs would just get
disabled, defeating the point of having it. (The safety spine adds one asymmetry: a *malformed
overrides file* fails **closed** — treated as absent — because a parse error must never disable
the spine.)

> **Why the sandbox reads the order, not the scope contract.** It used to resolve
> `.shapeup/active-scope` → `scopes/<id>.md` and enforce that contract's
> `allowed_file_substrate`. That covered exactly one operation — the build — because only build
> orders carry a scope. Every other dispatch (`analyze`, `wire`, `evaluate`, `hunt`, `coach` …)
> is compiled with a substrate by `substrateFor` (§3.1b) and then ran unfenced, and the
> `frozen`/`append_only` surfaces that table stamps had no enforcer at all. Reading the order
> makes the write contract the compiler already emits the same one the hook enforces, for every
> operation, with no per-operation code.

## 3.2a — The dispatch receipt (PostToolUse, records only)

Every hook above answers *may this call proceed*. This one answers a different question, and it is
the question the walls above structurally cannot reach: **did the shipped skill actually run?**

| Hook | Fires on | Records |
|---|---|---|
| `dispatch-receipt.mjs` | `Skill` / `Agent`, **after** the call | Appends `{order_id, run_id, worker_declared, skill_invoked, dispatch_ok, at}` to `.shapeup/<slug>/receipts/dispatch.jsonl` when the tool result names a resolved skill. Never denies; every write is inside `try`/`catch`. |

**Why it exists.** Measured, not theorized. A dispatch against a plugin that is absent, disabled or
a different version returns `<tool_use_error>Unknown skill</tool_use_error>`. The sub-agent then does
the craft itself, from the prose already in its own prompt — and every downstream check accepts it.
The artifacts land under exactly the path the order's `substrate` permits, so `verify envelope`
passes (the *order* was well-formed) and `sandbox-guard` passes (the *writes* were in bounds); the
phase post-condition passes because the artifacts exist; the run advances. Both walls fired correctly
and neither could help, because nothing in the system attested **which skill produced an artifact**.
That is not a failed run, it is a **false green**, and it defeats "measured, not claimed" at the
root: the measurement was "is the artifact on disk", which cannot separate skill-produced from
improvised.

**Why `PostToolUse` and not `PreToolUse`.** The pre event fires before the tool runs, so it cannot
tell "the Skill returned" from "the Skill errored and the sub-agent improvised". It appears to catch
the observed instance only by coincidence — the plugin was not loaded, so these hooks were not
registered either. Repair the environment and a failing dispatch gets a pre-receipt written just
before it fails: the fix would expire exactly when the thing it guards starts working.

**What the boundary actually does**, measured in a live session with a sub-agent making the calls,
because every dispatch here is a `Skill(...)` made by a workflow leg and a hook blind there is blind
where it matters:

| Dispatch state | `PreToolUse` | `PostToolUse` |
|---|---|---|
| resolves and completes | fires | fires, with `tool_response = {success, commandName}` |
| skill name unknown | never fires | never fires — the host rejects the name upstream of the hook layer |
| order missing → gate denies | fires (the deny) | never fires — a denied call never runs |

So a failed dispatch leaves **no row at all**, and the receipt's mere existence is the evidence;
`dispatch_ok` is corroboration recorded on top, so a future host that reports failures through this
event cannot satisfy the gate merely by firing. The host names the skill namespaced
(`shapeup-sdlc-plugin:orient`) where the order names it bare (`orient`), so the comparison is against
the segment after the last `:`.

**Where it becomes a wall.** Nowhere in the hook — it has no deny path. `harness reduce ingest`
refuses a result whose order declares `mode: "orchestrated"` and has no receipt matching on all three
of `order_id`, `skill_invoked === order.worker`, and `at ≥ compiled_at`. Existence alone would be
satisfied by a stale receipt from an earlier relaunch, since order paths like `orders/orient.json`
are reused verbatim on re-dispatch. A result with no order beside it — a standalone or fixture
ingest — made no such claim and is not held to it. `--no-receipt-check` is the documented way
through, because the receipt channel is best-effort by design and a load-bearing gate built on one
needs a stated escape rather than a folkloric one.

**The same rows answer a second question, at GATE L0.** `harness verify skills` reads the worker
roster off `domain.schema.json#/$defs/WorkerName` and refuses `init run` with exit 3 when a
`SKILL.md` is missing, recording the plugin root and version in the run receipt so every run's trace
names the copy that produced it. That is the cheap half, and it is honestly incomplete: it proves
*these files exist at this root at this version*, not that the session will resolve that copy. Both
states the failure actually takes — installed but disabled, and a different version loaded — have all
ten `SKILL.md` files and pass it green.

So the orchestrator's first leg is a canary: one `Skill(...)` dispatch, deliberately with no
`--order` (it is testing name resolution, not doing work, and an order would leave a compiled order
with no result in `orders/` that three readers would then have to know about). `harness verify
dispatch --skill <worker> --within <seconds>` then reads the decision rows above. Because a Skill
call whose name does not resolve fires no hook at all, a row naming a skill IS the proof that this
session resolved it, and the sub-agent that made the call cannot write that row — so the evidence is
not its account of what happened. The window is required rather than optional: without one, a
checkout that had the plugin loaded once passes forever.

## 3.2b — The zero-work block (Stop, blocking)

One `Stop`-event hook may block, and its predicate is why the invariant survives intact.

| Hook | Fires on | Enforces |
|---|---|---|
| `gate-zerowork.mjs` | Session end | Blocks a session that **dispatched the orchestrator and left no run receipt** — no `.shapeup/<slug>/receipt.json`, which `harness init run` writes as the run's first act (§3.2d). |

**Why it exists.** Observed repeatedly, not theorized: given a
*valid* spec, the orchestrator loaded a 450-line instruction file describing the gates and
returned a description of those gates — "The tech-lead skill is orchestrating the full Shape Up
harness. It will: 1. …" — then ended. No code, no board, no gate artifacts, and prose that reads
like a successful run, with every defect left in the deliverable.

**Why nothing already caught it.** Two guards existed and both missed it for independent
structural reasons, which is the finding worth keeping:

1. `gate-intake.mjs` fires on an *empty* intake. Intake was valid. Correct no-op.
2. The claim-versus-facts check of the day was scoped to an *active* run, and a run that never
   started produces none of the files it reads — it catches "claimed done on a half-green board"
   and misses "claimed done with no board at all". Its claim detector also matched only past-tense
   completion, while narration is future-tense. **The emptier the failure, the less of it there
   was to detect.**

**Why blocking here does not violate "QA is a level-up, not a gate."** That invariant forbids a
second *judge* behind `spec-evaluator`. This hook makes no judgment about quality — it reports
that no work exists to judge, from a mechanical absence that no phrasing can change. Blocking is
also uniquely safe in this state: a session with zero artifacts has nothing to lose by
continuing, and an *advisory* note at the end of a narrated run simply gets narrated too.
Everything ambiguous fails open, and `stop_hook_active` caps it at one block per stop chain.

## 3.2c — The advisory checks, and where their answers land

`gate-zerowork` is the only `Stop`-event hook. The two advisory checks that used to sit beside it
are now **sections of the ship report**, and the architectural invariant is what moved them:
"QA is a level-up, not a gate", so neither may ever become a second gate behind the single judge.
An advisory note printed into a transcript at the moment a session ends is the channel least
likely to be read and impossible to check later; the ship report is the artifact a human reads at
GATE L4 and a teammate finds on `git pull`. Neither check changed — only where its answer lands.

| Check | Looks for | Lands in |
|---|---|---|
| Board census | The run's mechanical facts: unfinished board tasks, a red T0 verdict, unanswered escalates, `final_verdict: fail` — the facts a confident summary can contradict | The ship report's **Outcome** and **Verification (T0)** sections, derived from the board and the T0 artifacts (`harness reduce ship`) |
| Leftovers | The run's own diff carrying, in **added lines** only, TODO/FIXME, `console.log`/`debugger`, commented-out blocks, or one file swallowing hundreds of added lines | The ship report's **Leftovers (advisory)** section — a section, never a verdict |

## 3.2d — The run receipt and the gate answer set

Two small scripts in `kernel/` close two failures observed in real runs.
Both follow the same rule as the hooks: move the invariant out of the prompt and into the runtime.

**`harness init run` — the run receipt (GATE L0.1).** The orchestrator's first tool call, before any
prose. It writes `receipt.json`, `intake.md` (the requirement verbatim, plus its SHA-256),
`harness-run.md`, and `active-scope`. It supplies the fact that was missing from the system: *a
run started*. Every prior guard could only observe what a run **did**, so a run that did nothing
was invisible to all of them; the receipt makes starting observable independently of progress.
Recording the intake digest also makes "the spec was dropped on the hand-off" a checkable claim
rather than an arguable one — that is routinely the first diagnosis offered for a narrated run,
and previously nothing on disk could settle it either way.

**`harness gate` — pre-recorded gate decisions.** Sign-off was the last load-bearing
invariant still living in a prompt, and it failed in both directions:

- *Stall.* An unattended run with no human waits at the first ⏸ until the wall-clock budget
  expires — a run killed at an external time cap having produced nothing scoreable, on a
  feature a bare agent finishes in under a minute. A wait is indistinguishable from work until
  the budget runs out.
- *Consent-by-prose.* The workaround was a paragraph in the prompt ("treat this as advance
  sign-off for every gate"). It worked on one model and was re-summarised instead of acted on
  by another. Consent carried in prose is consent that can be paraphrased.

The answer set is a schema-validated file (`schemas/gate-answers.schema.json`) mapping each gate
id to a decision, with presets `ci` / `guarded` / `interactive`. The orchestrator **resolves**
each gate through the script and branches on its exit code — `0` cross, `4` stop and put the
block to the PO, `5` abort — so a crossing is produced by a tool, not by the model's reading of a
paragraph.

This is **not "gates off."** Every gate still emits its block and still records a decision; what
changes is the decision's *source*, which the ledger names (`preset:ci`, plus the set's
`authorized_by`). An audited bypass and a rubber stamp differ by exactly that record. And
`on_missing: "abort"` — the default for headless presets — converts the stall into a fast,
attributable failure: "GATE L4 has no pre-recorded answer" in ten seconds beats a silent
half-hour that gets reported as a slow harness.

## 3.2f — The ratchet, and the receipt (v1.5)

Two shared libraries and one hook library, added because the harness had built a ratchet,
enforced it beautifully, and never fitted the pawl.

**`kernel/lib/argv.mjs` — the typed argv boundary.** The envelope boundary is
rigorously typed and hook-validated in both directions; that discipline stopped dead at
`process.argv`, which is where the pipeline actually executes. `t0-verify` parsed `--round` with
`Number(argv[++i])` and then `?? 1`, which does not catch `NaN`: a flag passed without a value
wrote a real verdict to `rNaN-a1.json` and **exited 0**, leaving the evaluator's mandatory T0
citation unresolvable. `parseArgs` takes a declarative spec, rejects before any I/O, exits 2, and
puts a machine-readable reason on stderr — the same contract `harness verify envelope` applies to a
malformed order. Every entry point exports its `ARGV_SPEC`, which is what makes the contract
inspectable by `tests/structural/13-argv-contract.mjs` rather than guessable.

**`kernel/verify/ratchet-tree.mjs` — `keep` and `revert`.** The attempt loop
branched a red T0 two ways and only one of them reverted anything: a seesaw regression got
`git stash push -u`, while a red on the scope's *own* fixtures got "loop to the next attempt" and
no revert at all — so attempt N+1's fresh, zero-memory subagent began from code it did not write
and could not see the history of. `snapshot()` publishes the working tree as a `git stash create`
object under a **shadow ref** (`refs/shapeup/<scope_id>/kept`), invisible to `git log`/`git status`
and to every branch operation, preserving the standing convention that the harness never writes
commits to the branch under test; `restore()` rewrites the tree from it. Both are best-effort:
outside a work tree, or with no snapshot yet, they report `{ok:false, reason}` and the caller
proceeds exactly as before.

Together with `score()`, `better()` and `trials.jsonl` in `harness verify t0`, these collapse the two
red branches into one rule — *keep what is strictly better, restore what is not* — whose important
consequence is that an attempt moving 2/5 → 4/5 fixtures is **red but better**, and is therefore
**kept**. The ratchet retains improvements, not just greens.

**`hooks/lib/decision.mjs` — `allow` gets a receipt.** Every enforcement tool's failure signature
was identical to its success signature: fed malformed input, all eleven answered `exit=0,
stdout_len=0` — which is also what "inspected and permitted" looks like, what "no rule matched"
looks like, what a thrown exception looks like, and what an inert script looks like. Four states,
one signature, which is how 26 enforcement points sat inert behind 610 green checks. Fail-open is
**retained** (a gate that breaks legitimate runs just gets disabled); what changes is that a
permitting decision now carries evidence. `runHook(name, fn)` is the only exit path a hook has, so
no route out of one can skip the record. Two things fall out at no extra cost: `gate-zerowork`
gains a second `Stop` condition — orchestrator dispatched, zero decision rows ⇒ the enforcement
layer itself never ran, so the detector for "the gates didn't run" stops depending on the gates
running — and `harness probe stats --hooks` can report evaluations, denials and errors per hook, which makes
"never had to fire" and "never ran" separable facts for the first time.

## 3.2g — The run key, and the record plane (v1.8)

Everything above writes JSON. Orders and results are the dispatch's input and output; the launcher
journals one row per agent call with its model, wall time and cost; every hook appends a decision
row; `t0-verify` appends a trial row with a genuine parent edge. The harness has been producing a
complete, schema-registered dataset since v1.0 — and discarding it, because **none of it was
joinable**.

The nearest thing to a key was `order_id`: `<slug>/r<N>-a<M>`. It identifies a dispatch *within* a
run and is identical across every run of the same slug, so two runs of one feature produce two
`checkout/analyze` records with no field that separates them. Two consequences, and they are
precisely the two rows [§5.1](05-verification-and-quality-strategy.md#51--the-measurement-table)
lists as having no instrument: "compare this run against the last one" was not expressible, and
"what did this run cost" could not be computed, because the cost rows (the journal) and the outcome
rows (results, verdicts) had no column in common.

**The key is derived, not drawn.** `mintRunId` (in `lib/paths.mjs`) mints `<slug>-<YYYYMMDDTHHMMSSZ>-<8 hex>` as a
pure function of three fields the receipt already holds — slug, `started_at`, `intake_sha256`. A
`randomUUID()` would have been one line and would have forfeited the property this repo pays for
everywhere else: a random key exists only where it was first written, so any record that missed the
stamp is unjoinable forever. A derived one means every writer holding the receipt computes the same
id without being handed it, and **runs that predate the field are backfillable** — an old receipt
yields the id it would have been given.

| Writer | Record | Stamp |
|---|---|---|
| `harness init run` | `receipt.json` | mints it — the run acquires identity at the moment it starts |
| `harness compile` | WorkOrder | `run_id` + `compiled_at`, at the one point every lane passes through |
| `harness verify t0` | T0Artifact, TrialRow | read off the receipt in the run root it was pointed at |
| the Workflow runtime | journal row | resolved once at launch, from `RunArgs.runId` or the receipt |
| `hooks/lib/decision.mjs` | decision row | best-effort via `active-scope`; `null` outside a run |
| tech-lead (SHIP S.6) | MetricsRow | copied — the harvest row's only link to its own trace |

**WorkResult deliberately gets no stamp.** It is written by the worker, and a field a worker must
remember to copy goes missing under exactly the conditions you most want the record. Results join
to orders on `order_id`, which they already echo and `harness verify envelope` already enforces — so the
key reaches the result leg through a checked join rather than through a worker's cooperation.

### The export, and what it does not do

`harness report export` projects a run's records into ten flat fact tables (JSONL, one object per line)
under `.shapeup/exports/<run_id>/`, plus a manifest carrying row counts, a skipped-record count and
the economics block. The dispatch grain is the spine — one row per compiled order, joined to its
result on `order_id` and to its agent call through the `result_path` the workflow's dispatch prompt
requires. It is read-only over the trace and re-runnable at any time.

Two properties are load-bearing rather than tidy:

- **It never fabricates a join.** The journal exists only on the workflow lane, so a `--tiny` or
  prose-lane dispatch has no cost row. Those rows carry `cost_usd: null` and `agent_join: null`,
  never `0` — an absent value and a zero value must not share a signature, which is the same defect
  `hooks/lib/decision.mjs` exists to close one layer down. `--economics` reports attributed and
  unattributed cost separately for the same reason.
- **It does not cross a machine boundary on its own.** The default destination is LOCAL and
  gitignored. Making it SHARED would put per-run structured data and a machine name back into the
  repository, which is exactly what ADR-0001 moved the metrics shards out of git to prevent. What
  the export fixes is that the LOCAL tier is *regenerable*: a dataset keyed by run id survives the
  per-slug wipe that used to delete it. Travelling further is `--out <dir>`, a human decision.

The read plane grades nothing. Every column is an id, a count, a duration or a copied enum — the
rule `harness probe stats` states in its own header, and the reason a computed "run quality" figure is absent
here: it would be a second judge behind `spec-evaluator`.

## 3.2e — Continuity across a context loss

Nothing on disk is ever lost to a context compaction — the two-root storage design (§3.3)
already guarantees that. The residual risk is the orchestrator *continuing on a degraded
summary without noticing*: re-dispatching an already-ingested order, miscounting attempts
(breaking the inner circuit breaker), or "remembering" a hill phase instead of re-deriving it.

The answer is a **query, not a reflex**. After a compaction, or in a fresh session over an open
run, the orchestrator re-derives where the run stands from artifacts:

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" reduce graph --slug <slug> --subgraph run
```

Two supporting derivations answer narrower questions from the same files: `harness probe resume`
reports the phase and can refuse to proceed past one (`--require`), and `harness reduce snapshot`
derives a `RunSnapshot` (registered in the domain registry, self-validated before emitting) from
the run pointer, `harness-run.md` frontmatter, board frontmatter, `t0/verdicts/` filenames and
the `orders/` vs `results/` diff — `--write` persists it as an audit anchor.

A third answers the question the fan-out is judged on. `harness probe concurrency` joins the
dispatch receipts (a leg's start, hook-attested) to the leg-completion rows `reduce ingest` appends
(its end) and reports how many legs were open at once, the build span, and the waves it observed.
It is the only measurement in the system whose subject is the pipeline rather than the deliverable,
and it is built around one rule: every figure travels with the completeness of the record set it
came from, and a speedup it cannot support is refused rather than approximated. A concurrency of 1
computed over four legs with one usable record reads exactly like a run that was genuinely
sequential, which is why the count of legs with no completion record sits in the same document.

The same leg-completion rows answer a second question, and `harness probe leg` is what asks it: did a
scope's result actually **reach the board**? A green T0 verdict says the worker's fixtures ran and
passed; it says nothing about whether the `WorkResult` was applied, and the BUILD round's confirm
stage asked only the first question. On a live run a build leg wrote its code, a green verdict, a kept
trial row and its result envelope, then skipped its own `reduce ingest` step — leaving that scope's
task `pending` with zero acceptance criteria ticked while its code sat finished on disk, and the board
that GATE L2 reads as complete silently disagreeing with a scope that was genuinely done. The row is
the evidence because `reduce ingest` is what writes it: its presence proves the writer ran, and it is
not something the leg can assert about itself — the same reason a dispatch receipt is written by the
hook layer rather than by the sub-agent making the call. Finished work whose leg failed to apply it is
ingested by the round rather than re-built, because re-running the leg would pay a whole attempt again
for work already on disk.

**Why a command rather than the lifecycle hooks this used to be.** The pair that preceded it
fired at two moments the platform chose, and the commonest continuity event in practice was
covered only by accident: you close the terminal and come back tomorrow, or a teammate picks the
work up in a fresh checkout. The cost of missing it has been observed, not imagined — re-entering
exactly that scenario with no pointer to the open run, the orchestrator started over at phase 1,
burning most of a session re-deriving state before its first write and closing none of the
handoff gap while the receipt and board sat on disk; one such run reached GATE L4 having advanced
the deliverable by zero criteria. A command answers whenever the question is asked, including the
moments a hook never saw, and `harness init run` refuses with **exit 3** over an already-open run
and prints the derived resume state — so the failure that actually happens is caught at the front
door rather than depended on being injected.

> Continuity and run economics are also the two measurement-table rows with **no automated
> instrument** ([§5.1](05-verification-and-quality-strategy.md#51--the-measurement-table)
> rows **3–4**) — the harness cannot produce those figures for itself, which is why this
> paragraph reports observations rather than numbers read off a baseline file.

## 3.3 — Two storage roots

Every artifact the harness produces lives in one of two roots, split by a single question: does
this need to survive a `git pull` by a teammate, or can it be rebuilt from what's committed?

| Root | Scope | Contents |
|---|---|---|
| **SHARED** — `shapeup/<slug>/` | Committed — the durable deliverable | `shaping/` (pitch, framing, breadboard, baseline, glossary), `spec/` (domain model, use cases, contracts, ux-behavior, scope-summary), `scopes/*.md`, `wiring-map.md`, `project-profile.md`, `requirements.md`, `hill/*.yml`, `REPORT.md` (frozen at GATE L4), and — at the `shapeup/` root — `knowledge-base/<skill>.md` |
| **LOCAL** — `.shapeup/<slug>/` | Gitignored — run trace and machine state | `receipt.json`, `harness-run.md`, `orient/`, `tasks/` (the board), `working/` (spec analysis that is not contract), `orders/` + `results/` (the envelope port), `t0/verdicts/` + `trials.jsonl`, `workflow-run/journal.jsonl` (the agent-call record), `evaluation/`, `qa/`, `trace/`, `discovery/ledger.md`, `round-ledger.md`, `run-snapshot.json` (compaction anchor), and — at the `.shapeup/` root, outside any slug — `active-scope`, `decisions.jsonl`, `metrics/*.jsonl`, `exports/<run_id>/` (frozen fact tables, §3.2g), `gate-answers.json`, `safety-overrides.json` |

The rule (ADR-0001): **prose is the team's, structured data is the machine's.** The three
contracts are the named exception — they are structured, but they are also low-level design a
reviewer must read, so they are converted to markdown rather than hidden. The knowledge base is
the second: it is policy, but coaching rules describe how an agent should work *in this codebase*,
which is a team property. A third exception once covered the migration bookkeeping files; the
upgrade path no longer migrates data, so it was withdrawn with its subject (ADR-0001).

The split matters operationally: a second developer who pulls a branch mid-run has the SHARED
spec but no LOCAL board — the harness detects that at GATE L1b and regenerates the board from
the committed spec, rather than treating a missing file as a broken run. They also see no run
evidence until the run ends: `REPORT.md` is written once at GATE L4 and carries the verdict, QA
findings, T0 summary and adjudicated decisions, so the deliverable tier gets the conclusions
without the per-attempt churn.

## 3.4 — Distribution: one source, one runtime

```mermaid
graph TD
    SRC["Single source of truth\nskills/ · commands/ · hooks/ · oracles/"]
    SRC --> CC["Claude Code plugin\n(native — .claude-plugin/plugin.json)"]
    CC -.->|"npx shapeup-sdlc init<br/>(or scripts/install-harness.sh)"| PROJ1["Target repo\n.claude/settings.json"]
```

Claude Code is the only delivery target — hooks are a per-CLI mechanism, and without them the
gates degrade from enforced to instructed, which is the property the harness exists to provide.

Scaffolding a target project has two entry points that do the same job. `npx shapeup-sdlc init`
(`bin/init.mjs`) is pure Node and works on Windows; `scripts/install-harness.sh` is the bash
equivalent and the published `curl` URL. Both wire the plugin via `.claude/settings.json` and
write the **permission grant** the pipeline needs: the harness's scripts ship *with the plugin*
and therefore live outside the user's project, so running them needs approval that a headless
session has nobody to give. `migrate.sh` upgrades an existing install the way a database
migration tool does — update code, then apply any pending, idempotent `NNNN__*.sh` data
migration exactly once, recorded in a committed ledger. Both shell paths are a frozen URL
contract (`scripts/FROZEN.md`): they may never be renamed or moved.

## 3.5 — The run itself: one workflow launch, not a turn-by-turn drive

Everything above describes a single dispatch. The **run** that strings them together is not the
orchestrator narrating steps in the conversation — it is one launch on the native Workflow runtime
that owns the whole pipeline:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/shapeup-run.js",
  args: <the RunArgs object>
})
```

`tech-lead` holds the GATE L0 intake conversation, writes `project-profile.md`, compiles one
`RunArgs` record (`domain.schema.json#/$defs/RunArgs`) — and hands over. ORIENT → L1a → ANALYZE →
WIRE → L1a.5 → MAP SCOPES → L1b → rounds of BUILD/L2/EVAL → QA → GATE H all run inside
`shapeup-run.js`. Three properties follow, and they are the reason the run is shaped this way:

| Property | Mechanism |
|---|---|
| **A gate pause is a return value, not a stop.** | The launch returns `{status: "paused", paused_at, block}`. The orchestrator emits `block` verbatim, gets the PO's decision, writes it to `.shapeup/<slug>/gate-answers.json`, and **relaunches the same call with the same args**. |
| **A killed session loses nothing.** | `harness probe resume` derives the resume point from **artifacts on disk**, never from stored status or conversation memory — every phase predicate is an artifact test. `shapeup-run.js` fast-forwards past finished phases on every launch, fresh or resumed. The same table answers `--require <phase>`, the post-condition checked after each dispatch, so *resume* and *completion* are one predicate by construction. |
| **The launch surface is one an install grants explicitly.** | The `Workflow` tool is the launch path, and `npx shapeup-sdlc init` writes the `"Workflow"` grant it needs. That grant is unscoped — it authorises every dynamic workflow script in the project — so it is opt-out (`--no-native-workflow`), and an install that declines it approves the launch once per session instead. |

`RunArgs` is compiled **once** and passed as a single JSON literal: the workflow cannot ask
follow-up questions and cannot read config files itself, so everything a run will ever need
travels in that one record.

**The lane boundary.** `shapeup-run.js` targets specs with committed `scopes/*.md`. A `--tiny`
run, or any spec with no scope contracts yet, takes the unchanged prose loop in
`skills/tech-lead/references/protocol.md` — non-regression, by design, and the reason that
file still carries the full step-by-step.

---
[← High-Level Design](02-high-level-design.md) · [Back to index](README.md) · [Next: Functional Design →](04-functional-design.md)
