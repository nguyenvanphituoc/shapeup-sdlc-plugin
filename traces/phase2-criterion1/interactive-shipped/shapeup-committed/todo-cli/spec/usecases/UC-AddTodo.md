---
type: usecase
feature: todo-cli
id: UC-AddTodo
bounded_context: todo
actor: Developer
entities: [TodoItem, TodoList]
repositories: [TodoStoreRepository]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: AddTodo

## Summary
Developer runs `todo add "<text>"`, which appends a new not-done item to the store and prints
its 1-based position.

## Preconditions
- None — the store file may not exist yet (`load()` returns `[]` for a missing file).

## Input

```typescript
interface AddTodoInput {
  text: string  // required positional arg; taken verbatim, non-empty enforced by argparse
}
```

## Steps

```
1. Resolve store path: $TODO_STORE verbatim if set, else os.path.expanduser("~/.todo.json")
2. TodoStoreRepository.load(path) — raises StoreCorruptedError on invalid JSON or non-list root
3. Append TodoItem{text, done: false} to the loaded items (order-preserving)
4. TodoStoreRepository.save(path, items) — atomic write of the FULL new item list
5. Print "added #<n>: <text>" to stdout, where n = len(items) after the append (1-based)
6. Exit 0
```

## Output

```typescript
interface AddTodoOutput {
  index: number   // 1-based position of the new item
  text: string    // echoed verbatim
}
```

## System Flow

```
[CLI: bin/todo add "<text>"]
  → [Dispatch: argparse subcommand "add"]
    → [Use Case: AddTodo.execute(text)]
      → [TodoStoreRepository.load() → file: $TODO_STORE or ~/.todo.json]
      → [TodoStoreRepository.save() → same file, atomic]
    ← [stdout: "added #<n>: <text>", exit 0]
```

## Invariants
- [INV-01] A save always persists the FULL current item list — a subsequent `load()` (same
  process or a fresh one) returns exactly what the last `save()` wrote, in the same order, with
  no truncation or loss (round-trip losslessness, spiked in Orient).
- [INV-05] Store-path resolution's fallback branch actually executes: when `$TODO_STORE` is unset
  in the environment (not merely empty), `StorePath` resolves to
  `os.path.expanduser("~/.todo.json")` — never raises, never requires `$TODO_STORE` to be present,
  and never falls through to any third path (domain-model#StorePath's resolution order, second
  half). Filed at GATE L1a.5: every prior Test Surface row across all four use cases seeds
  `$TODO_STORE`, so an implementation reading only `os.environ["TODO_STORE"]` (unguarded) would
  score full conformance while raising `KeyError` for any real user who never set the variable.

## Error Cases

| Error Code | Condition | Exit Code | Handling |
|---|---|---|---|
| `ERR_CORRUPTED_STORE` | store file exists but is invalid JSON, or valid JSON whose root is not a list | 1 | Print `error: corrupted store at <path>` to stderr; no save attempted; no traceback |

## Test Surface
<!-- DERIVED — do not hand-author rows here; regenerate via a retrofit-surface order. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | `todo add "a"` then `todo add "b"` against a fresh `$TODO_STORE`, then read the store file directly | Store contains exactly `[{"text":"a","done":false},{"text":"b","done":false}]` in that order — nothing lost or reordered | D1: INV-01 |
| TS-ERR-ERR_CORRUPTED_STORE | process | Seed `$TODO_STORE` with `not valid json`, run `todo add "x"` | exit 1, stderr matches `error: corrupted store at .*`, no stack trace, store file unchanged | D2 |
| TS-REQ-text-missing | process | Run `todo add` with no `<text>` argument | exit ≠ 0, a single clean usage/error message, no traceback, no write to the store | D3 |
| TS-INV-05 | process | Unset `$TODO_STORE` (`env -u TODO_STORE`), point `$HOME` at a fresh empty tmpdir, run `todo add "x"` | exit 0; the store file is created at `$HOME/.todo.json` — never at the invoking user's real `~/.todo.json` | D1: INV-05 |

## Integration Points
- → [[integration#Local-filesystem-store]] — writes the JSON store file
- ← [[ux-behavior#Screen-AddCommand]] — triggered by the `add` subcommand
