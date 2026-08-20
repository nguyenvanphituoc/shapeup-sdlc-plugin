---
type: synthesis
feature: FEATURE_SLUG
generated_at: YYYY-MM-DD
skill_version: "2.8"
coverage_status: 🟢 | 🟡 | 🔴
risk_status: 🟢 | 🟡 | 🔴
dependency_status: 🟢 | 🟡 | 🔴
depends_on:
  - "[[domain-model]]"
  - "[[ux-behavior]]"
  - "[[usecases/_index]]"
  - "[[scope-summary]]"
---

# Synthesis: FEATURE TITLE

> **How to use this document:**
> Read the Health Dashboard first (30 seconds).
> Each indicator tells you which section to open next — skip green sections.
> 🟢 = no action needed · 🟡 = review recommended · 🔴 = must resolve before execution

---

## Health Dashboard

| Indicator | Status | Signal |
|-----------|--------|--------|
| Coverage | COVERAGE_STATUS | COVERAGE_SIGNAL |
| Risk | RISK_STATUS | RISK_SIGNAL |
| Dependency | DEPENDENCY_STATUS | DEPENDENCY_SIGNAL |

### Execution Gate (Synthesis)

<!-- 
  ✅ PASS   = Coverage 🟢 AND Risk 🟢
  ⚠️ REVIEW = any indicator 🟡, none 🔴
  🚫 BLOCK  = any indicator 🔴
-->
SYNTHESIS_GATE

*Combine with Audit score gate: both must pass for autonomous `/execute-plan`.*

---

## S-01 — Traceability Matrix

> Open this section when **Coverage** is 🟡 or 🔴.

Derived from: `use_case_refs` in each task frontmatter — the single link source (v3.3: UC
frontmatter carries no back-link; reverse lookup is always computed live from the task board).

### UC × Task Coverage

<!-- 
  Coverage is DERIVED by inverting each task's use_case_refs over the LOCAL board
  (.shapeup/<slug>/tasks/) at generation time. Record only the count + status —
  never task ids or [[tasks/...]] links: ids are machine-local (boards regenerate and
  renumber) and this doc is committed. Tier rule: links flow LOCAL → SHARED only;
  spec-lint flags [[tasks/...]] here as a red TIER-DIRECTION finding.
  Status key:
    ✅ covered   = ≥ 1 task with this UC in use_case_refs
    ❌ missing   = no task references this UC
-->

| Use Case | Actor | Covering Tasks | Status |
|----------|-------|----------------|--------|
| [[usecases/UC-Name]] | Actor | 3 | ✅ covered |
| [[usecases/UC-Name]] | Actor | 0 | ❌ missing |

**Coverage gaps (❌ items above — must resolve before execution):**
- [ ] UC-[Name]: no tasks found — create task or mark UC as deferred in Non-Go

### UC × Entity Participation

<!--
  For each UC row: list entities from its frontmatter `entities` field.
  Role key:
    actor    = UC operates ON this entity (create/update/delete)
    target   = UC reads this entity
    emits    = UC emits a domain event on this entity
-->

| Use Case | Entity | Role |
|----------|--------|------|
| [[usecases/UC-Name]] | `EntityName` | actor |
| [[usecases/UC-Name]] | `EntityName` | target |

**Entity orphans (entities in domain-model with no UC reference):**
<!--
  🔴 orphan = aggregate root entity with no UC reference → coverage gap
  🟡 orphan = value object or child entity with no UC reference → acceptable
-->
- `EntityName` — aggregate root — 🔴 no UC references this entity

### Screen → UC Backing

<!--
  For each screen in ux-behavior.md `screens` frontmatter:
  Check if at least one UC in ux-behavior `usecases` frontmatter references it.
  ❌ unbacked screen = screen with no UC → UX spec is ahead of domain model
-->

| Screen | Backed By | Status |
|--------|-----------|--------|
| ScreenName | [[usecases/UC-Name]] | ✅ |
| ScreenName | — | ❌ no UC |

### Domain Event Flow

<!--
  For each domain event in domain-model `domain_events` frontmatter:
  Check if any UC has it in `domain_events_emitted`.
  Check if integration.md has a consumer for it.
  dead-end = event emitted but no consumer declared in integration.md
-->

| Event | Emitted By UC | Consumer (integration.md) | Status |
|-------|--------------|--------------------------|--------|
| `EventName` | [[usecases/UC-Name]] | [[integration#Section]] | ✅ |
| `EventName` | [[usecases/UC-Name]] | — | ⚠️ dead-end |

---

## S-02 — Risk Register

> Open this section when **Risk** is 🟡 or 🔴.

Derived from: `_index.md` rabbit holes + `api-feasibility.md` SPIKE blocks + `integration.md` external deps.

### SPIKE Risks

<!-- Only present if api-feasibility.md exists -->

| Ref | Third-Party | Capability Claimed | Investigation | Time Box | Status |
|-----|------------|-------------------|---------------|----------|--------|
| API-01 | ServiceName | what pitch assumes | [[api-feasibility#API-01]] | Nh | ⏳ open |

**Risk formula:** SPIKE risk is 🔴 when any SPIKE `time_box_hours` × (number of blocked tasks) > 20% of appetite hours.

### Rabbit Hole Register

| Risk | From | Likelihood | Mitigation | Status |
|------|------|-----------|------------|--------|
| [risk description] | [[_index#Rabbit Holes]] | high/med/low | [mitigation] | ✅ mitigated |
| [risk description] | [[_index#Rabbit Holes]] | high | — | ❌ no mitigation |

**Unmitigated risks (❌ items — PO must decide: accept, mitigate, or cut scope):**
- [ ] [risk] — no mitigation declared

### External Dependency Risks

| Dependency | Declared In | Type | Unblock Condition |
|------------|------------|------|------------------|
| ENV_VAR_NAME | [[integration#Env]] | env var | add to `.env.example` |
| External Account | [[integration#Setup]] | sandbox | provision before sprint |

### Hammered Out (Cut)

<!--
  The SINGLE source of truth for tasks that were scope-hammered out of the cycle.
  A Cut produces NO task file (no bet yet, so no spec). Only record a trace line here.
  Mostly populated/appended by the reconcile operation over the discovered ledger.
  Each line: what was cut — Cut @ GATE-N · reason · (if hammer-traded) which task it was traded for.
-->

| Cut | At | Reason | Traded for (if any) |
|-----|-----|-------|---------------------|
| ~~[cut capability]~~ | GATE-N | appetite overflow — saved for a later bet | [UC or scope it was traded for] |

*A Cut is a healthy shaping signal, not debt. Revisit it at the betting table next cycle.*

---

## S-03 — Dependency Shape

> Open this section when **Dependency** is 🟡 or 🔴.

Derived from: `depends_on` in every task frontmatter. **Counts and shape only — no task ids.**
This document is COMMITTED and the board is not: ids live in the gitignored tier and renumber on
every regeneration, so an id written here resolves on the machine that wrote it and nowhere else.
spec-lint reds a `TASK-` id anywhere in the committed tree (TIER-DIRECTION).

| Metric | Value |
|---|---|
| Critical path | N tasks · NN hours · NN% of total estimated hours |
| Widest parallel wave | N tasks |
| Tasks with no dependency | N |
| Single points of failure (block > 2 downstream) | N |

**The per-scope build order — which scopes go in which wave, and what each waits on — lives in
`scope-board.md`, not here.** `scope-architect` writes that board and is the only worker that knows
the scope ids; it runs after this document, so the ordering cannot be expressed here in a key that
survives a clone. Cite the board, never restate it.
