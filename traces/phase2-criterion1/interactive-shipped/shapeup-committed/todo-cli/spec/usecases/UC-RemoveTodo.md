---
type: usecase
feature: todo-cli
id: UC-RemoveTodo
bounded_context: todo
actor: Developer
entities: [TodoItem, TodoList]
repositories: [TodoStoreRepository]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: RemoveTodo

## Summary
Developer runs `todo rm <n>`, which removes the 1-based item `<n>` and prints a confirmation,
or rejects `<n>` cleanly when it is not a valid index.

## Preconditions
- None — `<n>` is validated against whatever `load()` returns, including an empty list
  (`len(items) == 0` makes every `<n>` out of range).

## Input

```typescript
interface RemoveTodoInput {
  n: string   // raw positional arg — PO decision #1: 1-based
}
```

## Steps

```
1. Resolve store path: $TODO_STORE verbatim if set, else os.path.expanduser("~/.todo.json")
2. TodoStoreRepository.load(path) — raises StoreCorruptedError on invalid JSON or non-list root
3. Parse n as an integer; if not parseable → ERR_INVALID_INDEX (non-integer form), no mutation
4. Validate 1 <= n <= len(items); if not → ERR_INVALID_INDEX (out-of-range form), no mutation
5. Record removed_text = items[n-1].text, then delete items[n-1] (all later items shift down 1)
6. TodoStoreRepository.save(path, items) — atomic write of the FULL remaining item list
7. Print "removed #<n>: <removed_text>" to stdout
8. Exit 0
```

## Output

```typescript
interface RemoveTodoOutput {
  index: number   // the validated 1-based n that was removed
  text: string    // the removed item's text
}
```

## System Flow

```
[CLI: bin/todo rm <n>]
  → [Dispatch: argparse subcommand "rm"]
    → [Use Case: RemoveTodo.execute(n)]
      → [TodoStoreRepository.load() → file: $TODO_STORE or ~/.todo.json]
      → [TodoStoreRepository.save() → same file, atomic — only on valid n]
    ← [stdout: "removed #<n>: <text>", exit 0]  OR  [stderr: error, exit 1]
```

## Invariants
- [INV-03] Removing item `<n>` shrinks the item count by exactly one and shifts every later
  item's display index down by one on the NEXT read, but never mutates the `text` or `done`
  field of any item other than the removed one.

## Error Cases

| Error Code | Condition | Exit Code | Handling |
|---|---|---|---|
| `ERR_INVALID_INDEX` | `<n>` is not a valid non-negative integer | 1 | Print `error: invalid item number '<n>'` to stderr; no save attempted |
| `ERR_INVALID_INDEX` | `<n>` is an integer but `< 1` or `> len(items)` | 1 | Print `error: no item <n> (list has <k> items)` to stderr; no save attempted |
| `ERR_CORRUPTED_STORE` | store file exists but is invalid JSON, or valid JSON whose root is not a list | 1 | Print `error: corrupted store at <path>` to stderr; no traceback |

## Test Surface
<!-- DERIVED — do not hand-author rows here; regenerate via a retrofit-surface order. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-03 | process | Seed store with 3 items, run `todo rm 2`, then `todo list` | Item count is now 2; the surviving items are the former #1 and #3, unmodified, now numbered 1 and 2; the removed item's text is gone | D1: INV-03 |
| TS-ERR-ERR_INVALID_INDEX | process | Seed store with 1 item, run `todo rm 5` | exit 1, stderr exactly `error: no item 5 (list has 1 items)`, store file unchanged | D2 |
| TS-ERR-ERR_CORRUPTED_STORE | process | Seed `$TODO_STORE` with invalid JSON, run `todo rm 1` | exit 1, stderr matches `error: corrupted store at .*`, no stack trace | D2 |
| TS-REQ-n-boundary | process | Seed store with 2 items; run `todo rm 0`, `todo rm 3`, `todo rm xyz`, then `todo rm 1` | `0`/`3`/`xyz` rejected (`ERR_INVALID_INDEX`, exit 1, no write, store still has 2 items); `1` accepted (exit 0, store now has 1 item) | D3 + D2 (dedup) |

## Integration Points
- → [[integration#Local-filesystem-store]] — reads and writes the JSON store file
- ← [[ux-behavior#Screen-RemoveCommand]] — triggered by the `rm` subcommand
