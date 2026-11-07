---
type: task-board
feature: envlint
tags: [cli]
---

# Task Board: envlint

## Progress
⬜ 0 / 4 tasks complete · Est. total: 11h

## Tasks

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[TASK-001-parse-module\|TASK-001]] | Implement the pure .env parse module | src | ⬜ | 1 | — | 3h |
| [[TASK-002-rules-module\|TASK-002]] | Implement the pure schema rules module | src | ⬜ | 1 | — | 3h |
| [[TASK-003-cli\|TASK-003]] | Implement the envlint CLI entry point | bin | ⬜ | 2 | TASK-001, TASK-002 | 3h |
| [[TASK-004-cli-edges\|TASK-004]] | Harden the CLI edges with end-to-end fixture tests | bin | ⬜ | 3 | TASK-003 | 2h |

## Execution Order

```
TASK-001 (parse) ──┐
                   ├──► TASK-003 (cli) ──► TASK-004 (edges)
TASK-002 (rules) ──┘
```

## Blocked Tasks
| ID | Blocked By | Reason |
|----|------------|--------|
