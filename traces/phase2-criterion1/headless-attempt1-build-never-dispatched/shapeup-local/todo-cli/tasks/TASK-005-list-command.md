---
type: task
feature: todo-cli
id: TASK-005
title: "Implement `list` command"
lens: standard
package: cli
status: ready
priority: 5
depends_on: [TASK-003]
unlocks: [TASK-008]
use_case_refs: [UC-ListTodos]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-ListTodos]]", "[[ux-behavior#Command-list]]"]
estimated_hours: 1
tags: [feat]
---

# TASK-005: Implement `list` command

## Context
Implement `[[usecases/UC-ListTodos]]` Steps 1–3. Uses `src/store.js` (TASK-003).

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/commands/list.js` exports a function that loads the store, and for each item prints
      `[<n>] [x|  ] <text>` at its 1-based position (RULE-03), exit code 0
- [ ] `node --test test/commands/list.test.js` passes

### 📭 Empty & Null States
- [ ] Empty list (missing file or `items: []`): prints an explicit non-blank "no todos yet"-style
      message, not an empty string, not a crash (pitch explicit edge case) — exit code 0
- [ ] `STORE_CORRUPTED`: stderr message, no stack trace, exit code 1 (does not fall through to
      the empty-list message)

### 🧪 BDD Scenarios

**Scenario: List a non-empty store**
Given `./.todo.json` has two items, the second marked done
When  `list.js` is invoked
Then  stdout prints two lines with correct 1-based indices and done markers; exit code 0

**Scenario: List an empty store**
Given `./.todo.json` does not exist
When  `list.js` is invoked
Then  stdout prints a single explicit "no todos yet" line (not blank); exit code 0

## Non-Go (not in this task)
- `add`/`done`/`rm` commands → TASK-004, TASK-006, TASK-007
- argv routing → TASK-008
