---
type: usecase-index
feature: envlint
tags: []
depends_on: ["[[_index]]"]
---

# Use Cases — envlint

| Use case | Actor | Action | Module |
|---|---|---|---|
| [[usecases/UC-ParseEnvText]] | System (called by the CLI) | turn `.env` text into pairs + problems | `src/parse.mjs` |
| [[usecases/UC-CheckRules]] | System (called by the CLI) | check the schema, then judge pairs against it | `src/rules.mjs` |
| [[usecases/UC-LintEnvFile]] | Developer / CI | run `envlint --schema <s> <envfile>` | `bin/envlint.mjs` |

Actors: Developer / CI (one human-facing action). The two System use cases are the pure pieces the pitch
requires to be "verifiable alone against its own fixtures"; they share nothing, and only UC-LintEnvFile
depends on both.
