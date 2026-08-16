---
type: task
feature: todo-cli
id: TASK-003
title: "Implement todo add <text>"
lens: standard
package: todo
status: done
priority: 3
depends_on: [TASK-002]
unlocks: [TASK-007]
use_case_refs: [UC-AddTodo]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-AddTodo]]", "[[ux-behavior#Screen-AddCommand]]"]
estimated_hours: 1
tags: [command]
completed_at: 2026-08-16
---

# TASK-003: Implement todo add <text>

## Context
Implement `commands.add(path, text)` in `todo/commands.py` per [[usecases/UC-AddTodo#Steps]]:
load, append `{"text": text, "done": False}`, save, print `added #<n>: <text>` where `n` is the
new 1-based position. Wire it as the real body behind TASK-002's `add` subcommand stub.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `python3 bin/todo add "ship it"` against a fresh `$TODO_STORE` prints `added #1: ship it`
      to stdout and exits 0
- [x] A second `add` against the same store prints `added #2: ...` (position is `len(items)`
      after append, per [[usecases/UC-AddTodo#Output]])
- [x] The store file on disk after `add` contains the new item appended at the end, all prior
      items unchanged (byte-identical `text`/`done` fields)
- [x] No stdout is written if `save()` raises — see [[usecases/UC-AddTodo#Steps]] step 3

### 🧪 BDD Scenarios

**Scenario: Add to an empty store**
Given `$TODO_STORE` points at a path with no existing file
When  `todo add "ship it"` is run
Then  stdout is `added #1: ship it`, exit 0, and the store now contains one item

**Scenario: Corrupted store rejects the add**
Given `$TODO_STORE` points at a file containing invalid JSON
When  `todo add "x"` is run
Then  exit 1, stderr matches `error: corrupted store at .*` (TASK-002's boundary), and the
      store file is left byte-identical to before the command ran

## Non-Go (not in this task)
- `list`/`done`/`rm` command logic → TASK-004, TASK-005, TASK-006
- Argument parsing / dispatch wiring → TASK-002 (already done)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `python3 bin/todo add "ship it"` against a fresh `$TODO_STORE` prints `added #1: ship it`: pass (python3 bin/todo add "ship it" against fresh store -> stdout 'added #1: ship it', exit 0 (manual run))
- A second `add` against the same store prints `added #2: ...` (position is `len(items)`: pass (second add -> 'added #2: write the spec', position = len(items) after append (manual run))
- The store file on disk after `add` contains the new item appended at the end, all prior: pass (store file after add: prior items unchanged, new item appended at end — verified via python3 json read)
- No stdout is written if `save()` raises — see [[usecases/UC-AddTodo#Steps]] step 3: pass (commands.add calls store.save() before print(); if save() raises the exception propagates before the print statement executes — no stdout on failure)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r2-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r2-a1: 7/7 fixtures green, no payload.bugs present)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r3-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r3-a1: 11/11 fixtures green, no regression on the 3 add fixtures)
