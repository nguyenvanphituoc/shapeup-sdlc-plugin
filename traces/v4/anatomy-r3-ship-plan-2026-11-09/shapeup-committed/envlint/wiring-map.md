---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring map — envlint

Intended architecture (design time, before code exists). The composition root is the profile's `entry_point`.

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-ParseEnvText | src/parse.mjs | ES module import of `parse`, called on the env file's text after it is read | bin/envlint.mjs — after reading the env file | `envlint --schema <schema.json> <envfile>` prints parse problems with line numbers |
| UC-CheckRules | src/rules.mjs | ES module import of `check`, called with the parser's pairs and the parsed schema JSON | bin/envlint.mjs — after `parse` returns | `envlint --schema <schema.json> <envfile>` prints rule findings key by key |
| UC-LintEnvFile | bin/envlint.mjs | CLI command: `process.argv` dispatch, stdout lines, `process.exitCode` | bin/envlint.mjs — module top level (the entry point itself) | `envlint --schema <schema.json> <envfile>` exits 0 / 1 / 2 |

## Deviations

None. The two pure engines have no attachment of their own; both attach only through the CLI's imports, which is
the seam the build must create.
