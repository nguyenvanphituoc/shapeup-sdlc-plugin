---
type: task
feature: todo-cli
id: TASK-008
title: "Wire CLI entry point: argv dispatch to add/list/done/rm + unknown-command handling"
lens: standard
package: cli
status: in-progress
priority: 8
depends_on: [TASK-004, TASK-005, TASK-006, TASK-007]
unlocks: [TASK-009]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: []
repositories: []
linked_docs: ["[[ux-behavior#Command-Flow]]"]
estimated_hours: 2
tags: [feat, cli]
eval_verdict: fail
eval_at: 2026-08-15
---

# TASK-008: Wire CLI entry point: argv dispatch to add/list/done/rm + unknown-command handling

## Context
Replace the `bin/todo.js` placeholder from TASK-001 with the real dispatcher per
`[[ux-behavior#Command-Flow]]`: `process.argv[2]` selects the subcommand, `process.argv.slice(3)`
is passed to the command module. Unknown/missing subcommand is the one error case not owned by
any single UC (`UNKNOWN_COMMAND`, cross-cutting in `[[ux-behavior#Cross-cutting-unknown-subcommand]]`).

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `bin/todo.js` routes `argv[2] === "add"` → `commands/add.js`, `"list"` → `commands/list.js`,
      `"done"` → `commands/done.js`, `"rm"` → `commands/rm.js`
- [ ] The command's own process.exit code (0 or 1) propagates as the CLI's exit code
- [ ] `node --test test/cli.test.js` (or equivalent, spawning the CLI as a subprocess) passes

### 🔁 Inverse Conditions
- [ ] `bin/todo.js` invoked with no subcommand, or an unrecognized one (e.g. `todo frobnicate`),
      does NOT dispatch to any command module — prints `UNKNOWN_COMMAND` usage message to stderr
      and exits 1
- [ ] No command module is invoked more than once per process run

### 🧪 BDD Scenarios

**Scenario: Route a known subcommand**
Given the CLI is invoked as `todo add "Buy milk"`
When  `bin/todo.js` parses argv
Then  `commands/add.js` is invoked with `["Buy milk"]` and its exit code becomes the process exit code

**Scenario: Reject an unknown subcommand**
Given the CLI is invoked as `todo frobnicate`
When  `bin/todo.js` parses argv
Then  stderr prints a usage message naming `frobnicate` as unknown, exit code 1, no store touched

### 🔗 Integration Flow

**CLI entry → command module → store**
Given a user runs `todo <subcommand> [args]` in a shell
When  `bin/todo.js` resolves `<subcommand>` to one of the four command modules
Then  that module runs its own store read/write per its own task's AC
And   the process exits with that module's exit code (0 success, 1 error) — never an uncaught
      exception / raw stack trace reaching the terminal for any of the four subcommands

