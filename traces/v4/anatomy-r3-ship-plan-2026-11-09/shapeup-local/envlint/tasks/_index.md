---
type: task-board
feature: envlint
---

# Task board — envlint

| Task | Title | Use case | depends_on | unlocks | h | status |
|---|---|---|---|---|---|---|
| TASK-001 | Implement the pure .env parser | UC-ParseEnvText | — | TASK-003 | 3 | ready |
| TASK-002 | Implement the pure schema rules checker | UC-CheckRules | — | TASK-003 | 3 | ready |
| TASK-003 | Implement the envlint CLI composition root | UC-LintEnvFile | TASK-001, TASK-002 | TASK-004 | 3 | ready |
| TASK-004 | End-to-end CLI test suite over written fixtures | UC-LintEnvFile | TASK-003 | — | 2 | ready |

Total 11 h · critical path TASK-001 → TASK-003 → TASK-004 = 8 h · appetite ~1 week: no overflow.
