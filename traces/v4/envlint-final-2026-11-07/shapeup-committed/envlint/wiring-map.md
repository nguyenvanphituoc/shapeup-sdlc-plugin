---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring map — envlint

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-ParseEnvText | src/parse.mjs | static ESM import of `parse`; called with the env file's text after it is read | bin/envlint.mjs — main flow, after reading the env file | `envlint --schema <s> <env>` reports parse problems by line |
| UC-EvaluateRules | src/rules.mjs | static ESM import of `validateSchema` and `lint`; schema validated after JSON.parse, `lint(pairs, schema)` after parsing | bin/envlint.mjs — main flow, after schema read and after parse | `envlint --schema <s> <env>` reports required/type/enum findings by key and line |
| UC-LintEnvFile | bin/envlint.mjs | CLI command: the process entry point itself (argv handling, file reads, printing, exit code) | bin/envlint.mjs — top level (the entry point) | `node bin/envlint.mjs --schema <schema.json> <envfile>` with exit 0/1/2 |

## Deviations
None. `src/parse.mjs` and `src/rules.mjs` are pure and import nothing from each other; the entry point
is their only importer.
