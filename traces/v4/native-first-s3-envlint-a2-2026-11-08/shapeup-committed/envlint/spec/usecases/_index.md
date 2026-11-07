---
type: usecase-index
feature: envlint
tags: [usecases]
---

# Use Cases — envlint

| ID | Title | Actor | Status | Depends On |
|---|---|---|---|---|
| [[usecases/UC-ParseEnvText]] | Parse `.env` text into pairs and problems | System | ready | — |
| [[usecases/UC-EvaluateRules]] | Evaluate pairs against a schema | System | ready | — |
| [[usecases/UC-LintEnvFile]] | Lint an env file from the command line | Developer | ready | UC-ParseEnvText, UC-EvaluateRules |

```
UC-ParseEnvText ──┐
                  ├──► UC-LintEnvFile (bin/envlint.mjs)
UC-EvaluateRules ─┘
```

UC-ParseEnvText and UC-EvaluateRules share nothing; only UC-LintEnvFile composes them.
