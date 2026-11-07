# Scope board — envlint

| scope_id | topology | use_cases | depends_on | files | lint |
|---|---|---|---|---|---|
| parsing | ICEBERG | [UC-ParseEnv] | [] | src/parse.mjs, test/parse.test.mjs | — |
| rules | ICEBERG | [UC-CheckRules] | [] | src/rules.mjs, test/rules.test.mjs | — |
| cli | LAYER_CAKE | [UC-LintEnvFile] | [parsing, rules] | bin/envlint.mjs, test/cli.test.mjs, test/cli-edges.test.mjs | — |
