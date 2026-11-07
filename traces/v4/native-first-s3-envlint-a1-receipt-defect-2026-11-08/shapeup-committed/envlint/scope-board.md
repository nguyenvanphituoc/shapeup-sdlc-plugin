# Scope board — envlint

| scope_id | topology | use_cases | depends_on | files | lint |
|---|---|---|---|---|---|
| parsing | ICEBERG | [UC-ParseEnvText] | [] | src/parse.mjs, test/parse.test.mjs | see verify spec |
| rules | ICEBERG | [UC-CheckEnvAgainstSchema] | [] | src/rules.mjs, test/rules.test.mjs | see verify spec |
| cli | LAYER_CAKE | [UC-LintEnvFile] | [parsing, rules] | bin/envlint.mjs, test/cli.test.mjs, test/integration.test.mjs | see verify spec |

Riskiest first: `parsing` and `rules` (independent, concurrent), then `cli`.
