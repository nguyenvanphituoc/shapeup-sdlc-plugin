---
type: task-board
feature: envlint
tags: [envlint]
---

# Task Board: envlint

## Progress
⬜ 0 / 4 tasks complete · Est. total: 8h

## Tasks

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[tasks/TASK-001-parse-module\|TASK-001]] | Implement the pure .env parser in src/parse.mjs | src | ⬜ | 1 | — | 2h |
| [[tasks/TASK-002-rules-module\|TASK-002]] | Implement the pure schema rules in src/rules.mjs | src | ⬜ | 1 | — | 2h |
| [[tasks/TASK-003-cli-entry\|TASK-003]] | Wire the envlint CLI in bin/envlint.mjs | bin | ⬜ | 2 | TASK-001, TASK-002 | 2h |
| [[tasks/TASK-004-cli-integration-tests\|TASK-004]] | Add end-to-end CLI tests over fixtures | test | ⬜ | 3 | TASK-003 | 2h |

## Execution Order

```
TASK-001 (parse) ──┐
                   ├──► TASK-003 (cli) ──► TASK-004 (cli e2e tests)
TASK-002 (rules) ──┘
```

## Blocked Tasks

| ID | Blocked By | Reason |
|----|------------|--------|
