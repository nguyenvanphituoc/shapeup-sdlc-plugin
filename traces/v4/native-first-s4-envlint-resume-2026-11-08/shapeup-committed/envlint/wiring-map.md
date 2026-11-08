---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring map — envlint

Every engine attaches to the composition root `bin/envlint.mjs` (the profile's `entry_point`). The two
pure engines have no seam of their own: they are reachable only because the CLI imports and calls them.

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-01 | src/parse.mjs | static ESM import of `parseEnv`; called on the env file's text after it is read | bin/envlint.mjs — main, after reading the env file | `envlint --schema s.json .env` reports `parse error` lines with their line numbers |
| UC-02 | src/rules.mjs | static ESM import of `checkSchema` and `checkPairs`; `checkSchema` on the parsed schema JSON, `checkPairs` on the parser's pairs | bin/envlint.mjs — main, after JSON.parse of the schema and after parseEnv | `envlint` reports `KEY: expected …` / `required key is missing` lines and exits 1 |
| UC-03 | bin/envlint.mjs | CLI command: the executable itself, declared as `bin.envlint` in `package.json`, argv parsed with `node:util` parseArgs | bin/envlint.mjs — top-level main invoked on load | `envlint --schema <schema.json> <envfile>` in a terminal or CI job |

## Deviations

None. No use case lacks an attachment path.
