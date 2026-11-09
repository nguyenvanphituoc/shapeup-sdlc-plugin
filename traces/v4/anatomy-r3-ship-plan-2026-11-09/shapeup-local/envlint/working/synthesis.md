# Synthesis — envlint

## Traceability (REQ → AC on the board)

| REQ | Task AC |
|---|---|
| REQ-1 | TASK-002 |
| REQ-2 | TASK-002, TASK-003, TASK-004 |
| REQ-3 | TASK-003, TASK-004 |
| REQ-4, REQ-5, REQ-8, REQ-9, REQ-21 | TASK-003 |
| REQ-6 | TASK-001, TASK-003 |
| REQ-7 | TASK-001, TASK-002, TASK-004 |
| REQ-10..REQ-16, REQ-24 | TASK-001 |
| REQ-17..REQ-20, REQ-27, REQ-28 | TASK-002 |
| REQ-22 | TASK-001, TASK-002 |
| REQ-23, REQ-25, REQ-26 | TASK-004 |

All 28 registered requirements are graded by at least one AC.

## Risk register

| Risk | Note |
|---|---|
| Planner decisions on open pitch points (schema shape, exit codes, output format, int/bool/url literals) | listed in the spec index; PO may overturn at Board Review |
| Quoted values with escapes / inline comments | not in the pitch; not specified (rabbit hole) |

## Dependency graph

```
TASK-001 ─┐
          ├─> TASK-003 ─> TASK-004
TASK-002 ─┘
```
