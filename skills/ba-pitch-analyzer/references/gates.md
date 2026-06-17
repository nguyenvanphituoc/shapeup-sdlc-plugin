# Gate Definitions

All gates follow these universal rules:
- Print summary always (even with no questions)
- Ask at most 2 questions (GATE 0: max 3)
- Questions only for gaps that force an assumption in the next phase
- User types "proceed" OR answers questions → record in `run-state.gate[N]_answers` → continue
- `--auto` flag skips all mid-phase gates (GATE 0 and GATE-PRE-GEN are NOT skipped by --auto)
- `--skip-gate N,N` skips specific gates

---

## GATE 0 — Input Enrichment (Pre-Assess)

Fires **before Phase 0** when pitch is missing any field Phase 0 depends on.

**Trigger conditions (any one is enough):**
- No named user role / actor identified
- No appetite or time-box stated
- Scope boundaries absent (no in/out list)
- Third-party mention without capability claim
- Multiple bounded contexts suspected but unconfirmed
- Feature name ambiguous (cannot derive feature-slug)

When NONE of the above → GATE 0 is silent, proceed to Phase 0.

**Format:**
```
⏸ GATE 0 — Need a few details before assessing

1. [Question about missing actor / scope / appetite]
2. [Question about third-party capability if applicable]
3. [Question about bounded context split if ambiguous]

(Provide your pitch + answers and I'll run the Assess.)
```

**Resolution:** Record answers in `run-state.gate0_answers`. Pass `--skip-gate0` to proceed with best-guess assumptions (logged in assess-report.md).

---

## GATE-PRE-GEN — Output Path + Final Input Check

Fires after Phase 0 when proceed = ✅ GO or ⚠️ GO+FIX.
Skipped when `--skip-gate-pregen` passed OR `--skip-assess` used with `--output-path`.

**Gap detection — surface when (max 3, triage by Phase 6 impact):**
- Third-party API capability unconfirmed AND no `--skip-spike` → 1 SPIKE gap
- Actor permissions / auth model unspecified AND tasks require auth AC → 1 auth gap
- Data retention / offline behavior unspecified AND lens=lite → 1 offline gap
- Existing schema version unknown AND pitch modifies existing entity → 1 schema gap

**Format:**
```
⏸ GATE-PRE-GEN — Ready to generate. Two questions before I start:

1. Output path (the SHARED spec deliverable dir):
   Default: docs/shapeup-sdlc/[feature-slug]/spec/
   Override with a different path? (press Enter to accept default)
   (run-trace — run-state.md, assess-report.md — always goes to the LOCAL
    root .shapeup-sdlc/[feature-slug]/, not here)

2. Missing inputs (printed only when gaps detected):
   □ [gap description] — needed for [phase that depends on it]
   □ [gap description] — will cause ⚠️ SPECULATIVE fields if not resolved

   Provide now, or type "proceed" to continue with ⚠️ SPECULATIVE annotations.

Lens confirmed: --lens [lite|standard]
Estimated output: [tasks_min]–[tasks_max] tasks, [tokens_min]–[tokens_max] tokens

→ Reply with output path + any missing inputs, or "proceed" to start.
```

**Resolution:** `run-state.output_path`, `run-state.gate_pregen_answers`. "proceed" → ⚠️ SPECULATIVE on unresolved gaps.

---

## GATE 1 — Ingest Confirmation

```
⏸ GATE 1 — Ingest complete. Confirming understanding before domain analysis.

Feature: [feature-name]
Appetite: [N weeks/days]
Bounded context: [context-name] ([new|existing])
In scope: [bullet list]
Out of scope: [bullet list]
Rabbit holes flagged: [N] — [brief list]
Third-party detected: [yes → Phase 1b will run | no → skip]
Codebase fit: [confidence score] — [found[]/warnings[]]

Questions (only when Claude cannot resolve from pitch alone):
  1. [e.g. "Is [EntityX] a new aggregate or extending [ExistingY]?"]
  2. [e.g. "Does [Actor] require auth or is this an anonymous flow?"]

→ Confirm, correct any item, or answer questions. Type "proceed" to continue.
```

---

## GATE 1b — Feasibility Review

Silent and auto-proceed if all capabilities are from existing codebase adapters.

```
⏸ GATE 1b — API feasibility draft ready. Review before generating contracts.

Third-party services found: [N]
  API-01: [ServiceName] — capability: "[what pitch claims]"
          Status: ⚠️ UNVERIFIED | ✅ CONFIRMED (from codebase)
          Fallback: [scope impact]
  ...

Questions (only when capability cannot be inferred):
  1. [e.g. "Does your team have a [ServiceName] sandbox account? Affects SPIKE time-box."]
  2. [e.g. "Is [capability X] required on day-1 or deferrable? Affects SPIKE blocking."]

→ Confirm, correct, or answer. Type "proceed" to generate contracts.
```

---

## GATE 2 — Domain Model Review

Always print — domain decisions are high-stakes and easy to misread.
Questions triage by irreversibility: aggregate roots > value objects > events.

```
⏸ GATE 2 — domain-model.md written. Confirm before generating contracts.

Bounded context: [context-name]
Aggregates:
  [AggregateRoot] (new|existing) — states: [list] — events: [list]
Value Objects: [list or "none"]
Repository interfaces: [list — each becomes a contract in Phase 2b]
Domain events emitted: [list]
Domain events consumed: [list or "none"]
Cross-context dependencies: [list or "none"]

Questions (only for debatable domain decisions):
  1. [e.g. "I modeled [X] as a Value Object — should it be an Entity?"]
  2. [e.g. "I placed this in [ContextA] — does it belong in [ContextB]?"]

→ Confirm, correct, or answer. Type "proceed" to generate contracts.
```

---

