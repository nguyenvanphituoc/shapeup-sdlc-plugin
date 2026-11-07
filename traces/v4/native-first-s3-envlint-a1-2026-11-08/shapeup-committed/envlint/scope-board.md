# Scope board — envlint

A view of the contracts under `scopes/`; rebuild it from them.

| scope_id | topology | use_cases | depends_on | files | lint |
|---|---|---|---|---|---|
| parsing | ICEBERG | [UC-ParseEnvText] | [] | [src/parse.mjs, test/parse.test.mjs] | ✓ |
| rules | ICEBERG | [UC-CheckRules] | [] | [src/rules.mjs, test/rules.test.mjs] | ✓ |
| cli | LAYER_CAKE | [UC-LintEnvFile] | [parsing, rules] | [bin/envlint.mjs, test/cli.test.mjs] | ✓ |

Riskiest first: parsing (dialect edges, never-throw), then rules (url shape policy), concurrently; cli last.
