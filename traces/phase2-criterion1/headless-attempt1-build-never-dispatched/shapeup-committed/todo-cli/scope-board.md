---
type: scope-board
feature: todo-cli
generated_at: 2026-08-15
scopes: [foundation, add-todo, list-todos, complete-todo, remove-todo, cli-integration]
---

# Scope Board: `todo` CLI

## Scopes

| scope_id | topology | tasks | substrate_size | lint |
|---|---|---|---|---|
| foundation | ICEBERG | TASK-001, TASK-002, TASK-003 | 6 | green |
| add-todo | LAYER_CAKE | TASK-004 | 2 | green |
| list-todos | LAYER_CAKE | TASK-005 | 2 | green |
| complete-todo | LAYER_CAKE | TASK-006 | 2 | green |
| remove-todo | LAYER_CAKE | TASK-007 | 2 | green |
| cli-integration | LAYER_CAKE | TASK-008, TASK-009 | 3 | green |

## Riskiest-first build sequence

1. **`foundation`** (TASK-001 → TASK-002 → TASK-003) — highest risk: atomic write (temp file +
   rename), missing-vs-corrupted-file distinction, `nextId` never-reused invariant. Every other
   scope depends on this contract holding; de-risked by
   `.shapeup/todo-cli/orient/spike-persistence.md` but still the pitch's single riskiest area
   per `[[scope-summary#Risks]]`.
2. **`complete-todo`** (TASK-006) and **`remove-todo`** (TASK-007) — next-highest risk: three
   index-validation error codes each (`MISSING_INDEX`/`INVALID_INDEX`/`INDEX_OUT_OF_RANGE`) that
   must reject BEFORE any store mutation, plus the `nextId`-never-decremented boundary on
   removal. Can build in parallel with each other and with `add-todo`/`list-todos` once
   `foundation` lands.
3. **`add-todo`** (TASK-004) and **`list-todos`** (TASK-005) — lower risk: `add-todo` has one
   validation rule (non-empty text); `list-todos` is read-only with one edge case (empty-list
   message).
4. **`cli-integration`** (TASK-008 → TASK-009) — last: depends on `foundation` and all four
   command scopes existing; owns dispatch + the one cross-cutting error case
   (`UNKNOWN_COMMAND`) + the full-round-trip subprocess test.

## Shared substrate

| path | scopes | why |
|---|---|---|
| `bin/todo.js` | foundation, cli-integration | `foundation` writes the TASK-001 shebang placeholder; `cli-integration` rewrites it with the real TASK-008 dispatcher |

No other overlap: `src/domain/todo-list.js` and `src/store.js` are frozen (read/call-only) for
every command scope — they are never in a command scope's `allowed_file_substrate`, only in
`foundation`'s, so DISJOINT has nothing else to declare.
