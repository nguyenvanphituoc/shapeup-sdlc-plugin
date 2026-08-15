---
type: task-board
feature: todo-cli
tags: [cli]
---

# Task Board: `todo` CLI

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[TASK-001\|TASK-001]] | Scaffold package.json with a `todo` bin entry | cli | ✅ done | 1 | — | 1h |
| [[TASK-002\|TASK-002]] | Implement TodoList domain module | cli | ✅ done | 2 | TASK-001 | 1.5h |
| [[TASK-003\|TASK-003]] | Implement TodoStoreRepository (persistence) | cli | ✅ done | 3 | TASK-001, TASK-002 | 3h |
| [[TASK-004\|TASK-004]] | Implement `add <text>` command | cli | ✅ done | 4 | TASK-003 | 1h |
| [[TASK-005\|TASK-005]] | Implement `list` command | cli | ✅ done | 5 | TASK-003 | 1h |
| [[TASK-006\|TASK-006]] | Implement `done <n>` command | cli | ✅ done | 6 | TASK-003 | 1.5h |
| [[TASK-007\|TASK-007]] | Implement `rm <n>` command | cli | ✅ done | 7 | TASK-003 | 1.5h |
| [[TASK-008\|TASK-008]] | Wire CLI entry point / dispatcher | cli | ✅ done | 8 | TASK-004, TASK-005, TASK-006, TASK-007 | 2h |
| [[TASK-009\|TASK-009]] | Integration test — full CLI round-trip | cli | ⬜ ready | 9 | TASK-008 | 3h |

Status emoji: ⬜ ready · 🔄 in-progress · 🚫 blocked · ✅ done
