# Scope board — envlint

A view of the contracts in `scopes/`; rebuildable from them.

| scope_id | topology | use_cases | depends_on | files | lint |
|---|---|---|---|---|---|
| parsing | ICEBERG | UC-ParseEnvText | — | 2 | clean |
| rules | ICEBERG | UC-CheckRules | — | 2 | clean |
| cli | LAYER_CAKE | UC-LintEnvFile | parsing, rules | 3 | clean |

Substrates are pairwise disjoint and no scope declares `shared_substrate`, so the concurrency ceiling the
contracts permit is 2 (parsing ‖ rules), then cli alone.

No breadboard was supplied (the deliverable is a CLI with no screens), so there are no V# slices to record.
