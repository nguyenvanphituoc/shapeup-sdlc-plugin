---
type: task
feature: todo-cli
id: TASK-004
title: "Implement `todo list` command"
lens: standard
package: cli
status: done
priority: 3
depends_on: [TASK-002]
unlocks: [TASK-007]
use_case_refs: [UC-ListTodos]
entities: [TodoItem]
repositories: [TodoRepository]
linked_docs: ["[[usecases/UC-ListTodos]]", "[[ux-behavior#list-command]]"]
estimated_hours: 1
tags: [feat, cli]
completed_at: 2026-08-16
---

# TASK-004: Implement `todo list` command

## Context
Implement [[usecases/UC-ListTodos#Steps]] as the `list` branch of the `bin/todo.js` dispatcher,
using `TodoRepository` from TASK-002. Output states are pinned in
[[ux-behavior#Command-list-command]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `node bin/todo.js list` on a missing store prints `No todos yet.` to stdout and exits 0
- [x] `node bin/todo.js list` with items prints one line per item, 1-based:
      `N) [ ] <text>` for open items, `N) [x] <text>` for done items, in store order
- [x] `list` never writes to `~/.todo.json` (read-only) under any input, including a corrupted
      store

### 📭 Empty & Null States
- [x] Empty result (missing file OR file containing `[]`): prints `No todos yet.`, exit 0 — both
      paths produce identical output, `ENOENT` is never surfaced as an error
- [x] No crash when an item's `done` field is unexpectedly missing/undefined on a hand-edited
      file — treat as falsy (renders `[ ]`), do not throw

### 🧪 BDD Scenarios

**Scenario: List a populated store**
Given `~/.todo.json` contains `[{ "text": "buy milk", "done": false }, { "text": "write spec", "done": true }]`
When  the Developer runs `todo list`
Then  stdout prints exactly two lines: `1) [ ] buy milk` and `2) [x] write spec`, exit code 0

**Scenario: List an empty/missing store**
Given `~/.todo.json` does not exist
When  the Developer runs `todo list`
Then  stdout prints `No todos yet.`, exit code 0

## Non-Go (not in this task)
- `add`/`done`/`rm` commands → TASK-003, TASK-005, TASK-006
- Numbering persistence across invocations (there is none — numbering is always recomputed
  fresh per [[ux-behavior#list-command]] RULE-04)


## Execution Log — 2026-08-15 (todo-cli/list-todos-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js list` on a missing store prints `No todos yet.` to stdout and exits 0: pass (node --test test/commands/list.test.js -> 'list on missing store prints "No todos yet." and exits 0' passed; manual: HOME=$(mktemp -d) node bin/todo.js list -> stdout 'No todos yet.', exit=0)
- `node bin/todo.js list` with items prints one line per item, 1-based:: pass (node --test test/commands/list.test.js -> 'list with items prints one line per item, 1-based, in store order' passed; manual: HOME=$(mktemp -d) sh -c 'node bin/todo.js add "buy milk" && node bin/todo.js done 1 && node bin/todo.js list' -> '1) [x] buy milk', exit=0)
- `list` never writes to `~/.todo.json` (read-only) under any input, including a corrupted: pass (node --test test/commands/list.test.js -> 'list never writes to the store, even for a corrupted store' passed (file contents byte-identical before/after))
- Empty result (missing file OR file containing `[]`): prints `No todos yet.`, exit 0 — both: pass (node --test test/commands/list.test.js -> 'list on missing store...' and 'list on store containing [] prints "No todos yet." and exits 0, identical to missing store' both passed)
- No crash when an item's `done` field is unexpectedly missing/undefined on a hand-edited: pass (node --test test/commands/list.test.js -> 'list does not crash when an item is missing the done field, treats it as falsy' passed (renders '1) [ ] no done field'))


## Execution Log — 2026-08-15 (todo-cli/list-todos-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js list` on a missing store prints `No todos yet.` to stdout and exits 0: pass (node --test test/commands/list.test.js -> 'list on missing store prints "No todos yet." and exits 0' passed)
- `node bin/todo.js list` with items prints one line per item, 1-based:: pass (node --test test/commands/list.test.js -> 'list with items prints one line per item, 1-based, in store order' passed (stdout '1) [ ] buy milk\n2) [x] write spec\n'))
- `list` never writes to `~/.todo.json` (read-only) under any input, including a corrupted: pass (node --test test/commands/list.test.js -> 'list never writes to the store, even for a corrupted store' passed (file contents byte-identical before/after))
- Empty result (missing file OR file containing `[]`): prints `No todos yet.`, exit 0 — both: pass (node --test test/commands/list.test.js -> 'list on missing store...' and 'list on store containing [] prints...' both passed)
- No crash when an item's `done` field is unexpectedly missing/undefined on a hand-edited: pass (node --test test/commands/list.test.js -> 'list does not crash when an item is missing the done field, treats it as falsy' passed (renders '1) [ ] no done field'))


## Execution Log — 2026-08-16 (todo-cli/list-todos-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js list` on a missing store prints `No todos yet.` to stdout and exits 0: pass (node --test test/commands/list.test.js -> 'list on missing store prints "No todos yet." and exits 0' passed)
- `node bin/todo.js list` with items prints one line per item, 1-based:: pass (node --test test/commands/list.test.js -> 'list with items prints one line per item, 1-based, in store order' passed (stdout '1) [ ] buy milk\n2) [x] write spec\n'))
- `list` never writes to `~/.todo.json` (read-only) under any input, including a corrupted: pass (node --test test/commands/list.test.js -> 'list never writes to the store, even for a corrupted store' passed (file contents byte-identical before/after))
- Empty result (missing file OR file containing `[]`): prints `No todos yet.`, exit 0 — both: pass (node --test test/commands/list.test.js -> 'list on missing store...' and 'list on store containing [] prints...' both passed)
- No crash when an item's `done` field is unexpectedly missing/undefined on a hand-edited: pass (node --test test/commands/list.test.js -> 'list does not crash when an item is missing the done field, treats it as falsy' passed (renders '1) [ ] no done field'))


## Execution Log — 2026-08-16 (todo-cli/list-todos-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js list` on a missing store prints `No todos yet.` to stdout and exits 0: pass (node --test test/commands/list.test.js -> 'list on missing store prints "No todos yet." and exits 0' passed)
- `node bin/todo.js list` with items prints one line per item, 1-based:: pass (node --test test/commands/list.test.js -> 'list with items prints one line per item, 1-based, in store order' passed)
- `list` never writes to `~/.todo.json` (read-only) under any input, including a corrupted: pass (node --test test/commands/list.test.js -> 'list never writes to the store, even for a corrupted store' passed (file contents byte-identical before/after))
- Empty result (missing file OR file containing `[]`): prints `No todos yet.`, exit 0 — both: pass (node --test test/commands/list.test.js -> 'list on store containing [] prints "No todos yet." and exits 0, identical to missing store' passed)
- No crash when an item's `done` field is unexpectedly missing/undefined on a hand-edited: pass (node --test test/commands/list.test.js -> 'list does not crash when an item is missing the done field, treats it as falsy' passed (renders '1) [ ] no done field'))


## Execution Log — 2026-08-16 (todo-cli/list-todos-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js list` on a missing store prints `No todos yet.` to stdout and exits 0: pass (node --test test/commands/list.test.js -> 'list on missing store prints "No todos yet." and exits 0' passed)
- `node bin/todo.js list` with items prints one line per item, 1-based:: pass (node --test test/commands/list.test.js -> 'list with items prints one line per item, 1-based, in store order' passed)
- `list` never writes to `~/.todo.json` (read-only) under any input, including a corrupted: pass (node --test test/commands/list.test.js -> 'list never writes to the store, even for a corrupted store' passed (file contents byte-identical before/after))
- Empty result (missing file OR file containing `[]`): prints `No todos yet.`, exit 0 — both: pass (node --test test/commands/list.test.js -> 'list on store containing [] prints "No todos yet." and exits 0, identical to missing store' passed)
- No crash when an item's `done` field is unexpectedly missing/undefined on a hand-edited: pass (node --test test/commands/list.test.js -> 'list does not crash when an item is missing the done field, treats it as falsy' passed (renders '1) [ ] no done field'))


## Execution Log — 2026-08-16 (todo-cli/list-todos-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js list` on a missing store prints `No todos yet.` to stdout and exits 0: pass (node --test test/commands/list.test.js -> 'list on missing store prints "No todos yet." and exits 0' passed)
- `node bin/todo.js list` with items prints one line per item, 1-based:: pass (node --test test/commands/list.test.js -> 'list with items prints one line per item, 1-based, in store order' passed)
- `list` never writes to `~/.todo.json` (read-only) under any input, including a corrupted: pass (node --test test/commands/list.test.js -> 'list never writes to the store, even for a corrupted store' passed (file contents byte-identical before/after))
- Empty result (missing file OR file containing `[]`): prints `No todos yet.`, exit 0 — both: pass (node --test test/commands/list.test.js -> 'list on store containing [] prints "No todos yet." and exits 0, identical to missing store' passed)
- No crash when an item's `done` field is unexpectedly missing/undefined on a hand-edited: pass (node --test test/commands/list.test.js -> 'list does not crash when an item is missing the done field, treats it as falsy' passed)
