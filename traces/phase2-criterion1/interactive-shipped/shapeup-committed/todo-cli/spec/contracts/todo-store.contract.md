---
type: repository-contract
source_type: offline-storage
feature: "todo-cli"
repository: "TodoStoreRepository"
engine: "FileSystem — a single JSON file, stdlib json + tempfile + os.replace, no ORM/DB"
schema_ref: "[[domain-model#Aggregate-TodoList]]"
migration_version: "v001"
status: confirmed
skill_version: "4.0"
---

# Repository Contract — TodoStoreRepository

## Source Type: `offline-storage`
## Engine: FileSystem (Python 3 stdlib `json` + `tempfile.mkstemp` + `os.replace`)
## Schema Ref: [[domain-model#Aggregate-TodoList]]
## Migration Version: `v001` — single flat schema, no migrations planned this appetite

---

## Storage Schema

### Key: the store file itself (`$TODO_STORE` or `~/.todo.json`)

The file's root is a JSON array. Each element:

| Field | Type | Constraint | Migration | Notes |
|-------|------|-----------|-----------|-------|
| text | string | required, non-empty | v001 | verbatim from `add <text>`, never re-validated on load |
| done | boolean | required | v001 | `false` on creation; flipped `true` by `done <n>`, never flipped back this appetite |

No `id` field — an item's identity for `done`/`rm` purposes is its 1-based position in the
array at read time (see domain-model `TodoList` state transitions). No `createdAt`/`updatedAt`
— out of scope for this appetite (not required by any UC).

---

## Method: `load(path)` (Read)

### Read Output

| Field | Type | Null Behavior |
|-------|------|--------------|
| items | `TodoItem[]` | Returns `[]` (never `null`, never throws) when the file does not exist at `path`. |

### Error Cases

| Condition | Error Type | Recovery |
|-----------|-----------|---------|
| File exists, content is not parseable JSON | `StoreCorruptedError` | Caller (CLI dispatch) catches, prints `error: corrupted store at <path>`, exits 1 |
| File exists, content is valid JSON but the root is not a list (e.g. a JSON object) | `StoreCorruptedError` | Same path as above — one error type covers both corruption flavors (PO decision #3) |

---

## Method: `save(path, items)` (Write)

### Write Input

| Field | Type | Required | Source |
|-------|------|----------|--------|
| path | string | ✓ | domain.StorePath (resolved from `env.TODO_STORE` or default) |
| items | `TodoItem[]` | ✓ | domain.TodoList.items (the FULL list, post-mutation) |

### Write Output
No return value. Success is "the file at `path` now contains exactly `items` as a JSON array."

### Error Cases

| Condition | Error Type | Recovery |
|-----------|-----------|---------|
| Directory for `path` does not exist / not writable | `OSError` propagates | Out of scope for this appetite — no directory-creation UX specified; a developer running this CLI is expected to have a writable `$HOME` or a valid `$TODO_STORE` directory |
| Process crashes mid-write | — (prevented by design) | `save()` writes to a `tempfile.mkstemp` sibling in the same directory, then `os.replace(tmp, path)` — atomic on POSIX, so the pre-existing file is never left half-written |

---

## Conflict Strategy: `last-write-wins`

Single-user, single-process CLI, no concurrent-writer requirement in scope (spiked and
confirmed — see Orient `spike-store-persistence.md`). Two invocations racing on the same store
file are out of scope; the atomic `os.replace` guarantees each individual `save()` is
all-or-nothing, not that concurrent invocations serialize.

## Migration Runbook
No migrations planned — v001 is the only schema version this appetite ships. A future schema
change would bump `migration_version` here and in `domain-model.md` together.
