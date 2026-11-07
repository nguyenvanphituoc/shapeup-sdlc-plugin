---
type: task-board
feature: envlint
tags: []
---

# Task Board: envlint

## Progress
⬜ 0 / 4 tasks complete · Est. total: 11h

## Tasks

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[TASK-001-parse-env-text\|TASK-001]] | Implement the pure .env parser in src/parse.mjs | src | ⬜ | 1 | — | 3h |
| [[TASK-002-evaluate-rules\|TASK-002]] | Implement schema validation and rule evaluation in src/rules.mjs | src | ⬜ | 1 | — | 3h |
| [[TASK-003-cli\|TASK-003]] | Build the envlint CLI in bin/envlint.mjs and wire package.json | bin | ⬜ | 2 | TASK-001, TASK-002 | 3h |
| [[TASK-004-cli-integration-tests\|TASK-004]] | Write the CLI integration tests in test/cli.test.mjs | test | ⬜ | 3 | TASK-003 | 2h |

<!-- Status: ⬜ ready · 🔄 in-progress · 🚫 blocked · ✅ done -->

## Execution Order

```
TASK-001 (parse) ──┐
                   ├──► TASK-003 (cli) ──► TASK-004 (cli tests)
TASK-002 (rules) ──┘
```

## Blocked Tasks

| ID | Blocked By | Reason |
|----|------------|--------|
