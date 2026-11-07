---
type: task-board
feature: FEATURE_SLUG
tags: []
---

# Task Board: FEATURE TITLE

## Progress
⬜ 0 / N tasks complete · Est. total: Xh

## Tasks

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[TASK-001\|TASK-001]] | [title] | shared | ⬜ | 1 | — | Xh |
| [[TASK-002\|TASK-002]] | [title] | api | ⬜ | 2 | TASK-001 | Xh |

<!-- Status: ⬜ ready · 🔄 in-progress · 🚫 blocked · ✅ done -->

## Execution Order

```
TASK-001 (schema)
    └──► TASK-002 (repository)
              └──► TASK-003 (use case)
                       └──► TASK-004 (endpoint)
                                 └──► TASK-005 (frontend)
```

## Blocked Tasks

<!-- Move tasks here if they are blocked, with reason -->
| ID | Blocked By | Reason |
|----|------------|--------|
