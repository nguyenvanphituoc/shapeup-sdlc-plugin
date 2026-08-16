---
type: usecase
feature: todo-cli
id: UC-ListTodos
bounded_context: todo-list
actor: Developer
entities: [TodoItem]
repositories: [TodoRepository]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: List Todos

## Summary
A Developer runs `todo list` which prints every stored item, open and done, 1-based numbered,
or a friendly empty-list message.

## Preconditions
- None — works whether or not `~/.todo.json` exists yet.

## Input

```typescript
interface ListTodosInput {}   // no arguments consumed
```

## Steps

```
1. Load current items via TodoRepository.load() — ENOENT resolves to [] per contract,
   SyntaxError resolves to E_STORE_CORRUPTED (abort).
2. If items.length === 0 → print "No todos yet." to stdout, return success.
3. Otherwise, for each item at 0-based index i: print `${i+1}) [${item.done ? "x" : " "}] ${item.text}`.
4. Return success output (no store mutation — list never writes).
```

## Output

```typescript
interface ListTodosOutput {
  ok: true
  count: number
}
// or on failure: { ok: false, code: "E_STORE_CORRUPTED", message: string }
```

## System Flow

```
[Shell: `todo list`]
  → [bin/todo.js dispatcher: argv[2] === "list"]
    → [Use Case: ListTodos.execute()]
      → [TodoRepository.load() → ~/.todo.json]
    ← [stdout: one line per item, or "No todos yet.", exit 0]
```

## Invariants
- [INV-03] `list` never mutates `~/.todo.json` — it is read-only under all inputs, including a
  corrupted store.
- [INV-04] A missing store file (`ENOENT`) is displayed identically to an existing store with
  zero items — both print "No todos yet." with exit 0, never treated as an error.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `E_STORE_CORRUPTED` | store file exists but fails `JSON.parse` | n/a (process exit 1) | stderr message per [[ux-behavior#Error-Catalog]], exit 1 |

## Test Surface

<!-- DERIVED — regenerate via a retrofit-surface order; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-03 | process | Write valid JSON to `~/.todo.json`, run `todo list`, then re-read the file | File content unchanged after `list` | D1: INV-03 |
| TS-INV-03b | process | Write invalid JSON to `~/.todo.json`, run `todo list` (which fails), then re-read the file | File content unchanged after the failed `list` | D1: INV-03 |
| TS-INV-04 | process | Ensure `~/.todo.json` does not exist, run `todo list` | stdout `No todos yet.`, exit code 0 (not treated as an error) | D1: INV-04 |
| TS-ERR-E_STORE_CORRUPTED | process | Write invalid JSON to `~/.todo.json`, then run `todo list` | stderr contains corrupted-store message, exit code 1 | D2 |
| TS-NOGO-02 | process | Run `todo list` with items present and inspect stdout bytes | Output is plain text only — no ANSI color escape codes, no interactive cursor control sequences | D4 |

## Integration Points
- → [[integration#Filesystem]] — reads `~/.todo.json`
- ← [[ux-behavior#list-command]] — triggered by the `list` subcommand
