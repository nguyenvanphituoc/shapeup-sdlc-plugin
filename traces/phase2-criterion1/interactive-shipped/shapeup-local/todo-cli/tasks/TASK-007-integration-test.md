---
type: task
feature: todo-cli
id: TASK-007
title: "Integration test — full todo CLI round-trip across all commands"
lens: standard
package: tests
status: done
priority: 4
depends_on: [TASK-003, TASK-004, TASK-005, TASK-006]
unlocks: []
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: [TodoItem, TodoList]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/_index]]", "[[integration#Local-filesystem-store]]"]
estimated_hours: 2
tags: [integration-test]
completed_at: 2026-08-16
---

# TASK-007: Integration test — full todo CLI round-trip across all commands

## Context
Drive the real `bin/todo` binary end-to-end (spawn a subprocess, never import internals) against
a `$TODO_STORE` pointed at a throwaway path per test — this is exactly the sandboxability the
pitch calls "a real constraint, not a detail." Cover the full command set plus every named edge
case from [[usecases/_index]]: empty list, bad index (non-integer and out-of-range), and both
corrupted-store variants (invalid JSON, valid-JSON-wrong-shape).

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `python3 -m unittest` (or `pytest`, whichever the repo's test runner ends up being — no
      test framework was declared in Orient, stdlib `unittest` is the zero-dependency default)
      discovers and passes this file
- [x] Full round-trip: `add "a"` → `add "b"` → `list` shows both, 1-based, correct done markers
      → `done 1` → `list` shows item 1 as `[x]` → `rm 2` → `list` shows only item 1, renumbered
      to `1.`
- [x] Each subprocess call asserts BOTH the exit code AND the exact stdout/stderr text (not just
      "did it crash") — per the derived Test Surface rows on each UC

### 🧪 BDD Scenarios (REQUIRED — FEAT + cross-boundary)

**Scenario: Happy-path round-trip**
Given a fresh `$TODO_STORE` pointed at a temp file that does not yet exist
When  `add`, `add`, `done 1`, `rm 2` are run in sequence via subprocess
Then  each step's exit code is 0 and its stdout matches the format specified in the owning UC's
      Output section; the final `list` shows exactly one item, `[x]` done, renumbered to `1.`

**Scenario: Corrupted store rejected uniformly across commands**
Given `$TODO_STORE` is seeded with invalid JSON
When  `add`, `list`, `done 1`, and `rm 1` are each run in turn against it
Then  every one exits 1 with stderr matching `error: corrupted store at .*`, none produces a
      Python traceback, and none modifies the store file

### 🔗 Integration Flow (REQUIRED — cross-service)

**Subprocess (bin/todo) → todo/commands.py → todo/store.py → local filesystem**
Given a `$TODO_STORE` env var pointed at a per-test temp path
When  the test spawns `python3 bin/todo <subcommand> <args>` as a real OS process
Then  the process's exit code, stdout, and stderr are captured and asserted; the store file's
      on-disk JSON is read directly and asserted where a Test Surface row requires it (e.g.
      TS-INV-01, TS-INV-02, TS-INV-03)

## Non-Go (not in this task)
- Performance / load testing → out of scope, not requested by the pitch
- Any UI/browser testing → N/A, this is a CLI deliverable (Non-Go: no TUI)


## Execution Log — 2026-08-16 (todo-cli/scope-integration-test-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `python3 -m unittest` (or `pytest`, whichever the repo's test runner ends up being — no: pass (python3 -m unittest discover -s tests -p 'test_*.py' -v -> Ran 10 tests in 0.931s, OK)
- Full round-trip: `add "a"` → `add "b"` → `list` shows both, 1-based, correct done markers: pass (tests/test_integration.py::FullRoundTripTest::test_full_round_trip — asserts stdout at each step: 'added #1: a', 'added #2: b', list '1. [ ] a\n2. [ ] b', 'done #1: a', list '1. [x] a\n2. [ ] b', 'removed #2: b', final list '1. [x] a', plus direct store-file read)
- Each subprocess call asserts BOTH the exit code AND the exact stdout/stderr text (not just: pass (every subprocess.run() call in tests/test_integration.py is followed by assertEqual on .returncode and exact/regex assertion on .stdout and .stderr (e.g. test_done_out_of_range, test_corrupted_store_rejected_uniformly))


## Execution Log — 2026-08-16 (todo-cli/scope-integration-test-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `python3 -m unittest` (or `pytest`, whichever the repo's test runner ends up being — no: pass (python3 -m unittest discover -s tests -p 'test_*.py' -v -> Ran 10 tests in 0.931s, OK)
- Full round-trip: `add "a"` → `add "b"` → `list` shows both, 1-based, correct done markers: pass (tests/test_integration.py::FullRoundTripTest::test_full_round_trip passes; harness verify t0 r2-a1 -> overall green, fixtures_passed 1/1, no regression)
- Each subprocess call asserts BOTH the exit code AND the exact stdout/stderr text (not just: pass (existing tests/test_integration.py assertions on .returncode plus exact/regex stdout/stderr checks unchanged; suite still green)
