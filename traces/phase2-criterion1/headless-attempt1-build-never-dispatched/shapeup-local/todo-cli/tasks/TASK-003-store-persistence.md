---
type: task
feature: todo-cli
id: TASK-003
title: "Implement TodoStoreRepository (JSON file, corruption + missing-file handling, atomic write)"
lens: standard
package: cli
status: ready
priority: 3
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004, TASK-005, TASK-006, TASK-007]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: [TodoList]
repositories: [TodoStoreRepository]
linked_docs: ["[[contracts/todo-store.contract]]", "[[domain-model#Repository-Interfaces]]"]
estimated_hours: 3
tags: [feat, persistence]
---

# TASK-003: Implement TodoStoreRepository (JSON file, corruption + missing-file handling, atomic write)

## Context
Implement `TodoStoreRepository` per `[[contracts/todo-store.contract]]`. This is the riskiest
area of the pitch and was de-risked by `.shapeup/todo-cli/orient/spike-persistence.md` — follow
its confirmed patterns exactly (they are not speculative).

- Request shape matches `[[contracts/todo-store.contract#Method-save-list-TodoList-Write]]` table
- Response mapping matches `[[contracts/todo-store.contract#Method-load-Read]]` table
- All error codes in the contract's Error Cases tables are handled

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/store.js` exports `load()` and `save(list)` per the contract's method signatures
- [ ] `save(list)` writes to `./.todo.json.tmp` via `fs.writeFileSync`, then renames to
      `./.todo.json` via `fs.renameSync` — never a direct `fs.writeFileSync` on the real path
      (contract "Write procedure")
- [ ] `load()` on a missing file (`err.code === 'ENOENT'`) returns `{ nextId: 1, items: [] }` —
      never throws (INV-02 / contract "Read Output" null behavior)
- [ ] `load()` on a file that exists but fails `JSON.parse` (catches `SyntaxError`) throws/returns
      a distinguishable `StoreCorruptedError` — never silently returns an empty list (INV-03)
- [ ] `load()` on a file that parses but has the wrong shape (`items` not an array, or an item
      missing `id`/`text`) also raises `StoreCorruptedError`
- [ ] `node --test test/store.test.js` (or equivalent) passes, covering: missing file → empty
      list, corrupted file → `StoreCorruptedError`, round-trip save→load returns the same data

### 📭 Empty & Null States
- [ ] `load()` on a missing file returns `{ nextId: 1, items: [] }`, never `null` and never throws
- [ ] `load()` on a store with `items: []` (valid empty JSON) returns that empty list, not an error

## Implementation Notes
- Use Node core `fs` only — no dependency (`fs.readFileSync`/`fs.writeFileSync`/`fs.renameSync`),
  per `.shapeup/todo-cli/orient/spike-persistence.md` conclusion.
- Distinguish `ENOENT` from other read errors via `err.code`, not by matching the message string.
- The temp filename is `./.todo.json.tmp`, matching the contract exactly (a later task's tests
  may assert on this literal path when checking no half-written state leaks).

## Non-Go (not in this task)
- CLI argument parsing / command dispatch → TASK-004..008
- Concurrent-write locking → explicitly out of scope (accepted residual risk, see
  `[[integration#Local-Filesystem]]`)
