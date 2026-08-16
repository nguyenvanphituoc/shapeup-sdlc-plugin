---
type: scope-contract
scope_id: foundation
feature: todo-cli
topology_type: ICEBERG
tasks: [TASK-001, TASK-002]
allowed_file_substrate: [package.json, bin/todo.js, lib/todo-repository.js, test/todo-repository.test.js, test/bin-scaffold.test.js]
shared_substrate: [bin/todo.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/todo-repository.test.js", "node --test test/bin-scaffold.test.js"]
---

# Scope Contract: `foundation`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| cli-dispatch-no-args | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a — no-arg invocation is always the usage-error path | prints usage line to stderr, exit 1 | n/a |
| cli-dispatch-unknown-cmd | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | prints `Error: unknown command "<cmd>"...` to stderr, exit 1 (`E_UNKNOWN_COMMAND`) | n/a |
| cli-dispatch-stub-branches | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | reaches a distinct stub branch per command without throwing (TASK-001 baseline, superseded in place by TASK-003–006) | n/a | n/a |
| todo-repository-load | repository-method | N/A (non-interactive CLI) | N/A (non-interactive CLI) | `load()` returns parsed `TodoItem[]`, or `[]` on `ENOENT`/`[]`-on-disk | invalid JSON or non-array JSON throws `StoreCorruptedError` (`E_STORE_CORRUPTED`); other read failures throw `StoreReadError` | missing file / `[]` on disk → `[]`, never `null` |
| todo-repository-save | repository-method | N/A (non-interactive CLI) | N/A (non-interactive CLI) | writes full `items` array atomically, round-trips through `load()` unchanged | filesystem write failure throws `StoreWriteError` (`E_STORE_WRITE_FAILED`) | saving `[]` writes a valid empty-array file |

## Why this slice

This is the one scope where complexity is real (`ICEBERG`, not `LAYER_CAKE`): the argv dispatch
skeleton (`bin/todo.js`) and the store I/O layer (`lib/todo-repository.js`) together carry the
footguns every other scope's fixtures assume are already closed — the `ENOENT`-vs-corrupted
distinction (`.shapeup/todo-cli/orient/spike-store-parsing.md`), the "never a bare `JSON.parse`
exception" guarantee, and the `E_UNKNOWN_COMMAND` usage-error path that every command scope's
fixture would otherwise have to re-prove. `bin/todo.js` is declared `shared_substrate` here and
in every command scope because this scope creates the file with stub branch bodies and each
command scope later replaces only its own branch's body in place, never the dispatch skeleton
around it. `package.json` and `lib/todo-repository.js` are exclusive to this scope — no other
scope's `allowed_file_substrate` may touch them (frozen/read-call-only elsewhere).
