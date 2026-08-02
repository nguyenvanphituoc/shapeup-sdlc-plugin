# 03 — System Design

[← Back to index](README.md)

## Components and their contracts

The tech-lead is the only stateful component. Every other skill is a **pure worker**: it
receives a structured order, does its craft, and returns a structured result — it never reads
or writes the run's shared files directly.

## 3.1 — The envelope port

Every worker dispatch is two JSON documents and three scripts, all living beside the
orchestrator skill (`skills/tech-lead/scripts/`, schemas in `skills/tech-lead/schemas/`):

```mermaid
sequenceDiagram
    participant TL as tech-lead (orchestrator)
    participant CO as compile-order.mjs
    participant VE as validate-envelope.mjs (hook)
    participant W as worker skill (fresh Agent)
    participant IR as ingest-result.mjs
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
        TL->>IR: node ingest-result.mjs <result path>;
        IR->>FS: tick AC boxes, flip board status,<br/>append ledger, propagate unblocks
    end
```

Workers never write boards, ledgers, or run-state. Everything a worker used to write into
shared files directly, it now **returns as data** in its `WorkResult`; `ingest-result.mjs` is
the single, deterministic writer. This closes what the project calls **D6** — "single-writer"
stops being a convention and becomes mechanically true, because no worker holds a path to
write to even if it wanted to.

### WorkOrder (in) — key fields

| Field | Purpose |
|---|---|
| `worker` | One of 11 enumerated skills — the order names its own destination |
| `operation` | Replaces ad-hoc flags (`--tasks-only`, `--remap` …) — the caller knows the pipeline position, the worker never re-derives it |
| `substrate` | The write contract for this order — data the sandbox hook enforces, not prose asking the worker to behave |
| `payload` | Worker-specific inputs: scope contract, tasks, prior decisions, digested errors, KB rules path |

### WorkResult (out) — key fields

| Field | Purpose |
|---|---|
| `task_results[]` | Per-task status + AC pass/fail + evidence — `ingest-result` flips the board row from this alone |
| `escalates[]` | The worker's one outward port for a decision it can't make alone — routed to `advisor-protocol` |
| `discoveries[]` | Raw discovered lines — appended to the discovery ledger by ingest, never by the worker |
| `verdict` | `spec-evaluator` only — overall PASS/FAIL, per-criterion results, refuted AC boxes, T0 citation hashes |

## 3.1b — Operation routing: one compiler, the whole skill set

