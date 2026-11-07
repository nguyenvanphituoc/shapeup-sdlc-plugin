---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring map — envlint

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-ParseEnvText | src/parse.mjs | static ESM import of `parse`; the CLI calls it on the envfile text after reading it | bin/envlint.mjs — after the envfile is read | `envlint --schema <schema.json> <envfile>` reports parse errors by line |
| UC-EvaluateRules | src/rules.mjs | static ESM import of `validateSchema` and `evaluate`; the CLI validates the parsed schema, then evaluates the parsed pairs | bin/envlint.mjs — after the schema is parsed and after `parse` returns | `envlint --schema <schema.json> <envfile>` reports missing / mistyped / out-of-enum keys |
| UC-LintEnvFile | bin/envlint.mjs | process entry: `node bin/envlint.mjs` (and the `bin.envlint` field in `package.json`) runs the top-level main with `process.argv` | bin/envlint.mjs — top-level main | `envlint --schema <schema.json> <envfile>` prints findings and exits 0 / 1 / 2 |

## Deviations

None. `src/parse.mjs` and `src/rules.mjs` never import each other; the CLI is their only caller and
passes `parse(...).pairs` straight into `evaluate`, which is why the `Pair` shape is fixed in the
domain model before either is built.
