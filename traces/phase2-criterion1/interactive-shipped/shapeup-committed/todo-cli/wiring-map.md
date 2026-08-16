---
schema_version: 1
type: wiring-map
feature: todo-cli
entry_point: bin/todo
---

# Wiring Map — todo-cli

Written by `solution-architect` at GATE L1a.5. Declares, for every use case, the chain from its
engine module to the entry point (`bin/todo`, the argparse dispatcher — see
`project-profile.md`) and the player-visible affordance it produces once wired.

Archetype note (echoed from the profile): this is a Python stdlib-only CLI mapped to the
`library` archetype. The reachability oracle's import-graph arm (`kernel/verify/trace.mjs`) is
JS/TS-only and will report every engine below as `never imported from entry_point` once
`bin/todo` exists — that is a known language-mismatch artifact of the arm, not evidence against
this map. The arm is advisory at L1b; this declaration plus T0 execution evidence are what
actually holds.

## Shared components (used by every entry below)

- `todo/store.py` — implements `TodoStoreRepository` (`load`/`save`), `StorePath` resolution
  (`$TODO_STORE` verbatim else `~/.todo.json`), and raises `StoreCorruptedError`. Not a use
  case itself; every UC's engine imports it directly.
- `bin/todo` — the argparse dispatcher (entry point / composition root). Defines subparsers
  `add`, `done`, `list`, `rm`, each registered with its own required positional arg(s), then
  dispatches to the matching engine function.

## Entries

### UC-AddTodo

| Field | Value |
|---|---|
| `engine` | `todo/commands.py` (`add(path, text)`) |
| `wiring_seam` | argparse subcommand registration: `bin/todo` registers an `add` subparser with one required positional `text` arg; the subparser's `set_defaults(func=...)` (or equivalent dispatch branch) binds it to `commands.add`. Internally, `add` calls `todo/store.py`'s `load()` then `save()`. |
| `entry_call_site` | `bin/todo` — `add` subcommand branch of the argparse dispatcher |
| `affordance` | Developer runs `todo add "<text>"` at a shell prompt and sees `added #<n>: <text>` printed to stdout, exit 0 — the new item is now in the store. |

### UC-CompleteTodo

| Field | Value |
|---|---|
| `engine` | `todo/commands.py` (`done(path, n)`) |
| `wiring_seam` | argparse subcommand registration: `bin/todo` registers a `done` subparser with one required positional `n` arg registered as a plain string (no `type=int` on the argparse argument) so that a non-numeric `n` reaches `commands.done` rather than being rejected by argparse itself; dispatch binds it to `commands.done`. Internally `done` validates `n` (raising the `error: invalid item number '<n>'` / `error: no item <n> (list has <k> items)` cases, exit 1) then calls `todo/store.py`'s `load()` and, on a valid index, `save()`. |
| `entry_call_site` | `bin/todo` — `done` subcommand branch of the argparse dispatcher |
| `affordance` | Developer runs `todo done <n>` and sees `done #<n>: <text>` on stdout, exit 0, with that item now marked done in the store — or a clean `error: ...` on stderr with exit 1 for an invalid `<n>`. |

### UC-ListTodos

| Field | Value |
|---|---|
| `engine` | `todo/commands.py` (`list_(path)`) |
| `wiring_seam` | argparse subcommand registration: `bin/todo` registers a `list` subparser (no positional args); dispatch binds it to `commands.list_`. Internally calls `todo/store.py`'s `load()` only (read-only, no `save()`). |
| `entry_call_site` | `bin/todo` — `list` subcommand branch of the argparse dispatcher |
| `affordance` | Developer runs `todo list` and sees every item printed as `<n>. [x] <text>` / `<n>. [ ] <text>`, or `(no items)` when the store is empty — plain text, no color/TUI. |

### UC-RemoveTodo

| Field | Value |
|---|---|
| `engine` | `todo/commands.py` (`rm(path, n)`) |
| `wiring_seam` | argparse subcommand registration: `bin/todo` registers an `rm` subparser with one required positional `n` arg registered as a plain string (no `type=int` on the argparse argument) so that a non-numeric `n` reaches `commands.rm` rather than being rejected by argparse itself; dispatch binds it to `commands.rm`. Internally `rm` validates `n` (same rules and error wording as `done`, exit 1 on failure) then calls `todo/store.py`'s `load()` and, on a valid index, `save()`. |
| `entry_call_site` | `bin/todo` — `rm` subcommand branch of the argparse dispatcher |
| `affordance` | Developer runs `todo rm <n>` and sees `removed #<n>: <text>` on stdout, exit 0, with that item gone from the store and later items' display index shifted down — or a clean `error: ...` on stderr with exit 1 for an invalid `<n>`. |

## Deviations

**Correction (this revision):** the prior revision of this map named four per-use-case engine
modules under `todo/usecases/` (`add_todo.py`, `list_todos.py`, `complete_todo.py`,
`remove_todo.py`, each exporting `execute(...)`). That module layout was never adopted anywhere
else in the spec: all seven frozen tasks (`.shapeup/todo-cli/tasks/TASK-001..007`), the scope
contract (`shapeup/todo-cli/scopes/scope-cli-core.md`), and `shapeup/todo-cli/scope-board.md`
all name a single module `todo/commands.py` with functions `add(path, text)`, `list_(path)`,
`done(path, n)`, `rm(path, n)`, on top of `todo/store.py`. `scope-cli-core`'s
`allowed_file_substrate` is exactly `[bin/todo, todo/store.py, todo/commands.py]` —
`todo/usecases/` is outside it, so an executor following the old map would be hook-denied on
first write and burn a build attempt. The PO decided at GATE L1b that `todo/commands.py` is the
correct build surface (1-day appetite; four single-function modules is over-structure for four
short functions). This revision renames all four `engine` fields to `todo/commands.py` with
their real function signatures, taken from TASK-003 through TASK-006, to match. No other field
(UC set, seam mechanism, entry_call_site, affordance, shared-components section, archetype note)
changed.

Otherwise: none. All four use cases have a full engine → seam → entry-point → affordance chain;
no UC is left with an uncertain attachment path. The only remaining caveat is the known
reachability-arm language-mismatch noted above (project-profile.md, "Known limitation of the
reachability arm on this run") — expected and advisory, not a gap in this design.
