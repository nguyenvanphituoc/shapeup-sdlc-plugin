---
type: usecase-index
feature: envlint
tags: []
---

# Use Cases: envlint

| ID | Title | Actor | Status | Depends On |
|----|-------|-------|--------|------------|
| [[usecases/UC-ParseEnvText]] | Parse `.env` text into pairs and problems | System | ready | — |
| [[usecases/UC-EvaluateRules]] | Judge pairs against a schema | System | ready | — |
| [[usecases/UC-LintEnvFile]] | Run `envlint` on a file and a schema | Developer | ready | UC-ParseEnvText, UC-EvaluateRules |

```
UC-ParseEnvText ──┐
                  ├──► UC-LintEnvFile
UC-EvaluateRules ─┘
```

UC-ParseEnvText and UC-EvaluateRules share nothing and can be built at the same time; both are
written against the `Pair` shape in [[domain-model#Value Objects]].
