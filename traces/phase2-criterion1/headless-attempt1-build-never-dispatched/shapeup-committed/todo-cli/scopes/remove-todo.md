---
scope_id: remove-todo
topology_type: LAYER_CAKE
tasks: [TASK-007]
allowed_file_substrate: [src/commands/rm.js, test/commands/rm.test.js]
e2e_verification_fixtures: ["node --test test/commands/rm.test.js"]
hill_phase: UPHILL_UNKNOWN
---

# Scope: remove-todo

## Why this slice
`UC-RemoveTodo` end to end: argv `<n>` → same validation shape as `complete-todo` (RULE-07 →
RULE-05) → `foundation`'s `todo-list.js#removeAt` (never decrements/reuses `nextId`, INV-01) →
`store.js#save` → confirmation / exit 0. Owns `MISSING_INDEX`, `INVALID_INDEX`,
`INDEX_OUT_OF_RANGE`, `STORE_CORRUPTED` per `[[ux-behavior#Command-rm-n]]`'s Error Catalog.
Deliberately a sibling of `complete-todo`, not a merge into it — RULE-07/RULE-08 note the
validation helper *may* be shared code, but `rm.js` is its own command file and its own task
(TASK-007), so it is its own scope with its own substrate.

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli:rm | command | [idle, loading, success, error] |
