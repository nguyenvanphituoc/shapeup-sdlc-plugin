---
type: domain-model
feature: todo-cli
bounded_context: todo
entities: [TodoList, TodoItem]
value_objects: [TodoItemId]
domain_events: [TodoItemAdded, TodoItemCompleted, TodoItemRemoved]
repositories: [TodoStoreRepository]
tags: [ddd, cli]
depends_on: ["[[_index]]"]
status: draft
---

# Domain Model: `todo` CLI

## Bounded Context
`todo` context — owns the single-user, local todo list: creating items, marking them done,
removing them, and persisting the list to a local JSON file. There is no other context in this
feature (no-gos rule out accounts/sync/server, so there is nothing to draw a context boundary
against — a single bounded context is the correct shape here, not an oversight).

---

## Aggregate: TodoList

**Aggregate Root:** `TodoList`

**Invariants:**
- [INV-01] Every `TodoItem.id` in a `TodoList` is unique and is never reused, even after the
  item is removed (an internal monotonic counter assigns ids; removal does not recycle them).
- [INV-02] A `TodoList` loaded from a missing store file behaves as an empty list — it never
  throws and never fabricates items.
- [INV-03] A `TodoList` loaded from a corrupted (unparseable) store file is rejected with a
  distinct, catchable error — it is never silently treated as an empty list and never
  partially parsed into a malformed in-memory state.

```
TodoList (Aggregate Root)
├── items: TodoItem[] (Entity, owned by root, insertion order = display order)
└── nextId: number (internal counter, persisted alongside items)

TodoItem (Entity, child of TodoList)
├── id: TodoItemId (VO)
├── text: string (non-empty, trimmed)
└── done: boolean
```

**State Transitions (per `TodoItem`):**
```
not-added ──add()──► pending ──complete()──► done
                         │
                     remove()
                         │
                         ▼
                     (removed from list)
```

`done` items can still be `remove()`d; `complete()` on an already-`done` item is idempotent
(stays `done`, no error) — there is no "un-done" transition in this pitch (no-gos: no
undo/toggle command specified).

---

## Value Objects

| Value Object | Fields | Invariants |
|---|---|---|
| `TodoItemId` | value: integer ≥ 1 | Assigned by `TodoList`'s internal counter at `add()` time; monotonic, never reused, never assigned by the caller |

**Display index vs. id (pinned decision — see `[[_index#Boundaries]]` open-decision note):**
The CLI's `done <n>` / `rm <n>` argument `<n>` is a **1-based display index** — the item's
position in the array returned by the current `list` render, not `TodoItemId`. It is
recomputed fresh on every process invocation (the CLI is single-shot, no long-lived session),
so "positions shift after `rm`" is expected and matches how `list` is re-run to see current
numbering. `TodoItemId` still exists internally (never reused, per INV-01) so a future
non-positional addressing scheme has a stable id to switch to without a data migration.

---

## Domain Events

| Event | Emitted When | Payload Fields | Consumers |
|---|---|---|---|
| `TodoItemAdded` | `add()` succeeds | id, text | none — single-process CLI, no other context subscribes; recorded for traceability only |
| `TodoItemCompleted` | `complete()` succeeds | id | none |
| `TodoItemRemoved` | `remove()` succeeds | id | none |

These events are conceptual (domain-model traceability, per the DDD pattern this feature's
lens uses) — the CLI is a single process with no event bus. No task exists to "publish" them;
implementation tasks note the state transition happened via the store write instead.

---

## Repository Interfaces

```typescript
interface TodoStoreRepository {
  load(): Promise<TodoList>          // never throws on missing file — returns empty TodoList
                                      // throws StoreCorruptedError on unparseable file content
  save(list: TodoList): Promise<void> // atomic write (temp file + rename); throws StoreWriteError on failure
}
```

## Related
- [[usecases/_index]] — use cases that operate on this aggregate
- [[contracts/todo-store.contract.md]] — exact on-disk JSON shape + error handling
