---
scope_id: cli-integration
topology_type: LAYER_CAKE
tasks: [TASK-008, TASK-009]
allowed_file_substrate: [bin/todo.js, test/cli.test.js, test/integration/cli.test.js]
shared_substrate: [bin/todo.js]
e2e_verification_fixtures: ["node --test test/cli.test.js", "node --test test/integration/cli.test.js"]
hill_phase: UPHILL_UNKNOWN
---

# Scope: cli-integration

## Why this slice
The composition root: replaces `foundation`'s `bin/todo.js` placeholder with the real
`argv[2]` → `{add,list,done,rm}` dispatcher (`[[ux-behavior#Command-Flow]]`), routes to each
command scope's module by require/import only (never by touching a command scope's own
files), owns the one error case no single UC owns — `UNKNOWN_COMMAND` (no/unrecognized
subcommand, exit 1, no store touched) — and propagates each command's own exit code. TASK-009's
subprocess round-trip test lives here rather than in any one command scope because it exercises
the full dispatch chain (`bin/todo.js` → all four commands → the shared store), which is
exactly this scope's flow, not any single command's.

`bin/todo.js` is declared `shared_substrate` with `foundation`: `foundation` (TASK-001) writes
the shebang placeholder first, this scope (TASK-008) rewrites it with the real dispatcher —
both scopes touch the same path by design, never silently.

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli:dispatch | router | [idle, error] |

`cli:dispatch`'s `error` state is `UNKNOWN_COMMAND` specifically (missing or unrecognized
`argv[2]`) — its `success` path is simply "handed off to the matching command scope's own
affordance" (`cli:add` / `cli:list` / `cli:done` / `cli:rm`), so no separate `success`/`loading`
row is owned here.

## Riskiest-first note
Build this scope LAST — it depends on `foundation` and all four command scopes existing.
