---
schema_version: 1
feature: todo-cli
entry_point: bin/todo.js
---

# Wiring Map — `todo` CLI

Composition root: `bin/todo.js` — the argv dispatcher. Invoked directly by the shell; routes
`process.argv[2]` (the subcommand) to a use-case engine module, same shape as a web-service
routing a request path to a handler module (per project profile).

Shared seam mechanism for all four use cases: **CLI command registration** — `bin/todo.js`
switches on `process.argv[2]` and calls the matching use-case engine's `execute(argv)` (or
equivalent), then prints the returned output to stdout/stderr and sets `process.exitCode`
accordingly. All four use cases share the one `TodoRepository` module
(`src/repositories/todo-repository.js`) implementing `load()`/`save()` against `~/.todo.json`
per `[[contracts/todo-repository.contract]]`.

## Entries

### UC-AddTodo

| Field | Value |
|---|---|
| `engine` | `src/usecases/add-todo.js` |
| `wiring_seam` | CLI command registration — `bin/todo.js` matches `argv[2] === "add"` and calls `addTodo.execute(argv[3])`; the engine calls `TodoRepository.load()`/`save()` from `src/repositories/todo-repository.js` |
| `entry_call_site` | `bin/todo.js` — `case "add":` branch of the argv[2] dispatch switch |
| `affordance` | Developer runs `todo add "<text>"` in a shell and sees `Added: "N) <text>"` printed, with the item persisted to `~/.todo.json` |

### UC-ListTodos

| Field | Value |
|---|---|
| `engine` | `src/usecases/list-todos.js` |
| `wiring_seam` | CLI command registration — `bin/todo.js` matches `argv[2] === "list"` and calls `listTodos.execute()`; the engine calls `TodoRepository.load()` only (never `save()`) |
| `entry_call_site` | `bin/todo.js` — `case "list":` branch of the argv[2] dispatch switch |
| `affordance` | Developer runs `todo list` in a shell and sees every stored item numbered 1-based with a `[x]`/`[ ]` done marker, or `No todos yet.` on an empty/missing store |

### UC-CompleteTodo

| Field | Value |
|---|---|
| `engine` | `src/usecases/complete-todo.js` |
| `wiring_seam` | CLI command registration — `bin/todo.js` matches `argv[2] === "done"` and calls `completeTodo.execute(argv[3])`; the engine calls `TodoRepository.load()`/`save()` |
| `entry_call_site` | `bin/todo.js` — `case "done":` branch of the argv[2] dispatch switch |
| `affordance` | Developer runs `todo done <n>` in a shell and sees `Done: "n) <text>"` printed, with the item's `done` flag persisted as `true` in `~/.todo.json` |

### UC-RemoveTodo

| Field | Value |
|---|---|
| `engine` | `src/usecases/remove-todo.js` |
| `wiring_seam` | CLI command registration — `bin/todo.js` matches `argv[2] === "rm"` and calls `removeTodo.execute(argv[3])`; the engine calls `TodoRepository.load()`/`save()` |
| `entry_call_site` | `bin/todo.js` — `case "rm":` branch of the argv[2] dispatch switch |
| `affordance` | Developer runs `todo rm <n>` in a shell and sees `Removed: "n) <text>"` printed, with the item removed from `~/.todo.json` and later items shifted left |

## Deviations

None — all four use cases have a direct CLI-command attachment path to the entry point; there
is no background/cron use case in this feature requiring a boot-hook seam instead.

## Assumptions

- Engine module paths (`src/usecases/*.js`, one file per use case) and the shared
  `src/repositories/todo-repository.js` are inferred from the domain model's Repository
  Interfaces section and the per-UC System Flow diagrams (which name `Use Case: X.execute(...)`
  and `TodoRepository.load()/save()`); the spec does not pin exact file paths, so these are
  proposed names for the build to create, not existing files (repo is greenfound — no `bin/` or
  `src/` directory exists yet).
- `bin/todo.js` is assumed to use a single `switch`/`if-else` dispatch on `argv[2]` (the
  simplest composition-root shape consistent with the project profile's description of it as
  "the argv dispatcher"); the build may implement the dispatch differently as long as all four
  cases remain reachable from `bin/todo.js` by import.
