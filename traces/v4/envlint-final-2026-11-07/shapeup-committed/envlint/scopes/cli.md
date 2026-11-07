---
scope_id: cli
topology_type: LAYER_CAKE
use_cases: [UC-LintEnvFile]
covers: [REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-21]
depends_on: [parsing, rules]
allowed_file_substrate: [bin/envlint.mjs, test/cli.test.mjs, test/e2e.test.mjs]
shared_substrate: []
e2e_verification_fixtures: ["node --test test/cli.test.mjs test/e2e.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: cli

## Why this slice
UC-LintEnvFile end to end: argv → read both files → parse → validate schema → lint → print → exit
code. It is the entry point and the sole importer of the two pure modules, so it builds after both.
Its fixtures spawn the real binary against temp-dir fixtures and assert the expected exit codes inside
test files that themselves exit 0.

## Affordances

| test_id | role | required_states | source |
|---|---|---|---|
| envlint-command | command | [idle, success, error, empty] | ux-behavior TerminalOutput |
