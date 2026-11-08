# Scope board — envlint

A view of the contracts in `scopes/`; rebuildable from them.

| scope_id | topology | use_cases | depends_on | files | lint |
|---|---|---|---|---|---|
| parsing | ICEBERG | UC-01 | — | src/parse.mjs, test/parse.test.mjs | green |
| rules | ICEBERG | UC-02 | — | src/rules.mjs, test/rules.test.mjs | green |
| cli | LAYER_CAKE | UC-03 | parsing, rules | bin/envlint.mjs, package.json, test/cli.test.mjs | green |

Concurrency ceiling the contracts permit: 2 (`parsing` ∥ `rules`), then `cli` alone.
