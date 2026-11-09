# Scope board — envlint

A view of the contracts in `scopes/`; rebuildable from them.

| scope_id | topology | use_cases | depends_on | files | lint |
|---|---|---|---|---|---|
| parsing | ICEBERG | UC-ParseEnvText | — | 2 | clean |
| rules | ICEBERG | UC-CheckRules | — | 2 | clean |
| cli | LAYER_CAKE | UC-LintEnvFile | parsing, rules | 2 | clean |

No breadboard, so no V# slices to record.
