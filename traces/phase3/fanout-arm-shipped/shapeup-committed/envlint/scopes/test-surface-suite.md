---
type: scope-contract
scope_id: test-surface-suite
feature: envlint
topology_type: CHOWDER
tasks: [TASK-004]
allowed_file_substrate: [test/test-surface.test.mjs]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/test-surface.test.mjs"]
---

# Scope Contract: `test-surface-suite`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| full-test-surface-coverage | integration-test | N/A (non-interactive CLI) | N/A (non-interactive CLI) | every `TS-*` row in [[usecases/UC-01#Test-Surface]] (TS-INV-*, TS-ERR-*, TS-REQ-*, TS-TYPE-*, TS-NOGO-*) has a corresponding test that drives the built `bin/envlint.mjs` binary via `child_process.spawnSync` against throwaway fixtures written to a temp directory per run; `npm test` exits 0 | a `TS-*` row's assertion failing means one of TASK-001/002/003 is incomplete, not this scope — this scope only adds coverage, per TASK-004's Non-Go | `TS-NOGO-02` (no `.env` writing) is verified by diffing fixture file contents/mtime before and after each run, not by code inspection alone; no fixture is ever committed as a stale golden file |

## Why this slice

`CHOWDER` — the one deliberate exception, declared rather than defaulted to: this scope shares no
business-flow substrate with `parsing-engine`, `rules-engine`, or `cli-composition-root` — it
writes only its own test file and exercises the already-built binary as a black box via
subprocess spawns against throwaway temp fixtures, never importing `src/parsing.mjs` or
`src/rules.mjs` directly. Its dependency (`TASK-001`, `TASK-002`, `TASK-003` per scope-summary's
Wave 3) is topological, not flow-based, so it cannot honestly join any single engine or the CLI
scope. It is the only scope proving the whole Test Surface — all four `D1`–`D4` source groups
across the entire stack at once — rather than one engine's or the CLI's own fixture in isolation.
Builds last per the riskiest-first sequence.
