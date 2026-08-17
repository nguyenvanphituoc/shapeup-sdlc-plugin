---
type: usecase-index
feature: envlint
tags: []
---

# Use Case Index — envlint

| ID | Title | Actor | Status | Depends On |
|---|---|---|---|---|
| [[UC-01]] | Lint Env File | Developer | ready | [[domain-model]], [[ux-behavior]] |

## Dependency Diagram

```
[domain-model] ──► [UC-01: Lint Env File] ──► [integration]
[ux-behavior]  ──►
```

Single use case by design: the pitch's "three independent pieces" (Parsing, Rules, CLI) are
scope-level slices of ONE end-to-end flow, not three separate actor/action pairs — there is one
thing a Developer does (lint a file against a schema) and three internally-independent engines
that cooperate to do it. `scope-architect` maps Parsing/Rules/CLI to their own scope contracts
against this single UC's `use_case_refs`.
