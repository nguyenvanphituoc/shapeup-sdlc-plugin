---
type: domain-model
feature: todo-cli
bounded_context: todo-list
entities: [TodoItem]
value_objects: [TodoIndex, TodoText]
domain_events: []
repositories: [TodoRepository]
tags: [ddd, cli]
depends_on: ["[[_index]]"]
status: draft
---

# Domain Model: `todo` CLI

## Bounded Context
`todo-list` context — owns capture, listing, completion, and removal of a single developer's
short-lived todo items, persisted to one local file. It does NOT own sync, multi-user sharing,
accounts, or scheduling — those are explicit pitch no-gos and out of this context entirely.

**Decision (pins discovered-seed #1 — store location):** the store lives at `~/.todo.json`
(the user's home directory), not cwd-relative. Rationale: the pitch calls this "zero-config" —
a cwd-relative file means the *same* command run from two directories silently edits two
different lists, which contradicts "zero-config" more than a fixed, predictable path does. One
global list per machine user is the simpler mental model and is what `[[contracts/todo-repository.contract]]`
implements.

---

## Aggregate: TodoStore

**Aggregate Root:** `TodoStore`

**Invariants:**
- The store is always a JSON array of `TodoItem` objects (never `null`, never a bare object) —
  an empty list is represented as `[]`, not a missing file.
- `TodoItem` order in the array IS the 1-based display/index convention used by `done <n>` and
  `rm <n>` — there is no separate persisted id field (**decision, pins discovered-seed #4**:
  1-based, array-position identity, re-derived fresh on every `list`/`done`/`rm` invocation).
- A failed `done`/`rm`/`add` operation (bad index, corrupted store, disk error) leaves the
  on-disk store byte-for-byte unchanged — no partial writes.

```
TodoStore (Aggregate Root)
└── items: TodoItem[] (Entity, owned by root, order-significant)
    ├── text: TodoText (VO)
    └── done: boolean (default false)
```

**State Transitions:**
```
(no store file) ──[first add()]──► [store: [item]] ──[add()]──► [store: [item, item]]
                                          │
                                    [done(n)] ──► item.done = true (idempotent — re-done(n) is a no-op success)
                                          │
                                     [rm(n)] ──► item removed, remaining items shift left
```

---

## Value Objects

| Value Object | Fields | Invariants |
|---|---|---|
| `TodoIndex` | value: integer | Must be an integer (no fractional, no leading/trailing junk); must satisfy `1 <= value <= items.length` at the time of use; never derived from `parseInt`/bare `Number()` coercion without an explicit integer + range check (spike-confirmed footguns: `Number('')` → `0`, `parseInt('3abc')` → `3`) |
| `TodoText` | value: string | Must be non-empty after trimming; stored verbatim (no length cap in this cycle — not in the pitch) |

---

## Domain Events

None. This is a single-process, single-invocation CLI with no other context to notify — there is
no event bus, no cross-context consumer. (Explicitly empty per pitch no-gos: no sync, no server.)

---

## Repository Interfaces

```typescript
interface TodoRepository {
  // Reads the store file. ENOENT -> returns [] (fresh install, not an error).
  // Invalid JSON -> throws StoreCorruptedError (never a bare JSON.parse exception).
  load(): Promise<TodoItem[]>

  // Overwrites the store file atomically with the full item list.
  // Throws StoreWriteError on any filesystem failure; never partially writes.
  save(items: TodoItem[]): Promise<void>
}

interface TodoItem {
  text: string
  done: boolean
}
```

See [[contracts/todo-repository.contract]] for the exact on-disk schema, error taxonomy, and
null/empty behavior.

---

## Related
- [[ux-behavior]] — command output states map to load/save outcomes above
- [[usecases/_index]] — use cases that operate on this aggregate
