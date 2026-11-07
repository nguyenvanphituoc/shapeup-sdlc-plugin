# Scope board — envlint

A view of the contracts under `scopes/`; rebuildable from them.

| scope_id | topology | use_cases | depends_on | files | lint |
|---|---|---|---|---|---|
| parse-env | ICEBERG | UC-ParseEnvText | — | src/parse.mjs, test/parse.test.mjs, test/fixtures/parse/** | — |
| rules-engine | ICEBERG | UC-EvaluateRules | — | src/rules.mjs, test/rules.test.mjs, test/fixtures/rules/** | — |
| cli | LAYER_CAKE | UC-LintEnvFile | parse-env, rules-engine | bin/envlint.mjs, package.json, test/cli.test.mjs, test/fixtures/cli/** | — |
