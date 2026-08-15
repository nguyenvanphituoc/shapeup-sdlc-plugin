---
type: task
feature: todo-cli
id: TASK-008
title: "Wire CLI entry point: argv dispatch to add/list/done/rm + unknown-command handling"
lens: standard
package: cli
status: ready
priority: 8
depends_on: [TASK-004, TASK-005, TASK-006, TASK-007]
unlocks: [TASK-009]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: []
repositories: []
linked_docs: ["[[ux-behavior#Command-Flow]]"]
estimated_hours: 2
tags: [feat, cli]
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
