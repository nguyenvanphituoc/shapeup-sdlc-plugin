---
description: Decompose the pitch into a spec tree + board, then map the scope contracts
---
This is step 8 (Map Scopes), which is two skills in sequence:

1. Use the **ba-pitch-analyzer** skill on $ARGUMENTS — pitch → linked DDD spec tree (domain
   model → use cases → tasks) with BDD scenarios and the derived Test Surface. Pass through an
   operation when the user names one: `analyze`, `generate-board`, `reconcile`,
   `retrofit-surface`, or `coverage` (which writes the shared `requirements.md` registry).
2. Then use the **scope-architect** skill to write the committed scope contracts
   (`scopes/*.json`) — import-graph slicing by flow, write-whitelist substrates, fixtures.
   Operations: `map-scopes` (default), `remap`, `split-scope`.

If the user asked for only one half ("just analyze", "just the contracts"), run only that half.
