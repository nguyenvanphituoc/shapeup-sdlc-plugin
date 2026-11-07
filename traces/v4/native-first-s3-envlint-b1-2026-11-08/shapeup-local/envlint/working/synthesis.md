---
type: synthesis
feature: envlint
lens: lite
---

# Synthesis — envlint (lite)

## S-01 Traceability (REQ → task AC)

| REQ | Task |
|---|---|
| REQ-10..16, REQ-24 | [[tasks/TASK-001-parse-module]] |
| REQ-1, REQ-17..20, REQ-26 | [[tasks/TASK-002-rules-module]] |
| REQ-22 | TASK-001 + TASK-002 |
| REQ-2, REQ-3, REQ-8, REQ-9, REQ-21, REQ-25 | [[tasks/TASK-003-cli]] |
| REQ-4, REQ-5, REQ-6, REQ-7, REQ-23 | [[tasks/TASK-004-cli-edges]] (REQ-6/7 also TASK-001) |

All 26 registry clauses are covered by at least one AC.

## Risk register
- The pitch left 14 details open; they are pinned as PD-1..PD-14 in the domain model and are to be
  confirmed by the PO at ship (the run was unattended).
- `node --test` with no test files exits 0: TASK-004 asserts more than 0 tests ran.
- Board total 11h against a 1-week appetite: no overflow.
