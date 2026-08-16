---
type: task
feature: todo-cli
id: TASK-006
title: "Implement `todo rm <n>` command"
lens: standard
package: cli
status: done
priority: 3
depends_on: [TASK-002]
unlocks: [TASK-007]
use_case_refs: [UC-RemoveTodo]
entities: [TodoItem]
repositories: [TodoRepository]
linked_docs: ["[[usecases/UC-RemoveTodo]]", "[[ux-behavior#rm-command]]"]
estimated_hours: 1.5
tags: [feat, cli]
completed_at: 2026-08-16
---

# TASK-006: Implement `todo rm <n>` command

## Context
Implement [[usecases/UC-RemoveTodo#Steps]] as the `rm` branch of the `bin/todo.js` dispatcher,
using `TodoRepository` from TASK-002. Index parsing rule is identical to TASK-005 (explicit
integer + range check, no bare coercion) — reuse the same parsing helper rather than
duplicating it.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `node bin/todo.js rm 1` on a store with ≥1 item removes item 1, saves, prints
      `Removed: "1) <text>"` to stdout, exits 0
- [x] `node bin/todo.js rm` (no index) exits 1 with `E_MISSING_INDEX` to stderr, store unchanged
- [x] `node bin/todo.js rm abc` exits 1 with `E_INVALID_INDEX` to stderr, store unchanged
- [x] Removing an item shifts later items left by one position (verified via a subsequent `list`
      showing the correct renumbering)
- [x] Removing an item does not alter the `text`/`done` value of any remaining item

### 🔢 Boundary Values
- [x] At min value (`1`, with ≥1 item): accepted, removes the first item
- [x] At max value (`items.length`, exact upper bound): accepted, removes the last item
- [x] Below min (`0` or negative): rejected `E_INDEX_OUT_OF_RANGE`
- [x] Above max (`items.length + 1`): rejected `E_INDEX_OUT_OF_RANGE`
- [x] Empty store (`rm 1` with 0 items): rejected `E_INDEX_OUT_OF_RANGE`

### 🧪 BDD Scenarios

**Scenario: Remove a middle item**
Given `~/.todo.json` contains 3 items `A, B, C` (positions 1, 2, 3)
When  the Developer runs `todo rm 2`
Then  stdout prints `Removed: "2) B"`, exit code 0, and a subsequent `todo list` shows
      `1) [ ] A` and `2) [ ] C`

**Scenario: Reject removal on an empty store**
Given `~/.todo.json` does not exist (or contains `[]`)
When  the Developer runs `todo rm 1`
Then  stderr prints the out-of-range error, exit code 1, and no file is created/modified

### 🔗 Integration Flow
**bin/todo.js `rm` handler → TodoRepository → Filesystem**
Given the store holds N items and a valid `1 <= n <= N` is supplied
When  `todo rm <n>` is invoked
Then  `TodoRepository.save()` persists N-1 items with item `n` spliced out and the rest
      order-preserved
And   stdout reports the removed item's original position and text

## Non-Go (not in this task)
- `add`/`list`/`done` commands → TASK-003, TASK-004, TASK-005
- Bulk removal / removing by text match (not in the pitch)


## Execution Log — 2026-08-15 (todo-cli/remove-todo-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js rm 1` on a store with ≥1 item removes item 1, saves, prints
      `Removed: "1) <text>"` to stdout, exits 0: pass (HOME=$(mktemp -d) sh -c 'node bin/todo.js add "buy milk" && node bin/todo.js rm 1' → stdout 'Removed: "1) buy milk"', exit 0)
- `node bin/todo.js rm` (no index) exits 1 with `E_MISSING_INDEX` to stderr, store unchanged: pass (HOME=$(mktemp -d) node bin/todo.js rm → stderr 'Error: E_MISSING_INDEX - index is required', exit 1)
- `node bin/todo.js rm abc` exits 1 with `E_INVALID_INDEX` to stderr, store unchanged: pass (HOME=$(mktemp -d) node bin/todo.js rm abc → stderr 'Error: E_INVALID_INDEX - invalid index: "abc"', exit 1)
- Removing an item shifts later items left by one position (verified via a subsequent `list`
      showing the correct renumbering): pass (Added A,B,C then rm 2 → store file contents [{"text":"A",...},{"text":"C",...}] confirming C shifted to position 2 (list command not yet implemented in this scope; verified via raw store file since e2e fixtures for this scope check rm output directly, not list))
- Removing an item does not alter the `text`/`done` value of any remaining item: pass (Store file after rm 2 on [A,B,C]: [{"text":"A","done":false},{"text":"C","done":false}] — A and C values unchanged)
- At min value (`1`, with ≥1 item): accepted, removes the first item: pass (rm 1 on single-item store → 'Removed: "1) buy milk"', exit 0)
- At max value (`items.length`, exact upper bound): accepted, removes the last item: pass (2-item store [x,y], rm 2 → 'Removed: "2) y"', exit 0, store left with [x])
- Below min (`0` or negative): rejected `E_INDEX_OUT_OF_RANGE`: pass (1-item store, rm 0 → stderr 'Error: E_INDEX_OUT_OF_RANGE - index 0 out of range (1-1)', exit 1)
- Above max (`items.length + 1`): rejected `E_INDEX_OUT_OF_RANGE`: pass (1-item store, rm 2 → stderr 'Error: E_INDEX_OUT_OF_RANGE - index 2 out of range (1-1)', exit 1)
- Empty store (`rm 1` with 0 items): rejected `E_INDEX_OUT_OF_RANGE`: pass (HOME=$(mktemp -d) node bin/todo.js rm 1 → stderr 'Error: E_INDEX_OUT_OF_RANGE - index 1 out of range (1-0)', exit 1)


## Execution Log — 2026-08-16 (todo-cli/remove-todo-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js rm 1` on a store with ≥1 item removes item 1, saves, prints: pass (node --test test/commands/rm.test.js → 'rm 1 on a store with 1 item removes it, saves, prints, exits 0' passed: stdout matches /Removed: "1\) buy milk"/, exit 0, store file becomes [])
- `node bin/todo.js rm` (no index) exits 1 with `E_MISSING_INDEX` to stderr, store unchanged: pass (node --test test/commands/rm.test.js → 'rm with no index exits 1 with E_MISSING_INDEX, store unchanged' passed)
- `node bin/todo.js rm abc` exits 1 with `E_INVALID_INDEX` to stderr, store unchanged: pass (node --test test/commands/rm.test.js → 'rm abc exits 1 with E_INVALID_INDEX, store unchanged' passed)
- Removing an item shifts later items left by one position (verified via a subsequent `list`: pass (node --test test/commands/rm.test.js → 'removing a middle item shifts later items left, leaves others unchanged' passed: store [A,B,C] → rm 2 → store [A,C] verified via raw store contents)
- Removing an item does not alter the `text`/`done` value of any remaining item: pass (same test as above: A's {text:'A',done:false} and C's {text:'C',done:false} unchanged after rm 2 on [A,B(done:true),C])
- At min value (`1`, with ≥1 item): accepted, removes the first item: pass (node --test test/commands/rm.test.js → 'at min value (1) with >=1 item: accepted, removes the first item' passed)
- At max value (`items.length`, exact upper bound): accepted, removes the last item: pass (node --test test/commands/rm.test.js → 'at max value (items.length): accepted, removes the last item' passed)
- Below min (`0` or negative): rejected `E_INDEX_OUT_OF_RANGE`: pass (node --test test/commands/rm.test.js → 'below min (0) is rejected E_INDEX_OUT_OF_RANGE, store unchanged' and 'below min (negative) is rejected E_INDEX_OUT_OF_RANGE, store unchanged' both passed)
- Above max (`items.length + 1`): rejected `E_INDEX_OUT_OF_RANGE`: pass (node --test test/commands/rm.test.js → 'above max (items.length + 1) is rejected E_INDEX_OUT_OF_RANGE, store unchanged' passed)
- Empty store (`rm 1` with 0 items): rejected `E_INDEX_OUT_OF_RANGE`: pass (node --test test/commands/rm.test.js → 'empty store: rm 1 is rejected E_INDEX_OUT_OF_RANGE, no file created' passed: no store file created)


## Execution Log — 2026-08-16 (todo-cli/remove-todo-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/todo.js rm 1` on a store with ≥1 item removes item 1, saves, prints: pass (node --test test/commands/rm.test.js → 'rm 1 on a store with 1 item removes it, saves, prints, exits 0' passed)
- `node bin/todo.js rm` (no index) exits 1 with `E_MISSING_INDEX` to stderr, store unchanged: pass (node --test test/commands/rm.test.js → 'rm with no index exits 1 with E_MISSING_INDEX, store unchanged' passed)
- `node bin/todo.js rm abc` exits 1 with `E_INVALID_INDEX` to stderr, store unchanged: pass (node --test test/commands/rm.test.js → 'rm abc exits 1 with E_INVALID_INDEX, store unchanged' passed)
- Removing an item shifts later items left by one position (verified via a subsequent `list`: pass (node --test test/commands/rm.test.js → 'removing a middle item shifts later items left, leaves others unchanged' passed)
- Removing an item does not alter the `text`/`done` value of any remaining item: pass (same test: A and C values unchanged after rm 2 on [A,B(done:true),C])
- At min value (`1`, with ≥1 item): accepted, removes the first item: pass (node --test test/commands/rm.test.js → 'at min value (1) with >=1 item: accepted, removes the first item' passed)
- At max value (`items.length`, exact upper bound): accepted, removes the last item: pass (node --test test/commands/rm.test.js → 'at max value (items.length): accepted, removes the last item' passed)
- Below min (`0` or negative): rejected `E_INDEX_OUT_OF_RANGE`: pass (node --test test/commands/rm.test.js → 'below min (0)' and 'below min (negative)' both passed)
- Above max (`items.length + 1`): rejected `E_INDEX_OUT_OF_RANGE`: pass (node --test test/commands/rm.test.js → 'above max (items.length + 1) is rejected E_INDEX_OUT_OF_RANGE, store unchanged' passed)
- Empty store (`rm 1` with 0 items): rejected `E_INDEX_OUT_OF_RANGE`: pass (node --test test/commands/rm.test.js → 'empty store: rm 1 is rejected E_INDEX_OUT_OF_RANGE, no file created' passed)
