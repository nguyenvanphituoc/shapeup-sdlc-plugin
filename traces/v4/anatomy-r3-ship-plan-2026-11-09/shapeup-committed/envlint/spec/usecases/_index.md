---
type: usecase-index
feature: envlint
---

# Use cases — envlint

| Id | Actor | Action | Engine | Test Surface rows |
|---|---|---|---|---|
| [[UC-ParseEnvText]] | System | parse `.env` text into pairs + problems | `src/parse.mjs` | 7 (oracle `test`) |
| [[UC-CheckRules]] | System | check pairs against a schema | `src/rules.mjs` | 7 (oracle `test`) |
| [[UC-LintEnvFile]] | Developer / CI | run `envlint --schema <schema.json> <envfile>` | `bin/envlint.mjs` | 10 (oracle `process`) |

Actors: Developer (and CI running the same command), System (the pure services the CLI composes).
