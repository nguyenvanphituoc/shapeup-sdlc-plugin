---
type: task
feature: todo-cli
id: TASK-006
title: "Implement `done <n>` command with index validation"
lens: standard
package: cli
status: ready
priority: 6
depends_on: [TASK-003]
unlocks: [TASK-008]
use_case_refs: [UC-CompleteTodo]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-CompleteTodo]]", "[[ux-behavior#Command-done-n]]"]
estimated_hours: 1.5
tags: [feat]
---

# TASK-006: Implement `done <n>` command with index validation

## Context
Implement `[[usecases/UC-CompleteTodo]]` Steps 1–8, including all three index-validation error
cases from `[[ux-behavior#Command-done-n]]`'s Error Catalog.

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/commands/done.js` validates presence, numeric-ness, and range of `<n>` BEFORE any
      store mutation, then marks the item done, saves, prints confirmation, exit code 0
- [ ] `node --test test/commands/done.test.js` passes

### 🔢 Boundary Values
- [ ] `<n> = 0`: rejected (`INVALID_INDEX`), no store write
- [ ] `<n> = list.length`: accepted (last item)
- [ ] `<n> = list.length + 1`: rejected (`INDEX_OUT_OF_RANGE`), no store write
- [ ] `<n>` on an empty list (any positive integer): rejected (`INDEX_OUT_OF_RANGE`)
- [ ] `<n> = "abc"` or `<n> = "1.5"`: rejected (`INVALID_INDEX`), no store write

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
