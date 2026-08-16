---
type: scope-board
feature: todo-cli
generated_at: 2026-08-16
scopes: [foundation, add-todo, list-todos, complete-todo, remove-todo, cli-integration-test]
---

# Scope Board: `todo` CLI

## Scopes

| scope_id | topology | tasks | substrate_size | lint |
|---|---|---|---|---|
| foundation | ICEBERG | TASK-001, TASK-002 | 4 | green |
| add-todo | LAYER_CAKE | TASK-003 | 2 | green |
| list-todos | LAYER_CAKE | TASK-004 | 2 | green |
| complete-todo | LAYER_CAKE | TASK-005 | 2 | green |
| remove-todo | LAYER_CAKE | TASK-006 | 2 | green |
| cli-integration-test | CHOWDER | TASK-007 | 1 | green |

## Riskiest-first build sequence

1. **`foundation`** (TASK-001 → TASK-002) — highest risk: the `E_STORE_CORRUPTED` vs. `ENOENT`
   distinction and the unguarded-`JSON.parse` footgun `.shapeup/todo-cli/orient/spike-store-parsing.md`
   confirms, plus the argv-dispatch skeleton and `E_UNKNOWN_COMMAND` handling every other scope
   is wired against. Build first — every fixture below assumes it holds.
2. **`complete-todo`** (TASK-005) and **`remove-todo`** (TASK-006) — next-highest risk: explicit
   integer + range parsing (never bare `Number()`/`parseInt()`) with 5 boundary cases each
   (min, max, below-min, above-max, empty store), sharing one index-parsing helper
   (`lib/parse-index.js`, declared `shared_substrate` between them). Can build in parallel with
   each other and with `add-todo`/`list-todos` once `foundation` lands, but sequence them first
   among the parallel group — their error surface is the largest of the four commands.
3. **`add-todo`** (TASK-003) and **`list-todos`** (TASK-004) — lower risk: `add-todo` has one
   validation rule (non-empty-after-trim text); `list-todos` is read-only with one edge case
   (empty/missing store → `No todos yet.`, never an error).
4. **`cli-integration-test`** (TASK-007) — last: depends on `foundation` and all four command
   scopes existing; the only scope exercising the full subprocess round-trip plus the
   corrupted-store and bad-index edge cases across the whole stack at once.

## Shared substrate

| path | scopes | why |
|---|---|---|
| `bin/todo.js` | foundation, add-todo, list-todos, complete-todo, remove-todo | `foundation` (TASK-001) writes the argv-dispatch skeleton with stub branch bodies; each command scope (TASK-003–006) later replaces only its own branch's body in place — same file, disjoint branches, declared here rather than silently widened |
| `lib/parse-index.js` | complete-todo, remove-todo | TASK-006's own text: index-parsing "is identical to TASK-005... reuse the same parsing helper rather than duplicating it" — whichever scope lands first creates it, the other calls it |

`lib/todo-repository.js` and `package.json` are frozen (read/call-only) for every command scope
and for `cli-integration-test` — they never appear in a non-`foundation` scope's
`allowed_file_substrate`, so DISJOINT has nothing else to declare.
