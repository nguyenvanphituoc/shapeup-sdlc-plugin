---
type: scope-contract
scope_id: remove-todo
feature: todo-cli
topology_type: LAYER_CAKE
tasks: [TASK-006]
allowed_file_substrate: [bin/todo.js, lib/parse-index.js, test/commands/rm.test.js]
shared_substrate: [bin/todo.js, lib/parse-index.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/commands/rm.test.js"]
---

# Scope Contract: `remove-todo`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| todo-rm-command | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | `1 <= n <= items.length` → removes `items[n-1]`, shifts subsequent items left, saves, prints `Removed: "N) <text>"` to stdout, exit 0 — no other item's `text`/`done` value changes | missing `<n>` → `E_MISSING_INDEX` to stderr, exit 1, store untouched; non-integer `<n>` → `E_INVALID_INDEX` to stderr, exit 1, store untouched (never bare `Number()`/`parseInt()`); out-of-range integer (`< 1` or `> items.length`) → `E_INDEX_OUT_OF_RANGE` to stderr, exit 1, store untouched; corrupted store → corrupted-store message to stderr, exit 1, store untouched | `rm 1` against a 0-item store → `E_INDEX_OUT_OF_RANGE`, no file created/modified |

## Why this slice

Crosses layers in one flow: the `rm` branch of `bin/todo.js` down through the shared
`lib/parse-index.js` helper (identical parsing rule to `complete-todo` — TASK-006's own text says
to reuse rather than duplicate) and `TodoRepository.load()`/`save()` (frozen, call-only) to the
filesystem. `bin/todo.js` is `shared_substrate` with every other command scope; `lib/parse-index.js`
is `shared_substrate` specifically with `complete-todo` — whichever scope lands first creates the
helper, the other calls it, never forks its own copy. Highest-risk of the four command scopes
alongside `complete-todo`: 5 boundary cases plus the left-shift-on-removal invariant that a
subsequent `list` must reflect.
