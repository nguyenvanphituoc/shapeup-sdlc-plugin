# Synthesis — envlint

## Traceability (REQ → AC)
| REQ | Task AC |
|---|---|
| REQ-1 | TASK-002, TASK-003 |
| REQ-2 | TASK-002, TASK-003 |
| REQ-3, REQ-4, REQ-5, REQ-8, REQ-21 | TASK-003 |
| REQ-6 | TASK-001, TASK-003 |
| REQ-7 | TASK-001, TASK-002, TASK-003 |
| REQ-9 | TASK-003, TASK-004 |
| REQ-10..16, REQ-26 | TASK-001 |
| REQ-17..20 | TASK-002 |
| REQ-22 | TASK-001, TASK-002, TASK-004 |
| REQ-23 | TASK-001, TASK-002 |
| REQ-24 | TASK-003, TASK-004 |
| REQ-25, REQ-27, REQ-28, REQ-29 | TASK-004 |
| REQ-30 | TASK-002, TASK-004 |

## Risk register
| Risk | Mitigation |
|---|---|
| Pair-shape drift between parallel parsing / rules builds | SD-1 written into both use cases' Input/Output |
| Spec decisions SD-1..SD-7 not confirmed by the PO (unattended run) | printed at Board Review; a rejection is a re-plan, cheap before build |
| Pitch has no `appetite` frontmatter; "single build round" taken from prose | max_rounds = 1 in the launch record |

## Dependency graph
TASK-001 ─┐
          ├─► TASK-003 ─► TASK-004
TASK-002 ─┘

## Hammered Out
(none)
