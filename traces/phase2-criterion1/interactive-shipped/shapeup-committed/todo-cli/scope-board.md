---
type: scope-board
feature: todo-cli
generated_by: scope-architect
total_scopes: 2
---

# Scope Board — todo-cli

| scope_id | topology | tasks | substrate size | build order | lint |
|---|---|---|---|---|---|
| scope-cli-core | LAYER_CAKE | TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006 | 3 files (exclusive) | 1 | pending |
| scope-integration-test | CHOWDER | TASK-007 | tests/** (exclusive) | 2 | pending |

## Riskiest-first build sequence

1. **scope-cli-core** — the whole `bin/todo` → `todo/commands.py` → `todo/store.py` vertical:
   atomic persistence, corruption detection, the top-level error boundary, 1-based index
   validation (the pitch's flagged off-by-one risk), and the `INV-05` unguarded-`$TODO_STORE`
   risk flagged at GATE L1a.5. All of it lands together because the frozen tasks put every
   command's body in the same two shared files (`bin/todo`, `todo/commands.py`) — see
   `scope-cli-core.md`'s "Why this slice".
2. **scope-integration-test** — full-binary round trip across all four commands, spawned as a
   real subprocess; depends on scope-cli-core being fully built.

## Substrate

`scope-cli-core` (`bin/todo`, `todo/store.py`, `todo/commands.py`) and
`scope-integration-test` (`tests/**`) are fully disjoint — no `shared_substrate` declared on
either.

## Deviation on file naming

`wiring-map.md` names per-UC engine modules under `todo/usecases/`; the frozen task substrate
(`.shapeup/todo-cli/tasks/TASK-002..007`) names a single `todo/commands.py` module instead. The
scope substrate above follows the frozen tasks. See `scope-cli-core.md`'s Deviation note and
this order's `WorkResult.deviations[]`.
