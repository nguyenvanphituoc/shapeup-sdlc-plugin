---
type: task
feature: todo-cli
id: TASK-004
title: "Implement todo list"
lens: standard
package: todo
status: done
priority: 3
depends_on: [TASK-002]
unlocks: [TASK-007]
use_case_refs: [UC-ListTodos]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-ListTodos]]", "[[ux-behavior#Screen-ListCommand]]"]
estimated_hours: 1
tags: [command]
completed_at: 2026-08-16
---

# TASK-004: Implement todo list

## Context
Implement `commands.list_(path)` in `todo/commands.py` per [[usecases/UC-ListTodos#Steps]]:
load, print `(no items)` if empty, else print one `"<n>. [x|  ] <text>"` line per item in
1-based order — exact format from the PO transcript at GATE L1a: `1. [ ] ship it`.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `python3 bin/todo list` against a store with 2 items (`ship it` not done, `write the spec`
      done) prints exactly:
      ```
      1. [ ] ship it
      2. [x] write the spec
      ```
      (verbatim PO example) and exits 0
- [x] Output contains no ANSI escape codes (`\x1b[`) — plain text only

### 📭 Empty & Null States
- [x] `python3 bin/todo list` against a fresh (non-existent) `$TODO_STORE` prints exactly
      `(no items)` to stdout and exits 0 — no crash, no traceback
- [x] `python3 bin/todo list` against a store file containing `[]` prints exactly `(no items)`
      and exits 0

### 🧪 BDD Scenarios

**Scenario: List a populated store**
Given a store with items `["ship it" (not done), "write the spec" (done)]`
When  `todo list` is run
Then  stdout is the two numbered lines above, in that order, exit 0

**Scenario: List an empty store never crashes**
Given `$TODO_STORE` points at a path with no existing file
When  `todo list` is run
Then  stdout is `(no items)`, exit 0, no traceback on stderr

## Non-Go (not in this task)
- `add`/`done`/`rm` command logic → TASK-003, TASK-005, TASK-006
- Argument parsing / dispatch wiring → TASK-002 (already done)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `python3 bin/todo list` against a store with 2 items (`ship it` not done, `write the spec`: pass (todo list against 2-item store (ship it undone, write the spec done) prints '1. [ ] ship it\n2. [x] write the spec', exit 0 (manual run))
- Output contains no ANSI escape codes (`\x1b[`) — plain text only: pass (output is plain f-string text, no ANSI codes; grep for \\x1b[ found nothing)
- `python3 bin/todo list` against a fresh (non-existent) `$TODO_STORE` prints exactly: pass (todo list against fresh nonexistent store -> exactly '(no items)', exit 0 (manual run))
- `python3 bin/todo list` against a store file containing `[]` prints exactly `(no items)`: pass (todo list against store file containing [] -> exactly '(no items)', exit 0)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r2-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r2-a1: 7/7 fixtures green, no payload.bugs present)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r3-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r3-a1: 11/11 fixtures green, no regression on the list fixtures; QA-001/QA-010 fixed upstream in store.py/bin/todo without touching commands.list_)
