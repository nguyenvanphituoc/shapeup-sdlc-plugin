---
type: repository-contract
source_type: offline-storage
feature: "todo-cli"
repository: "TodoStoreRepository"
engine: "Node core `fs` (JSON file), no dependency"
schema_ref: "[[domain-model#Aggregate-TodoList]]"
migration_version: "v001"
status: confirmed
skill_version: "2.3"
---

# Repository Contract — TodoStoreRepository

## Source Type: `offline-storage`
## Engine: Node core `fs` — JSON file at `./.todo.json` (cwd-relative, pinned decision — see `[[_index#Boundaries]]`)
## Schema Ref: [[domain-model#Aggregate-TodoList]]
## Migration Version: `v001` — no prior version exists (greenfield)

De-risked by `.shapeup/todo-cli/orient/spike-persistence.md` — the three probes below are
confirmed against real Node `fs`/`JSON.parse` on this machine (darwin, node v24.15.0), not
speculative.

---

## Storage Schema

### File: `./.todo.json`

Single JSON object, not an array at the top level (so `nextId` can be persisted alongside the
items without a second file):

```json
{
  "nextId": 3,
  "items": [
    { "id": 1, "text": "Buy milk", "done": false },
    { "id": 2, "text": "Write pitch", "done": true }
  ]
}
```

| Field | Type | Constraint | Migration | Notes |
|-------|------|-----------|-----------|-------|
| `nextId` | integer | ≥ 1 | v001 | monotonic counter, never decreases, survives item removal |
| `items` | array | may be `[]` | v001 | insertion order = display order |
| `items[].id` | integer | ≥ 1, unique within file | v001 | assigned once at `add()`, never reused (INV-01) |
| `items[].text` | string | non-empty after trim | v001 | |
| `items[].done` | boolean | — | v001 | |

---

## Method: `save(list: TodoList)` (Write)

### Write Input

| Field | Type | Required | Source |
|-------|------|----------|--------|
| `nextId` | number | ✓ | domain.TodoList.nextId |
| `items` | array | ✓ (may be empty) | domain.TodoList.items |

### Write Output

`void` — throws on failure, never returns a partial-success value.

### Error Cases

| Condition | Error Type | Recovery |
|-----------|-----------|---------|
| Write to temp file fails (e.g. disk full, no permission) | `StoreWriteError` | surface as `error` state per `[[ux-behavior]]`; original store file is untouched (temp-file-then-rename never touched the real path) |
| `fs.renameSync` fails after temp write succeeded | `StoreWriteError` | surface as `error` state; original store file is untouched — the rename is the only step that mutates the real path, and it is atomic (spike probe 3) |

**Write procedure (confirmed by spike-persistence.md probe 3):** `fs.writeFileSync('./.todo.json.tmp', JSON.stringify({nextId, items}))` then `fs.renameSync('./.todo.json.tmp', './.todo.json')` — never `fs.writeFileSync` directly on the real path, so a process kill mid-write cannot leave a half-written store.

---

## Method: `load()` (Read)

### Read Output

| Field | Type | Null Behavior |
|-------|------|--------------|
| `TodoList` | object `{ nextId, items }` | never `null` — missing file resolves to `{ nextId: 1, items: [] }` (INV-02) |

### Error Cases

| Condition | Error Type | Recovery |
|-----------|-----------|---------|
| File does not exist (`err.code === 'ENOENT'`, confirmed spike probe 2) | none — returns empty `TodoList` `{ nextId: 1, items: [] }` | caller proceeds as first-run |
| File exists but `JSON.parse` throws `SyntaxError` (confirmed spike probe 1) | `StoreCorruptedError` | caller surfaces `STORE_CORRUPTED` per `[[ux-behavior]]` error catalog; **never** silently falls back to an empty list — a corrupted file is not the same case as a missing one (INV-03) |
| File exists, parses, but shape doesn't match (`items` not an array, or an item missing `id`/`text`) | `StoreCorruptedError` | same handling as parse failure — a shape violation is still "corrupted" from the caller's perspective |

---

## Conflict Strategy: `last-write-wins` (accepted, non-blocking residual unknown)

Two concurrent `todo` processes racing to `save()` will have the second `rename()` win —
no merge, no lock. Explicitly accepted out of scope per `spike-persistence.md`: the pitch has
no concurrency requirement and no-gos exclude server/sync.

## Migration Runbook

No migration needed — this is the `v001` initial schema for a greenfield feature. A future
schema change adds a `migration_version` bump here and a documented upgrade path in this file
before any code changes it.
