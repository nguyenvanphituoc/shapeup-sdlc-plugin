---
type: task
feature: todo-cli
id: TASK-004
title: "Implement `add <text>` command"
lens: standard
package: cli
status: done
priority: 4
depends_on: [TASK-003]
unlocks: [TASK-008]
use_case_refs: [UC-AddTodo]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-AddTodo]]", "[[ux-behavior#Command-add-text]]"]
estimated_hours: 1
tags: [feat]
completed_at: 2026-08-15
---

# TASK-004: Implement `add <text>` command

## Context
Implement `[[usecases/UC-AddTodo]]` Steps 1–6. Uses `src/domain/todo-list.js` (TASK-002) and
`src/store.js` (TASK-003).

- Request shape matches `[[contracts/todo-store.contract#Method-save-list-TodoList-Write]]` table
- Response mapping matches `[[contracts/todo-store.contract#Method-load-Read]]` table
- All error codes in the contract Error Cases table are handled

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/commands/add.js` exports a function taking the raw args array and performing UC-AddTodo
      Steps 1–6: trim, validate non-empty, load, `addItem`, save, print confirmation to stdout,
      return exit code 0
- [x] `node --test test/commands/add.test.js` passes

### 🧪 BDD Scenarios

**Scenario: Add a valid item**
Given an empty or missing `./.todo.json`
When  `add.js` is invoked with `["Buy milk"]`
Then  `./.todo.json` contains one item with `text: "Buy milk"`, `done: false`, and stdout
      confirms the addition; exit code 0

**Scenario: Reject empty text**
Given any store state
When  `add.js` is invoked with `[]` (no text) or `["   "]` (whitespace-only)
Then  no store write occurs, stderr names "text is required" (`MISSING_TEXT`), exit code 1

## Non-Go (not in this task)
- `list`/`done`/`rm` commands → TASK-005, TASK-006, TASK-007
- argv routing (`process.argv` → this function) → TASK-008


## Execution Log — 2026-08-15 (todo-cli/add-todo-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/commands/add.js` exports a function taking the raw args array and performing UC-AddTodo Steps 1–6: trim, validate non-empty, load, `addItem`, save, print confirmation to stdout, return exit code 0: pass (src/commands/add.js exports `run(args)` — joins+trims args, validates non-empty (else stderr + exit 1), calls store.load(), domain addItem, store.save(), writes confirmation to stdout, returns 0. Manually invoked via test/commands/add.test.js 'add a valid item' case: exit 0, stdout matches /Buy milk/, ./.todo.json contains one item with text 'Buy milk', done:false.)
- `node --test test/commands/add.test.js` passes: pass (node --test test/commands/add.test.js → tests 4, pass 4, fail 0 (valid add, empty-args rejection, whitespace-only rejection, id-never-reused via addItem sequence).)
