---
type: scope-summary
feature: todo-cli
generated_at: 2026-08-16
total_tasks: 7
total_estimated_hours: 10
packages_touched: [cli]
critical_path_length: 4
critical_path_tasks: [TASK-001, TASK-002, TASK-005, TASK-007]
external_blockers: []
audit_score: 0
---

# Feature Scope Summary: `todo` CLI

> Generated from task graph (`harness reduce board --slug todo-cli --write`).
> Audit score below 90 means spec needs human review before execution.

---

## At a Glance

| | |
|---|---|
| Total tasks | 7 |
| Estimated effort | 10h (~1.25 days) |
| Packages touched | 1 (cli) |
| Critical path depth | 4 tasks |
| External blockers | 0 items before sprint can start |
| Spec audit score | pending — see [[_index#Audit Report]] |

---

## Critical Path

The longest sequential chain — minimum time to complete if parallelized optimally.

```
TASK-001 → TASK-002 → TASK-005 → TASK-007
  1h          2h          1.5h        2h
```

**Critical path estimate:** 6.5h total
*(TASK-003, TASK-004, TASK-006 run in parallel alongside TASK-005 once TASK-002 is done)*

---

## Package Distribution

| Package | Tasks | Est. Hours | % of effort |
|---------|-------|------------|-------------|
| cli | 7 | 10h | 100% |
| **Total** | **7** | **10h** | 100% |

---

## Parallel Opportunities

Tasks with no interdependency that can run simultaneously:

| Group | Tasks | Can start after |
|-------|-------|----------------|
| Group A | TASK-003, TASK-004, TASK-005, TASK-006 | TASK-002 completes |

---

## External Blockers

Items that must be resolved BEFORE sprint starts:

**Environment Variables**
- None — no env vars required ([[integration#Environment-Variables-Required]])

**Third-party Setup**
- None — no third-party services (pitch no-go: no sync, no server, no accounts)

**Internal Dependencies**
- None — greenfield feature, zero existing code to coordinate with ([[_index]] / orient
  `code-surface.md`)

---

## Risks (from Pitch)

Carried from [[_index#Rabbit-Holes]]:

| Risk | Impact | Mitigation | Related UC |
|------|--------|------------|-----------|
| Unguarded `JSON.parse` crashes on corrupted store | high | `TodoRepository.load()` try/catch, typed `E_STORE_CORRUPTED` | [[usecases/UC-AddTodo]], [[usecases/UC-ListTodos]], [[usecases/UC-CompleteTodo]], [[usecases/UC-RemoveTodo]] |
| Bare `Number()`/`parseInt()` coercion accepts bad index input | high | Explicit integer + range check in `done`/`rm` handlers | [[usecases/UC-CompleteTodo]], [[usecases/UC-RemoveTodo]] |
| Store location ambiguity (cwd vs home) | medium | Pinned to `~/.todo.json` in [[domain-model#Bounded-Context]] | all four UCs |
| Missing store file mishandled as corruption | medium | `ENOENT` and `SyntaxError` handled as distinct branches in [[contracts/todo-repository.contract]] | [[usecases/UC-ListTodos]] |

---

## Execution Recommendation

<!-- Filled from harness verify spec output -->

**Audit Score: pending**

```
[⚠️ Review recommended — PO + Dev walkthrough before /execute-plan]
```
`harness verify spec --slug todo-cli` reports 0 red, 3 warn at generation time (unresolved
wikilinks to this doc and [[synthesis]] before they existed, plus a contracts index display-name
link) — resolved by this file's own creation; re-run verify to confirm 0 red / 0 warn.
