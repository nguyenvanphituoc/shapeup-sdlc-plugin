# Scope summary — envlint

| Suspected scope | Use case | Tasks | Done when (headline) |
|---|---|---|---|
| parsing | UC-ParseEnvText | TASK-001 | `node --test test/parse.test.mjs` exits 0 with every UC-ParseEnvText Test Surface row as a named case |
| rules | UC-CheckRules | TASK-002 | `node --test test/rules.test.mjs` exits 0 with every UC-CheckRules Test Surface row as a named case |
| cli | UC-LintEnvFile | TASK-003, TASK-004 | `node --test test/cli.test.mjs test/boundaries.test.mjs` exits 0: exit codes 0/1/2, line format, edges, boundaries |

Hours: 8.5 total, critical path 6.5 h (parsing ‖ rules → cli). Appetite: one small-batch round — no overflow.
parsing and rules touch disjoint files and can build concurrently; cli depends on both.
