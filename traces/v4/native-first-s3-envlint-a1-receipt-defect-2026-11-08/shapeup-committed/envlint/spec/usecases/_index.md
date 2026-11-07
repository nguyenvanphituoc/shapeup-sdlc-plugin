---
type: usecase-index
feature: envlint
tags: [usecases]
---

# Use cases — envlint

| ID | Title | Actor | Status | Depends On |
|---|---|---|---|---|
| [[usecases/UC-ParseEnvText]] | Parse `.env` text into pairs and problems | System | ready | — |
| [[usecases/UC-CheckEnvAgainstSchema]] | Check pairs against a schema | System | ready | — |
| [[usecases/UC-LintEnvFile]] | Lint an env file from the command line | Developer | ready | UC-ParseEnvText, UC-CheckEnvAgainstSchema |

```
UC-ParseEnvText ──┐
                  ├──> UC-LintEnvFile
UC-CheckEnvAgainstSchema ──┘
```
