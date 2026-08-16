---
type: repository-contract
source_type: offline-storage
feature: "todo-cli"
repository: "TodoRepository"
engine: "Node fs (readFileSync/writeFileSync) — flat JSON file"
schema_ref: "[[domain-model#Aggregate-TodoStore]]"
migration_version: "v001"
status: confirmed
skill_version: "2.5"
---

# Repository Contract — TodoRepository

## Source Type: `offline-storage`
## Engine: Node `fs` — flat JSON file, no database, no ORM
## Schema Ref: [[domain-model#Aggregate-TodoStore]]
## Migration Version: `v001` — must match domain-model schema version (there is no v002 planned in this cycle)

---

## Storage Schema

### File: `~/.todo.json`

The file is a single JSON array at the top level — not an object wrapper.

| Field (per array element) | Type | Constraint | Migration | Notes |
|---|---|---|---|---|
| `text` | string | required, non-empty after trim | v001_initial | stored verbatim, no length cap |
| `done` | boolean | required, default `false` on `add` | v001_initial | |

Array position (0-based internally, 1-based on display/CLI args) is the item's identity for
this cycle — there is no separate `id` field (per [[domain-model#Aggregate-TodoStore]] decision).

Example file contents:
```json
[
  { "text": "buy milk", "done": false },
  { "text": "write spec", "done": true }
]
```

---

## Method: `load()` (Read)

### Read Output

| Field | Type | Null Behavior |
|---|---|---|
| return value | `TodoItem[]` | `[]` when the file does not exist (`ENOENT`) — never `null`, never throws for this case |

### Error Cases

| Condition | Error Type | Recovery |
|-----------|-----------|---------|
| File does not exist (`ENOENT`) | not an error — returns `[]` | caller proceeds as if the store is empty (first run) |
| File contents fail `JSON.parse` (`SyntaxError`) | `StoreCorruptedError` (`E_STORE_CORRUPTED`) | caller prints the corrupted-store message and exits 1; the file is left untouched — never auto-overwritten |
| File contents parse but are not a JSON array (e.g. an object, a number) | `StoreCorruptedError` (`E_STORE_CORRUPTED`) | same as above — treated as corruption, not silently coerced |
| Any other filesystem read error (e.g. `EACCES`) | `StoreReadError` | caller prints `Error: could not read todo store: <reason>` and exits 1 |

---

## Method: `save(items)` (Write)

### Write Input

| Field | Type | Required | Source |
|---|---|---|---|
| `items` | `TodoItem[]` | ✓ | domain.TodoStore.items — the full, current array (this contract has no partial-update method) |

### Write Output

No return value on success (`void`).

### Error Cases

| Condition | Error Type | Recovery |
|-----------|-----------|---------|
| Filesystem write fails (disk full, permissions, `EACCES`/`ENOSPC`) | `StoreWriteError` (`E_STORE_WRITE_FAILED`) | caller prints `Error: could not save todo store: <reason>` and exits 1; on-disk file from before the failed write is unaffected (no partial write — write to the real path only after the full JSON string is built in memory) |

---

## Conflict Strategy: `last-write-wins`

Single-user, single-process CLI (pitch no-go: no sync, no server) — there is no concurrent
writer to reconcile against. Two invocations racing in the same second is an accepted,
undocumented edge outside this cycle's appetite (not a No-go item, simply not designed for).

## Migration Runbook

```
-- v001: initial schema — flat JSON array of { text: string, done: boolean }
-- No migration script needed; this is the first and only schema version in this cycle.
```
