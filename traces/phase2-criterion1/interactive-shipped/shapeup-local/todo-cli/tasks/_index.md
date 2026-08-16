---
type: task-board
feature: todo-cli
tags: [cli]
---

# Task Board: todo-cli

## Progress
⬜ 0 / 7 tasks complete · Est. total: 9.5h

## Tasks

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[TASK-001\|TASK-001]] | TodoStoreRepository (load/save, atomic, path resolution) | todo | ✅ | 1 | — | 2h |
| [[TASK-002\|TASK-002]] | bin/todo argparse dispatcher + error boundary | bin | ✅ | 2 | TASK-001 | 1.5h |
| [[TASK-003\|TASK-003]] | todo add <text> | todo | ✅ | 3 | TASK-002 | 1h |
| [[TASK-004\|TASK-004]] | todo list | todo | ✅ | 3 | TASK-002 | 1h |
| [[TASK-005\|TASK-005]] | todo done <n> | todo | ✅ | 3 | TASK-002 | 1h |
| [[TASK-006\|TASK-006]] | todo rm <n> | todo | ✅ | 3 | TASK-002 | 1h |
| [[TASK-007\|TASK-007]] | Integration test — full CLI round-trip | tests | ✅ | 4 | TASK-003, TASK-004, TASK-005, TASK-006 | 2h |

<!-- Status: ⬜ ready · 🔄 in-progress · 🚫 blocked · ✅ done -->

## Execution Order

```
TASK-001 (store module)
    └──► TASK-002 (cli dispatcher + error boundary)
              ├──► TASK-003 (add)      ──┐
              ├──► TASK-004 (list)     ──┤
              ├──► TASK-005 (done)     ──┼──► TASK-007 (integration test)
              └──► TASK-006 (rm)       ──┘
```

## Blocked Tasks

| ID | Blocked By | Reason |
|----|------------|--------|
