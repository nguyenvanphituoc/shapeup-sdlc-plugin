---
type: task
feature: todo-cli
id: TASK-002
title: "Implement TodoList domain module (add/complete/remove, in-memory)"
lens: standard
package: cli
status: ready
priority: 2
depends_on: [TASK-001]
unlocks: [TASK-003]
use_case_refs: [UC-AddTodo, UC-CompleteTodo, UC-RemoveTodo]
entities: [TodoList, TodoItem]
repositories: []
linked_docs: ["[[domain-model#Aggregate-TodoList]]"]
estimated_hours: 1.5
tags: [domain]
---

# TASK-002: Implement TodoList domain module (add/complete/remove, in-memory)

## Context
Implement the `TodoList` aggregate as defined in `[[domain-model#Aggregate-TodoList]]` —
pure in-memory logic, no file I/O (that's TASK-004). This module owns id assignment
(`nextId`, monotonic, never reused — INV-01) and the three state-transition operations.

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/domain/todo-list.js` exports functions/class implementing:
      `createEmpty()` → `{ nextId: 1, items: [] }`,
      `addItem(list, text)` → new list with `{id: list.nextId, text, done: false}` appended and
      `nextId` incremented,
      `completeAt(list, index1based)` → new list with `items[index-1].done = true`,
      `removeAt(list, index1based)` → new list with `items[index-1]` spliced out, `nextId`
      **unchanged** (never decremented/reused)
- [ ] A unit test file (e.g. `test/domain/todo-list.test.js`) exercises: add assigns increasing
      ids, complete on an already-done item is idempotent (no throw, stays done), remove does not
      reuse the removed item's id on a subsequent add
- [ ] `node --test test/domain/todo-list.test.js` (or the project's chosen test runner) passes

### 🔢 Boundary Values
- [ ] `completeAt`/`removeAt` at index 1 (first item) and index `items.length` (last item) both
      operate on the correct item, not an off-by-one neighbor
- [ ] `addItem` on an empty list assigns id `1`

## Implementation Notes
- This module does not validate `index1based` bounds or non-numeric input — that's the CLI
  command layer's job (TASK-005..008), per `[[ux-behavior]]` RULE-05. This module can assume
  a valid in-range integer index.
- `nextId` is a plain integer counter, not a UUID — matches `[[contracts/todo-store.contract]]`
  storage schema.

## Non-Go (not in this task)
- File I/O / persistence → TASK-004
- Index validation (non-numeric, out-of-range) → TASK-007, TASK-008
