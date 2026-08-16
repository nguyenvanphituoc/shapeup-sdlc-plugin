---
scope_id: scope-integration-test
topology_type: CHOWDER
feature: todo-cli
tasks: [TASK-007]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
allowed_file_substrate:
  - tests/**
shared_substrate: []
build_order: 6
hill_phase: UPHILL_UNKNOWN
status: ready
e2e_verification_fixtures:
  - "python3 -m unittest discover -s tests -p 'test_*.py' -v"
---

# Scope: scope-integration-test

## Affordances

| test_id | role | required_states |
|---|---|---|
| test:full-round-trip | test-suite | [success] |
| test:corrupted-store-uniform | test-suite | [success] |

## Why this slice

`TASK-007` is a true stray (`CHOWDER`, the one deliberate exception): it does not extend any
single command's flow — it spawns the real `bin/todo` binary as a subprocess and drives the
full `add`/`add`/`done`/`rm`/`list` round trip plus the uniform corrupted-store rejection across
all four commands. It shares no business flow with `add`/`list`/`done`/`rm` individually (it
depends on ALL of them being built), and it writes only to `tests/**` — no overlap with any
other scope's substrate, so no `shared_substrate` entry is needed. Build order 6, last: it can
only pass once every command scope has landed (`depends_on: [TASK-003, TASK-004, TASK-005,
TASK-006]` on the task board).

The fixture command itself is `TBD`-adjacent by necessity: TASK-007's own acceptance criteria
leave the test-runner choice open ("`python3 -m unittest` (or `pytest`, whichever the repo's
test runner ends up being — no test framework was declared in Orient, stdlib `unittest` is the
zero-dependency default)"). This contract fixes `unittest discover` as the fixture per that
stated stdlib-only default (consistent with `project-profile.md`'s Python-stdlib-only stack) —
flagged here rather than silently assumed, since task-executor could reasonably pick `pytest`
if it were on the machine (it is not: `pip3 show pytest` found nothing installed at map-scopes
time), which would require this fixture command updated to match.
