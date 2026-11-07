---
type: usecase-index
feature: envlint
tags: [cli]
---

# Use cases — envlint

| ID | Title | Actor | Status | Depends On |
|---|---|---|---|---|
| [[usecases/UC-ParseEnvText]] | Parse `.env` text into pairs + problems | System | ready | — |
| [[usecases/UC-EvaluateRules]] | Judge pairs against a schema | System | ready | — |
| [[usecases/UC-LintEnvFile]] | Lint an env file from the command line | Developer | ready | UC-ParseEnvText, UC-EvaluateRules |

```
UC-ParseEnvText ──┐
                  ├──► UC-LintEnvFile
UC-EvaluateRules ─┘
```

UC-ParseEnvText and UC-EvaluateRules share no file and can be built at the same time.
