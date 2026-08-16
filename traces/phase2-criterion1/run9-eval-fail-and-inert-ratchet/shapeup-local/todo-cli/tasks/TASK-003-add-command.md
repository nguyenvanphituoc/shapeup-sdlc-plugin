---
type: task
feature: todo-cli
id: TASK-003
title: "Implement `todo add <text>` command"
lens: standard
package: cli
status: done
priority: 3
depends_on: [TASK-002]
unlocks: [TASK-007]
use_case_refs: [UC-AddTodo]
entities: [TodoItem]
repositories: [TodoRepository]
linked_docs: ["[[usecases/UC-AddTodo]]", "[[ux-behavior#add-command]]"]
estimated_hours: 1
tags: [feat, cli]
completed_at: 2026-08-16
---

# TASK-003: Implement `todo add <text>` command

## Context
Implement [[usecases/UC-AddTodo#Steps]] as the `add` branch of the `bin/todo.js` dispatcher
scaffolded in TASK-001, using `TodoRepository` from TASK-002. Output states and exact messages
are pinned in [[ux-behavior#Command-add-command]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `node bin/todo.js add "buy milk"` on an empty/missing store exits 0, prints
      `Added: "1) buy milk"` to stdout, and the store now contains one item
      `{ text: "buy milk", done: false }`
- [x] A second `add` appends (does not overwrite) — running `add` twice results in 2 items in
      original order
- [x] `node bin/todo.js add` (no text) exits 1, prints an `E_MISSING_TEXT` message to stderr, and
      does not create/modify the store file
- [x] `node bin/todo.js add "   "` (whitespace-only) is treated the same as missing text
      (`E_MISSING_TEXT`)
- [x] Text is stored trimmed (leading/trailing whitespace removed, interior whitespace preserved)

### 🧪 BDD Scenarios

**Scenario: Add the first item to a fresh store**
Given `~/.todo.json` does not exist
When  the Developer runs `todo add "buy milk"`
Then  stdout prints `Added: "1) buy milk"`, exit code 0, and `~/.todo.json` now contains
      `[{ "text": "buy milk", "done": false }]`

**Scenario: Reject an add with no text**
Given any store state (existing or missing)
When  the Developer runs `todo add` with no text argument
Then  stderr prints the missing-text error, exit code 1, and the store file is unchanged
      (unchanged means: still missing if it was missing, byte-identical if it existed)

### 🔗 Integration Flow
**bin/todo.js `add` handler → TodoRepository → Filesystem**
Given the store currently holds N items
When  `todo add <text>` is invoked with valid text
Then  `TodoRepository.save()` persists N+1 items, the new one appended last
And   the caller (stdout) reports the 1-based position `N+1`

## Non-Go (not in this task)
- `list`/`done`/`rm` commands → TASK-004, TASK-005, TASK-006
- Store corruption handling itself → implemented in TASK-002; this task only wires the
  `E_STORE_CORRUPTED` case through to the `add` command's stderr/exit-1 output


## Execution Log — 2026-08-15 (todo-cli/add-todo-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js add "buy milk"` on an empty/missing store exits 0, prints: pass (node --test test/commands/add.test.js -> 'add on empty/missing store exits 0 and prints Added: "1) buy milk"' passed; manual: HOME=$(mktemp -d) node bin/todo.js add "buy milk" -> stdout 'Added: "1) buy milk"', exit=0)
- A second `add` appends (does not overwrite) — running `add` twice results in 2 items in: pass (node --test test/commands/add.test.js -> 'a second add appends, resulting in 2 items in original order' passed)
- `node bin/todo.js add` (no text) exits 1, prints an `E_MISSING_TEXT` message to stderr, and: pass (node --test test/commands/add.test.js -> 'add with no text exits 1, prints E_MISSING_TEXT message to stderr, no store file created' passed; manual: HOME=$(mktemp -d) node bin/todo.js add -> stderr 'Error: missing todo text', exit=1)
- `node bin/todo.js add "   "` (whitespace-only) is treated the same as missing text: pass (node --test test/commands/add.test.js -> 'add with whitespace-only text is treated as missing text' passed; manual: HOME=$(mktemp -d) node bin/todo.js add "   " -> stderr 'Error: missing todo text', exit=1)
- Text is stored trimmed (leading/trailing whitespace removed, interior whitespace preserved): pass (node --test test/commands/add.test.js -> 'text is stored trimmed, interior whitespace preserved' passed (input '  buy   milk  ' stored as 'buy   milk'))


## Execution Log — 2026-08-16 (todo-cli/add-todo-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js add "buy milk"` on an empty/missing store exits 0, prints: pass (node --test test/commands/add.test.js -> 'add on empty/missing store exits 0 and prints Added: "1) buy milk"' passed)
- A second `add` appends (does not overwrite) — running `add` twice results in 2 items in: pass (node --test test/commands/add.test.js -> 'a second add appends, resulting in 2 items in original order' passed)
- `node bin/todo.js add` (no text) exits 1, prints an `E_MISSING_TEXT` message to stderr, and: pass (node --test test/commands/add.test.js -> 'add with no text exits 1, prints E_MISSING_TEXT message to stderr, no store file created' passed)
- `node bin/todo.js add "   "` (whitespace-only) is treated the same as missing text: pass (node --test test/commands/add.test.js -> 'add with whitespace-only text is treated as missing text' passed)
- Text is stored trimmed (leading/trailing whitespace preserved, interior whitespace preserved): pass (node --test test/commands/add.test.js -> 'text is stored trimmed, interior whitespace preserved' passed (input '  buy   milk  ' stored as 'buy   milk'))


## Execution Log — 2026-08-16 (todo-cli/add-todo-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js add "buy milk"` on an empty/missing store exits 0, prints: pass (node --test test/commands/add.test.js -> 'add on empty/missing store exits 0 and prints Added: "1) buy milk"' passed)
- A second `add` appends (does not overwrite) — running `add` twice results in 2 items in: pass (node --test test/commands/add.test.js -> 'a second add appends, resulting in 2 items in original order' passed)
- `node bin/todo.js add` (no text) exits 1, prints an `E_MISSING_TEXT` message to stderr, and: pass (node --test test/commands/add.test.js -> 'add with no text exits 1, prints E_MISSING_TEXT message to stderr, no store file created' passed)
- `node bin/todo.js add "   "` (whitespace-only) is treated the same as missing text: pass (node --test test/commands/add.test.js -> 'add with whitespace-only text is treated as missing text' passed)
- Text is stored trimmed (leading/trailing whitespace removed, interior whitespace preserved): pass (node --test test/commands/add.test.js -> 'text is stored trimmed, interior whitespace preserved' passed (input '  buy   milk  ' stored as 'buy   milk'))
