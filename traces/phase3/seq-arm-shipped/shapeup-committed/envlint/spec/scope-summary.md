---
schema_version: 1
doc_type: scope-summary
feature: envlint
lens: standard
---

# Scope summary — envlint

## Traceability matrix (UC → tasks → files)

| UC | Engine | Tasks | Files |
|---|---|---|---|
| UC-01 Parse env file | Parsing | TASK-001 | `lib/parse.mjs` |
| UC-02 Validate against schema | Rules | TASK-002 | `lib/rules.mjs` |
| UC-03 Run CLI lint | CLI | TASK-003 (+ TASK-004 integration) | `bin/envlint.mjs` |

## Substrate disjointness (pitch's core constraint)

- `lib/parse.mjs` and `lib/rules.mjs` share no file and import nothing from each other
  (TASK-001/TASK-002 AC assert this explicitly).
- `bin/envlint.mjs` is the only file that imports both.
- This shape is what makes TASK-001 and TASK-002 buildable in parallel — the intake's stated
  reason for the split ("independent pieces that can be built at the same time"). Map Scopes
  (`/scope-architect`) should slice along exactly this line: a Parsing scope, a Rules scope, and
  a CLI scope that depends on both.

## Dependency graph

```
TASK-001 (lib/parse.mjs)   ─┐
TASK-002 (lib/rules.mjs)   ─┼─▶ TASK-003 (bin/envlint.mjs) ─▶ TASK-004 (integration test)
```
TASK-001 and TASK-002 have no `depends_on` between them — independently buildable. Critical
path: TASK-001 or TASK-002 → TASK-003 → TASK-004 (whichever of 001/002 is heavier plus 003+004's
hours; both are 3h so the path is symmetric).

## Appetite

Total estimated hours: 3 (TASK-001) + 3 (TASK-002) + 4 (TASK-003) + 2 (TASK-004) = 12h, against
a "small batch, single build round" appetite (`intake.md`). No appetite-hours budget was passed
to `reduce board`, so no overflow arithmetic applies — this is reported as a plain fact for the
caller's HAMMER gate, not resolved here.
