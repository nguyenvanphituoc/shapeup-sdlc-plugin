---
type: ux-spec
feature: todo-cli
entities: [TodoList, TodoItem]
usecases: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
screens: [add, list, done, rm]
tags: [ux, cli]
depends_on: ["[[domain-model]]"]
status: draft
---

# UX Behavior: `todo` CLI

> This feature has no browser/GUI surface (pitch no-go: "No TUI / colors / interactive
> prompts"). "Screen" below means **one CLI subcommand invocation** — stdin args in,
> stdout/stderr + exit code out. States map process lifecycle, not visual states.

## Command Flow

```
$ todo <subcommand> [args]
    │
    ├─ "add <text>"   ──► [add]
    ├─ "list"         ──► [list]
    ├─ "done <n>"     ──► [done]
    ├─ "rm <n>"       ──► [rm]
    └─ (anything else)──► [unknown-command error, exit 1]
```

Every subcommand follows the same lifecycle: `idle` (process starts) → `loading` (store read)
→ `success` (store written/read + stdout printed, exit 0) or `error` (stderr message, exit 1).
There is no `submitting`/CTA concept — the "trigger" is the process invocation itself.

---

## Command: `add <text>`

### States

| State | Trigger | Behavior | Exit code |
|-------|---------|----------|-----------|
| `idle` | process starts | parse argv | — |
| `loading` | args valid | read store (load or empty-on-missing) | — |
| `success` | item appended + store saved | prints confirmation line naming the item | 0 |
| `error` | `<text>` missing/empty, or store corrupted, or write fails | prints one-line message to stderr, no stack trace | 1 |

### Behavior Rules
- [RULE-01] `<text>` is required and, once whitespace-trimmed, must be non-empty.
- [RULE-02] The new item is always appended to the end of the list (insertion order).

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `MISSING_TEXT` | `add` called with no `<text>` argument or only whitespace | "todo add: text is required" | exit 1, no store write |
| `STORE_CORRUPTED` | store file exists but is not valid JSON | "todo: store file is corrupted (<path>) — fix or remove it" | exit 1, no store write |

---

## Command: `list`

### States

| State | Trigger | Behavior | Exit code |
|-------|---------|----------|-----------|
| `idle` | process starts | parse argv (no args expected) | — |
| `loading` | — | read store (load or empty-on-missing) | — |
| `success` (non-empty) | store has ≥1 item | print each item as `[<n>] [x|  ] <text>` (1-based index, `x` if done) | 0 |
| `success` (empty) | store has 0 items | print a sane "no todos yet" line — **not** a blank output, **not** a crash (explicit pitch edge case) | 0 |
| `error` | store corrupted | prints one-line message to stderr, no stack trace | 1 |

### Behavior Rules
- [RULE-03] Display index `<n>` is always the item's 1-based position in the array returned by
  this `list` call — recomputed fresh every invocation (see `[[domain-model#Value-Objects]]`).
- [RULE-04] Empty list is a `success` state with an explicit human-readable message, never an
  empty string and never a non-zero exit.

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `STORE_CORRUPTED` | store file exists but is not valid JSON | "todo: store file is corrupted (<path>) — fix or remove it" | exit 1 |

---

## Command: `done <n>`

### States

| State | Trigger | Behavior | Exit code |
|-------|---------|----------|-----------|
| `idle` | process starts | parse argv | — |
| `loading` | `<n>` present | read store | — |
| `success` | `<n>` resolves to an existing item | mark item done, save store, print confirmation | 0 |
| `error` | `<n>` missing/non-numeric/out-of-range, or store corrupted, or write fails | prints one-line message to stderr, no stack trace | 1 |

### Behavior Rules
- [RULE-05] `<n>` must be a positive integer within `[1, list.length]`; anything else is
  rejected before any store mutation (explicit pitch edge case: "bad index").
- [RULE-06] Marking an already-done item done again is a `success` no-op (idempotent), not an
  error (no-gos: no "un-done" behavior specified, so re-`done` cannot mean "toggle").

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `MISSING_INDEX` | `done` called with no `<n>` argument | "todo done: index is required" | exit 1, no store write |
| `INVALID_INDEX` | `<n>` is not a positive integer (e.g. `abc`, `0`, `-1`, `1.5`) | "todo done: '<n>' is not a valid index" | exit 1, no store write |
| `INDEX_OUT_OF_RANGE` | `<n>` is a positive integer but > current list length (or list is empty) | "todo done: no item at index <n>" | exit 1, no store write |
| `STORE_CORRUPTED` | store file exists but is not valid JSON | "todo: store file is corrupted (<path>) — fix or remove it" | exit 1 |

---

## Command: `rm <n>`

### States

| State | Trigger | Behavior | Exit code |
|-------|---------|----------|-----------|
| `idle` | process starts | parse argv | — |
| `loading` | `<n>` present | read store | — |
| `success` | `<n>` resolves to an existing item | remove item, save store, print confirmation | 0 |
| `error` | `<n>` missing/non-numeric/out-of-range, or store corrupted, or write fails | prints one-line message to stderr, no stack trace | 1 |

### Behavior Rules
- [RULE-07] Same index validation as `done` (`[RULE-05]`).
- [RULE-08] Removing an item shifts all later display indices down by one on the *next*
  `list`/`done`/`rm` call (positional, not stable — see `[[domain-model#Value-Objects]]`).

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `MISSING_INDEX` | `rm` called with no `<n>` argument | "todo rm: index is required" | exit 1, no store write |
| `INVALID_INDEX` | `<n>` is not a positive integer | "todo rm: '<n>' is not a valid index" | exit 1, no store write |
| `INDEX_OUT_OF_RANGE` | `<n>` is a positive integer but > current list length (or list is empty) | "todo rm: no item at index <n>" | exit 1, no store write |
| `STORE_CORRUPTED` | store file exists but is not valid JSON | "todo: store file is corrupted (<path>) — fix or remove it" | exit 1 |

---

## Cross-cutting: unknown subcommand

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `UNKNOWN_COMMAND` | argv[2] is not one of `add\|list\|done\|rm` (including no argv[2] at all) | "todo: unknown command '<cmd>' — usage: todo <add\|list\|done\|rm>" | exit 1 |

---

## Platform Differences

| Behavior | macOS/Linux | Windows |
|---|---|---|
| Store path resolution | `./.todo.json` (cwd-relative, pinned — see `[[_index#Boundaries]]`) | same, path-separator handled by Node `path` module |
