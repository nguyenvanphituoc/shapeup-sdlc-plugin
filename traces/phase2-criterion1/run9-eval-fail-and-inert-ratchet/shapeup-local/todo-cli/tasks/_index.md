---
type: task-board
feature: todo-cli
tags: [cli]
---

# Task Board: `todo` CLI

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[TASK-001\|TASK-001]] | Scaffold bin/todo.js entry point and argv dispatcher | cli | ✅ done | 1 | — | 1h |
| [[TASK-002\|TASK-002]] | Implement TodoRepository (load/save ~/.todo.json) | cli | ✅ done | 2 | TASK-001 | 2h |
| [[TASK-003\|TASK-003]] | Implement `todo add <text>` command | cli | ✅ done | 3 | TASK-002 | 1h |
| [[TASK-004\|TASK-004]] | Implement `todo list` command | cli | ✅ done | 3 | TASK-002 | 1h |
| [[TASK-005\|TASK-005]] | Implement `todo done <n>` command | cli | ✅ done | 3 | TASK-002 | 1.5h |
| [[TASK-006\|TASK-006]] | Implement `todo rm <n>` command | cli | ✅ done | 3 | TASK-002 | 1.5h |
| [[TASK-007\|TASK-007]] | Integration test — full round-trip + edge cases | cli | ✅ done | 4 | TASK-003, TASK-004, TASK-005, TASK-006 | 2h |

**Total estimated:** 10h — within the "1-2 days" appetite.
