---
type: task
feature: todo-cli
id: TASK-007
title: "Integration test — full add/list/done/rm round-trip + edge cases"
lens: standard
package: cli
status: done
priority: 4
depends_on: [TASK-003, TASK-004, TASK-005, TASK-006]
unlocks: []
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: [TodoItem]
repositories: [TodoRepository]
linked_docs: ["[[usecases/UC-AddTodo]]", "[[usecases/UC-ListTodos]]", "[[usecases/UC-CompleteTodo]]", "[[usecases/UC-RemoveTodo]]", "[[integration#Filesystem]]"]
estimated_hours: 2
tags: [test, cli, integration]
completed_at: 2026-08-16
---

# TASK-007: Integration test — full CLI round-trip + edge cases

## Context
Exercise the fully-wired CLI end-to-end (spawn `node bin/todo.js <args>` as a real subprocess,
against a temp `HOME` so the real user's `~/.todo.json` is never touched) covering the happy
path across all four commands plus the edge cases the pitch calls out by name: empty list, bad
index, and a corrupted store file. This is the task that proves TASK-001 through TASK-006 add up
to the behavior specified across [[usecases/_index]] and [[ux-behavior]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] A test runner command exists and passes (e.g. `node --test test/cli.test.js`, or
      equivalent using only Node built-ins per the zero-config/no-new-dependency constraint)
- [x] Test isolates each run's store — point `HOME` (or the store path, whichever TASK-002
      chose) at a fresh temp directory per test case; no test reads/writes the real user's
      `~/.todo.json`

### 🧪 BDD Scenarios

**Scenario: Happy-path round-trip across all four commands**
Given a fresh temp `HOME` with no `.todo.json`
When  the test runs, in order: `todo add "buy milk"`, `todo add "write spec"`, `todo list`,
      `todo done 1`, `todo list`, `todo rm 2`, `todo list`
Then  each `add` exits 0 and prints the correct 1-based position; the first `list` shows both
      items open; after `done 1` the second `list` shows item 1 marked `[x]`; after `rm 2` the
      third `list` shows exactly one item, item 1, still marked `[x]`

**Scenario: Empty list is not an error**
Given a fresh temp `HOME` with no `.todo.json`
When  the test runs `todo list` with no prior `add`
Then  stdout is `No todos yet.`, exit code 0

**Scenario: Bad index is rejected without crashing**
Given a temp store containing exactly 1 item
When  the test runs `todo done 99`, `todo done abc`, `todo done 0`, and `todo rm` (no arg), in
      turn
Then  every invocation exits 1, prints a plain stderr message (no raw stack trace / no
      `at Object.<anonymous>` frames), and the store file is unchanged after each

**Scenario: Corrupted store fails clean, not with a stack trace**
Given a temp store file containing `{not valid json,,,`
When  the test runs `todo list`, `todo add "x"`, `todo done 1`, and `todo rm 1`, in turn
Then  every invocation exits 1, stderr names the store as corrupted (no raw
      `SyntaxError`/stack-trace text reaching the user), and the corrupted file is left
      byte-for-byte unchanged (never auto-overwritten)

### 🔗 Integration Flow
**Shell → bin/todo.js → TodoRepository → Filesystem, full stack**
Given the compiled CLI (TASK-001–006) and a real (temp) filesystem
When  each of the scenarios above spawns `node bin/todo.js <args>` as a child process
Then  the observed stdout/stderr/exit-code and resulting file contents match
      [[ux-behavior#Command-Flow]] and [[ux-behavior#Error-Catalog]] exactly
And   no scenario ever surfaces a raw uncaught-exception stack trace to the user (the pitch's
      core requirement: "a CLI that crashes on a typo is worse than no CLI")

## Non-Go (not in this task)
- Performance / load testing — not applicable to a single-user local CLI
- Testing the `package.json` `bin` global-install path (`npm link`) — covered by manual
  verification during TASK-001, not automated here


## Execution Log — 2026-08-15 (todo-cli/cli-integration-test-r1-a1)
- executor: task-executor via ingest-result
- status: done
- A test runner command exists and passes (e.g. `node --test test/cli.test.js`, or: pass (node --test test/cli.test.js -> tests 4, pass 4, fail 0)
- Test isolates each run's store — point `HOME` (or the store path, whichever TASK-002: pass (Each test uses fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-integration-test-')) and spawns bin/todo.js with env HOME/USERPROFILE overridden to that temp dir; real ~/.todo.json never touched)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-test-r2-a1)
- executor: task-executor via ingest-result
- status: done
- A test runner command exists and passes (e.g. `node --test test/cli.test.js`, or: pass (node --test test/cli.test.js -> tests 4, pass 4, fail 0 (re-verified, no changes needed this attempt))
- Test isolates each run's store — point `HOME` (or the store path, whichever TASK-002: pass (Confirmed test/cli.test.js still uses fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-integration-test-')) and spawns bin/todo.js with env HOME/USERPROFILE overridden to that temp dir; real ~/.todo.json untouched)


