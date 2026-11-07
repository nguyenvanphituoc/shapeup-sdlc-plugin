---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring map — envlint

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-ParseEnvText | src/parse.mjs | ESM import of `parseEnv`; the CLI calls it on the env file's text after reading it | bin/envlint.mjs — main(): after the env file read, before the rules | `envlint --schema s.json .env` reports unparseable lines as `<env>:<line>: <message>` |
| UC-EvaluateRules | src/rules.mjs | ESM import of `checkRules`; the CLI calls it with the parsed pairs and the parsed schema | bin/envlint.mjs — main(): after parseEnv, before printing | `envlint --schema s.json .env` reports rule findings key by key |
| UC-LintEnvFile | bin/envlint.mjs | CLI command: the `bin` entry in package.json runs main(process.argv) | bin/envlint.mjs — top-level main() invocation | `envlint --schema <schema.json> <envfile>` with exit code 0 / 1 / 2 |

## Deviations

None. The two pure modules never import each other. Only the entry point composes them.
