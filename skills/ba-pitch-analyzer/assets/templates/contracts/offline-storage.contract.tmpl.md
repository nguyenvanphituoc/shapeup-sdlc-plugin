---
type: repository-contract
source_type: offline-storage
feature: "[feature-slug]"
repository: "[RepoName]"
engine: "[SQLite via Drizzle / AsyncStorage / MMKV / FileSystem]"
schema_ref: "[[domain-model#[EntityName]]]"
migration_version: "v[NNN]"
status: confirmed
skill_version: "2.3"
---

# Repository Contract — [RepoName]

## Source Type: `offline-storage`
## Engine: [SQLite via Drizzle ORM / AsyncStorage / MMKV / FileSystem]
## Schema Ref: [[domain-model#[EntityName]]]
## Migration Version: `v[NNN]` — must match domain-model schema version

---

## Storage Schema

### Table / Key: `[table_name or storage_key]`

| Column / Key | Type | Constraint | Migration | Notes |
|-------------|------|-----------|-----------|-------|
| id | uuid | PK, NOT NULL | v001_initial | |
| [field1] | text | NOT NULL | v001_initial | |
| [field2] | integer | NOT NULL, default 0 | v001_initial | VND — integer only |
| [field3] | text? | NULL | v002_add_[field] | nullable until [condition] |
| createdAt | text | NOT NULL, ISO8601 | v001_initial | stored as UTC string |
| updatedAt | text | NOT NULL | v001_initial | update trigger or app-managed |

---

## Method: [methodName] (Write)

### Write Input

| Field | Type | Required | Source |
|-------|------|----------|--------|
| [field1] | string | ✓ | UC-[Name].input.[field] |
| [field2] | number | ✓ | domain.[Entity].[field] |

### Write Output

| Field | Type | Invariant |
|-------|------|-----------|
| id | uuid | server-generated, non-null |
| [field1] | string | mirrors input |

### Error Cases

| Condition | Error Type | Recovery |
|-----------|-----------|---------|
| Disk full | StorageError(QUOTA_EXCEEDED) | Prompt user to free space |
| Schema mismatch | MigrationError | Run pending migrations |
| Concurrent write | ConflictError | [last-write-wins / merge strategy] |

---

## Method: [methodName2] (Read)

### Read Output

| Field | Type | Null Behavior |
|-------|------|--------------|
| [field1] | string \| null | null when [condition] — caller must handle |
| [field2] | [Entity][] | empty array [] when no rows — never null |

### Error Cases

| Condition | Error Type | Recovery |
|-----------|-----------|---------|
| Record not found | returns `null` — never throws | Caller checks null |
| DB locked | StorageError(LOCKED) | Retry with backoff |

---

## Conflict Strategy: `[last-write-wins / merge / reject]`

*Describe: when two writes happen concurrently, what is the resolution?*

## Migration Runbook

```sql
-- v[NNN]: [description]
ALTER TABLE [table] ADD COLUMN [col] [type] [constraint];
```

Rollback: `[rollback SQL or "destructive — no rollback"]`