## Non-Go (not in this task)
- Command logic itself → TASK-004..007 (this task only routes)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-r1-a1)
- executor: task-executor via ingest-result
- status: failed
- `bin/todo.js` routes `argv[2] === "add"` → `commands/add.js`, `"list"` → `commands/list.js`,: fail (commands/add.js, commands/list.js, commands/done.js, commands/rm.js do not exist in the repo (only idea.md is present at repo root; find . -maxdepth 3 shows no bin/, commands/, or lib/ directories) and are outside this scope's allowed_file_substrate (bin/todo.js, test/cli.test.js, test/integration/cli.test.js), so a working dispatcher cannot be verified against real command modules.)
- The command's own process.exit code (0 or 1) propagates as the CLI's exit code: fail (No command module exists to exercise; exit-code propagation cannot be exercised end-to-end.)
- `node --test test/cli.test.js` (or equivalent, spawning the CLI as a subprocess) passes: skipped (Not attempted — blocked on missing command modules (see deviations).)
- `bin/todo.js` invoked with no subcommand, or an unrecognized one (e.g. `todo frobnicate`),: skipped (Not attempted — blocked on missing command modules (see deviations).)
- No command module is invoked more than once per process run: skipped (Not attempted — blocked on missing command modules (see deviations).)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-r1-a2)
- executor: task-executor via ingest-result
- status: failed
- `bin/todo.js` routes `argv[2] === "add"` → `commands/add.js`, `"list"` → `commands/list.js`,: fail (As of this attempt, src/commands/add.js and src/commands/done.js now exist (built by sibling scopes add-todo and complete-todo), but src/commands/list.js and src/commands/rm.js still do not exist anywhere in the repo (find . -maxdepth 3 confirms), and no order file for the list-todos or remove-todo scopes exists in .shapeup/todo-cli/orders/ or .shapeup/todo-cli/receipts/dispatch.jsonl — those two scopes have not been dispatched this round. A dispatcher wired to two real modules and two nonexistent ones cannot pass its own AC.)
- The command's own process.exit code (0 or 1) propagates as the CLI's exit code: fail (Only 2 of 4 command modules exist; propagation cannot be verified for the missing list/rm paths.)
- `node --test test/cli.test.js` (or equivalent, spawning the CLI as a subprocess) passes: skipped (Not attempted — blocked, same reason as attempt 1 (see deviations).)
- `bin/todo.js` invoked with no subcommand, or an unrecognized one (e.g. `todo frobnicate`),: skipped (Not attempted — blocked (see deviations).)
- No command module is invoked more than once per process run: skipped (Not attempted — blocked (see deviations).)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-r1-a3)
- executor: task-executor via ingest-result
- status: failed
- `bin/todo.js` routes `argv[2] === "add"` → `commands/add.js`, `"list"` → `commands/list.js`,: fail (As of this attempt, src/commands/add.js and src/commands/done.js now exist (built by sibling scopes add-todo and complete-todo), but src/commands/list.js and src/commands/rm.js still do not exist anywhere in the repo (find . -maxdepth 3 confirms), and no order file for the list-todos or remove-todo scopes exists in .shapeup/todo-cli/orders/ or .shapeup/todo-cli/receipts/dispatch.jsonl — those two scopes have not been dispatched this round. A dispatcher wired to two real modules and two nonexistent ones cannot pass its own AC.)
- The command's own process.exit code (0 or 1) propagates as the CLI's exit code: fail (Only 2 of 4 command modules exist; propagation cannot be verified for the missing list/rm paths.)
- `node --test test/cli.test.js` (or equivalent, spawning the CLI as a subprocess) passes: skipped (Not attempted — blocked, same reason as attempt 1 (see deviations).)
- `bin/todo.js` invoked with no subcommand, or an unrecognized one (e.g. `todo frobnicate`),: skipped (Not attempted — blocked (see deviations).)
- No command module is invoked more than once per process run: skipped (Not attempted — blocked (see deviations).)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-r1-a1)
- executor: task-executor via ingest-result
- status: failed
- `bin/todo.js` routes `argv[2] === "add"` → `commands/add.js`, `"list"` → `commands/list.js`,: fail (find -iname add.js/list.js/done.js/rm.js over the whole repo returns nothing; the repo tree contains only .git, .gitignore, .shapeup, idea.md, shapeup/ — no bin/, src/, or commands/ directory exists at all. None of the four command modules TASK-008 must dispatch to have been built, and commands/*.js is outside this scope's allowed_file_substrate (bin/todo.js, test/cli.test.js, test/integration/cli.test.js), so a working dispatcher cannot be written or verified against real command modules.)
- The command's own process.exit code (0 or 1) propagates as the CLI's exit code: skipped (No command module exists to exercise; exit-code propagation cannot be exercised end-to-end.)
- `node --test test/cli.test.js` (or equivalent, spawning the CLI as a subprocess) passes: skipped (Not attempted — blocked on missing command modules (see deviations).)
- `bin/todo.js` invoked with no subcommand, or an unrecognized one (e.g. `todo frobnicate`),: skipped (Not attempted — blocked on missing command modules (see deviations).)
- No command module is invoked more than once per process run: skipped (Not attempted — blocked on missing command modules (see deviations).)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-r1-a2)
- executor: task-executor via ingest-result
- status: failed
- `bin/todo.js` routes `argv[2] === "add"` → `commands/add.js`, `"list"` → `commands/list.js`,: fail (As of this attempt, foundation-scope files now exist (bin/todo.js placeholder, package.json, src/domain/todo-list.js, src/store.js), but no commands/ directory or add.js/list.js/done.js/rm.js exists anywhere in the repo (find over src/ and repo root confirms). commands/*.js is outside this scope's allowed_file_substrate (bin/todo.js, test/cli.test.js, test/integration/cli.test.js), so the dispatcher cannot be wired to real command modules yet.)
- The command's own process.exit code (0 or 1) propagates as the CLI's exit code: skipped (No command module exists to exercise; exit-code propagation cannot be exercised end-to-end.)
- `node --test test/cli.test.js` (or equivalent, spawning the CLI as a subprocess) passes: skipped (Not attempted — blocked on missing command modules (see deviations).)
- `bin/todo.js` invoked with no subcommand, or an unrecognized one (e.g. `todo frobnicate`),: skipped (Not attempted — blocked on missing command modules (see deviations).)
- No command module is invoked more than once per process run: skipped (Not attempted — blocked on missing command modules (see deviations).)


## Execution Log — 2026-08-15 (todo-cli/cli-integration-r1-a3)
- executor: task-executor via ingest-result
- status: failed
- `bin/todo.js` routes `argv[2] === "add"` → `commands/add.js`, `"list"` → `commands/list.js`,: fail (As of this attempt only src/commands/done.js exists (find over src/ confirms); src/commands/add.js, list.js, and rm.js still do not exist anywhere in the repo. commands/*.js remains outside this scope's allowed_file_substrate (bin/todo.js, test/cli.test.js, test/integration/cli.test.js), so the dispatcher cannot be wired to the three missing modules.)
- The command's own process.exit code (0 or 1) propagates as the CLI's exit code: skipped (Only 1 of 4 command modules exists; propagation cannot be verified end-to-end for the missing add/list/rm paths.)
- `node --test test/cli.test.js` (or equivalent, spawning the CLI as a subprocess) passes: skipped (Not attempted — blocked on missing command modules (see deviations).)
- `bin/todo.js` invoked with no subcommand, or an unrecognized one (e.g. `todo frobnicate`),: skipped (Not attempted — blocked on missing command modules (see deviations).)
- No command module is invoked more than once per process run: skipped (Not attempted — blocked on missing command modules (see deviations).)
