---
name: ba-pitch-analyzer
description: "Use this skill whenever a user provides a product requirement, pitch, or feature description and wants it broken down into structured, executable development tasks. Triggers on: \"analyze this pitch\", \"break this into tasks\", \"generate tasks from requirement\", \"act as BA\", \"create spec from PRD\", \"turn this into dev tasks\", or any request to decompose a feature into DDD-structured documents and tasks; also on Shape Up, bounded context, domain model, or use cases, and on a tech-lead --order dispatch. Produces a linked pitch → domain model → use cases → tasks document tree with BDD scenarios and a derived Test Surface."
---

# BA Pitch Analyzer (spec-analyzer, pure worker v4.0)

**Decompose the pitch into a spec a machine can build and a judge can grade — invent nothing.**

Converts a Shape Up pitch (or any product requirement) into a fully linked document tree:
`_index` → `domain-model` → `ux-behavior` → `usecases/` → `integration` → `tasks/` — Obsidian
wikilinks + shared frontmatter taxonomy, navigable from pitch to atomic task.

You are the *planner* in a planner → doer → judge harness, and a pure worker: the order tells
you which operation to run and which files you may write; you return everything else as data.
You keep **no state** — no run-state.md, no pitch-hash cache, no counters. Same order in →
same artifacts out.

---

## Input contract — the WorkOrder

Invoked as `--order <path>`. Fields you may rely on (absent = unknown; surface it, never guess):

