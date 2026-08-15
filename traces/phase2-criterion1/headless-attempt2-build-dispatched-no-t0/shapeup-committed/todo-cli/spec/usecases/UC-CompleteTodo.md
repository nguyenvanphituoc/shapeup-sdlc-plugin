---
type: usecase
feature: todo-cli
id: UC-CompleteTodo
bounded_context: todo
actor: Developer
entities: [TodoList, TodoItem]
repositories: [TodoStoreRepository]
domain_events_emitted: [TodoItemCompleted]
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: CompleteTodo

## Summary
A Developer runs `todo done <n>`, which marks the item at 1-based display index `<n>` as done.

## Preconditions
- The CLI process has read/write access to the current working directory.

## Input

```typescript
interface CompleteTodoInput {
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
6. TodoList.completeAt(n): items[n-1].done = true (idempotent if already true)
7. TodoStoreRepository.save(list)
8. Print confirmation line to stdout, exit 0
```

## Output

```typescript
interface CompleteTodoOutput {
  id: number
  text: string
}
```

## System Flow

```
[CLI: `todo done <n>`]
  → [Dispatcher: bin/todo.js routes "done" → commands/done.js]
    → [Use Case: CompleteTodo]
      → [Repository.load() / .save() → file: ./.todo.json]
```

## Invariants
- [INV-01] Every `TodoItem.id` is unique and never reused, even after removal (unaffected by
  `done` — carried for regression coverage since `done` reads the same store shape).

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
| TS-INV-01 | process | `done 1` on a fresh 2-item list, then inspect `./.todo.json` | item ids unchanged, only `done` flag flips on items[0] | D1: INV-01 |
| TS-ERR-MISSING_INDEX | process | run `todo done` with no `<n>` | exit 1, stderr names "index is required", store unchanged | D2 |
| TS-ERR-INVALID_INDEX | process | run `todo done abc` on a non-empty list | exit 1, stderr names `<n>` invalid, store unchanged | D2 |
| TS-ERR-INDEX_OUT_OF_RANGE | process | run `todo done 99` on a 1-item list (and `todo done 1` on an empty list) | exit 1, stderr says no item at that index, store unchanged | D2 |
| TS-ERR-STORE_CORRUPTED | process | write `not json {{{` to `./.todo.json`, run `todo done 1` | exit 1, stderr names the store as corrupted, no stack trace | D2 |
| TS-REQ-n-boundary | process | on a 3-item list: `todo done 0`, `todo done 1`, `todo done 3`, `todo done 4` | 0 and 4 rejected (`INDEX_OUT_OF_RANGE`/`INVALID_INDEX`), 1 and 3 accepted | D3: n bounded `[1, list.length]` |
| TS-NOGO-03 | process | run `todo done 1` twice in a row on the same item | second call succeeds idempotently (no error), no interactive confirm prompt shown | D4: no-gos "No interactive prompts" |

## Integration Points
- → [[integration#Local-Filesystem]] — reads and writes `./.todo.json`
- ← [[ux-behavior#Command-done-n]] — triggered by `todo done <n>`
