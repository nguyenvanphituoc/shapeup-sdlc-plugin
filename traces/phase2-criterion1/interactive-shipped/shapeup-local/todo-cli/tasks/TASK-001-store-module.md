---
type: task
feature: todo-cli
id: TASK-001
title: "Implement TodoStoreRepository (load/save, atomic, path resolution)"
lens: standard
package: todo
status: done
priority: 1
depends_on: []
unlocks: [TASK-002]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: [TodoItem, TodoList]
repositories: [TodoStoreRepository]
linked_docs: ["[[domain-model#Repository-Interfaces]]", "[[contracts/todo-store.contract]]"]
estimated_hours: 2
tags: [foundation, storage]
completed_at: 2026-08-16
---

# TASK-001: Implement TodoStoreRepository (load/save, atomic, path resolution)

## Context
Implement `TodoStoreRepository` per [[contracts/todo-store.contract]] and
[[domain-model#Repository-Interfaces]] in `todo/store.py`: `default_store_path()` (env var
resolution), `load(path)`, and `save(path, items)`. This is the foundation every use case
depends on — no CLI wiring in this task, pure module. The exact function shapes and both
corruption variants are already spiked in Orient (`spike-store-persistence.md`) — port that
approach, do not redesign it.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `todo/store.py` exists, exporting `default_store_path()`, `load(path)`, `save(path, items)`
- [x] `default_store_path()` returns `$TODO_STORE` verbatim when set; otherwise
      `os.path.expanduser("~/.todo.json")` — no third path branch
- [x] `load(path)` on a non-existent path returns `[]`
- [x] `save(path, items)` then `load(path)` round-trips exactly (same items, same order)
- [x] `save()` uses `tempfile.mkstemp` (same directory as `path`) + `os.replace` — never a bare
      `open(path, "w")`
- [x] Request shape matches [[contracts/todo-store.contract#Write-Input]] table
- [x] Response mapping matches [[contracts/todo-store.contract#Read-Output]] table
- [x] All error codes in [[contracts/todo-store.contract#Error-Cases]] are handled

### 📭 Empty & Null States
- [x] `load()` returns `[]` (never `None`, never throws) when the store file does not exist
- [x] `save(path, [])` then `load(path)` returns `[]` — an emptied store is a valid, loadable state

### 🧪 BDD Scenarios

**Scenario: Round-trip persistence**
Given no store file exists at `path`
When  `save(path, [{"text": "a", "done": False}])` is called, then `load(path)` is called
Then  `load(path)` returns exactly `[{"text": "a", "done": False}]`

**Scenario: Corrupted store — invalid JSON**
Given a file at `path` containing `not valid json`
When  `load(path)` is called
Then  a `StoreCorruptedError` is raised (not a bare `json.JSONDecodeError`, not an unhandled crash)

**Scenario: Corrupted store — valid JSON, wrong shape**
Given a file at `path` containing `{"not": "a list"}` (valid JSON, object root)
When  `load(path)` is called
Then  the SAME `StoreCorruptedError` type is raised as the invalid-JSON case (one error path,
      PO decision #3) — not a second exception type

### 🔗 Integration Flow

**store.py → local filesystem**
Given a caller has resolved a store path via `default_store_path()`
When  `save(path, items)` is called
Then  a temp file is written in the same directory and `os.replace()`d onto `path` atomically —
      a process kill between the write and the replace leaves the ORIGINAL file untouched
And   a subsequent `load(path)` sees either the old content or the new content, never a partial write

## Implementation Notes
- Port directly from Orient's `spike-store-persistence.md` — the four functions there
  (`default_store_path`, `load`, `save`, corruption guard) are already verified against
  Python 3.10.16, stdlib only.
- `StoreCorruptedError` should be a small custom exception (subclass `RuntimeError` is fine) so
  TASK-002's dispatch layer can catch it by type, not by string-matching a message.

## Non-Go (not in this task)
- CLI argument parsing / dispatch → TASK-002
- Any command's business logic (add/list/done/rm) → TASK-003…TASK-006
- Directory auto-creation for a missing `$TODO_STORE` parent dir → not specified by the pitch, out of scope


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `todo/store.py` exists, exporting `default_store_path()`, `load(path)`, `save(path, items)`: pass (todo/store.py exports default_store_path, load, save)
- `default_store_path()` returns `$TODO_STORE` verbatim when set; otherwise: pass (manual run: TODO_STORE=/tmp/x python3 -c 'import sys; sys.path.insert(0,"."); from todo import store; print(store.default_store_path())' -> /tmp/x; unset TODO_STORE -> ~/.todo.json)
- `load(path)` on a non-existent path returns `[]`: pass (load('/nonexistent') -> [] (verified via T0 fixture DISPATCH_OK path and manual test))
- `save(path, items)` then `load(path)` round-trips exactly (same items, same order): pass (save(path,[{'text':'a','done':False}]) then load(path) round-trips exactly, manual python3 check)
- `save()` uses `tempfile.mkstemp` (same directory as `path`) + `os.replace` — never a bare: pass (save() uses tempfile.mkstemp(dir=same dir) + os.replace, no bare open(path,'w') for writes)
- Request shape matches [[contracts/todo-store.contract#Write-Input]] table: pass (save(path, items) signature matches contract Write-Input (path, items))
- Response mapping matches [[contracts/todo-store.contract#Read-Output]] table: pass (load(path) returns items list per Read-Output; [] for missing file)
- All error codes in [[contracts/todo-store.contract#Error-Cases]] are handled: pass (StoreCorruptedError raised for invalid JSON and non-list root, one error type covers both per contract Error-Cases)
- `load()` returns `[]` (never `None`, never throws) when the store file does not exist: pass (load() on missing file returns [] verified manually, never raises/None)
- `save(path, [])` then `load(path)` returns `[]` — an emptied store is a valid, loadable state: pass (save(path, []) then load(path) -> [] verified manually)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r2-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r2-a1: 7/7 fixtures green, no payload.bugs present)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r3-a1)
- executor: task-executor via ingest-result
- status: done
- QA-004: an empty-but-set $TODO_STORE is a clean error, not a silent fallback to ~/.todo.json: pass (todo/store.py:15 default_store_path() now distinguishes unset ($TODO_STORE not in env -> fallback preserved, TS-INV-05 fixture 7 still green) from set-but-empty (raises ValueError("$TODO_STORE is set but empty")); verify t0 fixture 9 (QA004_EMPTY_STORE_OK) passes.)
- QA-010: a malformed store element (missing a required key) is treated as a corrupted store, not a raw KeyError: pass (todo/store.py:43-45 load() now validates every element is a dict containing 'text' and 'done', raising StoreCorruptedError uniformly with the invalid-JSON and wrong-shape-root paths; verify t0 fixture 11 (QA010_MALFORMED_ELEMENT_OK) passes for list/rm/done.)
