---
type: task
feature: todo-cli
id: TASK-005
title: "Implement `list` command"
lens: standard
package: cli
status: done
priority: 5
depends_on: [TASK-003]
unlocks: [TASK-008]
use_case_refs: [UC-ListTodos]
entities: [TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/UC-ListTodos]]", "[[ux-behavior#Command-list]]"]
estimated_hours: 1
tags: [feat]
completed_at: 2026-08-15
---

# TASK-005: Implement `list` command

## Context
Implement `[[usecases/UC-ListTodos]]` Steps 1–3. Uses `src/store.js` (TASK-003).

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/commands/list.js` exports a function that loads the store, and for each item prints
      `[<n>] [x|  ] <text>` at its 1-based position (RULE-03), exit code 0
- [x] `node --test test/commands/list.test.js` passes

### 📭 Empty & Null States
- [x] Empty list (missing file or `items: []`): prints an explicit non-blank "no todos yet"-style
      message, not an empty string, not a crash (pitch explicit edge case) — exit code 0
- [x] `STORE_CORRUPTED`: stderr message, no stack trace, exit code 1 (does not fall through to
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


## Execution Log — 2026-08-15 (todo-cli/list-todos-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/commands/list.js` exports a function that loads the store, and for each item prints: pass (src/commands/list.js run(): loadStore() then list.items.forEach printing `[${idx+1}] [${marker}] ${item.text}\n`, exit 0; test 'lists two items with correct 1-based indices and done markers, exit code 0' → out[0]='[1] [ ] first\n', out[1]='[2] [x] second\n')
- `node --test test/commands/list.test.js` passes: pass (node --test test/commands/list.test.js → tests 6, pass 6, fail 0)
- Empty list (missing file or `items: []`): prints an explicit non-blank "no todos yet"-style: pass (tests 'missing store file prints explicit "no todos yet" message, exit code 0' and 'empty items array prints explicit "no todos yet" message, exit code 0' → both exit 0, stdout 'no todos yet\n' (non-blank))
- `STORE_CORRUPTED`: stderr message, no stack trace, exit code 1 (does not fall through to: pass (tests 'corrupted store file is rejected with STORE_CORRUPTED, no stack trace leaked to stdout, exit code 1' and 'wrong-shape store file is rejected with STORE_CORRUPTED, exit code 1' → exit 1, stderr matches /store file is corrupted/, no stack-trace pattern (/at Object|\.js:\d+/) in stderr, stdout empty (does not fall through to the empty-list message))


## Execution Log — 2026-08-15 (todo-cli/list-todos-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `src/commands/list.js` exports a function that loads the store, and for each item prints: pass (src/commands/list.js run() loads store via loadStore() and prints `[${idx+1}] [${marker}] ${item.text}` per item, exit 0; node --test test/commands/list.test.js → 'lists two items with correct 1-based indices and done markers, exit code 0' passes)
- `node --test test/commands/list.test.js` passes: pass (node --test test/commands/list.test.js → tests 6, pass 6, fail 0)
- Empty list (missing file or `items: []`): prints an explicit non-blank "no todos yet"-style: pass (tests 'missing store file prints explicit "no todos yet" message, exit code 0' and 'empty items array prints explicit "no todos yet" message, exit code 0' both pass, stdout 'no todos yet\n' non-blank, exit 0)
- `STORE_CORRUPTED`: stderr message, no stack trace, exit code 1 (does not fall through to: pass (tests 'corrupted store file is rejected with STORE_CORRUPTED, no stack trace leaked to stdout, exit code 1' and 'wrong-shape store file is rejected with STORE_CORRUPTED, exit code 1' both pass, exit 1, stderr matches /store file is corrupted/, no stack-trace pattern in stderr, stdout empty)
