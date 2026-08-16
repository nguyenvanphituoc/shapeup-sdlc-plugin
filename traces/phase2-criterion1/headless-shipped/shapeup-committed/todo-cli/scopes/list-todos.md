---
type: scope-contract
scope_id: list-todos
feature: todo-cli
topology_type: LAYER_CAKE
tasks: [TASK-004]
allowed_file_substrate: [bin/todo.js, test/commands/list.test.js]
shared_substrate: [bin/todo.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/commands/list.test.js"]
---

# Scope Contract: `list-todos`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| todo-list-command | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | ≥1 item → one line per item, 1-based, `N) [ ] <text>` / `N) [x] <text>`, in store order, exit 0 | corrupted store → corrupted-store message to stderr, exit 1; never writes to the store under any input | 0 items (missing file OR `[]` on disk) → `No todos yet.` to stdout, exit 0 — never an error |

## Why this slice

Crosses layers in one flow: the `list` branch of the `bin/todo.js` dispatcher down through
`TodoRepository.load()` only (never `save()` — read-only) to the filesystem. `bin/todo.js` is
`shared_substrate` with `foundation` and the other three command scopes: this scope may only
replace its own `case "list":` branch body. Lowest-risk of the four command scopes alongside
`add-todo` — one edge case (empty/missing store → `No todos yet.`, never an error) and no
index-parsing surface at all.
