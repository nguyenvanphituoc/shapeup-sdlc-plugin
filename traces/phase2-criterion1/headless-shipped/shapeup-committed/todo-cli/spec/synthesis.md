---
type: synthesis
feature: todo-cli
generated_at: 2026-08-16
skill_version: "2.8"
coverage_status: 🟢
risk_status: 🟢
dependency_status: 🟢
depends_on:
  - "[[domain-model]]"
  - "[[ux-behavior]]"
  - "[[usecases/_index]]"
  - "[[scope-summary]]"
---

# Synthesis: `todo` CLI

> **How to use this document:**
> Read the Health Dashboard first (30 seconds).
> Each indicator tells you which section to open next — skip green sections.
> 🟢 = no action needed · 🟡 = review recommended · 🔴 = must resolve before execution

---

## Health Dashboard

| Indicator | Status | Signal |
|-----------|--------|--------|
| Coverage | 🟢 | All 4 use cases have ≥1 covering task; no orphan entities |
| Risk | 🟢 | Both rabbit holes (corrupted store, index coercion) are mitigated by name in the board |
| Dependency | 🟢 | `harness reduce board --write` reports 0 stale/asymmetric unlocks; single linear critical path |

### Execution Gate (Synthesis)

✅ PASS — Coverage 🟢 AND Risk 🟢

*Combine with Audit score gate: both must pass for autonomous `/execute-plan`.*

---

## S-01 — Traceability Matrix

Derived from: `use_case_refs` in each task frontmatter — the single link source.

### UC × Task Coverage

| Use Case | Actor | Covering Tasks | Status |
|----------|-------|----------------|--------|
| [[usecases/UC-AddTodo]] | Developer | 4 | ✅ covered |
| [[usecases/UC-ListTodos]] | Developer | 4 | ✅ covered |
| [[usecases/UC-CompleteTodo]] | Developer | 4 | ✅ covered |
| [[usecases/UC-RemoveTodo]] | Developer | 4 | ✅ covered |

**Coverage gaps:** none.

### UC × Entity Participation

| Use Case | Entity | Role |
|----------|--------|------|
| [[usecases/UC-AddTodo]] | `TodoItem` | actor |
| [[usecases/UC-ListTodos]] | `TodoItem` | target |
| [[usecases/UC-CompleteTodo]] | `TodoItem` | actor |
| [[usecases/UC-RemoveTodo]] | `TodoItem` | actor |

**Entity orphans:** none — `TodoItem` is referenced by all four use cases.

### Screen → UC Backing

<!-- CLI deliverable — "screen" reads as "command" per [[ux-behavior]] header note -->

| Screen (command) | Backed By | Status |
|--------|-----------|--------|
| add-command | [[usecases/UC-AddTodo]] | ✅ |
| list-command | [[usecases/UC-ListTodos]] | ✅ |
| done-command | [[usecases/UC-CompleteTodo]] | ✅ |
| rm-command | [[usecases/UC-RemoveTodo]] | ✅ |

### Domain Event Flow

No domain events in this feature (single-process CLI, no cross-context consumer — see
[[domain-model#Domain-Events]] and [[integration#Event-Coordination]]). Table intentionally
empty.

---

## S-02 — Risk Register

Derived from: `_index.md` rabbit holes + `integration.md` external deps. No `api-feasibility.md`
exists — this feature has no third-party dependency (SPIKE Risks table intentionally omitted).

### Rabbit Hole Register

| Risk | From | Likelihood | Mitigation | Status |
|------|------|-----------|------------|--------|
| Unguarded `JSON.parse` crashes on corrupted store | [[_index#Rabbit-Holes]] | high | `TodoRepository.load()` try/catch → typed `E_STORE_CORRUPTED`, TASK-002 | ✅ mitigated |
| Bare `Number()`/`parseInt()` coercion accepts bad index | [[_index#Rabbit-Holes]] | high | Explicit integer + range check, TASK-005/TASK-006 | ✅ mitigated |
| Store location ambiguity (cwd vs home) | [[_index#Rabbit-Holes]] | medium | Pinned to `~/.todo.json`, [[domain-model#Bounded-Context]] | ✅ mitigated |
| Missing store file mishandled as corruption | [[_index#Rabbit-Holes]] | medium | `ENOENT` vs `SyntaxError` handled as distinct branches, [[contracts/todo-repository.contract]] | ✅ mitigated |

**Unmitigated risks:** none.

### External Dependency Risks

| Dependency | Declared In | Type | Unblock Condition |
|------------|------------|------|------------------|
| — | — | — | none — no env vars, no accounts, no external services ([[integration#Environment-Variables-Required]]) |

### Hammered Out (Cut)

| Cut | At | Reason | Traded for (if any) |
|-----|-----|-------|---------------------|
| — | — | none cut — full pitch scope fits the 10h estimate inside the "1-2 days" appetite | — |

*A Cut is a healthy shaping signal, not debt. Revisit it at the betting table next cycle.*

---

## S-03 — Dependency Graph

Derived from: `depends_on` and `unlocks` in every task frontmatter + `estimated_hours`
(`harness reduce board --write` output).

### Critical Path

```
Critical path: 4 tasks · 6.5 hours · 65% of total estimated hours

TASK-001 [CHORE] cli-scaffold                                          1h
  └─ blocks ──► TASK-002
TASK-002 [FEAT]  todo-repository                  ⏳ blocked by TASK-001   2h
  └─ blocks ──► TASK-003, TASK-004, TASK-005, TASK-006
TASK-003 [FEAT]  add-command                      ⏳ blocked by TASK-002   1h   ← parallel with 004/005/006
TASK-004 [FEAT]  list-command                     ⏳ blocked by TASK-002   1h   ← parallel with 003/005/006
TASK-005 [FEAT]  done-command                     ⏳ blocked by TASK-002   1.5h ← parallel with 003/004/006
TASK-006 [FEAT]  rm-command                       ⏳ blocked by TASK-002   1.5h ← parallel with 003/004/005
TASK-007 [TEST]  integration-test    ⏳ blocked by TASK-003,004,005,006   2h
```

### Parallel Opportunities

| Wave | Tasks | Total Hours | Can Parallelize |
|------|-------|-------------|-----------------|
| Wave 1 (no deps) | TASK-001 | 1h | — single task |
| Wave 2 (after 001) | TASK-002 | 2h | — single task |
| Wave 3 (after 002) | TASK-003, TASK-004, TASK-005, TASK-006 | 5h | ✅ yes — up to 4 agents |
| Wave 4 (after 003-006) | TASK-007 | 2h | — single task |

### Single Points of Failure

| Task | Blocks | Cascaded Hours at Risk |
|------|--------|----------------------|
| TASK-002 | TASK-003, TASK-004, TASK-005, TASK-006, TASK-007 | 8h |
