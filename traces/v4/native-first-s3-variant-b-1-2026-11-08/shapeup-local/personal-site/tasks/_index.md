---
type: task-board
feature: personal-site
tags: [board]
---

# Task Board: personal-site

## Progress
⬜ 0 / 3 tasks complete · Est. total: 8h

## Tasks

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[tasks/TASK-001-build-cli-pipeline\|TASK-001]] | Create build.mjs input, validation and output pipeline | root | ⬜ | 1 | — | 2h |
| [[tasks/TASK-002-render-page\|TASK-002]] | Render the personal page as escaped, script-free, deterministic HTML | root | ⬜ | 2 | TASK-001 | 3h |
| [[tasks/TASK-003-test-suite\|TASK-003]] | Write the node --test suite over the UC-BuildPage Test Surface | root | ⬜ | 3 | TASK-001, TASK-002 | 3h |

<!-- Status: ⬜ ready · 🔄 in-progress · 🚫 blocked · ✅ done -->

## Execution Order

```
TASK-001 (pipeline)
    └──► TASK-002 (render)
              └──► TASK-003 (suite)
```

## Blocked Tasks

| ID | Blocked By | Reason |
|----|------------|--------|
