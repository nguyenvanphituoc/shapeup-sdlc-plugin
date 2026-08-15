---
schema_version: 1
feature: todo-cli
entry_point: bin/todo.js
---

# Wiring Map — todo-cli

Composition root: `bin/todo.js` — the argv dispatcher. It routes `process.argv[2]` (the
subcommand) to a `commands/<name>.js` handler module, the CLI analogue of a web-service router
dispatching a request path to a route handler (per `project-profile.md`).

Shared engine dependency for all four use cases: `lib/todo-store.js` (implements
`TodoStoreRepository.load()`/`.save()` per `contracts/todo-store.contract.md`, backing
`lib/todo-list.js`'s `TodoList`/`TodoItem` domain model). Each command engine below imports it
directly; none of them re-implement persistence.

---

## UC-AddTodo

| Field | Value |
|---|---|
| engine | `commands/add.js` (uses `lib/todo-list.js` for `TodoList.add()`, `lib/todo-store.js` for load/save) |
| wiring_seam | CLI subcommand registration — `bin/todo.js` matches `argv[2] === 'add'` and requires/invokes `commands/add.js`'s exported handler with the remaining argv, mirroring a route-table entry |
| entry_call_site | `bin/todo.js` — `"add"` dispatch branch, the composition root's argv-to-handler mapping |
| affordance | Developer runs `todo add <text>` in a shell and sees the added item confirmed on stdout, then present on the next `todo list` |

## UC-ListTodos

| Field | Value |
|---|---|
| engine | `commands/list.js` (uses `lib/todo-list.js` for rendering items, `lib/todo-store.js` for load) |
| wiring_seam | CLI subcommand registration — `bin/todo.js` matches `argv[2] === 'list'` and requires/invokes `commands/list.js`'s exported handler |
| entry_call_site | `bin/todo.js` — `"list"` dispatch branch |
| affordance | Developer runs `todo list` in a shell and sees every current item printed with its 1-based index and done/not-done marker, or an explicit empty-list message |

## UC-CompleteTodo

| Field | Value |
|---|---|
| engine | `commands/done.js` (uses `lib/todo-list.js` for `TodoList.completeAt()`, `lib/todo-store.js` for load/save) |
| wiring_seam | CLI subcommand registration — `bin/todo.js` matches `argv[2] === 'done'` and requires/invokes `commands/done.js`'s exported handler with the remaining argv (the index argument) |
| entry_call_site | `bin/todo.js` — `"done"` dispatch branch |
| affordance | Developer runs `todo done <n>` in a shell; the item at display position `<n>` shows as done on the next `todo list` |

## UC-RemoveTodo

| Field | Value |
|---|---|
| engine | `commands/rm.js` (uses `lib/todo-list.js` for `TodoList.removeAt()`, `lib/todo-store.js` for load/save) |
| wiring_seam | CLI subcommand registration — `bin/todo.js` matches `argv[2] === 'rm'` and requires/invokes `commands/rm.js`'s exported handler with the remaining argv (the index argument) |
| entry_call_site | `bin/todo.js` — `"rm"` dispatch branch |
| affordance | Developer runs `todo rm <n>` in a shell; the item at display position `<n>` no longer appears on the next `todo list`, and its `id` is never reassigned to a later item |

---

## Deviations

None. All four use cases have a direct, player-facing (developer-facing) CLI seam through the
single `bin/todo.js` dispatcher; no background/cron/init-only engine exists in this feature.
