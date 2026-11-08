# Synthesis — envlint (LITE)

## Board numbers (derived)
| task | use case | depends_on | unlocks (recomputed inverse) | hours |
|---|---|---|---|---|
| TASK-001 | UC-01 | — | TASK-003 | 3 |
| TASK-002 | UC-02 | — | TASK-003 | 3 |
| TASK-003 | UC-03 | TASK-001, TASK-002 | TASK-004 | 3 |
| TASK-004 | UC-03 | TASK-003 | — | 2 |

Total 11 h. Critical path: TASK-001 (or 002) → TASK-003 → TASK-004 = 8 h. Appetite "small batch — a single build round" (~1 week): no overflow.

## Traceability REQ → AC
Every REQ-1 … REQ-31 is cited by at least one AC `(covers: …)` on the board (read back line by line).

## Risk register
- R1 Contracts C1–C3 were decided by the planner (spec `_index` → Planning decisions); a PO override reshapes UC-01..03.
- R2 `node --test` (build_probe) is green with 0 tests: the round gate is meaningful only once the three test files land.
- R3 Inline `#` after an unquoted value is kept as part of the value (pitch silent) — a likely QA edge.

## Read back
Tree: _index → domain-model, ux-behavior, 3 use cases; every wikilink target exists. Every task has use_case_refs, explicit depends_on, command-verifiable AC. No breadboard → no Places to place.
