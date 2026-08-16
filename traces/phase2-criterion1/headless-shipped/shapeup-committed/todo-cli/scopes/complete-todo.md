---
type: scope-contract
scope_id: complete-todo
feature: todo-cli
topology_type: LAYER_CAKE
tasks: [TASK-005]
allowed_file_substrate: [bin/todo.js, lib/parse-index.js, test/commands/done.test.js]
shared_substrate: [bin/todo.js, lib/parse-index.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/commands/done.test.js"]
---

# Scope Contract: `complete-todo`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| todo-done-command | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | `1 <= n <= items.length` → sets `items[n-1].done = true`, saves, prints `Done: "N) <text>"` to stdout, exit 0; re-running on an already-done item is idempotent (same message, exit 0) | missing `<n>` → `E_MISSING_INDEX` to stderr, exit 1, store untouched; non-integer `<n>` (`abc`, `2.5`, `3abc`, `""`) → `E_INVALID_INDEX` to stderr, exit 1, store untouched (never bare `Number()`/`parseInt()`); out-of-range integer (`< 1` or `> items.length`) → `E_INDEX_OUT_OF_RANGE` to stderr, exit 1, store untouched; corrupted store → corrupted-store message to stderr, exit 1, store untouched | `done 1` against a 0-item store → `E_INDEX_OUT_OF_RANGE` (range `[1, 0]` is never satisfiable) |

## Why this slice

Crosses layers in one flow: the `done` branch of `bin/todo.js` down through the shared
`lib/parse-index.js` helper (explicit integer + range check — never bare `Number()`/`parseInt()`,
per the confirmed spike footguns) and `TodoRepository.load()`/`save()` (frozen, call-only) to the
filesystem. `bin/todo.js` is `shared_substrate` with every other command scope; `lib/parse-index.js`
is `shared_substrate` specifically with `remove-todo` — TASK-006 reuses the identical index-parsing
logic rather than duplicating it, so whichever of `complete-todo`/`remove-todo` lands first creates
the helper and the other calls it. Highest-risk of the four command scopes alongside `remove-todo`:
5 boundary cases (min, max, below-min, above-max, empty store) plus 3 malformed-index shapes.
