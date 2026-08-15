---
type: task
feature: todo-cli
id: TASK-006
title: "Implement `done <n>` command with index validation"
lens: standard
package: cli
status: done
priority: 6
depends_on: [TASK-003]
unlocks: [TASK-008]
use_case_refs: [UC-CompleteTodo]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-CompleteTodo]]", "[[ux-behavior#Command-done-n]]"]
estimated_hours: 1.5
tags: [feat]
completed_at: 2026-08-15
---

# TASK-006: Implement `done <n>` command with index validation

## Context
Implement `[[usecases/UC-CompleteTodo]]` Steps 1–8, including all three index-validation error
cases from `[[ux-behavior#Command-done-n]]`'s Error Catalog.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/commands/done.js` validates presence, numeric-ness, and range of `<n>` BEFORE any
      store mutation, then marks the item done, saves, prints confirmation, exit code 0
- [x] `node --test test/commands/done.test.js` passes

### 🔢 Boundary Values
- [x] `<n> = 0`: rejected (`INVALID_INDEX`), no store write
- [x] `<n> = list.length`: accepted (last item)
- [x] `<n> = list.length + 1`: rejected (`INDEX_OUT_OF_RANGE`), no store write
- [x] `<n>` on an empty list (any positive integer): rejected (`INDEX_OUT_OF_RANGE`)
- [x] `<n> = "abc"` or `<n> = "1.5"`: rejected (`INVALID_INDEX`), no store write

### 🧪 BDD Scenarios

**Scenario: Mark a valid item done**
Given `./.todo.json` has 2 items, neither done
When  `done.js` is invoked with `["1"]`
Then  `items[0].done === true` in the saved store, `items[1]` unchanged; exit code 0

**Scenario: Reject an out-of-range index**
Given `./.todo.json` has 1 item
When  `done.js` is invoked with `["5"]`
Then  no store write occurs, stderr says no item at index 5 (`INDEX_OUT_OF_RANGE`), exit code 1

## Non-Go (not in this task)
- `add`/`list`/`rm` commands → TASK-004, TASK-005, TASK-007
- argv routing → TASK-008


## Execution Log — 2026-08-15 (todo-cli/complete-todo-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/commands/done.js` validates presence, numeric-ness, and range of `<n>` BEFORE any: pass (src/commands/done.js run(): checks raw===undefined, then /^[1-9][0-9]*$/ regex, then loads store and checks 1<=n<=items.length, all before completeAt()/saveStore() is called; node --test test/commands/done.test.js → 11/11 pass)
- `node --test test/commands/done.test.js` passes: pass (node --test test/commands/done.test.js → tests 11, pass 11, fail 0)
- `<n> = 0`: rejected (`INVALID_INDEX`), no store write: pass (test 'n = 0 is rejected as INVALID_INDEX, no store write' → exit 1, stderr 'not a valid index', store file unchanged (deepEqual before/after))
- `<n> = list.length`: accepted (last item): pass (test 'n = list.length is accepted (last item)' → exit 0, items[1].done === true (2-item list, n=2))
- `<n> = list.length + 1`: rejected (`INDEX_OUT_OF_RANGE`), no store write: pass (test 'n = list.length + 1 is rejected as INDEX_OUT_OF_RANGE, no store write' → exit 1, stderr 'no item at index 2' (1-item list, n=2), store unchanged)
- `<n>` on an empty list (any positive integer): rejected (`INDEX_OUT_OF_RANGE`): pass (test 'any positive n on an empty list is rejected as INDEX_OUT_OF_RANGE' → exit 1, stderr 'no item at index 1'; also 'missing store file behaves as an empty list' → exit 1, no crash, no store file created)
- `<n> = "abc"` or `<n> = "1.5"`: rejected (`INVALID_INDEX`), no store write: pass (tests 'n = "abc" is rejected as INVALID_INDEX' and 'n = "1.5" is rejected as INVALID_INDEX' → both exit 1, stderr 'not a valid index', store unchanged)


## Execution Log — 2026-08-15 (todo-cli/complete-todo-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `src/commands/done.js` validates presence, numeric-ness, and range of `<n>` BEFORE any: pass (src/commands/done.js: presence check (raw === undefined) at line ~69, numeric-ness regex check at line ~75, range check (n < 1 || n > list.items.length) at line ~99 — all before saveStore/completeAt is called)
- `node --test test/commands/done.test.js` passes: pass (node --test test/commands/done.test.js → tests 11, pass 11, fail 0)
- `<n> = 0`: rejected (`INVALID_INDEX`), no store write: pass (test 'n = 0 is rejected as INVALID_INDEX, no store write' passes — exit 1, stderr matches /not a valid index/, store unchanged)
- `<n> = list.length`: accepted (last item): pass (test 'n = list.length is accepted (last item)' passes — exit 0, saved.items[1].done === true)
- `<n> = list.length + 1`: rejected (`INDEX_OUT_OF_RANGE`), no store write: pass (test 'n = list.length + 1 is rejected as INDEX_OUT_OF_RANGE, no store write' passes — exit 1, stderr matches /no item at index 2/, store unchanged)
- `<n>` on an empty list (any positive integer): rejected (`INDEX_OUT_OF_RANGE`): pass (test 'any positive n on an empty list is rejected as INDEX_OUT_OF_RANGE' passes — exit 1, stderr matches /no item at index 1/)
- `<n> = "abc"` or `<n> = "1.5"`: rejected (`INVALID_INDEX`), no store write: pass (tests 'n = "abc" is rejected...' and 'n = "1.5" is rejected...' both pass — exit 1, stderr matches /not a valid index/, store unchanged)