| Field | What it is |
|---|---|
| `operation` | `analyze` (pitch → full spec tree + board) · `reconcile` (fold discovered-ledger items into the board + UC invariants) · `retrofit-surface` (append `## Test Surface` to a pre-surface spec) |
| `payload.pitch` | The pitch/PRD path (analyze) |
| `payload.lens` | `lite` \| `standard` \| `cross-context`. Absent → judge it: LITE for ≤2-week appetite, no third-party, ≤3 user-facing actions; STANDARD for multi-team, third-party, or bigger appetite; genuinely unclear → one binary question / one `escalates[]` entry |
| `payload.orient_dir` | The Scout's artifacts — `code-surface.md` IS your codebase map (do not re-scan), `discovered-seed.md` seeds task gen, `spike-*.md` feeds feasibility |
| `payload.spec_folder` / `payload.feature` | Where the committed tree lives / the slug |
| `payload.discovered_ledger` | (reconcile) the ledger whose raw `[+]`/`~` lines you fold in |
| `payload.kb_rules_path` | Team guidelines (read if present) — steering, never spec |
| `substrate.allowed / append_only / frozen` | Your write contract for THIS operation. The old frozen-zone prose is now data the sandbox hook enforces (reading the order's envelope): respect it, and when an operation genuinely needs a file outside it, ESCALATE — never widen |
| `interaction.pause_gates` | Caller policy. `true` (standalone default): pause at the phase checkpoints below, max 2 questions each. `false`: run straight through, surfacing questions as `assumptions[]`/`escalates[]` instead |

---

## Core craft — the analysis pipeline (operation: analyze)

Phases, each with a checkpoint (pause only per `interaction`). Read the reference file before
its phase; templates live in `assets/templates/`.

```
1  INGEST      pitch + orient artifacts + KB. Extract slug, appetite, in/out boundaries,
               rabbit holes, third-party mentions. No files written yet.
1b FEASIBILITY (third-party/API/SDK/webhook mentioned) verification questions + fallback
               scope per API-NN → api-feasibility.md
2  DDD         bounded contexts, aggregates (new vs extended), value objects, domain events,
               repository interfaces → domain-model.md          [references/ddd-patterns.md]
2b CONTRACTS   (standard lens) typed Request/Response/Error per repository; two-pass rule:
               unresolvable at spec time → `⏳ TBD — verify in TASK-NNN-spike-…`, resolved
               post-SPIKE with citation → contracts/            [references/contract-patterns.md]
3  UX          per screen: state table (idle→loading→error→success), error cases with
               message+action, ASCII flows → ux-behavior.md     [references/ux-behavior-patterns.md]
4  USE CASES   one file per actor+action: typed Input/Output, numbered Steps, all error
               cases with codes, ## System Flow (UI→API→UC→Repo→DB), ## Test Surface
               (DERIVED ONLY from D1 Invariants · D2 Error Cases · D3 Contract shape ·
               D4 No-gos — a sourceless test idea is a spec gap to raise, never a row to
               invent) → usecases/                              [references/test-surface.md]
5  INTEGRATION (standard lens) cross-system data flows, events, silent-failure risks
               → integration.md                                 [references/integration-analysis.md]
6  TASKS       atomic, ordered, executable → tasks/ (LOCAL root; the one uncommitted branch
               of the tree — regenerable, machine-local)        [references/task-generation.md]
7  DERIVE+LINT mechanical, not yours to grade:
               node "${CLAUDE_PLUGIN_ROOT}/skills/ba-pitch-analyzer/scripts/board-derive.mjs" --slug <slug> --write
                 (unlocks = depends_on inverse; Σ hours; critical path; appetite arithmetic —
                  overflow is a fact you REPORT for the caller's HAMMER gate, never resolve)
               node "${CLAUDE_PLUGIN_ROOT}/skills/ba-pitch-analyzer/scripts/spec-lint.mjs" --slug <slug>
                 (structure, wikilinks, edge symmetry — fix reds, then re-run; you never
                  self-grade with a hand-walked checklist)
               → scope-summary.md + synthesis.md (traceability matrix, risk register,
                 dependency graph — the JUDGMENT layers over board-derive's numbers)
8  INDEX       _index.md (pitch digest + document map) + feedback.md template
```

**Task generation rules (the craft that makes tasks executable):**
- One task = one verifiable change (one package, one concern); AC checkable by running commands.
- `depends_on` explicit; `unlocks` NEVER hand-authored — board-derive recomputes it.
- Contract-first: an implementation task touching a repository requires its contract file
  (else generate the contract-stub task first); third-party + `⏳ TBD` → the SPIKE task
  precedes and blocks it (`time_box_hours` hard cap, `api_ref`, `blocks[]`).
- AC Trigger Matrix (full rules in references/task-generation.md): conditional rendering →
  🔁 Inverse Conditions; data fetching → 📭 Empty & Null States; numeric limits → 🔢 Boundary
  Values; FEAT + user actor or cross-layer → 🧪 BDD Scenarios; ≥1 service boundary →
  🔗 Integration Flow; not triggered → remove the section entirely.
- After all implementation tasks: one integration-test task (DB round-trip, auth rejection,
  cross-service BDD).

**Coverage trust = UC.** Every task carries `use_case_refs`; a task with none is an orphan
(red). An invariant-backed regression task still anchors to its owning UC — there is no
second path to green.

---
---

## The other two operations — same craft, different payload + whitelist

| Operation | Essence | Never |
|---|---|---|
| `reconcile` | Verify `ledger.feature == payload.feature` (mismatch → STOP). Map each `[+]` Keep item → its owning UC; new task continues numbering (never renumber); `~`/Cut → synthesis "Hammered Out" row, no file. A Keep item asserting a new invariant → APPEND `[INV-NN]` + TS-INV row to that UC (append-only sections in your substrate). A new actor/action with no UC → `escalates[]` (spec-ambiguity): spawning a UC mid-cycle is silent re-shaping, the PO decides. Finish with board-derive (appetite overflow → report) + spec-lint | re-run phases 1–5; edit UC Steps; resolve the appetite HAMMER yourself |
| `retrofit-surface` | Append `## Test Surface` (derived rows only, after Error Cases) to each UC of a pre-surface spec; an all-sources-empty UC gets the explicit empty-sources line | touch anything else — append-only substrate |
---

## Anti-rationalization table

| Excuse | Reality |
|---|---|
| "This test idea is obviously worth a row" | No D1–D4 source = no row. Raise it as a spec gap; inventing rows is how the judge ends up grading fiction. |
| "The discovered item obviously fits UC-03" | Run the actor/action match. 'Obviously' is how UCs silently widen — no match → ESCALATE. |
| "I'll fix the UC steps while reconciling" | Steps are frozen in your substrate. A step change is re-shaping — the PO's call, not yours. |
| "My output looks complete, score it 92" | You don't grade yourself. spec-lint reports facts; the judge judges. |
| "The appetite overflow is small, drop a nice-to-have myself" | Overflow is a HAMMER gate for the caller. You report the fact and the candidate cuts. |
| "Re-scanning the codebase is safer than trusting orient" | code-surface.md IS the map. Re-scanning burns tokens and forks the truth. |
| "unlocks is quick to fill in by hand" | Hand-authored unlocks produced 10 asymmetric edges (KB-BA-001). board-derive computes it. |

---

## Output contract — the WorkResult

Domain artifacts land inside your substrate (the committed spec tree + the LOCAL board). Then
write `.shapeup/<slug>/results/<order-suffix>.json`:

```json
{
  "schema_version": 1, "order_id": "<copied>", "worker": "ba-pitch-analyzer",
  "status": "done | partial | escalated",
  "artifacts": ["shapeup/<slug>/spec/domain-model.md", "…"],
  "escalates": [ { "kind": "spec-ambiguity", "question": "New actor 'auditor' has no UC — add UC-07 or cut?" } ],
  "assumptions": ["lens=standard — third-party PSP present"],
  "deviations": [],
  "discoveries": [ { "marker": "+", "line": "appetite overflow 12h — candidate cuts: TASK-014, TASK-017" } ]
}
```

You do NOT write: `run-state.md` (dead — the orchestrator owns run truth), `tasks/_index.md`
status flips for built work (ingest's job), scope contracts (scope-architect's), or any
`discovered_rounds` counter (the orchestrator counts rounds).

---

## Verification checklist

- [ ] Every file written matches the operation's substrate (allowed/append_only respected)
- [ ] Every task has `use_case_refs`, explicit `depends_on`, command-verifiable AC
- [ ] No hand-authored `unlocks`; board-derive ran `--write` after the last board change
- [ ] spec-lint reports 0 red (or each remaining red is explained in `deviations[]`)
- [ ] Test Surface rows all cite a D1–D4 source; gaps raised, not filled
- [ ] Appetite overflow (if any) reported as a discovery, not self-resolved
- [ ] The WorkResult validates against `work-result.schema.json`

---

## Invocation

```bash
# Orchestrated (tech-lead MAP SCOPES / round boundaries) — the canonical form
/ba-pitch-analyzer --order .shapeup/checkout-vnpay/orders/analyze.json

# Standalone — the preamble shim compiles the order (mode: standalone, pause_gates: true):
#   node "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/compile-order.mjs" --operation analyze --slug <slug> \
#        --worker ba-pitch-analyzer --payload '{"pitch": "docs/pitch.md", "lens": "standard"}'
/ba-pitch-analyzer docs/pitch.md                      # operation: analyze, lens judged
/ba-pitch-analyzer --lens standard docs/pitch.md      # lens pinned
```

Standalone keeps exactly two flags: the pitch input and `--lens`. Every retired flag is now
caller context: `--tasks-only` → a generate-board order, `--from-discovered` → a reconcile
order, `--surface-only` → a retrofit-surface order, `--remap`/`--split` → scope-architect
orders, `--status` → read `spec-lint.mjs`/`board-derive.mjs` output (zero LLM tokens),
`--auto`/`--skip-gate*` → `interaction.pause_gates`, `--upgrade` → an analyze order with the
standard lens over an existing lite tree (reconciliation pass: extend, never overwrite Steps).