The envelope port above is drawn once, generically — but there is a *single* compiler
(`compile-order.mjs`) behind every worker in the harness. The order's **`operation` is the
routing key**: `compile-order` resolves the owning worker from the operation alone (its
`OP_OWNER` map, mirroring `domain.schema.json`'s `$defs/Operation` ownership), so a dispatch
never carries a redundant `--worker`, and each operation stamps a fixed `substrate` write
contract (from `substrateFor`) that the sandbox hook then enforces. One compiled order therefore
*is* the dataflow across the skill set — the 20 operations fan out to the 11 worker skills by
pipeline stage:

```mermaid
graph LR
    CO["compile-order.mjs<br/>operation → worker + substrate"]
    CO --> ORI["orient<br/>(orient)"]
    CO --> SA["solution-architect<br/>(wire)"]
    CO --> BA["ba-pitch-analyzer<br/>(analyze · generate-board ·<br/>reconcile · retrofit-surface · coverage)"]
    CO --> SC["scope-architect<br/>(map-scopes · remap · split-scope)"]
    CO --> TE["task-executor<br/>(execute · fix · spike)"]
    CO --> SE["spec-evaluator<br/>(evaluate)"]
    CO --> QA["qa-edge-hunter<br/>(hunt · recheck)"]
    CO --> SH["scope-hammer<br/>(hammer)"]
    CO --> AD["advisor-protocol<br/>(adjudicate)"]
    CO --> TR["translator<br/>(translate)"]
    CO --> CH["coach<br/>(coach)"]
    ORI --> IR["ingest-result.mjs<br/>(single writer)"]
    SA --> IR
    BA --> IR
    SC --> IR
    TE --> IR
    SE --> IR
    QA --> IR
    SH --> IR
    AD --> IR
    TR --> IR
    CH --> IR
```

| Pipeline stage | Operation(s) | Worker skill | Order's `substrate.allowed` (write target) |
|---|---|---|---|
| Orient | `orient` | `orient` | `<local>/orient/**` |
| Wire (spine ✚) | `wire` | `solution-architect` | `docs/…/<slug>/wiring-map.md` |
| Map scopes | `analyze` | `ba-pitch-analyzer` | `<spec>/**` + `<local>/**` |
| | `map-scopes`, `remap`, `split-scope` | `scope-architect` | `<slug>/scopes/*.md` + `scope-board.md` |
| Coverage (spine ✚) | `coverage` | `ba-pitch-analyzer` | `docs/…/<slug>/requirements.md` |
| Board upkeep | `generate-board`, `reconcile`, `retrofit-surface` | `ba-pitch-analyzer` | `<local>/tasks/**` (+ append-only UC Invariants / Test Surface) |
| Build | `execute`, `fix`, `spike` | `task-executor` | the scope's own `allowed_file_substrate` + `<local>/spikes/**` |
| Evaluate | `evaluate` | `spec-evaluator` | `<local>/evaluation/**` |
| QA hunt | `hunt`, `recheck` | `qa-edge-hunter` | `<local>/qa/**` |
| Ship / triage | `hammer` | `scope-hammer` | `<local>/**` (run-trace default) |
| Escalation | `adjudicate` | `advisor-protocol` | `<local>/**` (its answer lands in the committed round-ledger via ingest) |
| Intake | `translate` | `translator` | `<local>/**` (writes the faithful `.en.md` copies) |
| Retro | `coach` | `coach` | `<local>/**` (its rules land in the committed knowledge-base via ingest) |

Two consequences fall out of routing *in the order* rather than in each skill: **(1)** adding a
worker is adding an operation, its `OP_OWNER` entry, and its `substrateFor` case — the
orchestrator owns the vocabulary and workers never re-derive their own pipeline position; and
**(2)** because the write contract travels inside the order, one `sandbox-guard.mjs` hook fences
every skill's writes with zero per-skill code. The return leg is uniform too: whatever any of the
11 workers produces comes back as a `WorkResult`, and `ingest-result.mjs` is the sole writer that
lands it into shared state (§3.1).

## 3.2 — Runtime-enforced guardrails (hooks)

Five `PreToolUse` hooks turn the harness's load-bearing rules from things the model is asked
to respect into things it cannot get past:

| Hook | Fires on | Enforces |
|---|---|---|
| `safety-spine.mjs` | `Bash` / `Read` / `Edit` / `Write` / `MultiEdit` | Denies the provably destructive operations no session ever legitimately needs: `rm -rf` on unrecoverable targets, force-push and push-to-main, `git reset --hard`, `DROP TABLE`/`TRUNCATE`, and secret-file reads (`.env`, `*.pem`, ssh keys, cloud credentials) via shell readers or the `Read` tool. Unlike the other three, it guards the **machine**, not the pipeline. The only escape hatch is the human-authored `.shapeup/safety-overrides.json` (schema: `SafetyOverrides`) — mechanically self-protected, and every exercised override is logged to the metrics shard as a `SAFETY-OVERRIDE` pathology row. |
| `gate-l2.mjs` | `Skill → spec-evaluator` (round mode) | Denies the once-per-round EVAL unless every task on the board reads `done` — reading both task frontmatter and the board table independently, and naming the unfinished tasks in the denial. |
| `gate-intake.mjs` | `Skill → tech-lead` | Denies an orchestrator dispatch with no resolvable intake — no `--pitch`, no `--spec`, no `--from` resume, and no free requirement text. Closes the harness's own front door: measured on `sdd-harness-bench` (F2 / Haiku 4.5, n=3, zero variance), a `tech-lead` reached as `args:"--unattended"` lost the requirement text on the hand-off, printed eleven gate names and a plan, wrote no code, and scored 29% while reading as a successful run — the same "claims done" pathology the harness exists to prevent, at its own entry point. Fails open on `--order` (the envelope port owns that path) and on any ambiguous arg shape. |
| `gate-deadline.mjs` | `Skill → task-executor` | Denies a dispatch that would start new build work once the run's opt-in `wall_clock_budget_s` is spent, routing to GATE H instead. **Deliberately does not deny `spec-evaluator`, `scope-hammer`, `qa-edge-hunter` or `advisor-protocol`** — a run past its deadline must still be able to judge, hammer and close, and a breaker that blocked the exit would strand green scopes it could not ship. It exists because the benchmark's F3 DNF turned out not to be a stall at all: the retained transcript shows 327 turns, 262 tool calls, 37 writes, last gate L3 and **zero** stall signals. The harness was working when the clock ran out, and both existing breakers count *events* (rounds, T0 attempts) so neither could see it. Off unless a budget is configured. |
| `validate-envelope.mjs` | `Skill` / `Agent` | Denies any worker dispatch whose `--order` file is missing or fails the WorkOrder schema — a malformed envelope never reaches a worker. |
| `sandbox-guard.mjs` | `Edit` / `Write` / `MultiEdit` | Denies a write outside the active scope's `allowed_file_substrate`, with a carve-out for the scope's own local run-trace root so it can still update its own board. |

All five are deliberately **fail-open** when there's nothing to verify (no active scope, no
board, no configured budget, unparseable input) and **fail-closed** the instant they can prove a violation — a guard
that broke legitimate standalone runs would just get disabled, defeating the point of having it.
(The safety spine adds one asymmetry: a *malformed overrides file* fails **closed** — treated
as absent — because a parse error must never disable the spine.)