## Execution Log — 2026-08-16 (todo-cli/cli-integration-test-r1-a1)
- executor: task-executor via ingest-result
- status: done
- A test runner command exists and passes (e.g. `node --test test/cli.test.js`, or: pass (node --test test/cli.test.js -> tests 4, pass 4, fail 0)
- Test isolates each run's store — point `HOME` (or the store path, whichever TASK-002: pass (test/cli.test.js: freshHome() uses fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-integration-test-')) per test; run() spawns bin/todo.js with env HOME/USERPROFILE overridden to that temp dir. lib/todo-repository.js storePath() = path.join(os.homedir(), '.todo.json'), which resolves HOME in the child's env, so the real user's ~/.todo.json is never touched.)


## Execution Log — 2026-08-16 (todo-cli/cli-integration-test-r2-a1)
- executor: task-executor via ingest-result
- status: done
- A test runner command exists and passes (e.g. `node --test test/cli.test.js`, or: pass (node --test test/cli.test.js -> tests 4, pass 4, fail 0 (re-verified, no changes needed this attempt))
- Test isolates each run's store — point `HOME` (or the store path, whichever TASK-002: pass (Confirmed test/cli.test.js freshHome() uses fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-integration-test-')) per test and spawns bin/todo.js with env HOME/USERPROFILE overridden to that temp dir; lib/todo-repository.js resolves storePath() via os.homedir(), which honors the child's HOME env, so the real user's ~/.todo.json is never touched)


## Execution Log — 2026-08-16 (todo-cli/cli-integration-test-r2-a1)
- executor: task-executor via ingest-result
- status: done
- A test runner command exists and passes (e.g. `node --test test/cli.test.js`, or: pass (node --test test/cli.test.js -> tests 4, pass 4, fail 0 (re-verified, no changes needed this attempt))
- Test isolates each run's store — point `HOME` (or the store path, whichever TASK-002: pass (Confirmed test/cli.test.js freshHome() uses fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-integration-test-')) per test and spawns bin/todo.js with env HOME/USERPROFILE overridden to that temp dir; lib/todo-repository.js resolves storePath() via os.homedir(), which honors the child's HOME env, so the real user's ~/.todo.json is never touched)


## Execution Log — 2026-08-16 (todo-cli/cli-integration-test-r2-a1)
- executor: task-executor via ingest-result
- status: done
- A test runner command exists and passes (e.g. `node --test test/cli.test.js`, or: pass (node --test test/cli.test.js -> tests 4, pass 4, fail 0 (re-verified against existing test/cli.test.js, no changes needed this attempt))
- Test isolates each run's store — point `HOME` (or the store path, whichever TASK-002: pass (test/cli.test.js freshHome() uses fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-integration-test-')) per test; run() spawns bin/todo.js with env HOME/USERPROFILE overridden to that temp dir, so the real user's ~/.todo.json is never touched)


## Execution Log — 2026-08-16 (todo-cli/cli-integration-test-r2-a1)
- executor: task-executor via ingest-result
- status: done
- A test runner command exists and passes (e.g. `node --test test/cli.test.js`, or: pass (node --test test/cli.test.js -> tests 4, pass 4, fail 0 (re-verified against existing test/cli.test.js, no changes needed this attempt))
- Test isolates each run's store — point `HOME` (or the store path, whichever TASK-002: pass (test/cli.test.js freshHome() (line 12-14) uses fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-integration-test-')) per test; run() (line 20-25) spawns bin/todo.js with env HOME/USERPROFILE overridden to that temp dir, so the real user's ~/.todo.json is never touched)
