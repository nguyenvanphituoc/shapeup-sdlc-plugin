---
type: usecase
feature: todo-cli
id: UC-ListTodos
bounded_context: todo
actor: Developer
entities: [TodoList, TodoItem]
repositories: [TodoStoreRepository]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: ListTodos

## Summary
A Developer runs `todo list`, which prints every item with its current display index and
done/not-done state, or a sane message if the list is empty.

## Preconditions
- The CLI process has read access to the current working directory.

## Input

```typescript
interface ListTodosInput {}   // no arguments
```

## Steps

```
1. TodoStoreRepository.load() — ENOENT → empty TodoList; SyntaxError/shape → StoreCorruptedError
2. If list.items.length === 0: print "no todos yet" line, exit 0
3. Else: for each item at 1-based position i, print "[i] [x|  ] <text>", exit 0
```

## Output

```typescript
interface ListTodosOutput {
  items: Array<{ index: number; id: number; text: string; done: boolean }>
}
```

## System Flow

```
[CLI: `todo list`]
  → [Dispatcher: bin/todo.js routes "list" → commands/list.js]
    → [Use Case: ListTodos]
      → [Repository.load() → file: ./.todo.json]
```

## Invariants
- [INV-02] A `TodoList` loaded from a missing store file behaves as an empty list — never throws.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `STORE_CORRUPTED` | store file exists but is not valid JSON / wrong shape | n/a (process, exit 1) | stderr message, exit 1 |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-02 | process | run `todo list` with no `./.todo.json` file present | exit 0, "no todos yet"-style message, not a crash | D1: INV-02 |
| TS-ERR-STORE_CORRUPTED | process | write `not json {{{` to `./.todo.json`, run `todo list` | exit 1, stderr names the store as corrupted, no stack trace | D2 |
| TS-REQ-empty-list | process | `add` nothing, run `todo list` on a fresh empty store | exit 0, explicit non-blank message, not an empty string / not a crash (pitch explicit edge case: "empty list") | D3: ListTodosOutput.items may be `[]` |
| TS-NOGO-02 | process | run `todo list` and inspect stdout for ANSI escape codes | no color codes — plain assertable text only | D4: no-gos "No TUI / colors" |

## Integration Points
- → [[integration#Local-Filesystem]] — reads `./.todo.json`
- ← [[ux-behavior#Command-list]] — triggered by `todo list`