## 3.2b — The zero-work block (Stop, blocking)

One `Stop`-event hook may block, and its predicate is why the invariant survives intact.

| Hook | Fires on | Enforces |
|---|---|---|
| `gate-zerowork.mjs` | Session end | Blocks a session that **dispatched the orchestrator and left no run receipt** — no `.shapeup/<slug>/receipt.json`, which `init-run.mjs` writes as the run's first act (§3.2d). |

**Why it exists.** Measured on `sdd-harness-bench` (F2 / Haiku 4.5, n=5, zero variance): given a
*valid* spec, the orchestrator loaded a 450-line instruction file describing eleven gates and
returned a description of eleven gates — "The tech-lead skill is orchestrating the full Shape Up
harness. It will: 1. …" — then ended. No code, no board, no gate artifacts, and prose that reads
like a successful run. 29% acceptance, 10 escaped defects.

**Why nothing already caught it.** Two guards existed and both missed it for independent
structural reasons, which is the finding worth keeping:

1. `gate-intake.mjs` fires on an *empty* intake. Intake was valid. Correct no-op.
2. `anti-rationalization.mjs` is scoped to an *active* run, and a run that never started
   produces none of the files it reads — it catches "claimed done on a half-green board" and
   misses "claimed done with no board at all". Its claim detector also matched only past-tense
   completion, while narration is future-tense. **The emptier the failure, the less of it there
   was to detect.**

**Why blocking here does not violate "QA is a level-up, not a gate."** That invariant forbids a
second *judge* behind `spec-evaluator`. This hook makes no judgment about quality — it reports
that no work exists to judge, from a mechanical absence that no phrasing can change. Blocking is
also uniquely safe in this state: a session with zero artifacts has nothing to lose by
continuing, and an *advisory* note at the end of a narrated run simply gets narrated too.
Everything ambiguous fails open, and `stop_hook_active` caps it at one block per stop chain.

## 3.2c — Advisory hooks (Stop)

Two `Stop`-event hooks review the session as it ends — and, by architectural invariant, may
only **inform**, never block. "QA is a level-up, not a gate": an advisory hook here cannot be a
second gate behind the single judge, so both exit 0 always and emit at most a `systemMessage`,
never a `decision`. Both are harness-scoped — silent unless a run is active.

| Hook | Checks | Says |
|---|---|---|
| `anti-rationalization.mjs` | The final message claims completion ("done", "all tests pass", "ready to ship") — **or promises it in future tense** ("will now run", "is orchestrating") as the session's last word — while the run's mechanical facts disagree: unfinished board tasks, a red T0 verdict, unanswered escalates, `final_verdict: fail`. | Names the specific contradicting facts, out loud, to the user. |
| `slop-cleaner.mjs` | The session's diff (git working tree; fallback: the newest WorkResult's `files_touched`) carries leftovers in **added lines**: TODO/FIXME, `console.log`/`debugger`, commented-out code blocks, one file swallowing 400+ added lines. | Lists the files and markers, suggests a cleanup pass. |

## 3.2d — The run receipt and the gate answer set

Two small scripts in `skills/tech-lead/scripts/` close the two failures the benchmark surfaced.
Both follow the same rule as the hooks: move the invariant out of the prompt and into the runtime.

**`init-run.mjs` — the run receipt (GATE L0.1).** The orchestrator's first tool call, before any
prose. It writes `receipt.json`, `intake.md` (the requirement verbatim, plus its SHA-256),
`harness-run.md`, and `active-scope`. It supplies the fact that was missing from the system: *a
run started*. Every prior guard could only observe what a run **did**, so a run that did nothing
was invisible to all of them; the receipt makes starting observable independently of progress.
Recording the intake digest also makes "the spec was dropped on the hand-off" a checkable claim
rather than an arguable one — the benchmark's first diagnosis was exactly that, and nothing on
disk could settle it either way.

