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
  - "[[tasks/_index]]"
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

Derived from: `use_case_refs` in each task frontmatter + `related_tasks` in each UC frontmatter.

### UC × Task Coverage

<!-- 
  For each use case row: list every task that references it.
  Status key:
    ✅ covered   = ≥ 1 task with this UC in use_case_refs
    ⚠️ partial   = UC exists in related_tasks but no task has use_case_refs pointing back
    ❌ missing   = UC has related_tasks: [] AND no task references it
-->

| Use Case | Actor | Tasks | Status |
|----------|-------|-------|--------|
| [[usecases/UC-Name]] | Actor | [[tasks/TASK-NNN]], [[tasks/TASK-NNN]] | ✅ covered |
| [[usecases/UC-Name]] | Actor | — | ❌ missing |

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

| Ref | Third-Party | Capability Claimed | SPIKE Task | Time Box | Status |
|-----|------------|-------------------|------------|----------|--------|
| API-01 | ServiceName | what pitch assumes | [[tasks/TASK-001-spike]] | Nh | ⏳ open |

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
  Mostly populated/appended by `--tasks-only` when reconciling the discovered ledger.
  Each line: what was cut — Cut @ GATE-N · reason · (if hammer-traded) which task it was traded for.
-->

| Cut | At | Reason | Traded for (if any) |
|-----|-----|-------|---------------------|
| ~~[cut capability]~~ | GATE-N | appetite overflow — saved for a later bet | TASK-NNN |

*A Cut is a healthy shaping signal, not debt. Revisit it at the betting table next cycle.*

---

## S-03 — Dependency Graph

> Open this section when **Dependency** is 🟡 or 🔴, or when planning parallel work.

Derived from: `depends_on` and `unlocks` in every task frontmatter + `estimated_hours`.

### Critical Path

```
Critical path: N tasks · NN hours · NN% of total estimated hours

TASK-001 [SPIKE]  spike-[api]-feasibility         2h
  └─ blocks ──► TASK-004, TASK-005, TASK-006
TASK-002 [TASK]   shared-schema                   3h  ← parallel (no dependency on 001)
TASK-003 [TASK]   contract-stub                   2h  ← parallel
TASK-004 [FEAT]   implement-[repo]               ⏳ blocked by TASK-001   4h
  └─ blocks ──► TASK-005
TASK-005 [FEAT]   [use-case]-service             ⏳ blocked by TASK-004   6h
  └─ blocks ──► TASK-006, TASK-007
TASK-006 [FEAT]   [feature]-ui                   ⏳ blocked by TASK-005   8h
TASK-007 [FEAT]   [feature]-ui-edge-cases        ⏳ blocked by TASK-005   4h
```

### Parallel Opportunities

Tasks at the same dependency depth with no interdependency — can be executed in parallel:

| Wave | Tasks | Total Hours | Can Parallelize |
|------|-------|-------------|-----------------|
| Wave 1 (no deps) | TASK-001, TASK-002, TASK-003 | Nh | ✅ yes — 3 agents |
| Wave 2 (after 001) | TASK-004 | Nh | — single task |
| Wave 3 (after 004) | TASK-005 | Nh | — single task |
| Wave 4 (after 005) | TASK-006, TASK-007 | Nh | ✅ yes — 2 agents |

### Single Points of Failure

Tasks whose delay cascades to > 2 downstream tasks:

| Task | Blocks | Cascaded Hours at Risk |
|------|--------|----------------------|
| TASK-NNN | TASK-NNN, TASK-NNN, TASK-NNN | Nh |
