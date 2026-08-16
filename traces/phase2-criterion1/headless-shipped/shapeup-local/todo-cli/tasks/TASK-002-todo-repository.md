---
type: task
feature: todo-cli
id: TASK-002
title: "Implement TodoRepository (load/save ~/.todo.json)"
lens: standard
package: cli
status: done
priority: 2
depends_on: [TASK-001]
unlocks: [TASK-003, TASK-004, TASK-005, TASK-006]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: [TodoItem]
repositories: [TodoRepository]
linked_docs: ["[[contracts/todo-repository.contract]]", "[[domain-model#Repository-Interfaces]]"]
estimated_hours: 2
tags: [feat, cli, repository]
completed_at: 2026-08-16
---

# TASK-002: Implement TodoRepository (load/save `~/.todo.json`)

## Context
Implement `TodoRepository` per [[contracts/todo-repository.contract]] and
[[domain-model#Repository-Interfaces]]: `load()` reads `~/.todo.json` (via `os.homedir()`),
returning `[]` on `ENOENT` and throwing a typed `StoreCorruptedError` on any `JSON.parse`
failure or non-array parsed content (never a bare, uncaught exception — see
`.shapeup/todo-cli/orient/spike-store-parsing.md` for the confirmed Node behavior this guards
against). `save(items)` overwrites the file with the full array, throwing `StoreWriteError` on
any filesystem write failure.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] A `TodoRepository` module is created (e.g. `lib/todo-repository.js`) exporting `load()`
      and `save(items)`
- [x] `load()` on a missing file returns `[]` (does not throw)
- [x] `load()` on a file containing invalid JSON throws/returns an error tagged
      `E_STORE_CORRUPTED` — never lets a raw `SyntaxError` propagate uncaught
- [x] `load()` on a file containing valid JSON that is not an array (e.g. `{}`) also resolves to
      `E_STORE_CORRUPTED`, per [[contracts/todo-repository.contract#Method-load-Read]]
- [x] `save(items)` writes valid JSON that `load()` can read back unchanged (round-trip)
- [x] Request shape matches [[contracts/todo-repository.contract#Storage-Schema]] table
- [x] Response mapping matches [[contracts/todo-repository.contract#Method-load-Read]] Read Output
- [x] All error codes in [[contracts/todo-repository.contract]] Error Cases tables are handled

### 📭 Empty & Null States
- [x] Missing store file: `load()` returns `[]`, not `null` and not a thrown error
- [x] Empty array file (`[]` on disk): `load()` returns `[]` — no special-casing needed beyond
      the missing-file path already covering the mechanism
- [x] `load()` never returns `null` under any input — always `[]` or throws a typed error

### 🔗 Integration Flow
**bin/todo.js (dispatcher) → TodoRepository → Filesystem**
Given a command handler needs the current items
When  it calls `TodoRepository.load()`
Then  the file at `~/.todo.json` is read; `ENOENT` yields `[]`, valid JSON array yields the
      parsed items, anything else yields a typed `E_STORE_CORRUPTED` error
And   the caller never sees a raw `fs`/`JSON` exception — only `[]`, the parsed array, or the
      typed error

## Implementation Notes
- Use `os.homedir()` + `path.join(..., '.todo.json')` for the path — do not hardcode `~`.
- Build the full JSON string in memory (`JSON.stringify(items)`) before the single
  `fs.writeFileSync` call, so a mid-write failure never leaves a half-written file distinguishable
  from "write never started" (supports [[domain-model#Aggregate-TodoStore]] INV about no partial
  writes).

## Non-Go (not in this task)
- Command-level argument parsing / index validation → TASK-005, TASK-006
- `add`/`list`/`done`/`rm` command handlers → TASK-003, TASK-004, TASK-005, TASK-006


## Execution Log — 2026-08-15 (todo-cli/foundation-r1-a1)
- executor: task-executor via ingest-result
- status: done
- A `TodoRepository` module is created (e.g. `lib/todo-repository.js`) exporting `load()`: pass (lib/todo-repository.js exports load, save, storePath, StoreCorruptedError, StoreReadError, StoreWriteError)
- `load()` on a missing file returns `[]` (does not throw): pass (node --test test/todo-repository.test.js -> 'load() on a missing file returns []' passed)
- `load()` on a file containing invalid JSON throws/returns an error tagged: pass (test 'load() on invalid JSON throws StoreCorruptedError tagged E_STORE_CORRUPTED' passed)
- `load()` on a file containing valid JSON that is not an array (e.g. `{}`) also resolves to: pass (test 'load() on valid JSON that is not an array throws E_STORE_CORRUPTED' passed)
- `save(items)` writes valid JSON that `load()` can read back unchanged (round-trip): pass (test 'save(items) writes JSON that load() reads back unchanged (round-trip)' passed)
- Request shape matches [[contracts/todo-repository.contract#Storage-Schema]] table: pass (save(items) accepts TodoItem[] = {text: string, done: boolean}[]; JSON.stringify(items) written verbatim as top-level array, matches contract Storage Schema)
- Response mapping matches [[contracts/todo-repository.contract#Method-load-Read]] Read Output: pass (load() returns TodoItem[] always, [] on ENOENT, never null — matches Read Output row)
- All error codes in [[contracts/todo-repository.contract]] Error Cases tables are handled: pass (ENOENT -> [] (not error); SyntaxError -> StoreCorruptedError E_STORE_CORRUPTED; non-array parse -> E_STORE_CORRUPTED; other read errors -> StoreReadError; write failure -> StoreWriteError E_STORE_WRITE_FAILED. See lib/todo-repository.js load()/save())
- Missing store file: `load()` returns `[]`, not `null` and not a thrown error: pass (test 'load() on a missing file returns []' passed; ENOENT branch returns [] directly)
- Empty array file (`[]` on disk): `load()` returns `[]` — no special-casing needed beyond: pass (test 'empty array file ([] on disk): load() returns []' passed)
- `load()` never returns `null` under any input — always `[]` or throws a typed error: pass (test 'load() never returns null' passed; code path only returns [] (ENOENT) or parsed array, else throws)


## Execution Log — 2026-08-16 (todo-cli/foundation-r1-a1)
- executor: task-executor via ingest-result
- status: done
- A `TodoRepository` module is created (e.g. `lib/todo-repository.js`) exporting `load()`: pass (lib/todo-repository.js exports load, save, storePath, StoreCorruptedError, StoreReadError, StoreWriteError)
- `load()` on a missing file returns `[]` (does not throw): pass (node --test test/todo-repository.test.js -> 'load() on a missing file returns []' passed)
- `load()` on a file containing invalid JSON throws/returns an error tagged: pass (test 'load() on invalid JSON throws StoreCorruptedError tagged E_STORE_CORRUPTED' passed)
- `load()` on a file containing valid JSON that is not an array (e.g. `{}`) also resolves to: pass (test 'load() on valid JSON that is not an array throws E_STORE_CORRUPTED' passed)
- `save(items)` writes valid JSON that `load()` can read back unchanged (round-trip): pass (test 'save(items) writes JSON that load() reads back unchanged (round-trip)' passed)
- Request shape matches [[contracts/todo-repository.contract#Storage-Schema]] table: pass (save(items) accepts TodoItem[] = {text, done}[]; JSON.stringify(items) written verbatim as top-level array, matches contract Storage Schema)
- Response mapping matches [[contracts/todo-repository.contract#Method-load-Read]] Read Output: pass (load() returns TodoItem[] always, [] on ENOENT, never null — matches Read Output row)
- All error codes in [[contracts/todo-repository.contract]] Error Cases tables are handled: pass (ENOENT -> [] (not error); SyntaxError -> StoreCorruptedError E_STORE_CORRUPTED; non-array parse -> E_STORE_CORRUPTED; other read errors -> StoreReadError; write failure -> StoreWriteError E_STORE_WRITE_FAILED. See lib/todo-repository.js load()/save())
- Missing store file: `load()` returns `[]`, not `null` and not a thrown error: pass (test 'load() on a missing file returns []' passed; ENOENT branch returns [] directly)
- Empty array file (`[]` on disk): `load()` returns `[]` — no special-casing needed beyond: pass (test 'empty array file ([] on disk): load() returns []' passed)
- `load()` never returns `null` under any input — always `[]` or throws a typed error: pass (test 'load() never returns null' passed; code path only returns [] (ENOENT) or parsed array, else throws)


## Execution Log — 2026-08-16 (todo-cli/foundation-r2-a1)
- executor: task-executor via ingest-result
- status: done
- A `TodoRepository` module is created (e.g. `lib/todo-repository.js`) exporting `load()`: pass (lib/todo-repository.js exports load()/save() (pre-existing, unchanged))
- `load()` on a missing file returns `[]` (does not throw): pass (node --test test/todo-repository.test.js -> 'load() on a missing file returns []' passed)
- `load()` on a file containing invalid JSON throws/returns an error tagged: pass (node --test test/todo-repository.test.js -> 'load() on invalid JSON throws StoreCorruptedError tagged E_STORE_CORRUPTED' passed)
- `load()` on a file containing valid JSON that is not an array (e.g. `{}`) also resolves to: pass (node --test test/todo-repository.test.js -> 'load() on valid JSON that is not an array throws E_STORE_CORRUPTED' passed)
- `save(items)` writes valid JSON that `load()` can read back unchanged (round-trip): pass (node --test test/todo-repository.test.js -> 'save(items) writes JSON that load() reads back unchanged (round-trip)' passed)
- Request shape matches [[contracts/todo-repository.contract#Storage-Schema]] table: pass (round-trip test confirms storage schema shape is preserved)
- Response mapping matches [[contracts/todo-repository.contract#Method-load-Read]] Read Output: pass (load() returns parsed TodoItem[] per repository test suite)
- All error codes in [[contracts/todo-repository.contract]] Error Cases tables are handled: pass (E_STORE_CORRUPTED covered by tests; StoreReadError/StoreWriteError implemented in lib/todo-repository.js)
- Missing store file: `load()` returns `[]`, not `null` and not a thrown error: pass (node --test test/todo-repository.test.js -> 'load() never returns null' passed)
- Empty array file (`[]` on disk): `load()` returns `[]` — no special-casing needed beyond: pass (node --test test/todo-repository.test.js -> 'empty array file ([] on disk): load() returns []' passed)
- `load()` never returns `null` under any input — always `[]` or throws a typed error: pass (node --test test/todo-repository.test.js -> 'load() never returns null' passed)


## Execution Log — 2026-08-16 (todo-cli/foundation-r2-a1)
- executor: task-executor via ingest-result
- status: done
- A `TodoRepository` module is created (e.g. `lib/todo-repository.js`) exporting `load()`: pass (lib/todo-repository.js exists and exports load()/save())
- `load()` on a missing file returns `[]` (does not throw): pass (node --test test/todo-repository.test.js → 'load() on a missing file returns []' passes)
- `load()` on a file containing invalid JSON throws/returns an error tagged: pass (node --test test/todo-repository.test.js → 'load() on invalid JSON throws StoreCorruptedError tagged E_STORE_CORRUPTED' passes)
- `load()` on a file containing valid JSON that is not an array (e.g. `{}`) also resolves to: pass (node --test test/todo-repository.test.js → 'load() on valid JSON that is not an array throws E_STORE_CORRUPTED' passes)
- `save(items)` writes valid JSON that `load()` can read back unchanged (round-trip): pass (node --test test/todo-repository.test.js → 'save(items) writes JSON that load() reads back unchanged (round-trip)' passes)
- Request shape matches [[contracts/todo-repository.contract#Storage-Schema]] table: pass (lib/todo-repository.js save()/load() operate on the TodoItem[] schema per test/todo-repository.test.js)
- Response mapping matches [[contracts/todo-repository.contract#Method-load-Read]] Read Output: pass (load() returns TodoItem[] as verified by round-trip test)
- All error codes in [[contracts/todo-repository.contract]] Error Cases tables are handled: pass (E_STORE_CORRUPTED and E_STORE_WRITE_FAILED covered by test/todo-repository.test.js)
- Missing store file: `load()` returns `[]`, not `null` and not a thrown error: pass (node --test test/todo-repository.test.js → 'load() on a missing file returns []' passes)
- Empty array file (`[]` on disk): `load()` returns `[]` — no special-casing needed beyond: pass (node --test test/todo-repository.test.js → 'empty array file ([] on disk): load() returns []' passes)
- `load()` never returns `null` under any input — always `[]` or throws a typed error: pass (node --test test/todo-repository.test.js → 'load() never returns null' passes)


## Execution Log — 2026-08-16 (todo-cli/foundation-r2-a1)
- executor: task-executor via ingest-result
- status: done
- A `TodoRepository` module is created (e.g. `lib/todo-repository.js`) exporting `load()`: pass (lib/todo-repository.js exports load, save, storePath, StoreCorruptedError, StoreReadError, StoreWriteError (unchanged this round))
- `load()` on a missing file returns `[]` (does not throw): pass (node --test test/todo-repository.test.js -> 'load() on a missing file returns []' passed)
- `load()` on a file containing invalid JSON throws/returns an error tagged: pass (test 'load() on invalid JSON throws StoreCorruptedError tagged E_STORE_CORRUPTED' passed)
- `load()` on a file containing valid JSON that is not an array (e.g. `{}`) also resolves to: pass (test 'load() on valid JSON that is not an array throws E_STORE_CORRUPTED' passed)
- `save(items)` writes valid JSON that `load()` can read back unchanged (round-trip): pass (test 'save(items) writes JSON that load() reads back unchanged (round-trip)' passed)
- Request shape matches [[contracts/todo-repository.contract#Storage-Schema]] table: pass (save(items) accepts TodoItem[] = {text, done}[]; JSON.stringify(items) written verbatim as top-level array, matches contract Storage Schema (unchanged this round))
- Response mapping matches [[contracts/todo-repository.contract#Method-load-Read]] Read Output: pass (load() returns TodoItem[] always, [] on ENOENT, never null — matches Read Output row (unchanged this round))
- All error codes in [[contracts/todo-repository.contract]] Error Cases tables are handled: pass (ENOENT -> []; SyntaxError -> StoreCorruptedError E_STORE_CORRUPTED; non-array parse -> E_STORE_CORRUPTED; other read errors -> StoreReadError; write failure -> StoreWriteError E_STORE_WRITE_FAILED (unchanged this round))
- Missing store file: `load()` returns `[]`, not `null` and not a thrown error: pass (test 'load() on a missing file returns []' passed)
- Empty array file (`[]` on disk): `load()` returns `[]` — no special-casing needed beyond: pass (test 'empty array file ([] on disk): load() returns []' passed)
- `load()` never returns `null` under any input — always `[]` or throws a typed error: pass (test 'load() never returns null' passed)
