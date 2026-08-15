---
scope_id: list-todos
topology_type: LAYER_CAKE
tasks: [TASK-005]
allowed_file_substrate: [src/commands/list.js, test/commands/list.test.js]
e2e_verification_fixtures: ["node --test test/commands/list.test.js"]
hill_phase: UPHILL_UNKNOWN
---

# Scope: list-todos

## Why this slice
`UC-ListTodos` end to end: no args → `foundation`'s `store.js#load` → render `[<n>] [x| ]
<text>` per RULE-03, or the explicit "no todos yet" line on an empty store (RULE-04 — this is
a `success` state, never blank, never non-zero exit), or `STORE_CORRUPTED` on stderr / exit 1.
Read-only against the store — the only file this scope owns is the command handler and its
unit test.

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli:list | command | [idle, loading, success, empty, error] |
