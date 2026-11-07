---
type: usecase-index
feature: personal-site
tags: [usecases]
---

# Use Cases — personal-site

| ID | Title | Actor | Status | Depends On |
|---|---|---|---|---|
| [[usecases/UC-BuildPage]] | Build the personal page from the content file | Freelancer | ready | — |

```
Freelancer ──node build.mjs──► UC-BuildPage ──► index.html | stderr + exit 1
```
