---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring map — envlint

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-ParseEnv | src/parse.mjs | ESM import; the CLI calls `parse(text)` on the env file's contents after reading it | bin/envlint.mjs — main flow, after the env file read | `envlint --schema s.json app.env` reports unparseable lines with their line numbers |
| UC-CheckRules | src/rules.mjs | ESM import; the CLI calls `checkSchema(schema)` after JSON.parse, then `check(pairs, schema)` | bin/envlint.mjs — main flow, after parse | `envlint --schema s.json app.env` reports required/type/enum findings key by key |
| UC-LintEnvFile | bin/envlint.mjs | the composition root itself, started by `node bin/envlint.mjs` or the `package.json` `bin` mapping | bin/envlint.mjs — top-level module code (argv parse → read → parse → check → print → exit) | `envlint --schema <schema.json> <envfile>` with exit code 0 / 1 / 2 |

## Deviations
None. `src/parse.mjs` and `src/rules.mjs` do not import each other; only the entry point imports both.
