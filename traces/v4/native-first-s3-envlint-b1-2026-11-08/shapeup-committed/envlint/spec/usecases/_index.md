---
type: usecase-index
feature: envlint
tags: [cli]
---

# Use Cases — envlint

| ID | Title | Actor | Status | Depends On |
|---|---|---|---|---|
| [[usecases/UC-ParseEnv]] | Parse `.env` text into pairs and problems | System | ready | — |
| [[usecases/UC-CheckRules]] | Check pairs against a schema | System | ready | — |
| [[usecases/UC-LintEnvFile]] | Lint an env file from the command line | Admin | ready | UC-ParseEnv, UC-CheckRules |

```
UC-ParseEnv ──┐
              ├──► UC-LintEnvFile
UC-CheckRules ┘
```