## GATE 2b — Contract Review

Skipped (auto-proceed) if lens = lite.

```
⏸ GATE 2b — Repository contracts drafted. Confirm before UX behavior.

Contracts generated: [N]
  [RepoName] (be-service|third-party-api|offline-storage)
    Request fields: [N total, N with ⏳ TBD]
    Response fields: [N total]
    Error codes: [list]
    Speculative fields: [list or "none"]

⏳ TBD fields requiring SPIKE: [field → API-NN, or "none"]

Questions (only when source tracing is ambiguous):
  1. [e.g. "I couldn't find source for [fieldX] — session context or UC input?"]
  2. [e.g. "[RepoName] — new endpoint or wrapping an existing one?"]

→ Confirm, correct field sources, or answer. Type "proceed" to map UX behavior.
```

---

## GATE 3 — UX Behavior Review

Always print screen inventory — missing screens are the most common Phase 3 defect.

```
⏸ GATE 3 — ux-behavior.md written. Confirm screens and flows before use cases.

Screens mapped: [N]
  [ScreenName] — states: [idle|loading|error|success|...] — actor: [Actor]
Error cases: [N total]
Offline behavior: [described | not applicable]
Navigation flows: [N transitions]

Unbacked screens (no UC yet): [list or "none"]
States with no error handling: [list or "none"]

Questions (only when flows are ambiguous or states missing):
  1. [e.g. "[ScreenX] empty state — CTA or hide section?"]
  2. [e.g. "After [action], stay on [ScreenA] or navigate to [ScreenB]?"]

→ Confirm, correct, or answer. Type "proceed" to define use cases.
```

---

## GATE 4 — Use Case Review

Print coverage gaps always — untraced UCs cause audit failures in Phase 7a.

```
⏸ GATE 4 — Use cases written. Confirm coverage before integration mapping.

Use cases: [N total]
  UC-[Name] — actor: [Actor] — steps: [N] — errors: [N] — events: [list]

Coverage gaps:
  UCs with no domain event: [list or "none"]
  UCs with no screen trace: [list or "none"]
  Actors in pitch but no UC: [list or "none"]

Questions (only when a UC step required a fork decision):
  1. [e.g. "UC-[Name] step 3 — confirm before [action], or immediate?"]
  2. [e.g. "I combined [ActionA]+[ActionB] into one UC — should these be separate?"]

→ Confirm, correct, or answer. Type "proceed" to map integrations.
```

---

## GATE 5 — Integration Review

Skipped (auto-proceed) if lens = lite.
Surface dead-end events and silent regression risks — these cause prod incidents.

```
⏸ GATE 5 — integration.md written. Confirm cross-system impact before tasks.

Systems touched: [N]
  [ServiceName] — data flows: [in/out] — silent failure risk: [yes|no]
Events produced: [list] → consumers: [list or "⚠️ no consumer found"]
Components with changed behavior: [list or "none"]
Silent regression risks: [list or "none"]
Env vars / external setup required: [list or "none"]

Questions (only when integration impact is ambiguous):
  1. [e.g. "[EventX] — consumed by [ServiceY] or fire-and-forget?"]
  2. [e.g. "[ComponentZ] flagged as changed — existing regression test suite?"]

→ Confirm, correct, or answer. Type "proceed" to generate tasks.
```

---

## GATE 6 — Task Graph Review

Always print layer breakdown and ordering issues.
Surface tasks with empty use_case_refs — they fail L3 audit.

```
⏸ GATE 6 — Tasks generated. Review task graph before audit.

Tasks: [N total]  SPIKE: [N]  FEAT: [N]  FIX: [N]  CHORE: [N]
Estimated: [X]h  |  Critical path: [Y]h  |  Parallelizable: [Z]h
BLOCKED tasks: [list by SPIKE dependency, or "none"]

Layer breakdown:
  shared-schema: [N]  domain: [N]  repository: [N]  use-case: [N]  ui: [N]

Ordering issues: [list or "none"]
Tasks with no UC trace: [list or "none"]

Questions (only when decomposition required assumptions):
  1. [e.g. "Schema task for [EntityX] — share migration with [EntityY]?"]
  2. [e.g. "TASK-NNN — [PackageA] or [PackageB] owns [concern]?"]

→ Confirm, correct, or answer. Type "proceed" to run audit.
```

---

## GATE 7 — Synthesis & Execution Decision

If audit score < 70: do NOT offer "proceed" — list required fixes first.
Score 70–89 OR gate = ⚠️ REVIEW: proceed available with explicit acknowledgment.
Score ≥ 90 AND gate = ✅ PASS: user can type "proceed" directly.

```
⏸ GATE 7 — Audit + Synthesis complete. Final review before master index.

Audit score: [N]/100
  Layer 0 (Input Quality):       [score] — [N/N checks]
  Layer 1 (Generation Complete): [score] — [N/N checks]
  Layer 2 (Document Quality):    [score] — [N/N checks]
  Layer 3 (Execution Readiness): [score] — [N/N checks]

Health Dashboard:
  Coverage:   [🟢|🟡|🔴] — [brief reason]
  Risk:       [🟢|🟡|🔴] — [brief reason]
  Dependency: [🟢|🟡|🔴] — [brief reason]

Synthesis Gate: [✅ PASS | ⚠️ REVIEW | 🚫 BLOCK]
Autonomous execution: [✅ CLEARED | ⛔ BLOCKED — reason]
Failures requiring attention: [list with file + check ID, or "none"]

→ Acknowledge results, request fixes, or type "proceed" to write final index.
   🚫 BLOCK: list failures to fix before proceeding.
   ⚠️ REVIEW: list risks acceptable to carry forward.
```

**Resolution:** Record in `run-state.gate7_acknowledged_risks` → Phase 8.
