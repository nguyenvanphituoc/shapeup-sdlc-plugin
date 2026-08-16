---
type: ux-spec
feature: todo-cli
entities: [TodoItem]
usecases: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
screens: [add-command, list-command, done-command, rm-command]
tags: [ux, cli, non-ui]
depends_on: ["[[domain-model]]"]
status: draft
---

# UX Behavior: `todo` CLI

> This is a non-UI deliverable — no browser, no screens. "Screen" below is read as "command
> invocation": one shell command in, one stdout/stderr + exit code out. Per the pitch no-go,
> there is no TUI, no color, no interactive prompt — every state below is a single synchronous
> print + exit, nothing to drive with a browser tool.

## Command Flow

```
[shell: todo <cmd> [<arg>]]
    │
    ├─ cmd == "add"  ──► [add-command]  ──► exit 0 (success) | exit 1 (missing text)
    │
    ├─ cmd == "list" ──► [list-command] ──► exit 0 always (empty list is not an error)
    │
    ├─ cmd == "done" ──► [done-command] ──► exit 0 (success) | exit 1 (bad/missing index, corrupted store)
    │
    ├─ cmd == "rm"   ──► [rm-command]   ──► exit 0 (success) | exit 1 (bad/missing index, corrupted store)
    │
    └─ cmd == anything else / missing ──► [usage-error] ──► exit 1, prints usage to stderr
```

**Global convention (pins discovered-seed #3 — exit-code / stderr-vs-stdout):**
- Success path: human-readable confirmation to **stdout**, exit code **0**.
- Any error (bad args, missing text, corrupted store, bad index): message to **stderr**, exit
  code **1**. Never a bare stack trace — every thrown error the store/index layer can produce is
  caught at the command boundary and rendered as one plain-English line.

---

## Command: add-command (`todo add <text>`)

### States

| State | Trigger | Behavior | Exit |
|-------|---------|----------|------|
| `success` | `<text>` present (non-empty after trim) | Appends item, prints `Added: "N) <text>"` to stdout (N = new 1-based position) | 0 |
| `missing-text` | `<text>` omitted or empty/whitespace-only | Prints `Error: missing todo text` to stderr | 1 |
| `store-corrupted` | store file has invalid JSON | Prints corrupted-store message (see Error Catalog), does not write | 1 |

### Behavior Rules
- [RULE-01] The new item is always appended to the end of the array (highest index after add).
- [RULE-02] `<text>` is stored verbatim after trimming leading/trailing whitespace; no length cap.

---

## Command: list-command (`todo list`)

### States

| State | Trigger | Behavior | Exit |
|-------|---------|----------|------|
| `empty` | store has 0 items (including: store file does not exist yet) | Prints `No todos yet.` to stdout | 0 |
| `populated` | store has ≥1 item | Prints one line per item: `N) [ ] <text>` (open) or `N) [x] <text>` (done), 1-based, in store order | 0 |
| `store-corrupted` | store file has invalid JSON | Prints corrupted-store message to stderr | 1 |

### Behavior Rules
- [RULE-03] A missing store file (`ENOENT`) is treated identically to an empty store — never an
  error (spike-confirmed: must not be conflated with `store-corrupted`).
- [RULE-04] Numbering is always recomputed fresh from current array order — it is not a stored id.

---

## Command: done-command (`todo done <n>`)

### States

| State | Trigger | Behavior | Exit |
|-------|---------|----------|------|
| `success` | `<n>` is an integer with `1 <= n <= items.length` | Sets `items[n-1].done = true`, saves, prints `Done: N) <text>` to stdout | 0 |
| `already-done` | item at `n` already has `done: true` | Same as `success` (idempotent) — prints `Done: N) <text>` | 0 |
| `missing-arg` | `<n>` omitted | Prints `Error: missing index` to stderr, store untouched | 1 |
| `not-integer` | `<n>` is present but not a clean integer (e.g. `abc`, `2.5`, `3abc`) | Prints `Error: "<n>" is not a valid index` to stderr, store untouched | 1 |
| `out-of-range` | `<n>` is an integer but `n < 1` or `n > items.length` | Prints `Error: no todo at index <n>` to stderr, store untouched | 1 |
| `store-corrupted` | store file has invalid JSON | Prints corrupted-store message to stderr, store untouched | 1 |

### Behavior Rules
- [RULE-05] Index parsing NEVER uses bare `Number()`/`parseInt()` as the sole check — an
  explicit integer + range check runs first (spike footguns: `Number('')` → `0`,
  `parseInt('3abc')` → `3`).

---

## Command: rm-command (`todo rm <n>`)

### States

| State | Trigger | Behavior | Exit |
|-------|---------|----------|------|
| `success` | `<n>` is an integer with `1 <= n <= items.length` | Removes `items[n-1]`, saves, prints `Removed: N) <text>` to stdout | 0 |
| `missing-arg` | `<n>` omitted | Prints `Error: missing index` to stderr, store untouched | 1 |
| `not-integer` | `<n>` not a clean integer | Prints `Error: "<n>" is not a valid index` to stderr, store untouched | 1 |
| `out-of-range` | `<n>` integer but out of `[1, items.length]` | Prints `Error: no todo at index <n>` to stderr, store untouched | 1 |
| `store-corrupted` | store file has invalid JSON | Prints corrupted-store message to stderr, store untouched | 1 |

### Behavior Rules
- [RULE-06] Removal shifts all subsequent items left by one position — the NEXT `list` reflects
  new numbering; this is expected and not itself an error condition.

---

## Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `E_MISSING_TEXT` | `add` called with no/blank text | `Error: missing todo text` | exit 1, stderr |
| `E_MISSING_INDEX` | `done`/`rm` called with no index | `Error: missing index` | exit 1, stderr |
| `E_INVALID_INDEX` | index arg is not a clean integer | `Error: "<n>" is not a valid index` | exit 1, stderr |
| `E_INDEX_OUT_OF_RANGE` | index integer outside `[1, length]` | `Error: no todo at index <n>` | exit 1, stderr |
| `E_STORE_CORRUPTED` | store file contents fail `JSON.parse` | `Error: todo store is corrupted (~/.todo.json) — fix or delete the file` | exit 1, stderr, no auto-overwrite |
| `E_STORE_WRITE_FAILED` | filesystem write fails (disk full, permissions) | `Error: could not save todo store: <reason>` | exit 1, stderr |
| `E_UNKNOWN_COMMAND` | `argv[2]` is not one of add/list/done/rm | `Error: unknown command "<cmd>". Usage: todo <add\|list\|done\|rm> ...` | exit 1, stderr |

---

## Platform Differences

| Behavior | Mobile | Web |
|---|---|---|
| N/A — CLI only, single platform (any OS with Node.js), no mobile/web surface | — | — |
