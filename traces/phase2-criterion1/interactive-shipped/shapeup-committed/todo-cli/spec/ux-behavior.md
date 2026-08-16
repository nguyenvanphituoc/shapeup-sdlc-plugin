---
type: ux-spec
feature: todo-cli
entities: [TodoItem, TodoList]
usecases: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
screens: [AddCommand, ListCommand, DoneCommand, RemoveCommand]
tags: [ux, cli, non-ui]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX Behavior: `todo` CLI

> No graphical UI — Non-Go rules out TUI/colors/interactive prompts. Each "Screen" below is a
> subcommand's **output contract**: exact stdout/stderr shape and exit code, the CLI equivalent
> of a screen's states. All output is plain text (no ANSI), so it stays assertable by a test
> harness. Oracle for every use case is `process` (spawn + exit code + stdout/stderr), never `ui`.

## Screen Flow

```
$ todo <subcommand> [args]
        │
        ▼
  resolve store path ($TODO_STORE or ~/.todo.json)
        │
        ▼
  load() ──corrupted──► [ErrorOutput: corrupted store] ──exit 1
        │
      clean
        │
   ┌────┼─────────┬─────────────┐
   ▼    ▼          ▼             ▼
 [Add] [List]   [Done <n>]   [Rm <n>]
   │    │          │  │          │  │
   │    │        valid invalid valid invalid
   │    │          │  │          │  │
   ▼    ▼          ▼  ▼          ▼  ▼
 save  print   save+print  [ErrorOutput: bad index] ──exit 1
 +confirm  items(or "(no items)")
 exit 0  exit 0   exit 0
```

---

## Screen: AddCommand

### States

| State | Trigger | Output | Exit |
|-------|---------|--------|------|
| `success` | `todo add "<text>"`, store loads clean | stdout: `added #<n>: <text>` (n = new 1-based position) | 0 |
| `error-corrupted-store` | store file exists, invalid JSON or non-list root | stderr: `error: corrupted store at <path>` | 1 |

### Behavior Rules
- [RULE-01] `<text>` is required and taken verbatim (no trimming, no length cap) — argparse
  enforces presence; a missing `<text>` is the CLI transport's own usage error, not a domain
  error code.
- [RULE-02] The new item is always appended at the end — its display index is `len(items)`
  after the append (1-based).
- [RULE-03] No output is written to stdout before the save succeeds — a save failure must not
  print a false confirmation.

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `ERR_CORRUPTED_STORE` | store file exists but fails to parse as a JSON list | `error: corrupted store at <path>` | none — CLI exits 1, no write attempted |

---

## Screen: ListCommand

### States

| State | Trigger | Output | Exit |
|-------|---------|--------|------|
| `success-populated` | `todo list`, ≥1 item | one line per item, 1-based: `1. [ ] ship it` | 0 |
| `success-empty` | `todo list`, 0 items (fresh or emptied store) | stdout: `(no items)` | 0 |
| `error-corrupted-store` | store file exists, invalid JSON or non-list root | stderr: `error: corrupted store at <path>` | 1 |

### Behavior Rules
- [RULE-04] Numbering is exactly 1-based, in store order: `1. [ ] ship it` / `2. [x] write the spec`
  (verbatim PO example, GATE L1a decision #1).
- [RULE-05] Done marker is `[x]` when `done: true`, `[ ]` otherwise — no other glyph, no color.
- [RULE-06] An empty list is a `success` state, not an error — never a crash, never a traceback.

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `ERR_CORRUPTED_STORE` | store file exists but fails to parse as a JSON list | `error: corrupted store at <path>` | none — CLI exits 1 |

---

## Screen: DoneCommand

### States

| State | Trigger | Output | Exit |
|-------|---------|--------|------|
| `success` | `todo done <n>`, `1 ≤ n ≤ len(items)` | stdout: `done #<n>: <text>` (PO example) | 0 |
| `error-invalid-index` | `<n>` non-integer or out of `[1, len(items)]` | stderr: single-line error (see catalog) | 1 |
| `error-corrupted-store` | store file exists, invalid JSON or non-list root | stderr: `error: corrupted store at <path>` | 1 |

### Behavior Rules
- [RULE-07] Index validation happens BEFORE any mutation — a rejected `<n>` leaves the store
  byte-for-byte unchanged (no save call at all).
- [RULE-08] Marking an already-done item done again is idempotent success (still prints
  `done #<n>: <text>`, still exits 0) — no separate "already done" state in this appetite.

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `ERR_INVALID_INDEX` | `<n>` is not a valid non-negative integer | `error: invalid item number '<n>'` | none — exit 1, no write |
| `ERR_INVALID_INDEX` | `<n>` is an integer but `< 1` or `> len(items)` | `error: no item <n> (list has <k> items)` (PO example) | none — exit 1, no write |
| `ERR_CORRUPTED_STORE` | store file exists but fails to parse as a JSON list | `error: corrupted store at <path>` | none — exit 1 |

---

## Screen: RemoveCommand

### States

| State | Trigger | Output | Exit |
|-------|---------|--------|------|
| `success` | `todo rm <n>`, `1 ≤ n ≤ len(items)` | stdout: `removed #<n>: <text>` (text of the removed item) | 0 |
| `error-invalid-index` | `<n>` non-integer or out of `[1, len(items)]` | stderr: single-line error (same format as DoneCommand) | 1 |
| `error-corrupted-store` | store file exists, invalid JSON or non-list root | stderr: `error: corrupted store at <path>` | 1 |

### Behavior Rules
- [RULE-09] Removal re-numbers every later item down by one on the NEXT `list`/`done`/`rm` —
  the store holds no gaps; display index is always recomputed from current store order.
- [RULE-10] Index validation happens BEFORE any mutation (same as DoneCommand RULE-07).

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `ERR_INVALID_INDEX` | `<n>` is not a valid non-negative integer | `error: invalid item number '<n>'` | none — exit 1, no write |
| `ERR_INVALID_INDEX` | `<n>` is an integer but `< 1` or `> len(items)` | `error: no item <n> (list has <k> items)` | none — exit 1, no write |
| `ERR_CORRUPTED_STORE` | store file exists but fails to parse as a JSON list | `error: corrupted store at <path>` | none — exit 1 |

---

## Platform Differences

| Behavior | Mobile | Web |
|---|---|---|
| — | N/A — CLI-only deliverable, no mobile or web surface (Non-Go) | N/A |
