---
type: task-board
feature: one-page-site
tags: [board]
---

# Task Board: One-page site

## Progress
⬜ 0 / 3 tasks complete · Est. total: 4h

## Tasks

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[TASK-001\|TASK-001]] | Render content.json into a static dist/index.html | root | ✅ | 1 | — | 2h |
| [[TASK-002\|TASK-002]] | Reject missing or invalid content | root | ✅ | 2 | TASK-001 | 1h |
| [[TASK-003\|TASK-003]] | node --test suite | root | ✅ | 3 | TASK-001, TASK-002 | 1h |

<!-- Status: ⬜ ready · 🔄 in-progress · 🚫 blocked · ✅ done -->

## Execution Order

```
TASK-001 (render)
    └──► TASK-002 (reject)
              └──► TASK-003 (tests)
```

## Blocked Tasks

| ID | Blocked By | Reason |
|----|------------|--------|
