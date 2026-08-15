---
type: scope-summary
feature: todo-cli
generated_at: 2026-08-15
total_tasks: 9
total_estimated_hours: 15.5
packages_touched: [cli]
critical_path_length: 6
critical_path_tasks: [TASK-001, TASK-002, TASK-003, TASK-006, TASK-008, TASK-009]
external_blockers: []
audit_score: 0
---

# Feature Scope Summary: `todo` CLI

> Generated from `harness reduce board --slug todo-cli --write --appetite-hours 16`.
> Audit score below 90 means spec needs human review before execution.

---

## At a Glance

| | |
|---|---|
| Total tasks | 9 |
| Estimated effort | 15.5h (~2 days) |
| Packages touched | 1 (`cli`) |
| Critical path depth | 6 tasks |
| External blockers | 0 items before sprint can start |
| Spec audit score | pending — run `harness verify spec` after any further edits |

---

## Critical Path

```
TASK-001 → TASK-002 → TASK-003 → TASK-006 → TASK-008 → TASK-009
  1h          1.5h        3h         1.5h        2h          3h
```

**Critical path estimate:** 12h total
*(TASK-004, TASK-005, TASK-007 run in parallel alongside TASK-006 once TASK-003 completes)*

---

## Package Distribution

| Package | Tasks | Est. Hours | % of effort |
|---------|-------|------------|-------------|
| cli | 9 | 15.5h | 100% |
| **Total** | **9** | **15.5h** | 100% |

---

## Parallel Opportunities

| Group | Tasks | Can start after |
|-------|-------|----------------|
| Group A | TASK-004, TASK-005, TASK-006, TASK-007 | TASK-003 completes |

---

## External Blockers

None. No third-party API, no env var, no cross-team dependency — the pitch's no-gos
(no sync, no server, no accounts) rule these out by design.

---

## Risks (from Pitch)

Carried from `[[_index#Rabbit-Holes]]`:

| Risk | Impact | Mitigation | Related UC |
|------|--------|------------|-----------|
| Corrupted/missing store file crashes the CLI | high if unmitigated | spiked, confirmed with Node core `fs` only | [[usecases/UC-AddTodo]], [[usecases/UC-ListTodos]], [[usecases/UC-CompleteTodo]], [[usecases/UC-RemoveTodo]] |
| Torn/half-written store file on process kill mid-write | med if unmitigated | temp-file + `fs.renameSync`, confirmed atomic | [[usecases/UC-AddTodo]], [[usecases/UC-CompleteTodo]], [[usecases/UC-RemoveTodo]] |
| Positional index semantics confuse users after `rm` shifts numbering | low | pinned decision, documented in ux-behavior RULE-08 | [[usecases/UC-CompleteTodo]], [[usecases/UC-RemoveTodo]] |
| Concurrent `todo` processes racing to write | accepted, out of scope | no-gos exclude server/sync | [[usecases/UC-AddTodo]], [[usecases/UC-CompleteTodo]], [[usecases/UC-RemoveTodo]] |

---

## Execution Recommendation

**Appetite check:** 15.5h estimated vs. a 16h appetite budget for this single build round — no
overflow (`harness reduce board --appetite-hours 16` reports `overflow: false`).

```
✅ Ready for autonomous execution — run the executor against .shapeup/todo-cli/tasks/_index.md
```
