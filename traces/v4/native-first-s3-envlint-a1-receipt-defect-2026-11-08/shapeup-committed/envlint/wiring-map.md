---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring map — envlint

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-ParseEnvText | src/parse.mjs | static ESM import of `parse`; the CLI calls `parse(text)` on the env file's contents | bin/envlint.mjs — after reading the env file | `envlint --schema <schema.json> <envfile>` reports parse problems by line |
| UC-CheckEnvAgainstSchema | src/rules.mjs | static ESM import of `check`; the CLI calls `check(pairs, schema)` with parse's pairs and the parsed schema | bin/envlint.mjs — after `parse` and the schema read | `envlint --schema <schema.json> <envfile>` reports rule findings key by key |
| UC-LintEnvFile | bin/envlint.mjs | CLI command: the composition root itself — argv handling, file reads, printing, `process.exitCode` | bin/envlint.mjs — top-level main | `envlint --schema <schema.json> <envfile>` with exit 0 / 1 / 2 |

## Deviations

None. `src/parse.mjs` and `src/rules.mjs` are reachable only through `bin/envlint.mjs`, and neither imports the other.
