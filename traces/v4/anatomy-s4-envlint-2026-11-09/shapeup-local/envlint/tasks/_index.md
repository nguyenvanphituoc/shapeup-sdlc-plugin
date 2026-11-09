---
type: task-board
feature: envlint
---

# Task board — envlint (per-machine)

| Task | Title | Use case | depends_on | unlocks | Files | Hours | Status |
|---|---|---|---|---|---|---|---|
| [[TASK-001]] | parseEnv module | UC-ParseEnvText | — | TASK-003, TASK-004 | src/parse.mjs, test/parse.test.mjs | 2 | ready |
| [[TASK-002]] | checkSchema / checkRules module | UC-CheckRules | — | TASK-003, TASK-004 | src/rules.mjs, test/rules.test.mjs | 2 | ready |
| [[TASK-003]] | envlint CLI | UC-LintEnvFile | TASK-001, TASK-002 | TASK-004 | bin/envlint.mjs, test/cli.test.mjs | 3 | ready |
| [[TASK-004]] | boundary regression suite | UC-LintEnvFile | TASK-001, TASK-002, TASK-003 | — | test/boundaries.test.mjs | 1.5 | ready |

Total 8.5 h. Critical path TASK-001 (or TASK-002) → TASK-003 → TASK-004 = 6.5 h. Within a one-round small batch: no overflow.
