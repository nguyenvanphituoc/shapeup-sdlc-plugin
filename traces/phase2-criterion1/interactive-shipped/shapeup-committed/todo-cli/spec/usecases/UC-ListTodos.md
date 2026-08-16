---
type: usecase
feature: todo-cli
id: UC-ListTodos
bounded_context: todo
actor: Developer
entities: [TodoItem, TodoList]
repositories: [TodoStoreRepository]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: ListTodos

## Summary
Developer runs `todo list`, which prints every item with its 1-based number and done marker,
or a clean empty-state line when the store has no items.

## Preconditions
- None — the store file may not exist yet (`load()` returns `[]` for a missing file, which is
  the same shape as an emptied-out store).

## Input

```typescript
interface ListTodosInput {}   // no arguments
```

## Steps

```
1. Resolve store path: $TODO_STORE verbatim if set, else os.path.expanduser("~/.todo.json")
2. TodoStoreRepository.load(path) — raises StoreCorruptedError on invalid JSON or non-list root
3. If items is empty: print "(no items)" to stdout
4. Else: for each item at 0-based position i, print "<i+1>. [x] <text>" if done else
   "<i+1>. [ ] <text>" — plain text, no color codes
5. Exit 0
```

## Output

```typescript
interface ListTodosOutput {
  lines: string[]   // one rendered line per item, or a single "(no items)" line
}
```

## System Flow

```
[CLI: bin/todo list]
  → [Dispatch: argparse subcommand "list"]
    → [Use Case: ListTodos.execute()]
      → [TodoStoreRepository.load() → file: $TODO_STORE or ~/.todo.json]
    ← [stdout: numbered items or "(no items)", exit 0]
```

## Invariants
- [INV-04] Listing never crashes regardless of item count, including zero — an empty store
  produces a well-formed `success` output (RULE-06), never an unhandled exception or traceback.

## Error Cases

| Error Code | Condition | Exit Code | Handling |
|---|---|---|---|
| `ERR_CORRUPTED_STORE` | store file exists but is invalid JSON, or valid JSON whose root is not a list | 1 | Print `error: corrupted store at <path>` to stderr; no traceback |

## Test Surface
<!-- DERIVED — do not hand-author rows here; regenerate via a retrofit-surface order. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-04 | process | `todo list` against a fresh (non-existent) `$TODO_STORE` path | exit 0, stdout is exactly `(no items)`, no traceback on stderr | D1: INV-04 |
| TS-ERR-ERR_CORRUPTED_STORE | process | Seed `$TODO_STORE` with `{"not": "a list"}` (valid JSON, wrong shape), run `todo list` | exit 1, stderr matches `error: corrupted store at .*`, no stack trace | D2 |
| TS-NOGO-01 | process | Seed store with 2 items, run `todo list`, inspect raw stdout bytes | Output contains no ANSI escape sequences (`\x1b[`) and the process does not attempt to read from stdin (no interactive prompt) — plain text only per Non-Go "no TUI / colors / interactive prompts" | D4 |

## Integration Points
- → [[integration#Local-filesystem-store]] — reads the JSON store file
- ← [[ux-behavior#Screen-ListCommand]] — triggered by the `list` subcommand
