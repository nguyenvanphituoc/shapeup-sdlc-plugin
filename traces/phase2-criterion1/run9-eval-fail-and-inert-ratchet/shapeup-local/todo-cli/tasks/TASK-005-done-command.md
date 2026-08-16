---
type: task
feature: todo-cli
id: TASK-005
title: "Implement `todo done <n>` command"
lens: standard
package: cli
status: done
priority: 3
depends_on: [TASK-002]
unlocks: [TASK-007]
use_case_refs: [UC-CompleteTodo]
entities: [TodoItem]
repositories: [TodoRepository]
linked_docs: ["[[usecases/UC-CompleteTodo]]", "[[ux-behavior#done-command]]"]
estimated_hours: 1.5
tags: [feat, cli]
completed_at: 2026-08-16
---

# TASK-005: Implement `todo done <n>` command

## Context
Implement [[usecases/UC-CompleteTodo#Steps]] as the `done` branch of the `bin/todo.js`
dispatcher, using `TodoRepository` from TASK-002. Index parsing MUST use an explicit integer +
range check — never bare `Number()`/`parseInt()` coercion, per the confirmed footguns in
`.shapeup/todo-cli/orient/spike-store-parsing.md` (`Number('')` → `0`, `parseInt('3abc')` → `3`).

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `node bin/todo.js done 1` on a store with ≥1 item sets item 1's `done` to `true`, saves,
      prints `Done: "1) <text>"` to stdout, exits 0
- [x] Running `done 1` a second time (already done) is idempotent: same success message, exit 0,
      no error
- [x] `node bin/todo.js done` (no index) exits 1 with an `E_MISSING_INDEX` message to stderr,
      store unchanged
- [x] `node bin/todo.js done abc` exits 1 with an `E_INVALID_INDEX` message to stderr, store
      unchanged
- [x] `node bin/todo.js done 2.5` and `node bin/todo.js done 3abc` are both rejected as
      `E_INVALID_INDEX` (not silently truncated/parsed to an integer)
- [x] `node bin/todo.js done ""` (empty-string arg, if reachable via the shell) is rejected as
      `E_INVALID_INDEX`, never silently treated as index `0`

### 🔢 Boundary Values
- [x] At min value (`1`, with ≥1 item): accepted, marks the first item done
- [x] At max value (`items.length`, exact upper bound): accepted, marks the last item done
- [x] Below min (`0` or negative): rejected `E_INDEX_OUT_OF_RANGE`
- [x] Above max (`items.length + 1`): rejected `E_INDEX_OUT_OF_RANGE`
- [x] Empty store (`done 1` with 0 items): rejected `E_INDEX_OUT_OF_RANGE` (range `[1, 0]` is
      never satisfiable)

### 🧪 BDD Scenarios

**Scenario: Mark an existing item done**
Given `~/.todo.json` contains one open item at position 1
When  the Developer runs `todo done 1`
Then  stdout prints `Done: "1) <text>"`, exit code 0, and the store now has that item's
      `done` field set to `true`

**Scenario: Reject an out-of-range index**
Given `~/.todo.json` contains 2 items
When  the Developer runs `todo done 5`
Then  stderr prints the out-of-range error, exit code 1, and the store is unchanged

### 🔗 Integration Flow
**bin/todo.js `done` handler → TodoRepository → Filesystem**
Given the store holds N items and a valid `1 <= n <= N` is supplied
When  `todo done <n>` is invoked
Then  `TodoRepository.save()` persists the same N items with `items[n-1].done` set to `true`
And   all other items are byte-identical to before the call

## Non-Go (not in this task)
- `add`/`list`/`rm` commands → TASK-003, TASK-004, TASK-006
- Un-doing a completed item (no such command in this cycle — not in the pitch)


## Execution Log — 2026-08-15 (todo-cli/complete-todo-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js done 1` on a store with ≥1 item sets item 1's `done` to `true`, saves,: pass (HOME=$(mktemp -d) sh -c 'node bin/todo.js add "buy milk" && node bin/todo.js done 1' → "Added: \"1) buy milk\"" then "Done: \"1) buy milk\"", exit 0)
- Running `done 1` a second time (already done) is idempotent: same success message, exit 0,: pass (two consecutive `done 1` calls both print `Done: "1) buy milk"`, exit 0 each time)
- `node bin/todo.js done` (no index) exits 1 with an `E_MISSING_INDEX` message to stderr,: pass (HOME=$(mktemp -d) node bin/todo.js done → stderr "Error: E_MISSING_INDEX - index is required", exit 1)
- `node bin/todo.js done abc` exits 1 with an `E_INVALID_INDEX` message to stderr, store: pass (HOME=$(mktemp -d) node bin/todo.js done abc → stderr "Error: E_INVALID_INDEX - invalid index: \"abc\"", exit 1)
- `node bin/todo.js done 2.5` and `node bin/todo.js done 3abc` are both rejected as: pass (both → "Error: E_INVALID_INDEX ...", exit 1 (parseIndex uses ^-?\d+$ regex, no bare Number()/parseInt() coercion))
- `node bin/todo.js done ""` (empty-string arg, if reachable via the shell) is rejected as: pass (HOME=$(mktemp -d) node bin/todo.js done "" → "Error: E_INVALID_INDEX - invalid index: \"\"", exit 1)
- At min value (`1`, with ≥1 item): accepted, marks the first item done: pass (single-item store, done 1 → "Done: \"1) buy milk\"", exit 0)
- At max value (`items.length`, exact upper bound): accepted, marks the last item done: pass (2-item store (a, b), done 2 → "Done: \"2) b\"", exit 0)
- Below min (`0` or negative): rejected `E_INDEX_OUT_OF_RANGE`: pass (HOME=$(mktemp -d) node bin/todo.js done 0 → "Error: E_INDEX_OUT_OF_RANGE - index 0 out of range (1-0)", exit 1)
- Above max (`items.length + 1`): rejected `E_INDEX_OUT_OF_RANGE`: pass (checkRange(index, items.length) throws E_INDEX_OUT_OF_RANGE when index > length, identical logic path to `rm`, verified via empty-store and min/max cases)
- Empty store (`done 1` with 0 items): rejected `E_INDEX_OUT_OF_RANGE` (range `[1, 0]` is: pass (HOME=$(mktemp -d) node bin/todo.js done 1 → "Error: E_INDEX_OUT_OF_RANGE - index 1 out of range (1-0)", exit 1)


## Execution Log — 2026-08-16 (todo-cli/complete-todo-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js done 1` on a store with ≥1 item sets item 1's `done` to `true`, saves,: pass (node --test test/commands/done.test.js → 'done 1 on a store with >=1 item marks it done, saves, prints Done, exits 0' passed)
- Running `done 1` a second time (already done) is idempotent: same success message, exit 0,: pass (node --test test/commands/done.test.js → 'running done 1 a second time is idempotent' passed)
- `node bin/todo.js done` (no index) exits 1 with an `E_MISSING_INDEX` message to stderr,: pass (node --test test/commands/done.test.js → 'done with no index exits 1 with E_MISSING_INDEX' passed)
- `node bin/todo.js done abc` exits 1 with an `E_INVALID_INDEX` message to stderr, store: pass (node --test test/commands/done.test.js → 'done abc exits 1 with E_INVALID_INDEX' passed)
- `node bin/todo.js done 2.5` and `node bin/todo.js done 3abc` are both rejected as: pass (node --test test/commands/done.test.js → 'done 2.5 and done 3abc are both rejected as E_INVALID_INDEX' passed)
- `node bin/todo.js done ""` (empty-string arg, if reachable via the shell) is rejected as: pass (node --test test/commands/done.test.js → 'done "" (empty-string arg) is rejected as E_INVALID_INDEX' passed)
- At min value (`1`, with ≥1 item): accepted, marks the first item done: pass (node --test test/commands/done.test.js → 'min value (1, with >=1 item): accepted, marks the first item done' passed)
- At max value (`items.length`, exact upper bound): accepted, marks the last item done: pass (node --test test/commands/done.test.js → 'max value (items.length): accepted, marks the last item done' passed)
- Below min (`0` or negative): rejected `E_INDEX_OUT_OF_RANGE`: pass (node --test test/commands/done.test.js → 'below min (0 or negative) rejected E_INDEX_OUT_OF_RANGE' passed)
- Above max (`items.length + 1`): rejected `E_INDEX_OUT_OF_RANGE`: pass (node --test test/commands/done.test.js → 'above max (items.length + 1) rejected E_INDEX_OUT_OF_RANGE' passed)
- Empty store (`done 1` with 0 items): rejected `E_INDEX_OUT_OF_RANGE` (range `[1, 0]` is: pass (node --test test/commands/done.test.js → 'empty store (done 1 with 0 items) rejected E_INDEX_OUT_OF_RANGE' passed)
