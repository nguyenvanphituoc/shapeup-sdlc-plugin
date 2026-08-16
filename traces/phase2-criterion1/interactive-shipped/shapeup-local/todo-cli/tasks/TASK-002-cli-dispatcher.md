---
type: task
feature: todo-cli
id: TASK-002
title: "Build bin/todo argparse dispatcher with top-level error boundary"
lens: standard
package: bin
status: done
priority: 2
depends_on: [TASK-001]
unlocks: [TASK-003, TASK-004, TASK-005, TASK-006]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: []
repositories: [TodoStoreRepository]
linked_docs: ["[[ux-behavior]]", "[[domain-model#Repository-Interfaces]]"]
estimated_hours: 1.5
tags: [foundation, cli-entrypoint]
completed_at: 2026-08-16
---

# TASK-002: Build bin/todo argparse dispatcher with top-level error boundary

## Context
Create the `bin/todo` entry point per `project-profile.md`'s declared `entry_point`: an
`argparse` dispatcher with subcommands `add <text>`, `list`, `done <n>`, `rm <n>`, each calling
into a (not-yet-implemented) command function in `todo/commands.py`. This task's real payload is
the top-level error boundary shared by all four commands, per [[ux-behavior]]'s per-screen error
catalogs: catch `StoreCorruptedError` from TASK-001's `todo/store.py` and print
`error: corrupted store at <path>` to stderr, exit 1 — never let it propagate as a Python
traceback. Wire the four subcommands to call stub functions (`commands.add`, `commands.list_`,
`commands.done`, `commands.rm`) that TASK-003…006 will implement; this task's own AC does not
require those stubs to do real work yet, only that dispatch reaches them and the error boundary
catches what TASK-001 raises.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `bin/todo` exists and is executable (`chmod +x`), shebang `#!/usr/bin/env python3`
- [x] `python3 bin/todo add "x"` / `list` / `done 1` / `rm 1` all reach their respective
      `todo/commands.py` function (verify via a temporary print or a passing smoke test —
      remove any debug print before this task is marked done)
- [x] `python3 bin/todo` (no subcommand) exits non-zero with a usage message, no traceback
- [x] `python3 bin/todo bogus-command` exits non-zero with a usage message, no traceback
- [x] Any `StoreCorruptedError` raised by a command function is caught at the top level, printed
      as `error: corrupted store at <path>` to stderr, and the process exits 1

### 🧪 BDD Scenarios

**Scenario: Corrupted store produces a clean error, not a traceback**
Given `$TODO_STORE` points at a file containing invalid JSON
When  `python3 bin/todo list` is run
Then  stderr contains exactly one line matching `error: corrupted store at .*`, stdout is
      empty, and the exit code is 1 — no Python traceback on stderr

**Scenario: Unknown subcommand is rejected before touching the store**
Given `$TODO_STORE` points at a valid, non-existent path (fresh store)
When  `python3 bin/todo frobnicate` is run
Then  the process exits non-zero with argparse's own usage error; the store file is not created

### 🔗 Integration Flow

**bin/todo → todo/commands.py → todo/store.py**
Given a subcommand and its arguments arrive on `sys.argv`
When  `argparse` dispatches to the matching `todo/commands.py` function
Then  that function is called with the parsed arguments and the resolved store path
And   any `StoreCorruptedError` it lets propagate is caught here, converted to the clean stderr
      message above, never re-raised

## Implementation Notes
- Resolve the store path ONCE at the top of `main()` via `todo.store.default_store_path()` (or
  accept an override for testability) and pass it down — do not re-resolve per subcommand.
- Keep the error boundary a single `try/except StoreCorruptedError` wrapping the dispatch call,
  not one per subcommand — this is the "one error path" the pitch asks for.

## Non-Go (not in this task)
- Real command logic (mutating/reading the store, formatting `add`/`list`/`done`/`rm` output) → TASK-003…TASK-006
- `ERR_INVALID_INDEX` handling (that error is raised inside `done`/`rm`'s own logic, not this dispatcher) → TASK-005, TASK-006


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `bin/todo` exists and is executable (`chmod +x`), shebang `#!/usr/bin/env python3`: pass (bin/todo chmod +x, shebang #!/usr/bin/env python3 (ls -la bin/todo shows executable bit))
- `python3 bin/todo add "x"` / `list` / `done 1` / `rm 1` all reach their respective: pass (python3 bin/todo add/list/done/rm all dispatch to commands.add/list_/done/rm — manual run confirmed output from each)
- `python3 bin/todo` (no subcommand) exits non-zero with a usage message, no traceback: pass (python3 bin/todo (no subcommand) -> argparse usage error, exit 2, no traceback)
- `python3 bin/todo bogus-command` exits non-zero with a usage message, no traceback: pass (python3 bin/todo bogus-command -> argparse usage error, exit 2, no traceback)
- Any `StoreCorruptedError` raised by a command function is caught at the top level, printed: pass (StoreCorruptedError caught in main(), prints 'error: corrupted store at <path>' to stderr, exit 1 — manual run confirmed)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r2-a1)
- executor: task-executor via ingest-result
- status: done
- no change required this round: pass (T0 r2-a1: 7/7 fixtures green, no payload.bugs present)


## Execution Log — 2026-08-16 (todo-cli/scope-cli-core-r3-a1)
- executor: task-executor via ingest-result
- status: done
- QA-001: todo list piped to a reader that closes early must not raise an uncaught BrokenPipeError / dump a traceback: pass (bin/todo:52-61 main() now catches BrokenPipeError around the dispatch, redirects fd 1 to /dev/null before exiting so the interpreter's shutdown-time stdout flush cannot re-raise on stderr; verify t0 fixture 8 (QA001_PIPE_OK) passes.)
- QA-005: store-path I/O errors below the JSON layer (missing parent dir, path is a directory) must produce the app's uniform error: ... on stderr, exit 1, no traceback: pass (bin/todo:37,62-64 moved store.default_store_path() inside the top-level try and added except OSError (after the more specific BrokenPipeError) printing 'error: {e}' and exit(1); verify t0 fixture 10 (QA005_IO_ERRORS_OK) passes for both the missing-parent-dir and path-is-a-directory cases.)
