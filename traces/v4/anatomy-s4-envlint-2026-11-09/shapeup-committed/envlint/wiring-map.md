---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring map — envlint

Composition root: `bin/envlint.mjs` (from `project-profile.md`). Both pure engines attach to it by a static
ESM import and a direct call in the CLI's main flow; nothing else imports them.

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-ParseEnvText | src/parse.mjs | static `import { parseEnv }`; called with the env file's text after the schema is accepted | bin/envlint.mjs — main flow, after reading `<envfile>` | `envlint --schema <s> <envfile>` reports parse problems as `<envfile>:<line>: parse error: …` |
| UC-CheckRules | src/rules.mjs | static `import { checkSchema, checkRules }`; `checkSchema` called on the parsed schema JSON, `checkRules` on `parseEnv(...).pairs` | bin/envlint.mjs — main flow, after `JSON.parse(schema)` and after `parseEnv` | `envlint --schema <s> <envfile>` reports `<envfile>:<line>: <KEY>: …` findings and exits 1 |
| UC-LintEnvFile | bin/envlint.mjs | the process entry itself: `node bin/envlint.mjs` runs its top-level main, which sets `process.exitCode` | bin/envlint.mjs — top-level module body | a developer or CI runs `node bin/envlint.mjs --schema <s> <envfile>` and reads stdout + exit code 0/1/2 |

## Deviations
- No `package.json` `bin` entry is planned: the pitch grades by driving the binary from tests, which spawn
  `node bin/envlint.mjs` directly. Adding a `bin` field would put `package.json` in a scope's substrate for no graded gain.
