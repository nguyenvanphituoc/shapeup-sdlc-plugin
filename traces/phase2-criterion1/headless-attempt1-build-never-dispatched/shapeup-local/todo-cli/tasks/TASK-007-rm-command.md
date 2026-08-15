---
type: task
feature: todo-cli
id: TASK-007
title: "Implement `rm <n>` command with index validation"
lens: standard
package: cli
status: ready
priority: 7
depends_on: [TASK-003]
unlocks: [TASK-008]
use_case_refs: [UC-RemoveTodo]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-RemoveTodo]]", "[[ux-behavior#Command-rm-n]]"]
estimated_hours: 1.5
tags: [feat]
---

# TASK-007: Implement `rm <n>` command with index validation

## Context
Implement `[[usecases/UC-RemoveTodo]]` Steps 1–8, including all three index-validation error
cases from `[[ux-behavior#Command-rm-n]]`'s Error Catalog. Same validation shape as TASK-006
(`done`) — reuse the same validation helper if practical, but this is a separate command file.

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/commands/rm.js` validates presence, numeric-ness, and range of `<n>` BEFORE any store
      mutation, then removes the item, saves, prints confirmation, exit code 0
- [ ] `node --test test/commands/rm.test.js` passes
- [ ] After removal, `nextId` in the saved store is unchanged (never decremented) — see
      `[[domain-model#Aggregate-TodoList]]` INV-01

### 🔢 Boundary Values
- [ ] `<n> = 0`: rejected (`INVALID_INDEX`), no store write
- [ ] `<n> = list.length`: accepted (removes last item)
- [ ] `<n> = list.length + 1`: rejected (`INDEX_OUT_OF_RANGE`), no store write
- [ ] `<n>` on an empty list (any positive integer): rejected (`INDEX_OUT_OF_RANGE`)
- [ ] `<n> = "abc"` or `<n> = "-1"`: rejected (`INVALID_INDEX`), no store write

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
