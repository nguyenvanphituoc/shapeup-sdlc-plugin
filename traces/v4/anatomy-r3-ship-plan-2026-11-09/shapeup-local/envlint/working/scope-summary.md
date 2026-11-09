# Scope summary — envlint

| Suspected scope | Use case | Tasks | Done when |
|---|---|---|---|
| parsing | UC-ParseEnvText | TASK-001 | `node --test test/parse.test.mjs` exits 0 over every UC-ParseEnvText Test Surface row |
| rules | UC-CheckRules | TASK-002 | `node --test test/rules.test.mjs` exits 0 over every UC-CheckRules Test Surface row |
| cli | UC-LintEnvFile | TASK-003, TASK-004 | `node --test test/cli.test.mjs` exits 0 over every UC-LintEnvFile Test Surface row |

Appetite arithmetic: 11 h total, critical path 8 h, against ~1 week. No overflow.
