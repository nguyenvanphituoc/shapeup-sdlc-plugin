# Pure-Skill Architecture — Clean Architecture for the Orchestrator/Executor Split

**Status:** IMPLEMENTED — landed as v1.0.0 (2026-07-13), phases P0–P4 in one pass.
See CHANGELOG.md [1.0.0] for the landing record. Deviations from this proposal:
`spec-assess.mjs` was not built (Phase-0 scoring arithmetic retired outright; the lens
judgment stays as one paragraph in the skill); `spec-status.mjs` folded into
`board-derive.mjs`/`spec-lint.mjs` output; the purified analyzer keeps the name
`ba-pitch-analyzer` (the §8.4 "spec-analyzer" role) so AGENTS.md, the coach KB mapping, and
trigger-eval datasets stay stable — `scope-architect` was extracted as proposed.
**Date:** 2026-07-13
**Reference repo studied:** [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (24 skills, MIT)

---

## 1. Thesis

The orchestrator layer should own **all pipeline management** — data marshalling, path
resolution, state writes, mode detection — and feed each executor a **structured input
envelope** (JSON work order). Executor skills should contain **only craft**: how to do
their one job excellently, the way agent-skills authors its skills.

Today both concerns live in every worker. That is the architectural defect this
proposal removes.

---

## 2. Diagnosis — where the current harness leaks

### 2.1 Executors carry pipeline plumbing

`skills/task-executor/SKILL.md` is 580 lines. By concern:

| Concern | Where | Layer it belongs to |
|---|---|---|
| **Craft** — AC-by-AC loop, Karpathy P2.7/P2.8, UI Layer 1/2/3, verification vs observable criteria | Phase 2, GATE D | Domain (keep in skill) |
| **Plumbing** — spec-folder path resolution, `run-state.md` parse, board glob-matching (GATE A), dependency status reads (B1), 6-file doc-update fan-out (P3.1–P3.6), unblock propagation (P3.4) | GATE A/B, Phase 3 | Application/Infra (move out) |
| **Mode branching** — standalone vs `--brief`, scope-contracts present vs absent, "A3/A4 skipped when no run-state is threaded" | GATE A/B/C, B0 | Application (move out) |

The same leak exists in `spec-evaluator` (path resolution, board reads, ticking/un-ticking
checkboxes) and `ba-pitch-analyzer` (writes `run-state.md`).

### 2.2 The single-writer rule is declared, not enforced

`tech-lead` SKILL.md declares "sole writer of run-state," but
`references/delegation.md` admits at the bottom:

> `run-state.md`: still written by planner/generator/evaluator until their D6 cleanup lands

D6 was never completed. Workers still write shared state (`tasks/_index.md`,
`run-state.md`, discovery ledger). Every one of those writes is a place where a worker
can corrupt run truth, and every one forces the worker skill to re-document filesystem
topology (the v3.2 local-tasks migration had to touch **four skills** just to move a
directory — that is coupling made visible).

### 2.3 Handoffs are prose, not contracts

The brief (`briefs/r<N>-a<M>.md`) is free-form markdown "containing exactly four things"
— but nothing validates that. A malformed brief fails silently inside the worker's run.
Compare `t0-verify.mjs`: its verdict is a JSON artifact with a schema, and it is the
single most reliable component in the harness. The lesson is already in the repo:
**structured artifacts + deterministic tooling beat prose conventions.**

---

## 3. Research — how agent-skills builds a pure skill

From `skills/test-driven-development/SKILL.md` and the `using-agent-skills` meta-skill:

**Anatomy of a pure skill (their invariant structure):**
1. Frontmatter: `name` + one-line `description` (trigger conditions only).
2. **Overview** — one philosophical sentence establishing the mindset.
3. **When to use / when NOT to use** — activation boundaries, `Related:` links.
4. **Core process** — ASCII flow (RED → GREEN → REFACTOR), numbered steps, code examples.
5. **Best practices** — principle name + bad-vs-good comparison + rationale.
6. **Anti-rationalization table** — `Excuse | Reality` rows pre-rebutting the model's
   known shortcut rationalizations ("this is trivial, no test needed" → rebuttal).
7. **Red flags** — checklist of in-practice anti-patterns.
8. **Verification checklist** — closing `- [ ]` list; "a task is not complete until
   verification passes."

**What is conspicuously absent:** path resolution, state-file formats, board updates,
run ledgers, mode flags, gate blocks. Their skills know **nothing about the pipeline**.

**Their handoff convention (meta-skill):** input = task description + constraints +
prior decisions + artifacts; output = completed work + **evidence**. Composition is the
*caller's* job — a decision tree routes work through 5–16 skills; skills never sequence
each other.

**Conclusion:** a pure skill = *craft + verification + refusal-to-rationalize*, with I/O
as an explicit contract owned by the caller. This is exactly the Dependency Rule from
clean architecture applied to prompt engineering.

---

## 4. Target architecture — clean architecture mapping

```
┌────────────────────────────────────────────────────────────────────┐
│ POLICY (PO)          Betting table, gates confirmations, feedback  │
├────────────────────────────────────────────────────────────────────┤
│ APPLICATION          tech-lead (conductor, thin):                  │
│  (orchestrator       - round loop, gates L0–L4, PO interaction     │
│   layer — GROWS)     - decides WHEN/WHETHER each worker runs       │
│                      - SOLE writer of ALL run-state (enforced)     │
│                      pipeline sub-layer (new, mostly mechanical):  │
│                      - compile-order.mjs  → WorkOrder JSON         │
│                      - ingest-result.mjs  → board/ledger/unblocks  │
│                      - validate-envelope.mjs → schema gate         │
├────────────────────────────────────────────────────────────────────┤
│ DOMAIN               Pure worker skills (SHRINK to craft only):    │
│  (executor layer)    orient · ba-pitch-analyzer · task-executor    │
│                      spec-evaluator · qa-edge-hunter · translator  │
│                      scope-hammer · coach · advisor-protocol       │
│                      Contract: WorkOrder in → artifacts +          │
│                      WorkResult out. Zero pipeline knowledge.      │
├────────────────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE       t0-verify.mjs, aegis-digest.mjs, sandbox      │
│  (already right)     hook, gate-l2 hook — deterministic, 0 tokens  │
└────────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** arrows point inward only. A worker depends on *its input envelope*,
never on filesystem topology, run-state format, board schema, or another worker. The
orchestrator depends on worker contracts. Moving `tasks/` again (a v3.2-style change)
would touch **one script**, zero skills.

### 4.1 The ports — two JSON envelopes

**`WorkOrder`** (orchestrator → worker; formalizes today's brief):

```jsonc
// .shapeup-sdlc/<slug>/orders/r<N>-a<M>.json   (schema: schemas/work-order.schema.json)
{
  "schema_version": 1,
  "order_id": "checkout-vnpay/r2-a3",
  "worker": "task-executor",
  "mode": "orchestrated",              // orchestrated | standalone
  "payload": {
    "scope_contract": { /* inlined scopes/<id>.json */ },
    "tasks": [ { "id": "TASK-003", "body_path": "...", "acceptance_criteria": [...] } ],
    "substrate": { "allowed": ["apps/api/src/orders/**"], "shared": [...] },
    "decisions": [ { "id": "ESC-2", "answer": "..." } ],      // from round-ledger
    "digested_errors": [ /* AEGIS triples from last attempt */ ],
    "kb_rules_path": "docs/shapeup-sdlc/knowledge-base/task-executor.md",
    "verify": { "test_cmd": "pnpm --filter api test", "env": [] },
    "constraints": { "non_go": [...], "ui_layers": { "layer3_frozen": true } }
  }
}
```

**`WorkResult`** (worker → orchestrator; replaces Phase 3's 6-file fan-out):

```jsonc
// .shapeup-sdlc/<slug>/results/r<N>-a<M>.json   (schema: schemas/work-result.schema.json)
{
  "schema_version": 1,
  "order_id": "checkout-vnpay/r2-a3",
  "status": "done",                    // done | partial | escalated | failed
  "ac_results": [ { "ac": "AC-1", "result": "pass", "evidence": "pnpm test → 14/14" } ],
  "files_touched": [ { "path": "...", "change": "created" } ],
  "escalates": [ /* advisor-protocol blocks, if any */ ],
  "discoveries": [ { "marker": "+", "line": "empty-cart edge case unhandled" } ],
  "assumptions": [ "..." ],
  "deviations": [ "..." ]
}
```

Everything a worker used to *write into shared files*, it now *returns as data*. The
orchestrator's `ingest-result.mjs` performs the writes: tick AC boxes, flip board
status, append execution log, propagate unblocks, append discoveries to the ledger —
deterministically, in one place, schema-validated.

### 4.2 Where the orchestrator gains "more skill"

The user's instinct is right, with one refinement: most new pipeline capability should
be **scripts, not LLM skills** (the repo's own DD-7 lesson — deterministic tooling costs
zero tokens and cannot rationalize). The application layer grows like this:

| New capability | Form | Replaces |
|---|---|---|
| `compile-order.mjs <scope> --round N --attempt M` | script | tech-lead's hand-assembled `isolated_brief()` prose step |
| `ingest-result.mjs <result.json>` | script | task-executor Phase 3 (P3.1–P3.6), spec-evaluator's box un-ticking, discovery-ledger appends |
| `validate-envelope.mjs <file> <schema>` | script + PreToolUse hook | nothing (new safety: a malformed order never reaches a worker) |
| `dispatch` (thin skill or tech-lead section) | skill logic | GATE A/B mode-detection currently duplicated in every worker |
| Board/unblock/status authority | tech-lead (via ingest script) | P3.4 unblock propagation inside the worker |

tech-lead's SKILL.md itself gets *shorter*, not longer — its BUILD section becomes
"compile order → dispatch → ingest result → t0-verify," four calls.

### 4.3 What a pure task-executor looks like (target ~250 lines)

Adopting the agent-skills anatomy, keeping what is genuinely craft:

```markdown
---
name: task-executor
description: Implement a work order's acceptance criteria exactly — minimum code,
  surgical diffs, verified outcomes. Input: a WorkOrder envelope. Output: code +
  a WorkResult envelope. Never writes run-state, boards, or ledgers.
---
# Overview           — "Implement exactly what the AC specifies. Prove it. Report it."
# Input contract     — WorkOrder fields you may rely on; anything absent = unknown →
#                      ESCALATE, never invent (zero-memory rule, kept)
# Core process       — PLAN (assumptions surfaced) → per AC: state minimum code →
#                      implement → verify observable outcome → next AC
# Craft rules        — Karpathy P2.7/P2.8, UI Layer 1/2/3, contract-reference rule,
#                      Non-Go stop (all kept verbatim — this IS the skill)
# Anti-rationalization table (NEW, from agent-skills)
#   "The AC is obviously satisfied, skip the test run" | Run it. Evidence or it didn't happen.
#   "This helper will be needed later"                 | Speculative code is scope creep (P2.7).
#   "The hardcoded array is temporary"                 | Layer-2 violation; the DB probe exists for you.
#   "I remember what attempt 2 decided"                | You have no memory. If it's not in the order, ESCALATE.
# ESCALATE protocol  — the worker's one outward port (kept)
# Verification checklist — every AC has evidence; result envelope complete; no files
#                      outside substrate; discoveries reported not self-planned
# Output contract    — WorkResult schema + example
```

**Deleted from the worker:** GATE A (locate/validate), GATE B1–B4 (dependency/env
plumbing — dependencies are the orchestrator's sequencing job; the test command arrives
in the order), Phase 3 entirely, GATE E (sign-off is the orchestrator's gate), all
standalone-vs-brief branching.

**GATE C survives** as the PLAN step: assumptions + observable criteria are craft, not
plumbing — agent-skills has the same move ("surface assumptions before proceeding").

**Standalone UX preserved:** `/task-executor --spec ... --task ...` still works — a
10-line preamble compiles a minimal WorkOrder from the flags (or tech-lead's dispatch
does it). One code path inside; two entry points outside.

### 4.4 Same treatment, other workers

| Worker | Loses | Keeps (the craft) |
|---|---|---|
| spec-evaluator | path/board resolution, checkbox un-ticking (→ ingest) | probe design, grading rubric, T0-citation requirement, single-judge verdict |
| orient | spec-folder conventions | code-surface sweep method, spike discipline, hill-signal heuristics |
| ba-pitch-analyzer | `run-state.md` writes, board *placement* knowledge | DDD spec-tree method, scope-architect contracts, PA1/PA2 lints |
| qa-edge-hunter | ledger-append mechanics (→ `discoveries[]` in result) | 6-lens charter, repro-required rule |

Architectural invariants (single judge, EVAL-once-per-round, two-level breaker, hill
mechanical) are **unchanged** — they are application-layer policy and stay in tech-lead,
which is exactly where clean architecture says policy belongs.

---

## 5. Migration plan (non-regression, the v0.3.0 pattern)

| Phase | Deliverable | Risk |
|---|---|---|
| **P0** | `schemas/work-order.schema.json` + `work-result.schema.json` + `validate-envelope.mjs`; briefs keep working | none — additive |
| **P1** | `compile-order.mjs` + `ingest-result.mjs`; tech-lead BUILD section rewired to call them; workers untouched (scripts translate order → today's brief format) | low — scripts testable in isolation (structural tests exist) |
| **P2** | task-executor v2.0 rewritten pure (anatomy above); legacy `--brief`/`--spec` accepted via preamble shim | medium — needs an eval run on `examples/todo-cli` before/after |
| **P3** | spec-evaluator, orient, qa-edge-hunter, ba-pitch-analyzer purified; D6 finally closed (`run-state.md` writes removed from workers) | medium |
| **P4** | Delete dual-mode branches + legacy brief format; CHANGELOG major bump | low by then |

Gate for each phase: the structural test suite + one full harness run on
`examples/todo-cli` with identical verdict.

---

## 6. What we gain / what it costs

**Gain**
- Workers become model-portable and individually eval-able (agent-skills' key property).
- Single-writer becomes *mechanically true*, not aspirational (closes D6).
- Filesystem moves (next v3.x) touch scripts, not five SKILL.md files.
- Token cost drops: plumbing tokens (GATE A/B/E, Phase 3) leave every worker dispatch;
  deterministic scripts do the work for free.
- Anti-rationalization tables imported — a proven countermeasure we currently lack.

**Cost**
- ~2 scripts + 2 schemas + 5 skill rewrites; the rewrites are deletions more than additions.
- Standalone invocations need the preamble shim (small, one-time).
- JSON-in-context is marginally less human-readable than the markdown brief — mitigated
  by keeping `orders/*.json` pretty-printed and colocated with a generated `*.md` mirror
  if audits need it.

---

## 7. Decision asks (Betting Table)

1. Approve the two-envelope contract (WorkOrder/WorkResult) as the harness's canonical port?
2. Approve "plumbing goes to scripts, not new LLM skills" as the default for the application layer?
3. Bet P0+P1 (schemas + scripts, zero worker changes) as the first appetite (~1 week)?

---

## 8. Compaction case study — ba-pitch-analyzer (670 lines → ~230)

The worst offender against the pure-skill target. Measured surface today:
**670 SKILL.md lines · 15 flags · 12 invocation modes**, each mode carrying its own
frozen-zone rules, write whitelist, idempotency notes, and drift semantics — all as prose.

### 8.1 Why flags are the disease, not the symptom

Every flag encodes **lifecycle position**: `--tasks-only` = "board missing on this
machine", `--from-discovered` = "round boundary reached", `--remap --split` = "scope
stuck ≥3 rounds", `--upgrade` = "lens changed", `--status` = "PO wants a read".

But the orchestrator **already knows the lifecycle position** — that is its whole job
(GATE L1b bootstrap check, round boundaries, hill `rounds_at_position`). The flags exist
so a stateless CLI entry point can be *told* where the pipeline is. Once the WorkOrder
carries that context, the worker never re-derives it, and the flag surface collapses:

| Today's flag | Where it goes |
|---|---|
| `--lens`, `--output-path` | `WorkOrder.payload` fields |
| `--auto`, `--skip-gate0/pregen`, `--skip-gate 2,2b` | `WorkOrder.interaction` policy — pausing is *caller* policy; the pure skill only *surfaces* questions/assumptions, it never decides whether the pipeline stops |
| `--tasks-only`, `--from-discovered`, `--remap`, `--surface-only`, `--upgrade` | `WorkOrder.operation` + a **write whitelist** (see 8.3) |
| `--status` | deleted — a read-only report over committed files is a script (`spec-status.mjs`), zero LLM tokens |
| `--assess`, `--skip-assess` | orchestrator decides whether the assess operation runs |
| `--cross-context` | separate WorkOrder shape (genuinely distinct job) |

Result: **15 flags → 0** under orchestration; standalone keeps two (`input`, `--lens`)
via the preamble shim.

### 8.2 The mechanical half was never craft — line-by-line audit

The skill's own text confesses which parts need no model:

| Block (lines today) | Evidence it's mechanical | New home |
|---|---|---|
| Phase 0 scoring (L0 preview, confidence +25/+25/+15, token math) | pure arithmetic over grep hits | `spec-assess.mjs` (judgment on lens choice stays in-skill, one paragraph) |
| Phase 1 cache rule (`pitch_hash` match → skip) | memoization = pipeline concern | orchestrator (compile-order checks the hash) |
| Phase 7a self-audit (L0–L3 weighted score) | checkbox walking over generated files | `spec-lint.mjs` — and a worker grading its own output was always a judge-purity smell |
| Phase 7b scope summary (Σ hours, BFS critical path, Appetite Guard arithmetic) | explicitly graph math | `board-derive.mjs`; the HAMMER **pause** is an orchestrator gate |
| Phase 7c synthesis steps 1–5 | says verbatim "Parse-only… (no AI inference)" | `spec-lint.mjs` (gap-severity classification — the one inference — stays in-skill) |
| PA1/PA2 lints (Phase 6b) | glob/size checks | `spec-lint.mjs`, already gate-shaped |
| v3.3 `unlocks` recompute (depends_on inverse) | pure graph inversion | `board-derive.mjs`, run on **every** ingest — the KB-BA-001 asymmetric-edges bug becomes structurally impossible |
| v3.3 drift check + status-from-hill bootstrap join | mechanical join on scope key | `board-derive.mjs` |
| Upgrade Behavior section (~75 lines of per-mode write contracts) | see 8.3 | JSON + hook |
| `run-state.md` writes, `human_edited_files`, `discovered_rounds` counter | worker-held state | deleted from worker — orchestrator owns all of it (D6). The worker becomes genuinely **stateless**: same WorkOrder in → same artifacts out, no memory between invocations, no cache of its own |

### 8.3 The key move — mode differences are write-contract differences

Read the mode prose closely and a pattern falls out: what actually differs between
`--remap`, `--from-discovered`, `--tasks-only`, `--surface-only` is **which files each
may write and which are frozen**:

> "`--remap` is READ-ONLY on every other frozen-zone doc… it only ever writes
> `scopes/*.json`" · "READ-ONLY frozen zone: domain-model, usecases/ Steps…" ·
> "Regenerate ONLY: tasks/_index.md, scope-summary.md, synthesis.md" ·
> "only `## Test Surface` sections appended"

That is a **substrate whitelist** — the exact mechanism the harness already built for
task-executor (scope contract `allowed_file_substrate` + PreToolUse sandbox hook). So
each operation becomes data, not prose:

```jsonc
// inside WorkOrder for operation: "reconcile"
{
  "operation": "reconcile",
  "payload": { "discovered": [ /* ledger items, pre-read by compile-order */ ] },
  "substrate": {
    "allowed": [".shapeup-sdlc/<slug>/tasks/**", "spec/scope-summary.md", "spec/synthesis.md"],
    "append_only": ["spec/usecases/*.md#Invariants"],
    "frozen": ["spec/domain-model.md", "spec/usecases/*.md#Steps", "spec/contracts/**"]
  }
}
```

~75 lines of mode prose per skill → ~8 whitelist templates in `compile-order.mjs`,
**enforced by the hook instead of trusted to the model's reading comprehension**. The
mode logic isn't deleted — it's relocated into data + mechanical enforcement, where it
cannot drift and needs no re-documenting in four skills when a path moves (the v3.2
lesson).

### 8.4 What remains is the actual BA craft — and it splits cleanly in two

Two genuinely different expert jobs are bundled today:

1. **`spec-analyzer`** (~180 lines) — pitch → DDD spec tree. Phases 1–6 essence:
   ingest discipline, DDD decomposition judgment, contract two-pass rule, UC/Test-Surface
   derivation rules, task atomicity + contract-first + AC Trigger Matrix, the
   anti-invention rule ("a sourceless test idea is a spec gap, never a row"). Operations:
   `analyze | generate-board | reconcile | retrofit-surface` — same craft, different
   payload + whitelist.
2. **`scope-architect`** (~90 lines) — Phase 6b + `--remap --split`. Import-graph
   slicing judgment (by flow, never by directory), topology classification, affordance
   manifest derivation, fixture authoring, supersede-never-delete. A distinct skill
   because it has a distinct authority (sole writer of scope contracts) and a distinct
   failure mode (PA1 directory-thinking) deserving its own anti-rationalization table.

Both gain the agent-skills closing sections the current file lacks: an
anti-rationalization table ("the discovered item obviously fits scope A" → *run the flow
match; 'obviously' is how substrates silently widen*) and a verification checklist.

### 8.5 Net accounting

| | Today | Target |
|---|---|---|
| SKILL.md lines | 670 | ~180 (spec-analyzer) + ~90 (scope-architect) = **~270 (−60%)** |
| Flags | 15 | 0 orchestrated / 2 standalone |
| Modes documented in prose | 12 | 5 operations = payload + whitelist rows in `compile-order.mjs` |
| State held by worker | run-state.md, pitch_hash, human_edited_files, discovered_rounds | **none** — stateless by construction |
| Self-grading | Phase 7a audits its own output | `spec-lint.mjs` (mechanical, unbluffable) |
| Mode-rule enforcement | prose the model must obey | sandbox hook + schema validation |

Same yardstick applied to the rest of the fleet:

| Worker | Today | Pure target | Main cut |
|---|---|---|---|
| task-executor | 580 | ~250 | GATE A/B/E + Phase 3 (→ ingest script) |
| ba-pitch-analyzer | 670 | ~270 (two skills) | modes → whitelists; audits/graphs → scripts |
| tech-lead | 691 | ~400 | BUILD/brief mechanics → compile/ingest scripts; delegation tables stay |
| spec-evaluator | 462 | ~280 | path/board resolution + checkbox writes (→ ingest) |
| qa-edge-hunter | 377 | ~250 | ledger-append mechanics → `discoveries[]` |
| orient | 264 | ~200 | output-path conventions → WorkOrder |

Fleet total: **~3,000 → ~1,650 skill lines (−45%)**, with the removed half becoming
schemas, whitelist data, and ~4 deterministic scripts — cheaper per dispatch, testable
in CI, and immune to rationalization.

### 8.6 Rule of thumb going forward (proposed hard rule for the harness)

> A SKILL.md line must change **what a competent model would produce**. If it instead
> tells the worker *where* things live, *which* files it may touch, *when* it runs, or
> *how* to update shared state — it is pipeline logic and belongs in the WorkOrder,
> a whitelist, a script, or the orchestrator. Flags that encode lifecycle position are
> the tell: the caller always already knows.
