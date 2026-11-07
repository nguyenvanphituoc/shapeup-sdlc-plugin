---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring map — envlint

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-ParseEnvText | src/parse.mjs | static ESM import of `parse`; called with the env file's text after the CLI reads it | bin/envlint.mjs — main flow, after reading the env file | `envlint --schema <schema.json> <envfile>` reports unparseable lines by 1-based line number |
| UC-CheckRules | src/rules.mjs | static ESM import of `check`; called with the parsed pairs and the shape-checked schema | bin/envlint.mjs — main flow, after `parse` | `envlint --schema <schema.json> <envfile>` reports each rule a key breaks, key by key |
| UC-LintEnvFile | bin/envlint.mjs | CLI command: the package `bin` entry runs it via its `#!/usr/bin/env node` shebang | bin/envlint.mjs — top-level argv handling and process exit | `envlint --schema <schema.json> <envfile>` prints findings and exits 0, 1 or 2 |

## Deviations
None. `src/parse.mjs` and `src/rules.mjs` never import each other; the entry point is their only joiner.
