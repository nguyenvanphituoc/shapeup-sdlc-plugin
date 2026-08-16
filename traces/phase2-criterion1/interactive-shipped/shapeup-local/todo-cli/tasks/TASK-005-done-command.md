---
type: task
feature: todo-cli
id: TASK-005
title: "Implement todo done <n>"
lens: standard
package: todo
status: done
priority: 3
depends_on: [TASK-002]
unlocks: [TASK-007]
use_case_refs: [UC-CompleteTodo]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-CompleteTodo]]", "[[ux-behavior#Screen-DoneCommand]]"]
estimated_hours: 1
tags: [command]
completed_at: 2026-08-16
---

# TASK-005: Implement todo done <n>

## Context
Implement `commands.done(path, n)` in `todo/commands.py` per
[[usecases/UC-CompleteTodo#Steps]]: load, validate `n` (non-integer → `ERR_INVALID_INDEX`
"invalid item number"; out-of-range → `ERR_INVALID_INDEX` "no item N (list has K items)",
exact wording from the PO transcript at GATE L1a), mark `items[n-1].done = True`, save, print
`done #<n>: <text>`.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `todo done 1` against a 2-item store marks item 1 done, prints `done #1: <text>`, exits 0
- [x] The store file after `done 1` has item 1's `done` field `true`; item 2 unchanged
- [x] Marking an already-done item done again still succeeds (idempotent), prints the same
      confirmation, exits 0

### 🔢 Boundary Values
- [x] `todo done 0` (below min) against a 2-item store: exit 1, stderr
      `error: no item 0 (list has 2 items)`, store unchanged
- [x] `todo done 1` (min, valid): exit 0, item 1 marked done
- [x] `todo done 2` (max, valid, 2-item store): exit 0, item 2 marked done
- [x] `todo done 3` (max+1, 2-item store): exit 1, stderr
      `error: no item 3 (list has 2 items)` (matches the PO transcript's `no item 9` shape),
      store unchanged
- [x] `todo done abc` (non-integer): exit 1, stderr `error: invalid item number 'abc'`, store
      unchanged

### 🧪 BDD Scenarios

**Scenario: Mark an item done**
Given a store with 2 items, none done
When  `todo done 1` is run
Then  stdout is `done #1: <text of item 1>`, exit 0, and the store's item 1 has `done: true`

**Scenario: Out-of-range index is rejected before any write**
Given a store with 2 items
When  `todo done 9` is run
Then  stderr is exactly `error: no item 9 (list has 2 items)`, exit 1, and the store file is
      byte-identical to before the command ran

## Non-Go (not in this task)
- `add`/`list`/`rm` command logic → TASK-003, TASK-004, TASK-006
- Argument parsing / dispatch wiring → TASK-002 (already done)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `todo done 1` against a 2-item store marks item 1 done, prints `done #1: <text>`, exits 0: pass (todo done 1 against 2-item store -> 'done #1: <text>', exit 0 (manual run))
- The store file after `done 1` has item 1's `done` field `true`; item 2 unchanged: pass (store file after done 1: item 1 done=true, item 2 unchanged — verified via json read)
- Marking an already-done item done again still succeeds (idempotent), prints the same: pass (marking already-done item again succeeds idempotently, same confirmation message, exit 0)
- `todo done 0` (below min) against a 2-item store: exit 1, stderr: pass (todo done 0 against 2-item store -> exit 1, stderr 'error: no item 0 (list has 2 items)' (manual run))
- `todo done 1` (min, valid): exit 0, item 1 marked done: pass (todo done 1 (min valid) -> exit 0, item 1 marked done)
- `todo done 2` (max, valid, 2-item store): exit 0, item 2 marked done: pass (todo done 2 (max valid, 2-item store) -> exit 0, item 2 marked done)
- `todo done 3` (max+1, 2-item store): exit 1, stderr: pass (todo done 3 (max+1) -> exit 1, stderr 'error: no item 3 (list has 2 items)' (manual run, matches PO transcript shape))
- `todo done abc` (non-integer): exit 1, stderr `error: invalid item number 'abc'`, store: pass (todo done abc -> exit 1, stderr "error: invalid item number 'abc'", store unchanged (manual run))


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r2-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r2-a1: 7/7 fixtures green, no payload.bugs present)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r3-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r3-a1: 11/11 fixtures green, no regression on the done fixtures)
