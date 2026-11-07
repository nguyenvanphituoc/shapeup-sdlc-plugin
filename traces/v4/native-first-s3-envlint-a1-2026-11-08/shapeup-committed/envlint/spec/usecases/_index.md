---
type: usecase-index
feature: envlint
tags: []
---

# Use Cases — envlint

| ID | Title | Actor | Status | Depends On |
|---|---|---|---|---|
| [[usecases/UC-ParseEnvText]] | Parse `.env` text into pairs and problems | System | ready | — |
| [[usecases/UC-CheckRules]] | Check parsed pairs against a schema | System | ready | — |
| [[usecases/UC-LintEnvFile]] | Lint an env file against a schema from the command line | Developer | ready | UC-ParseEnvText, UC-CheckRules |

```
UC-ParseEnvText ──┐
                  ├──► UC-LintEnvFile
UC-CheckRules  ───┘
```
