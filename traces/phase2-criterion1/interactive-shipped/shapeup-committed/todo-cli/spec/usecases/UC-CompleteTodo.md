---
type: usecase
feature: todo-cli
id: UC-CompleteTodo
bounded_context: todo
actor: Developer
entities: [TodoItem, TodoList]
repositories: [TodoStoreRepository]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: CompleteTodo

## Summary
Developer runs `todo done <n>`, which marks the 1-based item `<n>` done and prints a
confirmation, or rejects `<n>` cleanly when it is not a valid index.

## Preconditions
- None — `<n>` is validated against whatever `load()` returns, including an empty list
  (`len(items) == 0` makes every `<n>` out of range).

## Input

```typescript
interface CompleteTodoInput {
  n: string   // raw positional arg, still a string until parsed — PO decision #1: 1-based
}
```

## Steps

```
1. Resolve store path: $TODO_STORE verbatim if set, else os.path.expanduser("~/.todo.json")
2. TodoStoreRepository.load(path) — raises StoreCorruptedError on invalid JSON or non-list root
3. Parse n as an integer; if not parseable → ERR_INVALID_INDEX (non-integer form), no mutation
4. Validate 1 <= n <= len(items); if not → ERR_INVALID_INDEX (out-of-range form), no mutation
5. Set items[n-1].done = true (idempotent if already done)
6. TodoStoreRepository.save(path, items) — atomic write of the FULL item list
7. Print "done #<n>: <text>" to stdout, where <text> is items[n-1].text
8. Exit 0
```

## Output

```typescript
interface CompleteTodoOutput {
  index: number   // the validated 1-based n
  text: string    // the completed item's text
}
```

## System Flow

```
[CLI: bin/todo done <n>]
  → [Dispatch: argparse subcommand "done"]
    → [Use Case: CompleteTodo.execute(n)]
      → [TodoStoreRepository.load() → file: $TODO_STORE or ~/.todo.json]
      → [TodoStoreRepository.save() → same file, atomic — only on valid n]
    ← [stdout: "done #<n>: <text>", exit 0]  OR  [stderr: error, exit 1]
```

## Invariants
- [INV-02] Marking item `<n>` done never mutates any other item's `text` field, and never
  changes the store's item order or count (no item is added or removed by `done`).

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
| TS-INV-02 | process | Seed store with 3 items (positions 1,2,3), run `todo done 2`, read the store file directly | Item 1 and item 3's `text` fields are byte-identical to the seed; item count stays 3, order unchanged; only item 2's `done` flips to `true` | D1: INV-02 |
| TS-ERR-ERR_INVALID_INDEX | process | Seed store with 2 items, run `todo done 9` | exit 1, stderr exactly `error: no item 9 (list has 2 items)` (PO transcript, GATE L1a), store file unchanged | D2 |
| TS-ERR-ERR_CORRUPTED_STORE | process | Seed `$TODO_STORE` with invalid JSON, run `todo done 1` | exit 1, stderr matches `error: corrupted store at .*`, no stack trace | D2 |
| TS-REQ-n-boundary | process | Seed store with 2 items; run `todo done 0`, `todo done 1`, `todo done 2`, `todo done 3`, `todo done abc` | `0`/`3`/`abc` rejected (`ERR_INVALID_INDEX`, exit 1, no write); `1`/`2` accepted (exit 0, item marked done) | D3 + D2 (dedup) |

## Integration Points
- → [[integration#Local-filesystem-store]] — reads and writes the JSON store file
- ← [[ux-behavior#Screen-DoneCommand]] — triggered by the `done` subcommand
