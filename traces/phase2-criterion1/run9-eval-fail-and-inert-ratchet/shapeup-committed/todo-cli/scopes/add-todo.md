---
type: scope-contract
scope_id: add-todo
feature: todo-cli
topology_type: LAYER_CAKE
tasks: [TASK-003]
allowed_file_substrate: [bin/todo.js, test/commands/add.test.js]
shared_substrate: [bin/todo.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/commands/add.test.js"]
---

# Scope Contract: `add-todo`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| todo-add-command | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | `<text>` present (non-empty after trim) → appends item, prints `Added: "N) <text>"` to stdout, exit 0 | missing/blank `<text>` → `Error: missing todo text` to stderr, exit 1 (`E_MISSING_TEXT`); corrupted store → corrupted-store message to stderr, exit 1, no write | first `add` on a missing/empty store creates the store with exactly one item |

## Why this slice

Crosses layers in one flow: the `add` branch of the `bin/todo.js` dispatcher (UI/entry layer) down
through `TodoRepository.load()`/`save()` (frozen, call-only — `lib/todo-repository.js` is not in
this scope's substrate) to the filesystem. `bin/todo.js` is `shared_substrate` with `foundation`,
`list-todos`, `complete-todo`, and `remove-todo`: this scope may only replace its own `case "add":`
branch body, never the dispatch skeleton around it. One validation rule (non-empty-after-trim
text) keeps this the lowest-risk of the four command scopes alongside `list-todos`.
