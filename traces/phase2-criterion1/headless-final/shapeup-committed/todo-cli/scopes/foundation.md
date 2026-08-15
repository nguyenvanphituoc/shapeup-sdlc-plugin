---
scope_id: foundation
topology_type: ICEBERG
tasks: [TASK-001, TASK-002, TASK-003]
allowed_file_substrate: [package.json, bin/todo.js, src/domain/todo-list.js, src/store.js, test/domain/todo-list.test.js, test/store.test.js]
shared_substrate: [bin/todo.js]
e2e_verification_fixtures: ["node --test test/domain/todo-list.test.js", "node --test test/store.test.js"]
hill_phase: UPHILL_UNKNOWN
---

# Scope: foundation

## Why this slice
Every command scope (`add-todo`, `list-todos`, `complete-todo`, `remove-todo`) calls the same
two modules — `src/domain/todo-list.js` (in-memory aggregate, INV-01/02/03) and `src/store.js`
(the `TodoStoreRepository`, de-risked by `.shapeup/todo-cli/orient/spike-persistence.md`,
flagged as the pitch's highest-risk area in `[[scope-summary#Risks]]`). Slicing this out is not
directory-thinking (PA1): it is the one call chain every other scope depends on but none of
them owns, so it ships first and its substrate is frozen (read-only, not rewritten) by every
downstream scope. `bin/todo.js` is written here only as TASK-001's shebang placeholder; the
real dispatcher body belongs to `cli-integration` (TASK-008) — hence the declared
`shared_substrate` entry on both sides.

`topology_type: ICEBERG` — the complexity is almost entirely on one side (atomic write,
missing-vs-corrupted-file distinction, id-never-reused invariant) versus the thin
`package.json`/shebang scaffolding on the other.

## Affordances

This scope has no CLI-invocable surface of its own (no subcommand dispatches here) — it is
pure engine code consumed by the command scopes below. No affordance_manifest row applies.

## Riskiest-first note
Build this scope FIRST. `TASK-003` (store persistence: atomic temp-file+rename write, ENOENT
vs. SyntaxError distinction, shape-validation on read) is the pitch's single highest-risk item
per `[[scope-summary#Risks]]` — every other scope's fixtures assume its contract holds.
