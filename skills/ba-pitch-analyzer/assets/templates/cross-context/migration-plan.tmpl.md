---
type: migration-plan
feature: FEATURE_SLUG
skill_version: "2.5"
affected_tables: []
change_type: additive | breaking | destructive
backward_compatible: true | false
tags: [cross-context, migration]
depends_on: ["[[_cross-context/context-map]]"]
status: draft
---

# Migration Plan: FEATURE TITLE

> Generated only when feature modifies existing production schema.
> Each migration task maps to a TASK-M0N in tasks/_index.md.

---

## Change Summary

| Table | Change Type | Breaking | Rollback Window |
|-------|------------|---------|----------------|
| `table_name` | add column / rename / drop | ✅ yes / ❌ no | 48h |

**Backward compatible:** YES / NO
**Estimated rows affected:** ~N rows
**Estimated migration time:** < Ns (no lock) / ~Ns (with lock)

---

## Migration Tasks

### TASK-M01 — [description, e.g. Add nullable columns]

```sql
-- UP
ALTER TABLE table_name ADD COLUMN col_name TYPE DEFAULT NULL;

-- ROLLBACK
ALTER TABLE table_name DROP COLUMN col_name;
```

Lock type: **none** (nullable add) / **table lock** (not null without default)
Safe to run: during deploy / after deploy / off-hours only

---

### TASK-M02 — [description, e.g. Backfill existing rows]

```sql
-- UP (run in batches of 1000 to avoid lock escalation)
UPDATE table_name
SET col_name = [derived value]
WHERE col_name IS NULL
LIMIT 1000;

-- Verify
SELECT COUNT(*) FROM table_name WHERE col_name IS NULL;
-- Expected: 0

-- ROLLBACK: not needed (nullable — old code ignores new column)
```

Estimated rows: ~N | Estimated time: ~Ns | Lock: none

---

### TASK-M03 — [description, e.g. Enforce NOT NULL constraint]

```sql
-- UP — only run after M02 verified
ALTER TABLE table_name ALTER COLUMN col_name SET NOT NULL;

-- ROLLBACK
ALTER TABLE table_name ALTER COLUMN col_name DROP NOT NULL;
```

**Prerequisite:** M02 complete AND verified (0 null rows)

---

## Deploy Sequence

```
M01 ──► deploy app v[N] ──► verify (smoke test) ──► M02 ──► verify ──► M03
  │                                                                       │
  └─ rollback window: run ROLLBACK scripts in reverse order ◄────────────┘
                      M03-rollback → M02 (no-op) → M01-rollback
```

**Rollback window:** 48h after M03
**Rollback owner:** [team]
**Runbook location:** [link or path]

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Lock escalation on M03 | low | high — table unavailable | Run during low-traffic window |
| Backfill timeout on M02 | medium | medium — partial migration | Batch size 1000, resumable |
| App v[N-1] reads new column | low | low — nullable, ignored | Backward compatible by design |
