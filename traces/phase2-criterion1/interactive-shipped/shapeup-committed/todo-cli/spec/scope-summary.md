---
type: scope-summary
feature: todo-cli
generated_at: 2026-08-16
total_tasks: 7
total_estimated_hours: 9.5
packages_touched: [todo, bin, tests]
critical_path_length: 4
critical_path_tasks: [TASK-001, TASK-002, TASK-003, TASK-007]
external_blockers: []
audit_score: 100
---

# Feature Scope Summary: `todo` CLI

> Generated from the task graph (`harness reduce board --write`, todo-cli).
> Audit score below 90 means spec needs human review before execution.

---

## At a Glance

| | |
|---|---|
| Total tasks | 7 |
| Estimated effort | 9.5h (~1 day) |
| Packages touched | 3 (`todo`, `bin`, `tests`) |
| Critical path depth | 4 tasks |
| External blockers | 0 — no env vars or sandbox accounts required before the sprint starts (`$TODO_STORE` is optional, test-only) |
| Spec audit score | 100/100 ✅ (`harness verify spec`: 0 red, 0 warn) |

---

## Critical Path

```
TASK-001 → TASK-002 → TASK-003 → TASK-007
   2h         1.5h        1h         2h
```

**Critical path estimate:** 6.5h total
*(TASK-004, TASK-005, TASK-006 all run in parallel with TASK-003 once TASK-002 lands — the
critical path picked TASK-003 only because `harness reduce board` breaks the tie on the first
task alphabetically/positionally among four equal-weight siblings; any of the four command
tasks could be the long pole.)*

---

## Package Distribution

| Package | Tasks | Est. Hours | % of effort |
|---------|-------|------------|-------------|
| todo | 5 | 6h | 63% |
| bin | 1 | 1.5h | 16% |
| tests | 1 | 2h | 21% |
| **Total** | **7** | **9.5h** | 100% |

---

## Parallel Opportunities

Tasks with no interdependency that can run simultaneously:

| Group | Tasks | Can start after |
|-------|-------|----------------|
| Group A | TASK-003, TASK-004, TASK-005, TASK-006 | TASK-002 completes |

---

## External Blockers

None. This is a stdlib-only, zero-dependency, zero-install CLI — no environment variables are
required (`$TODO_STORE` is an optional override used only for test sandboxing), no third-party
accounts, no other team's deploy.

---

## Risks (from Pitch)

Carried from [[_index#Rabbit-Holes]]:

| Risk | Impact | Mitigation | Related UC |
|------|--------|------------|-----------|
| Corrupted-store handling misses the hand-edited valid-JSON-wrong-shape variant | med | Spiked — one `StoreCorruptedError` path covers both (PO decision #3) | [[usecases/UC-AddTodo]], [[usecases/UC-ListTodos]], [[usecases/UC-CompleteTodo]], [[usecases/UC-RemoveTodo]] |
| `done`/`rm` index semantics left implicit (off-by-one) | med | PO decision #1: 1-based, exact error text/exit code specified and carried into every UC's Error Cases | [[usecases/UC-CompleteTodo]], [[usecases/UC-RemoveTodo]] |
| Default store path invented untested | low | Spiked and confirmed `~/.todo.json`, PO decision #2 | [[usecases/UC-AddTodo]] |
| Crash mid-save corrupts the store worse than before | low | Spiked — atomic `tempfile.mkstemp` + `os.replace` | [[usecases/UC-AddTodo]], [[usecases/UC-CompleteTodo]], [[usecases/UC-RemoveTodo]] |

---

## Execution Recommendation

<!-- Filled from harness verify spec output -->

**Audit Score: 100/100**

```
[✅ Ready for autonomous execution — run /execute-plan tasks/_index.md]
```
