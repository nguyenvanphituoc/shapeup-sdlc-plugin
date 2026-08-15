---
type: task
feature: todo-cli
id: TASK-009
title: "Integration test — full CLI round-trip via subprocess"
lens: standard
package: cli
status: in-progress
priority: 9
depends_on: [TASK-008]
unlocks: []
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: [TodoList, TodoItem]
repositories: [TodoStoreRepository]
linked_docs: ["[[usecases/_index]]", "[[integration#Local-Filesystem]]"]
estimated_hours: 3
tags: [test, integration]
---

# TASK-009: Integration test — full CLI round-trip via subprocess

## Context
Layer 9 (end-to-end) integration test per `[[usecases/_index]]` — spawns the real `bin/todo.js`
as a subprocess against a scratch temp directory (never the repo's own `./.todo.json`), and
verifies the full add→list→done→list→rm→list round-trip plus the corrupted/missing-store and
bad-index edge cases the pitch explicitly calls out.

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `test/integration/cli.test.js` spawns `node bin/todo.js <args>` with `cwd` set to a
      per-test temp directory (e.g. `fs.mkdtempSync`), never the repo root
- [ ] `node --test test/integration/cli.test.js` passes
- [ ] Full round-trip: `add` → `list` shows the item pending → `done 1` → `list` shows it done →
      `rm 1` → `list` shows "no todos yet"
- [ ] Missing store file: `list` on a fresh temp dir exits 0 with the empty message, does not
      create `./.todo.json` as a side effect of a read-only command
- [ ] Corrupted store file: write `not json {{{` to `./.todo.json` in the temp dir, then run any
      of `add`/`list`/`done`/`rm` → exits 1, stderr names corruption, no stack trace on stdout/stderr

### 🧪 BDD Scenarios

**Scenario: Happy-path round-trip**
Given a fresh temp directory with no `./.todo.json`
When  `todo add "Buy milk"`, `todo done 1`, and `todo list` are run in sequence
Then  the final `list` output shows exactly one item marked done, and `./.todo.json` on disk
      matches the store contract shape (`nextId`, `items[]`)

**Scenario: Corrupted store rejected consistently across all four commands**
Given a temp directory with `./.todo.json` containing `not json {{{`
When  `add`, `list`, `done 1`, and `rm 1` are each run against it
Then  every one exits 1 with a corruption-naming stderr message and none crashes with an
      unhandled exception / raw stack trace

### 🔗 Integration Flow

**CLI subprocess → filesystem**
Given a per-test scratch `cwd`
When  a sequence of `todo` subprocess invocations runs against it
Then  `./.todo.json` in that scratch dir reflects every committed mutation, and no other file
      (including the repo's real files) is touched

## Non-Go (not in this task)
- Performance / load testing → out of scope for this pitch
- Concurrent-process race testing → explicitly out of scope (accepted risk, see
  `[[integration#Local-Filesystem]]`)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-r1-a1)
- executor: task-executor via ingest-result
- status: failed
- `test/integration/cli.test.js` spawns `node bin/todo.js <args>` with `cwd` set to a: skipped (Not attempted — depends on TASK-008's dispatcher, which itself is blocked (see deviations).)
- `node --test test/integration/cli.test.js` passes: skipped (Not attempted — blocked.)
- Full round-trip: `add` → `list` shows the item pending → `done 1` → `list` shows it done →: skipped (Not attempted — blocked.)
- Missing store file: `list` on a fresh temp dir exits 0 with the empty message, does not: skipped (Not attempted — blocked.)
- Corrupted store file: write `not json {{{` to `./.todo.json` in the temp dir, then run any: skipped (Not attempted — blocked.)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-r1-a2)
- executor: task-executor via ingest-result
- status: failed
- `test/integration/cli.test.js` spawns `node bin/todo.js <args>` with `cwd` set to a: skipped (Not attempted — depends on TASK-008's dispatcher, still blocked (see deviations).)
- `node --test test/integration/cli.test.js` passes: skipped (Not attempted — blocked.)
- Full round-trip: `add` → `list` shows the item pending → `done 1` → `list` shows it done →: skipped (Not attempted — the round-trip requires `list` and `rm`, neither of which exists yet.)
- Missing store file: `list` on a fresh temp dir exits 0 with the empty message, does not: skipped (Not attempted — `list` command module does not exist yet.)
- Corrupted store file: write `not json {{{` to `./.todo.json` in the temp dir, then run any: skipped (Not attempted — blocked.)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-r1-a3)
- executor: task-executor via ingest-result
- status: failed
- `test/integration/cli.test.js` spawns `node bin/todo.js <args>` with `cwd` set to a: skipped (Not attempted — depends on TASK-008's dispatcher, still blocked (see deviations).)
- `node --test test/integration/cli.test.js` passes: skipped (Not attempted — blocked.)
- Full round-trip: `add` → `list` shows the item pending → `done 1` → `list` shows it done →: skipped (Not attempted — the round-trip requires `list` and `rm`, neither of which exists yet.)
- Missing store file: `list` on a fresh temp dir exits 0 with the empty message, does not: skipped (Not attempted — `list` command module does not exist yet.)
- Corrupted store file: write `not json {{{` to `./.todo.json` in the temp dir, then run any: skipped (Not attempted — blocked.)
