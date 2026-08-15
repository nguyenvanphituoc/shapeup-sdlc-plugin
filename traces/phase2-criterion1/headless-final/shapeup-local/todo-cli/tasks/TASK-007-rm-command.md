---
type: task
feature: todo-cli
id: TASK-007
title: "Implement `rm <n>` command with index validation"
lens: standard
package: cli
status: done
priority: 7
depends_on: [TASK-003]
unlocks: [TASK-008]
use_case_refs: [UC-RemoveTodo]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-RemoveTodo]]", "[[ux-behavior#Command-rm-n]]"]
estimated_hours: 1.5
tags: [feat]
completed_at: 2026-08-15
---

# TASK-007: Implement `rm <n>` command with index validation

## Context
Implement `[[usecases/UC-RemoveTodo]]` Steps 1–8, including all three index-validation error
cases from `[[ux-behavior#Command-rm-n]]`'s Error Catalog. Same validation shape as TASK-006
(`done`) — reuse the same validation helper if practical, but this is a separate command file.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/commands/rm.js` validates presence, numeric-ness, and range of `<n>` BEFORE any store
      mutation, then removes the item, saves, prints confirmation, exit code 0
- [x] `node --test test/commands/rm.test.js` passes
- [x] After removal, `nextId` in the saved store is unchanged (never decremented) — see
      `[[domain-model#Aggregate-TodoList]]` INV-01

### 🔢 Boundary Values
- [x] `<n> = 0`: rejected (`INVALID_INDEX`), no store write
- [x] `<n> = list.length`: accepted (removes last item)
- [x] `<n> = list.length + 1`: rejected (`INDEX_OUT_OF_RANGE`), no store write
- [x] `<n>` on an empty list (any positive integer): rejected (`INDEX_OUT_OF_RANGE`)
- [x] `<n> = "abc"` or `<n> = "-1"`: rejected (`INVALID_INDEX`), no store write

### 🧪 BDD Scenarios

**Scenario: Remove a valid item**
Given `./.todo.json` has 2 items
When  `rm.js` is invoked with `["1"]`
Then  the saved store has 1 item (the former `items[1]`), and its `id` is unchanged from before
      the removal; exit code 0

**Scenario: Reject an out-of-range index**
Given `./.todo.json` has 1 item
When  `rm.js` is invoked with `["2"]`
Then  no store write occurs, stderr says no item at index 2 (`INDEX_OUT_OF_RANGE`), exit code 1

## Non-Go (not in this task)
- `add`/`list`/`done` commands → TASK-004, TASK-005, TASK-006
- argv routing → TASK-008


## Execution Log — 2026-08-15 (todo-cli/remove-todo-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/commands/rm.js` validates presence, numeric-ness, and range of `<n>` BEFORE any store: pass (rm.js checks raw !== undefined -> loads store -> checks INDEX_RE -> checks 1<=n<=list.items.length, all before removeAt/save; confirmed by no-store-write assertions in 'n = 0', 'n = list.length + 1', empty-list, 'abc', '-1', and missing-index tests)
- `node --test test/commands/rm.test.js` passes: pass (node --test test/commands/rm.test.js -> tests 9, pass 9, fail 0)
- After removal, `nextId` in the saved store is unchanged (never decremented) — see: pass (test 'nextId is unchanged (never decremented) after removal' -> saved.nextId === 3 after rm(['1']) on a 2-item list (unchanged from input); todoList.removeAt() only filters items, never touches nextId)
- `<n> = 0`: rejected (`INVALID_INDEX`), no store write: pass (test 'n = 0 is rejected as INVALID_INDEX, no store write' -> code 1, stderr matches /not a valid index/, saved.items.length unchanged at 1)
- `<n> = list.length`: accepted (removes last item): pass (test 'n = list.length is accepted (removes last item)' -> code 0, saved.items.length 1, remaining item id 1 (last item removed))
- `<n> = list.length + 1`: rejected (`INDEX_OUT_OF_RANGE`), no store write: pass (test 'n = list.length + 1 is rejected as INDEX_OUT_OF_RANGE, no store write' -> code 1, stderr matches /no item at index 2/, store unchanged)
- `<n>` on an empty list (any positive integer): rejected (`INDEX_OUT_OF_RANGE`): pass (test 'any positive n on an empty list is rejected as INDEX_OUT_OF_RANGE' -> no store file, rm(['1']) -> code 1, stderr matches /no item at index 1/, store file still does not exist)
- `<n> = "abc"` or `<n> = "-1"`: rejected (`INVALID_INDEX`), no store write: pass (tests 'n = "abc" is rejected as INVALID_INDEX' and 'n = "-1" is rejected as INVALID_INDEX' -> both code 1, stderr matches /not a valid index/, store unchanged)


## Execution Log — 2026-08-15 (todo-cli/remove-todo-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/commands/rm.js` validates presence, numeric-ness, and range of `<n>` BEFORE any store: pass (rm.js checks raw !== undefined -> INDEX_RE numeric test -> loads store -> checks 1<=n<=list.items.length, all before removeAt/saveStore; confirmed by no-store-write assertions in the 'n = 0', 'n = list.length + 1', empty-list, 'abc', '-1', and missing-index tests)
- `node --test test/commands/rm.test.js` passes: pass (node --test test/commands/rm.test.js -> tests 11, pass 11, fail 0)
- After removal, `nextId` in the saved store is unchanged (never decremented) — see: pass (test 'nextId in the saved store is unchanged (never decremented) after removal' -> saved.nextId === 3 after rm(['1']) on a 2-item list (unchanged from input); removeAt() only filters items, never touches nextId)
- `<n> = 0`: rejected (`INVALID_INDEX`), no store write: pass (test 'n = 0 is rejected as INVALID_INDEX, no store write' -> code 1, stderr matches /not a valid index/, store unchanged)
- `<n> = list.length`: accepted (removes last item): pass (test 'n = list.length is accepted (removes last item)' -> code 0, saved.items.length 1, remaining item id 1 (last item removed))
- `<n> = list.length + 1`: rejected (`INDEX_OUT_OF_RANGE`), no store write: pass (test 'n = list.length + 1 is rejected as INDEX_OUT_OF_RANGE, no store write' -> code 1, stderr matches /no item at index 2/, store unchanged)
- `<n>` on an empty list (any positive integer): rejected (`INDEX_OUT_OF_RANGE`): pass (test 'any positive n on an empty list is rejected as INDEX_OUT_OF_RANGE' -> no store file, rm(['1']) -> code 1, stderr matches /no item at index 1/, store file still does not exist)
- `<n> = "abc"` or `<n> = "-1"`: rejected (`INVALID_INDEX`), no store write: pass (tests 'n = "abc" is rejected as INVALID_INDEX' and 'n = "-1" is rejected as INVALID_INDEX' -> both code 1, stderr matches /not a valid index/, store unchanged)


## Execution Log — 2026-08-15 (todo-cli/remove-todo-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `src/commands/rm.js` validates presence, numeric-ness, and range of `<n>` BEFORE any store: pass (src/commands/rm.js checks raw !== undefined -> INDEX_RE numeric test -> loads store -> checks 1<=n<=list.items.length, all before removeAt/saveStore; already implemented in a prior round, unchanged)
- `node --test test/commands/rm.test.js` passes: pass (node --test test/commands/rm.test.js -> tests 11, pass 11, fail 0)
- After removal, `nextId` in the saved store is unchanged (never decremented) — see: pass (test 'nextId in the saved store is unchanged (never decremented) after removal' passes; removeAt() only filters items, never touches nextId)
- `<n> = 0`: rejected (`INVALID_INDEX`), no store write: pass (test 'n = 0 is rejected as INVALID_INDEX, no store write' passes)
- `<n> = list.length`: accepted (removes last item): pass (test 'n = list.length is accepted (removes last item)' passes)
- `<n> = list.length + 1`: rejected (`INDEX_OUT_OF_RANGE`), no store write: pass (test 'n = list.length + 1 is rejected as INDEX_OUT_OF_RANGE, no store write' passes)
- `<n>` on an empty list (any positive integer): rejected (`INDEX_OUT_OF_RANGE`): pass (test 'any positive n on an empty list is rejected as INDEX_OUT_OF_RANGE' passes)
- `<n> = "abc"` or `<n> = "-1"`: rejected (`INVALID_INDEX`), no store write: pass (tests 'n = "abc" is rejected as INVALID_INDEX' and 'n = "-1" is rejected as INVALID_INDEX' both pass)
