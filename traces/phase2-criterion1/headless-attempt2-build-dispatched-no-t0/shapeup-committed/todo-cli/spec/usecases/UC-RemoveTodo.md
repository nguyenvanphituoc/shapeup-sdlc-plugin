---
type: usecase
feature: todo-cli
id: UC-RemoveTodo
bounded_context: todo
actor: Developer
entities: [TodoList, TodoItem]
repositories: [TodoStoreRepository]
domain_events_emitted: [TodoItemRemoved]
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: RemoveTodo

## Summary
A Developer runs `todo rm <n>`, which removes the item at 1-based display index `<n>`.

## Preconditions
- The CLI process has read/write access to the current working directory.

## Input

```typescript
interface RemoveTodoInput {
  n: string   // argv[3], parsed as a positive integer
}
```

## Steps

```
1. Parse argv: raw = argv[3]
2. Validate raw is present — else MISSING_INDEX, exit 1, no store touch
3. TodoStoreRepository.load() — ENOENT → empty TodoList; SyntaxError/shape → StoreCorruptedError
4. Validate raw is a positive integer (/^[1-9][0-9]*$/) — else INVALID_INDEX, exit 1, no store touch
5. Validate 1 <= n <= list.items.length — else INDEX_OUT_OF_RANGE, exit 1, no store touch
6. TodoList.removeAt(n): splice items[n-1] out (nextId is NOT decremented or reused — INV-01)
7. TodoStoreRepository.save(list)
8. Print confirmation line to stdout, exit 0
```

## Output

```typescript
interface RemoveTodoOutput {
  id: number
  text: string
}
```

## System Flow

```
[CLI: `todo rm <n>`]
  → [Dispatcher: bin/todo.js routes "rm" → commands/rm.js]
    → [Use Case: RemoveTodo]
      → [Repository.load() / .save() → file: ./.todo.json]
```

## Invariants
- [INV-01] Every `TodoItem.id` is unique and never reused, even after removal — `rm` is the
  one operation that could tempt id recycling (e.g. decrementing `nextId`); it must not.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `MISSING_INDEX` | `<n>` argument absent | n/a (process, exit 1) | stderr message, exit 1, no store write |
| `INVALID_INDEX` | `<n>` is not a positive integer (e.g. `abc`, `0`, `-1`, `1.5`) | n/a (process, exit 1) | stderr message, exit 1, no store write |
| `INDEX_OUT_OF_RANGE` | `<n>` is a positive integer but > current list length (or list is empty) | n/a (process, exit 1) | stderr message, exit 1, no store write |
| `STORE_CORRUPTED` | store file exists but is not valid JSON / wrong shape | n/a (process, exit 1) | stderr message, exit 1 |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | `add` 2 items, `rm 1`, then `add` a third; inspect `./.todo.json` | the third item's id ≠ 1 and ≠ the removed item's id (not recycled) | D1: INV-01 |
| TS-ERR-MISSING_INDEX | process | run `todo rm` with no `<n>` | exit 1, stderr names "index is required", store unchanged | D2 |
| TS-ERR-INVALID_INDEX | process | run `todo rm abc` on a non-empty list | exit 1, stderr names `<n>` invalid, store unchanged | D2 |
| TS-ERR-INDEX_OUT_OF_RANGE | process | run `todo rm 99` on a 1-item list (and `todo rm 1` on an empty list) | exit 1, stderr says no item at that index, store unchanged | D2 |
| TS-ERR-STORE_CORRUPTED | process | write `not json {{{` to `./.todo.json`, run `todo rm 1` | exit 1, stderr names the store as corrupted, no stack trace | D2 |
| TS-REQ-n-boundary | process | on a 3-item list: `todo rm 0`, `todo rm 1`, `todo rm 4` (after first rm, list has 2) | 0 and (now-)4 rejected, 1 accepted and list shrinks by one | D3: n bounded `[1, list.length]` |
| TS-NOGO-04 | process | run `todo rm 1` on an existing item | item removed with no interactive "are you sure?" confirmation prompt | D4: no-gos "No interactive prompts" |

## Integration Points
- → [[integration#Local-Filesystem]] — reads and writes `./.todo.json`
- ← [[ux-behavior#Command-rm-n]] — triggered by `todo rm <n>`
