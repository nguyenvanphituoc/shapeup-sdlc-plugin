---
type: usecase
feature: todo-cli
id: UC-RemoveTodo
bounded_context: todo-list
actor: Developer
entities: [TodoItem]
repositories: [TodoRepository]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: Remove Todo

## Summary
A Developer runs `todo rm <n>` which permanently removes the item at 1-based position `n` from
the store.

## Preconditions
- The store may or may not exist; if it exists it must parse as valid JSON for this use case to
  proceed past the load step.

## Input

```typescript
interface RemoveTodoInput {
  index: string | undefined   // argv[3], raw string — see [[ux-behavior#rm-command]]
}
```

## Steps

```
1. Read raw `index` string from argv[3].
2. If `index` is undefined → return E_MISSING_INDEX (no store access).
3. Parse `index` as a strict integer (same rule as UC-CompleteTodo Step 3 — no bare coercion)
   → on failure return E_INVALID_INDEX.
4. Load current items via TodoRepository.load() — SyntaxError resolves to E_STORE_CORRUPTED (abort).
5. If parsed index < 1 or > items.length → return E_INDEX_OUT_OF_RANGE (no mutation).
6. Remove items[index-1] from the array (splice), remaining items shift left.
7. TodoRepository.save(items) — E_STORE_WRITE_FAILED aborts with no partial write.
8. Return success output with the removed item's text.
```

## Output

```typescript
interface RemoveTodoOutput {
  ok: true
  position: number     // the position that was removed
  text: string          // the removed item's text
}
// or on failure: { ok: false, code: "E_MISSING_INDEX" | "E_INVALID_INDEX" | "E_INDEX_OUT_OF_RANGE" | "E_STORE_CORRUPTED" | "E_STORE_WRITE_FAILED", message: string }
```

## System Flow

```
[Shell: `todo rm 2`]
  → [bin/todo.js dispatcher: argv[2] === "rm"]
    → [Use Case: RemoveTodo.execute(argv[3])]
      → [TodoRepository.load() → ~/.todo.json]
      → [TodoRepository.save(items) → ~/.todo.json]
    ← [stdout: `Removed: "2) buy milk"`, exit 0]
```

## Invariants
- [INV-07] A failed `rm` (missing/invalid/out-of-range index, corrupted store, write failure)
  never mutates `~/.todo.json` — remaining items keep their original text and order.
- [INV-08] Removing item `n` shifts all items after `n` left by exactly one position and leaves
  all items before `n` untouched — no item's `text`/`done` value is altered by a `rm`, only its
  position.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `E_MISSING_INDEX` | index argument omitted | n/a (process exit 1) | stderr message, exit 1, no store access attempted |
| `E_INVALID_INDEX` | index present but not a clean integer | n/a (process exit 1) | stderr message, exit 1, no mutation |
| `E_INDEX_OUT_OF_RANGE` | index is an integer but `< 1` or `> items.length` | n/a (process exit 1) | stderr message, exit 1, no mutation |
| `E_STORE_CORRUPTED` | store file exists but fails `JSON.parse` | n/a (process exit 1) | stderr message, exit 1, file untouched |
| `E_STORE_WRITE_FAILED` | filesystem write fails after successful load + mutation in memory | n/a (process exit 1) | stderr message, exit 1, prior file contents preserved |

## Test Surface

<!-- DERIVED — regenerate via a retrofit-surface order; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-07 | process | With one item in the store, run `todo rm 99` (out of range) and re-read the file | File content unchanged after the rejected attempt | D1: INV-07 |
| TS-INV-08 | process | With a 3-item store `[A, B, C]`, run `todo rm 2` then `todo list` | Result is `[A, C]` in that order, both re-numbered 1 and 2, neither `A` nor `C` text altered | D1: INV-08 |
| TS-ERR-E_MISSING_INDEX | process | Run `todo rm` with no index argument | stderr contains missing-index message, exit code 1, store unchanged | D2 |
| TS-ERR-E_INVALID_INDEX | process | Run `todo rm abc` against a non-empty store | stderr contains invalid-index message, exit code 1, store unchanged | D2 |
| TS-ERR-E_INDEX_OUT_OF_RANGE | process | Run `todo rm 0` and `todo rm <length+1>` against a non-empty store | Both rejected with out-of-range message, exit code 1, store unchanged | D2 |
| TS-ERR-E_STORE_CORRUPTED | process | Write invalid JSON to `~/.todo.json`, run `todo rm 1` | stderr contains corrupted-store message, exit code 1 | D2 |
| TS-REQ-index-missing | process | Omit `<n>` entirely (`todo rm`) | Rejected as E_MISSING_INDEX (dedup with TS-ERR-E_MISSING_INDEX) | D3 + D2 (dedup) |
| TS-REQ-index-boundary | process | With a 3-item store: `todo rm 0`, `todo rm 4` vs `todo rm 1`, `todo rm 3` (on separate fixtures) | `0` and `4` rejected out-of-range; `1` and `3` (min/max valid edges) accepted | D3 |
| TS-NOGO-04 | process | Run `todo rm 1` and check for any confirmation prompt before deletion | No interactive "are you sure?" prompt — removal is immediate per the no-interactive-prompts no-go | D4 |

## Integration Points
- → [[integration#Filesystem]] — reads and writes `~/.todo.json`
- ← [[ux-behavior#rm-command]] — triggered by the `rm` subcommand
