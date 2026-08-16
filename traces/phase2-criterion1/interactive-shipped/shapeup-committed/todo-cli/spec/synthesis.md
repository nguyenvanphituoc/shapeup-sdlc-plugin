---
type: synthesis
feature: todo-cli
generated_at: 2026-08-16
skill_version: "4.0"
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
| Coverage | 🟢 | All 4 UCs have ≥1 covering task; no entity orphans; no unbacked screens |
| Risk | 🟢 | All 4 rabbit holes mitigated — de-risked at Orient's spike, no open SPIKE blocks the build |
| Dependency | 🟢 | Single linear foundation (store → dispatcher) fanning out to 4 independent command tasks, no cycles |

### Execution Gate (Synthesis)
✅ **PASS** — Coverage 🟢 AND Risk 🟢.

*Combine with the Audit score gate (`harness verify spec`) — both must pass for autonomous execution.*

---

## S-01 — Traceability Matrix

Derived from `use_case_refs` in each task's frontmatter over the LOCAL board
(`.shapeup/todo-cli/tasks/`) at generation time.

### UC × Task Coverage

| Use Case | Actor | Covering Tasks | Status |
|----------|-------|----------------|--------|
| [[usecases/UC-AddTodo]] | Developer | 3 (TASK-001, TASK-002, TASK-003) | ✅ covered |
| [[usecases/UC-ListTodos]] | Developer | 3 (TASK-001, TASK-002, TASK-004) | ✅ covered |
| [[usecases/UC-CompleteTodo]] | Developer | 3 (TASK-001, TASK-002, TASK-005) | ✅ covered |
| [[usecases/UC-RemoveTodo]] | Developer | 3 (TASK-001, TASK-002, TASK-006) | ✅ covered |

All four UCs are also exercised end-to-end by TASK-007 (the integration test), not counted
above since it is a cross-cutting verification task rather than an implementation task per UC.

**Coverage gaps:** none.

### UC × Entity Participation

| Use Case | Entity | Role |
|----------|--------|------|
| [[usecases/UC-AddTodo]] | `TodoItem` | actor |
| [[usecases/UC-AddTodo]] | `TodoList` | target |
| [[usecases/UC-ListTodos]] | `TodoItem` | target |
| [[usecases/UC-ListTodos]] | `TodoList` | target |
| [[usecases/UC-CompleteTodo]] | `TodoItem` | actor |
| [[usecases/UC-CompleteTodo]] | `TodoList` | target |
| [[usecases/UC-RemoveTodo]] | `TodoItem` | actor |
| [[usecases/UC-RemoveTodo]] | `TodoList` | target |

**Entity orphans:** none — `TodoList` (aggregate root) and `TodoItem` are both referenced by
every UC.

### Screen → UC Backing

| Screen | Backed By | Status |
|--------|-----------|--------|
| AddCommand | [[usecases/UC-AddTodo]] | ✅ |
| ListCommand | [[usecases/UC-ListTodos]] | ✅ |
| DoneCommand | [[usecases/UC-CompleteTodo]] | ✅ |
| RemoveCommand | [[usecases/UC-RemoveTodo]] | ✅ |

### Domain Event Flow

| Event | Emitted By UC | Consumer (integration.md) | Status |
|-------|--------------|--------------------------|--------|
| — | none — [[domain-model#Domain-Events]] declares no events this appetite | — | ✅ N/A, not a gap |

---

## S-02 — Risk Register

Derived from `_index.md` Rabbit Holes + [[integration]] (no third-party deps this appetite, so
no `api-feasibility.md` / SPIKE-risk section applies).

### SPIKE Risks
None — no third-party API/SDK in scope. `TodoStoreRepository` is `offline-storage`
(confirmed status, see [[contracts/todo-store.contract]]), not `third-party-api`.

### Rabbit Hole Register

| Risk | From | Likelihood | Mitigation | Status |
|------|------|-----------|------------|--------|
| Wrong-shape-JSON corruption variant missed | [[_index#Rabbit-Holes]] | med | Folded into `StoreCorruptedError` alongside invalid-JSON (PO decision #3), spiked at Orient | ✅ mitigated |
| `done`/`rm` index off-by-one ambiguity | [[_index#Rabbit-Holes]] | med | 1-based indexing + exact error text fixed by PO decision #1, carried into UC Error Cases | ✅ mitigated |
| Untested default store path | [[_index#Rabbit-Holes]] | low | `~/.todo.json` spiked and confirmed, PO decision #2 | ✅ mitigated |
| Mid-save crash corrupts store | [[_index#Rabbit-Holes]] | low | Atomic `tempfile.mkstemp` + `os.replace`, spiked at Orient | ✅ mitigated |

**Unmitigated risks:** none.

### External Dependency Risks

| Dependency | Declared In | Type | Unblock Condition |
|------------|------------|------|------------------|
| `TODO_STORE` | [[integration#Environment-Variables-Required]] | env var (optional) | none — has a working default, only needed for test sandboxing |

### Hammered Out (Cut)

| Cut | At | Reason | Traded for (if any) |
|-----|-----|-------|---------------------|
| XDG base-directory store path resolution | GATE-L1a | appetite is a small batch; "zero-config" argues for one dotfile over a third path branch (PO decision #2) | — |

*A Cut is a healthy shaping signal, not debt.*

---

## S-03 — Dependency Graph

Derived from `depends_on`/`unlocks` (written by `harness reduce board --write`) and
`estimated_hours` in every task's frontmatter.

### Critical Path

```
Critical path: 4 tasks · 6.5 hours · 68% of total estimated hours (9.5h)

TASK-001 [FEAT]  store-module                     2h
  └─ blocks ──► TASK-002
TASK-002 [FEAT]  cli-dispatcher                    1.5h  ⏳ blocked by TASK-001
  └─ blocks ──► TASK-003, TASK-004, TASK-005, TASK-006
TASK-003 [FEAT]  add-command                       1h    ⏳ blocked by TASK-002  ← parallel with 004/005/006
  └─ blocks ──► TASK-007
TASK-007 [FEAT]  integration-test                  2h    ⏳ blocked by TASK-003, TASK-004, TASK-005, TASK-006
```

### Parallel Opportunities

| Wave | Tasks | Total Hours | Can Parallelize |
|------|-------|-------------|-----------------|
| Wave 1 (no deps) | TASK-001 | 2h | — single task, foundation |
| Wave 2 (after 001) | TASK-002 | 1.5h | — single task, shared dispatcher |
| Wave 3 (after 002) | TASK-003, TASK-004, TASK-005, TASK-006 | 4h | ✅ yes — 4 agents |
| Wave 4 (after 003–006) | TASK-007 | 2h | — single task, needs all 4 commands |

### Single Points of Failure

| Task | Blocks | Cascaded Hours at Risk |
|------|--------|----------------------|
| TASK-001 | TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007 (everything) | 7.5h |
| TASK-002 | TASK-003, TASK-004, TASK-005, TASK-006, TASK-007 | 6h |
