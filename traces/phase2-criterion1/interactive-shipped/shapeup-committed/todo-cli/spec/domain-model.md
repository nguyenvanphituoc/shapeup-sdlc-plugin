---
type: domain-model
feature: todo-cli
bounded_context: todo
entities: [TodoItem, TodoList]
value_objects: [StorePath]
domain_events: []
repositories: [TodoStoreRepository]
tags: [ddd, stdlib-only]
depends_on: ["[[_index]]"]
status: ready
---

# Domain Model: `todo` CLI

## Bounded Context
`todo` context — owns the single JSON-backed todo list a developer keeps on one machine: item
text, done state, and the store file's location and integrity. Does NOT own: process
argument parsing (CLI transport, see [[ux-behavior]]), any notion of multiple lists, users, or
sync (explicitly Non-Go in [[_index#Non-Go]]).

---

## Aggregate: TodoList

**Aggregate Root:** `TodoList`

**Invariants:**
- A save always persists the FULL current item set — no partial writes (spiked: atomic
  `tempfile.mkstemp` + `os.replace` — see Orient's `spike-store-persistence.md`).
- Item order is stable and matches display/index order: item `i` in the loaded list is always
  displayed and addressed as `<n> = i + 1`.
- Marking one item done, or removing one item, never mutates any other item's `text` field.

```
TodoList (Aggregate Root — one per store file, no separate id; the file path IS the identity)
├── path: StorePath (VO)
└── items: TodoItem[] (Entity, owned by root, order-significant)
    ├── text: string (non-empty; enforced by the CLI's required positional arg, not re-validated)
    └── done: boolean
```

**State Transitions (per item):**
```
[not-done] ──done <n>──► [done]
[not-done|done] ──rm <n>──► [removed — index of every later item shifts down by 1]
```

---

## Value Objects

| Value Object | Fields | Invariants |
|---|---|---|
| `StorePath` | value: string (absolute path) | Resolution order is exactly: `$TODO_STORE` verbatim when set; else `os.path.expanduser("~/.todo.json")`. No third path branch (XDG explicitly declined, PO decision #2). |

---

## Domain Events

| Event | Emitted When | Payload Fields | Consumers |
|---|---|---|---|
| — | — | — | None — a synchronous, single-process CLI has no event bus in this appetite's scope; every state change is observed via the command's own exit code + stdout. |

---

## Repository Interfaces

```typescript
interface TodoStoreRepository {
  // Returns [] when the store file does not exist yet. Throws StoreCorruptedError when the
  // file exists but is not parseable JSON, or is valid JSON whose root is not an array.
  // Never returns null; never lets a JSONDecodeError/ValueError escape uncaught.
  load(path: StorePath): TodoItem[]

  // Overwrites the FULL item list atomically (tempfile + os.replace) — a crash mid-write
  // leaves the pre-existing file untouched, never half-written.
  save(path: StorePath, items: TodoItem[]): void
}
```

Error type: `StoreCorruptedError` — the single domain error both "invalid JSON" and "valid
JSON, wrong-shape root" raise (PO decision #3: one error path, not two). See
[[contracts/todo-store.contract.md]] for the full error/recovery table.

---

## Related
- [[ux-behavior]] — command output states map to `TodoList`/`TodoItem` state
- [[usecases/_index]] — the four use cases that operate on this aggregate
- [[contracts/todo-store.contract.md]] — exact storage shape and error table for `TodoStoreRepository`