**`gate-answers.mjs` — pre-recorded gate decisions.** Sign-off was the last load-bearing
invariant still living in a prompt, and it failed in both directions:

- *Stall.* An unattended run with no human waits at the first ⏸ until the wall-clock budget
  expires. On benchmark F3 that produced a DNF at 1800 s on a feature the no-harness control
  finished in 51 s. A wait is indistinguishable from work until the budget runs out.
- *Consent-by-prose.* The workaround was a paragraph in the prompt ("treat this as advance
  sign-off for every gate"). It worked on Sonnet 5 and was re-summarised instead of acted on by
  Haiku 4.5. Consent carried in prose is consent that can be paraphrased.

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

**`skills/tech-lead/scripts/lib/argv.mjs` — the typed argv boundary.** The envelope boundary is
rigorously typed and hook-validated in both directions; that discipline stopped dead at
`process.argv`, which is where the pipeline actually executes. `t0-verify` parsed `--round` with
`Number(argv[++i])` and then `?? 1`, which does not catch `NaN`: a flag passed without a value
wrote a real verdict to `rNaN-a1.json` and **exited 0**, leaving the evaluator's mandatory T0
citation unresolvable. `parseArgs` takes a declarative spec, rejects before any I/O, exits 2, and
puts a machine-readable reason on stderr — the same contract `validate-envelope` applies to a
malformed order. Every entry point exports its `ARGV_SPEC`, which is what makes the contract
inspectable by `tests/structural/13-argv-contract.mjs` rather than guessable.

**`skills/tech-lead/scripts/lib/ratchet-tree.mjs` — `keep` and `revert`.** The attempt loop
branched a red T0 two ways and only one of them reverted anything: a seesaw regression got
`git stash push -u`, while a red on the scope's *own* fixtures got "loop to the next attempt" and
no revert at all — so attempt N+1's fresh, zero-memory subagent began from code it did not write
and could not see the history of. `snapshot()` publishes the working tree as a `git stash create`
object under a **shadow ref** (`refs/shapeup/<scope_id>/kept`), invisible to `git log`/`git status`
and to every branch operation, preserving the standing convention that the harness never writes
commits to the branch under test; `restore()` rewrites the tree from it. Both are best-effort:
outside a work tree, or with no snapshot yet, they report `{ok:false, reason}` and the caller
proceeds exactly as before.

Together with `score()`, `better()` and `trials.jsonl` in `t0-verify.mjs`, these collapse the two
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
running — and `stats.mjs --hooks` can report evaluations, denials and errors per hook, which makes
"never had to fire" and "never ran" separable facts for the first time.

## 3.2e — Compaction resilience (PreCompact + SessionStart)

Nothing on disk is ever lost to a context compaction — the two-root storage design (§3.3)
already guarantees that. The residual risk is the orchestrator *continuing on a degraded
summary without noticing*: re-dispatching an already-ingested order, miscounting attempts
(breaking the inner circuit breaker), or "remembering" a hill phase instead of re-deriving it.
The resilience pair makes re-reading the files a reflex:

- **`run-snapshot.mjs`** (in `skills/tech-lead/scripts/`) derives a `RunSnapshot`
  (registered in the domain registry) from **files only** — the active-scope pointer,
  `harness-run.md` frontmatter, board frontmatter, `t0/verdicts/` filenames, and the
  `orders/` vs `results/` diff — and self-validates it against the registry before emitting.
- **`compact-snapshot.mjs`** (PreCompact) persists that snapshot to
  `.shapeup/<slug>/run-snapshot.json` before compaction. PreCompact provably cannot
  inject context, so this hook is a pure side effect: the audit anchor and fallback.
- **`session-rehydrate.mjs`** (SessionStart, matcher `startup|compact|resume|clear`) re-derives the
  snapshot **fresh** and injects its `rehydrate_hint` as `additionalContext`: *"re-read
  `.shapeup/<slug>/harness-run.md` and the board before continuing — trust the files, not
  the conversation summary."*

  The matcher was `compact|resume` until v1.4.1, and that was a real gap rather than a scoping
  choice. Both of those sources continue a conversation that still exists; the commonest continuity
  event in practice has none — you close the terminal and come back tomorrow, or a teammate picks
  the work up in a fresh checkout, and the CLI calls that `startup`. A reflex whose whole purpose is
  *trust the files, not your memory* did not fire in the one case where there is no memory at all.

  The SDD harness benchmark priced it. Its handoff design is exactly that scenario, and across three
  Sonnet rows the orchestrator re-entered at phase 1 with no pointer to the open run: **82–120 turns
  before the first write, $4.57–$10.36 per session, and 0/3 of the gap closed** while the receipt and
  board sat on disk. One row reached GATE L4 having advanced the deliverable by zero criteria. On a
  cold start the injection therefore leads with the failure that actually happens — *a run is already
  open, resume it, do not re-open it* — rather than with a generic pointer to the files, which a
  competent agent finds anyway.

## 3.3 — Two storage roots

Every artifact the harness produces lives in one of two roots, split by a single question: does
this need to survive a `git pull` by a teammate, or can it be rebuilt from what's committed?

| Root | Scope | Contents |
|---|---|---|
| **SHARED** — `shapeup/<slug>/` | Committed — the durable deliverable | `shaping/` (pitch, framing, breadboard, baseline, glossary), `spec/` (domain model, use cases, contracts, ux-behavior, scope-summary), `scopes/*.md`, `wiring-map.md`, `project-profile.md`, `requirements.md`, `hill/*.yml`, `REPORT.md` (frozen at GATE L4), and — at the `shapeup/` root — `knowledge-base/<skill>.md` |
| **LOCAL** — `.shapeup/<slug>/` | Gitignored — run trace and machine state | `receipt.json`, `harness-run.md`, `orient/`, `tasks/` (the board), `working/` (spec analysis that is not contract), `orders/` + `results/` (the envelope port), `t0/verdicts/` + `trials.jsonl`, `evaluation/`, `qa/`, `trace/`, `discovery/ledger.md`, `round-ledger.md`, `run-snapshot.json` (compaction anchor), and — at the `.shapeup/` root, outside any slug — `active-scope`, `decisions.jsonl`, `metrics/*.jsonl`, `gate-answers.json`, `safety-overrides.json` |

The rule (ADR-0001): **prose is the team's, structured data is the machine's.** The three
contracts are the named exception — they are structured, but they are also low-level design a
reviewer must read, so they are converted to markdown rather than hidden. The knowledge base is
the second: it is policy, but coaching rules describe how an agent should work *in this codebase*,
which is a team property. `.harness-version`/`.harness-migrations` are the third — machine state
that must be committed, or every teammate re-runs the migrations.

The split matters operationally: a second developer who pulls a branch mid-run has the SHARED
spec but no LOCAL board — the harness detects that at GATE L1b and regenerates the board from
the committed spec, rather than treating a missing file as a broken run. They also see no run
evidence until the run ends: `REPORT.md` is written once at GATE L4 and carries the verdict, QA
findings, T0 summary and adjudicated decisions, so the deliverable tier gets the conclusions
without the per-attempt churn.

## 3.4 — Distribution: one source, four runtimes

```mermaid
graph TD
    SRC["Single source of truth\nskills/ · commands/ · hooks/"]
    SRC --> CC["Claude Code plugin\n(native — .claude-plugin/plugin.json)"]
    SRC --> DIST["tools/distribute.js"]
    DIST --> CUR1["dist/cursor-rules/*.mdc"]
    DIST --> CUR2["dist/cursor-extension/"]
    DIST --> ANT["dist/antigravity/subagents/"]
    CC -.->|install-harness.sh| PROJ1["Target repo\n.claude/settings.json"]
    ANT -.->|install-harness.sh| PROJ2["Target repo\n.agents/skills/"]
    SRC -.->|install-harness.sh| PROJ3["Target repo\n.codex/skills/"]
```

`distribute.js` parses each `SKILL.md`'s frontmatter and inlines its `references/*.md`, so every
compiled target carries the full behavior contract, not a stub. `install-harness.sh` scaffolds
a target project per detected CLI — wiring the plugin via settings for Claude Code, or copying
skill files for Antigravity/Codex, which deliberately enables **local skill evolution**: a team
can tune its copy without forking the plugin. `migrate.sh` upgrades an existing install the
same way a database migration tool does — update code, then apply any pending, idempotent
`NNNN__*.sh` data migration exactly once, recorded in a committed ledger.

---
[← High-Level Design](02-high-level-design.md) · [Back to index](README.md) · [Next: Functional Design →](04-functional-design.md)
