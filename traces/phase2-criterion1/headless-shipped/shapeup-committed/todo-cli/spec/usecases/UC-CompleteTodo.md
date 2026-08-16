---
type: usecase
feature: todo-cli
id: UC-CompleteTodo
bounded_context: todo-list
actor: Developer
entities: [TodoItem]
repositories: [TodoRepository]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: Complete Todo

## Summary
A Developer runs `todo done <n>` which marks the item at 1-based position `n` as done
(idempotently) and persists the change.

## Preconditions
- The store may or may not exist; if it exists it must parse as valid JSON for this use case to
  proceed past the load step.

## Input

```typescript
interface CompleteTodoInput {
  index: string | undefined   // argv[3], raw string — see [[ux-behavior#done-command]]
}
```

## Steps

```
1. Read raw `index` string from argv[3].
2. If `index` is undefined → return E_MISSING_INDEX (no store access).
3. Parse `index` as a strict integer (reject non-integer strings, trailing garbage, empty
   string, decimals — do NOT rely on bare Number()/parseInt() coercion, see
   [[domain-model#Value-Objects]] TodoIndex rule) → on failure return E_INVALID_INDEX.
4. Load current items via TodoRepository.load() — SyntaxError resolves to E_STORE_CORRUPTED (abort).
5. If parsed index < 1 or > items.length → return E_INDEX_OUT_OF_RANGE (no mutation).
6. Set items[index-1].done = true (no-op if already true).
7. TodoRepository.save(items) — E_STORE_WRITE_FAILED aborts with no partial write.
8. Return success output.
```

## Output

```typescript
interface CompleteTodoOutput {
  ok: true
  position: number
  text: string
}
// or on failure: { ok: false, code: "E_MISSING_INDEX" | "E_INVALID_INDEX" | "E_INDEX_OUT_OF_RANGE" | "E_STORE_CORRUPTED" | "E_STORE_WRITE_FAILED", message: string }
```

## System Flow

```
[Shell: `todo done 2`]
  → [bin/todo.js dispatcher: argv[2] === "done"]
    → [Use Case: CompleteTodo.execute(argv[3])]
      → [TodoRepository.load() → ~/.todo.json]
      → [TodoRepository.save(items) → ~/.todo.json]
    ← [stdout: `Done: "2) buy milk"`, exit 0]
```

## Invariants
- [INV-05] A failed `done` (missing/invalid/out-of-range index, corrupted store, write failure)
  never mutates `~/.todo.json`.
- [INV-06] `done` is idempotent — calling it twice on the same index with no `add`/`rm` in
  between produces the same final state (`done: true`) and the same success output both times,
  never an error on the second call.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `E_MISSING_INDEX` | index argument omitted | n/a (process exit 1) | stderr message, exit 1, no store access attempted |
| `E_INVALID_INDEX` | index present but not a clean integer (`abc`, `2.5`, `3abc`, empty string) | n/a (process exit 1) | stderr message, exit 1, no mutation |
| `E_INDEX_OUT_OF_RANGE` | index is an integer but `< 1` or `> items.length` | n/a (process exit 1) | stderr message, exit 1, no mutation |
| `E_STORE_CORRUPTED` | store file exists but fails `JSON.parse` | n/a (process exit 1) | stderr message, exit 1, file untouched |
| `E_STORE_WRITE_FAILED` | filesystem write fails after successful load + mutation in memory | n/a (process exit 1) | stderr message, exit 1, prior file contents preserved |

## Test Surface

<!-- DERIVED — regenerate via a retrofit-surface order; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-05 | process | With one item in the store, run `todo done 99` (out of range) and re-read the file | File content unchanged after the rejected attempt | D1: INV-05 |
| TS-INV-06 | process | With one item in the store, run `todo done 1` twice in a row | Both invocations exit 0 with the same success message; item remains `done: true` after both | D1: INV-06 |
| TS-ERR-E_MISSING_INDEX | process | Run `todo done` with no index argument | stderr contains missing-index message, exit code 1, store unchanged | D2 |
| TS-ERR-E_INVALID_INDEX | process | Run `todo done abc` against a non-empty store | stderr contains invalid-index message, exit code 1, store unchanged | D2 |
| TS-ERR-E_INDEX_OUT_OF_RANGE | process | Run `todo done 0` and `todo done <length+1>` against a non-empty store | Both rejected with out-of-range message, exit code 1, store unchanged | D2 |
| TS-ERR-E_STORE_CORRUPTED | process | Write invalid JSON to `~/.todo.json`, run `todo done 1` | stderr contains corrupted-store message, exit code 1 | D2 |
| TS-REQ-index-missing | process | Omit `<n>` entirely (`todo done`) | Rejected as E_MISSING_INDEX (dedup with TS-ERR-E_MISSING_INDEX) | D3 + D2 (dedup) |
| TS-REQ-index-boundary | process | With a 3-item store: `todo done 0`, `todo done 1`, `todo done 3`, `todo done 4` | `0` and `4` rejected out-of-range; `1` and `3` (the min/max valid edges) accepted | D3 |
| TS-NOGO-03 | process | Run `todo done` with a missing index and check for any interactive re-prompt | Process exits 1 immediately — no interactive prompt asking the user to supply the index | D4 |

## Integration Points
- → [[integration#Filesystem]] — reads and writes `~/.todo.json`
- ← [[ux-behavior#done-command]] — triggered by the `done` subcommand
