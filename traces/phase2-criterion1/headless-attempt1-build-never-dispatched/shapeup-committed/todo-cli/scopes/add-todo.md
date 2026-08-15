---
scope_id: add-todo
topology_type: LAYER_CAKE
tasks: [TASK-004]
allowed_file_substrate: [src/commands/add.js, test/commands/add.test.js]
e2e_verification_fixtures: ["node --test test/commands/add.test.js"]
hill_phase: UPHILL_UNKNOWN
---

# Scope: add-todo

## Why this slice
`UC-AddTodo` end to end: argv text → validate → `foundation`'s `todo-list.js#addItem` →
`store.js#save` → stdout confirmation / exit 0, or `MISSING_TEXT` on stderr / exit 1. It reads
and calls `foundation`'s modules but never rewrites them (they are frozen from this scope's
point of view) — the only file this scope owns is the command handler and its unit test, which
is why the substrate is exactly `src/commands/add.js` + its test, not all of `src/commands/`.
`error` covers both `MISSING_TEXT` (empty/whitespace `<text>`) and `STORE_CORRUPTED`
(propagated from `foundation`) per `[[ux-behavior#Command-add-text]]`'s Error Catalog. No
`empty` state applies — `add` always mutates.

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli:add | command | [idle, loading, success, error] |
