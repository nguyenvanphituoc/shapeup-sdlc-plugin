---
type: usecase
feature: todo-cli
id: UC-AddTodo
bounded_context: todo-list
actor: Developer
entities: [TodoItem]
repositories: [TodoRepository]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: Add Todo

## Summary
A Developer runs `todo add <text>` which appends a new open item to the store and prints its
new 1-based position.

## Preconditions
- None — `add` works on a fresh (missing) store exactly like an existing one.

## Input

```typescript
interface AddTodoInput {
  text: string | undefined   // argv[3], may be missing/empty — see [[ux-behavior#add-command]]
}
```

## Steps

```
1. Read `text` from argv[3].
2. Trim `text`; if undefined or empty after trim → return E_MISSING_TEXT (no store access).
3. Load current items via TodoRepository.load() — ENOENT resolves to [] per contract,
   SyntaxError resolves to E_STORE_CORRUPTED (abort, do not write).
4. Append { text: <trimmed>, done: false } to the items array.
5. TodoRepository.save(items) — E_STORE_WRITE_FAILED aborts with no partial write.
6. Return success output with the new item's 1-based position (items.length after append).
```

## Output

```typescript
interface AddTodoOutput {
  ok: true
  position: number       // 1-based index of the newly added item
  text: string
}
// or on failure: { ok: false, code: "E_MISSING_TEXT" | "E_STORE_CORRUPTED" | "E_STORE_WRITE_FAILED", message: string }
```

## System Flow

```
[Shell: `todo add "buy milk"`]
  → [bin/todo.js dispatcher: argv[2] === "add"]
    → [Use Case: AddTodo.execute(argv[3])]
      → [TodoRepository.load() → ~/.todo.json]
      → [TodoRepository.save(items) → ~/.todo.json]
    ← [stdout: `Added: "N) buy milk"`, exit 0]
```

## Invariants
- [INV-01] A failed `add` (missing text, corrupted store, write failure) never mutates
  `~/.todo.json` — the file after a failed `add` is byte-identical to before.
- [INV-02] `add` never overwrites or reorders existing items — it only appends.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `E_MISSING_TEXT` | `text` argument is missing or empty/whitespace-only after trim | n/a (process exit 1) | stderr message, exit 1, no store access attempted |
| `E_STORE_CORRUPTED` | store file exists but fails `JSON.parse` | n/a (process exit 1) | stderr message per [[ux-behavior#Error-Catalog]], exit 1, file untouched |
| `E_STORE_WRITE_FAILED` | filesystem write fails after successful load | n/a (process exit 1) | stderr message, exit 1, prior file contents preserved |

## Test Surface

<!-- DERIVED — regenerate via a retrofit-surface order; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | Run `todo add` with a store file present, then force a write failure (e.g. read-only target) and inspect the file before/after | File content unchanged byte-for-byte after the failed attempt | D1: INV-01 |
| TS-INV-02 | process | `todo add "first"` then `todo add "second"`, then `todo list` | Items appear in the order added, `first` before `second`, no reordering | D1: INV-02 |
| TS-ERR-E_MISSING_TEXT | process | Run `todo add` with no text argument | stderr contains missing-text message, exit code 1, store file unchanged | D2 |
| TS-ERR-E_STORE_CORRUPTED | process | Write invalid JSON to `~/.todo.json`, then run `todo add "x"` | stderr contains corrupted-store message, exit code 1, corrupted file left as-is (no auto-overwrite) | D2 |
| TS-REQ-text-missing | process | Omit `<text>` entirely (`todo add`) | Rejected as E_MISSING_TEXT, no side effect (dedup with TS-ERR-E_MISSING_TEXT) | D3 + D2 (dedup) |
| TS-NOGO-01 | process | Attempt to run `todo add` interactively expecting a prompt (no args, check for any stdin read) | No interactive prompt is issued — process exits 1 immediately on missing text, does not block waiting for stdin | D4 |

## Integration Points
- → [[integration#Filesystem]] — writes to `~/.todo.json`
- ← [[ux-behavior#add-command]] — triggered by the `add` subcommand
