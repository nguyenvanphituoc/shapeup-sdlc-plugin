---
scope_id: complete-todo
topology_type: LAYER_CAKE
tasks: [TASK-006]
allowed_file_substrate: [src/commands/done.js, test/commands/done.test.js]
e2e_verification_fixtures: ["node --test test/commands/done.test.js"]
hill_phase: UPHILL_UNKNOWN
---

# Scope: complete-todo

## Why this slice
`UC-CompleteTodo` end to end: argv `<n>` → validate presence/numeric/range BEFORE any mutation
(RULE-05) → `foundation`'s `todo-list.js#completeAt` → `store.js#save` → confirmation / exit 0.
Owns all three index-validation error codes (`MISSING_INDEX`, `INVALID_INDEX`,
`INDEX_OUT_OF_RANGE`) plus `STORE_CORRUPTED`, per `[[ux-behavior#Command-done-n]]`'s Error
Catalog. Re-`done`-ing an already-done item is a `success` no-op (RULE-06), not an error. The
only file this scope owns is the command handler and its unit test.

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli:done | command | [idle, loading, success, error] |
