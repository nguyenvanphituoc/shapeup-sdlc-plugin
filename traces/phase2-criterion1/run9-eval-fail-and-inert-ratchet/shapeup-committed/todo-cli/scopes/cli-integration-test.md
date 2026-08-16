---
type: scope-contract
scope_id: cli-integration-test
feature: todo-cli
topology_type: CHOWDER
tasks: [TASK-007]
allowed_file_substrate: [test/cli.test.js]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/cli.test.js"]
---

# Scope Contract: `cli-integration-test`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| cli-happy-path-roundtrip | integration-test | N/A (non-interactive CLI) | N/A (non-interactive CLI) | spawns `node bin/todo.js <args>` as a real subprocess against a temp `HOME` through `add`, `add`, `list`, `done 1`, `list`, `rm 2`, `list` — each step's stdout/exit code matches [[ux-behavior#Command-Flow]] | n/a — this row is the happy path; error rows below cover the same subprocess mechanism | n/a |
| cli-empty-list-not-error | integration-test | N/A (non-interactive CLI) | N/A (non-interactive CLI) | `list` on a fresh temp `HOME` with no store prints `No todos yet.`, exit 0 | n/a | fresh temp `HOME`, no prior `add` |
| cli-bad-index-rejected | integration-test | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | `done 99`, `done abc`, `done 0`, `rm` (no arg) against a 1-item temp store each exit 1 with a plain stderr message (no raw stack trace), store unchanged after each | n/a |
| cli-corrupted-store-clean-fail | integration-test | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | `list`, `add "x"`, `done 1`, `rm 1` against a temp store containing `{not valid json,,,` each exit 1, stderr names the store as corrupted (no raw `SyntaxError`/stack-trace text), corrupted file left byte-for-byte unchanged | n/a |

## Why this slice

`CHOWDER` — the one deliberate exception, declared rather than defaulted to: this scope shares no
business-flow substrate with any other scope (it writes only its own test file, reads the already-
built CLI as a black box) and its dependency is topological (needs `foundation` + all four command
scopes to exist) rather than flow-based, so it cannot honestly join any of them. It is the only
scope exercising the full subprocess round-trip — real `child_process` spawns of `bin/todo.js`
against a temp `HOME`, never the real user's `~/.todo.json` — plus the corrupted-store and bad-index
edge cases across the whole stack at once. Builds last per the riskiest-first sequence: it proves
TASK-001 through TASK-006 add up to the behavior specified across
[[usecases/_index]] and [[ux-behavior]], not a substitute for any single command scope's own fixture.
