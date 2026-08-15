---
type: usecase
feature: todo-cli
id: UC-AddTodo
bounded_context: todo
actor: Developer
entities: [TodoList, TodoItem]
repositories: [TodoStoreRepository]
domain_events_emitted: [TodoItemAdded]
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: AddTodo

## Summary
A Developer runs `todo add <text>`, which appends a new pending item to the local store.

## Preconditions
- The CLI process has read/write access to the current working directory.

## Input

```typescript
interface AddTodoInput {
  text: string   // argv[3..], joined with spaces if multiple tokens; trimmed
}
```

## Steps

```
1. Parse argv: text = argv.slice(3).join(' ').trim()
2. Validate: text.length > 0 — else MISSING_TEXT, exit 1, no store touch
3. TodoStoreRepository.load() — ENOENT → empty TodoList; SyntaxError/shape → StoreCorruptedError
4. TodoList.add(text): assign id = nextId, push {id, text, done: false}, increment nextId
5. TodoStoreRepository.save(list) — temp-file + rename (see contract)
6. Print confirmation line to stdout, exit 0
```

## Output

```typescript
interface AddTodoOutput {
  id: number       // the assigned TodoItemId
  text: string
}
```

## System Flow

```
[CLI: `todo add <text>`]
  → [Dispatcher: bin/todo.js routes "add" → commands/add.js]
    → [Use Case: AddTodo]
      → [Repository.load() / .save() → file: ./.todo.json]
```

## Invariants
- [INV-01] Every `TodoItem.id` is unique and never reused, even after removal.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `MISSING_TEXT` | `text` argument absent or empty/whitespace-only after trim | n/a (process, exit 1) | stderr message, exit 1, no store write |
| `STORE_CORRUPTED` | store file exists but is not valid JSON / wrong shape | n/a (process, exit 1) | stderr message, exit 1, no store write |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | `add` twice, then `rm 1`, then `add` a third item; inspect `./.todo.json` | third item's id ≠ 1 (not reused) and ≠ any existing id | D1: INV-01 |
| TS-ERR-MISSING_TEXT | process | run `todo add` with no text argument | exit 1, stderr names "text is required", `./.todo.json` unchanged (or absent if none existed) | D2 |
| TS-ERR-STORE_CORRUPTED | process | write `not json {{{` to `./.todo.json`, run `todo add "x"` | exit 1, stderr names the store as corrupted, no stack trace, file left unchanged | D2 |
| TS-REQ-text-missing | process | run `todo add` (no text) | same as TS-ERR-MISSING_TEXT (dedup) | D3 + D2 |
| TS-NOGO-01 | process | run `todo add "x"` and inspect stdout for ANSI escape codes / interactive prompt | no color codes, no prompt — plain assertable text only | D4: no-gos "No TUI / colors / interactive prompts" |

## Integration Points
- → [[integration#Local-Filesystem]] — writes `./.todo.json`
- ← [[ux-behavior#Command-add-text]] — triggered by `todo add <text>`
