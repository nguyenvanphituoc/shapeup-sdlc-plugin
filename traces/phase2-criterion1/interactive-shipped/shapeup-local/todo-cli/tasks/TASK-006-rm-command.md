---
type: task
feature: todo-cli
id: TASK-006
title: "Implement todo rm <n>"
lens: standard
package: todo
status: done
priority: 3
depends_on: [TASK-002]
unlocks: [TASK-007]
use_case_refs: [UC-RemoveTodo]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-RemoveTodo]]", "[[ux-behavior#Screen-RemoveCommand]]"]
estimated_hours: 1
tags: [command]
completed_at: 2026-08-16
---

# TASK-006: Implement todo rm <n>

## Context
Implement `commands.rm(path, n)` in `todo/commands.py` per [[usecases/UC-RemoveTodo#Steps]]:
load, validate `n` (same rules and error wording as TASK-005's `done`), remove `items[n-1]`
(later items shift down), save, print `removed #<n>: <text>` (text of the removed item).

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `todo rm 1` against a 2-item store removes item 1, prints `removed #1: <text of old item 1>`, exits 0
- [x] The store file after `rm 1` has exactly 1 item — the former item 2, `text`/`done` unchanged
- [x] After a removal, a subsequent `list` renumbers remaining items starting at 1 (no gaps)

### 🔢 Boundary Values
- [x] `todo rm 0` (below min) against a 2-item store: exit 1, stderr
      `error: no item 0 (list has 2 items)`, store unchanged (still 2 items)
- [x] `todo rm 1` (min, valid): exit 0, store now has 1 item
- [x] `todo rm 2` (max, valid, 2-item store): exit 0, store now has 1 item
- [x] `todo rm 3` (max+1, 2-item store): exit 1, stderr `error: no item 3 (list has 2 items)`,
      store unchanged
- [x] `todo rm xyz` (non-integer): exit 1, stderr `error: invalid item number 'xyz'`, store unchanged

### 🧪 BDD Scenarios

**Scenario: Remove an item and renumber**
Given a store with 3 items
When  `todo rm 2` is run, then `todo list` is run
Then  `rm 2` prints `removed #2: <text of old item 2>`, exit 0; the following `list` shows the
      former items 1 and 3 renumbered as 1 and 2

**Scenario: Out-of-range index is rejected before any write**
Given a store with 1 item
When  `todo rm 5` is run
Then  stderr is exactly `error: no item 5 (list has 1 items)`, exit 1, store file unchanged

## Non-Go (not in this task)
- `add`/`list`/`done` command logic → TASK-003, TASK-004, TASK-005
- Argument parsing / dispatch wiring → TASK-002 (already done)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `todo rm 1` against a 2-item store removes item 1, prints `removed #1: <text of old item 1>`, exits 0: pass (todo rm 1 against 2-item store -> 'removed #1: <text of old item 1>', exit 0 (manual run))
- The store file after `rm 1` has exactly 1 item — the former item 2, `text`/`done` unchanged: pass (store file after rm 1 has exactly 1 item — former item 2, text/done unchanged — verified via json read)
- After a removal, a subsequent `list` renumbers remaining items starting at 1 (no gaps): pass (after removal, list renumbers remaining items starting at 1, no gaps — manual run rm 2 of 3 then list)
- `todo rm 0` (below min) against a 2-item store: exit 1, stderr: pass (todo rm 0 against 2-item store -> exit 1, stderr 'error: no item 0 (list has 2 items)')
- `todo rm 1` (min, valid): exit 0, store now has 1 item: pass (todo rm 1 (min valid) -> exit 0, store now has 1 item)
- `todo rm 2` (max, valid, 2-item store): exit 0, store now has 1 item: pass (todo rm 2 (max valid, 2-item store) -> exit 0, store now has 1 item)
- `todo rm 3` (max+1, 2-item store): exit 1, stderr `error: no item 3 (list has 2 items)`,: pass (todo rm 3 (max+1) -> exit 1, stderr 'error: no item 3 (list has 2 items)' (manual run))
- `todo rm xyz` (non-integer): exit 1, stderr `error: invalid item number 'xyz'`, store unchanged: pass (todo rm xyz -> exit 1, stderr "error: invalid item number 'xyz'", store unchanged (manual run))


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r2-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r2-a1: 7/7 fixtures green, no payload.bugs present)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r3-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r3-a1: 11/11 fixtures green, no regression on the rm fixtures)
