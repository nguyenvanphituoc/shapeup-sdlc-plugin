---
description: Decompose the pitch into a spec tree + board, then map the scope contracts
---
This is step 8 (Map Scopes), which is two skills in sequence:

1. Use the **ba-pitch-analyzer** skill on $ARGUMENTS — pitch → linked DDD spec tree (domain
   model → use cases → tasks) with BDD scenarios and the derived Test Surface. Pass through an
   operation when the user names one: `analyze` (the default — spec tree + board), `reconcile`
   (fold discovered-ledger items back into the board and UC invariants), `retrofit-surface`
   (append a Test Surface to a spec written before there was one), or `coverage` (extract the
   shared `requirements.md` registry that anchors covers-closure).
2. Then use the **scope-architect** skill (`map-scopes`) to write the committed scope contracts
   (`scopes/*.md`) — import-graph slicing by flow, write-whitelist substrates, fixtures.

If the user asked for only one half ("just analyze", "just the contracts"), run only that half.
