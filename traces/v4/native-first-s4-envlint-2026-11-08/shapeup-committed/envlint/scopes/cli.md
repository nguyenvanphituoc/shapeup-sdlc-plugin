---
scope_id: cli
topology_type: LAYER_CAKE
use_cases: [UC-03]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-21, REQ-24, REQ-25, REQ-27, REQ-28, REQ-29]
depends_on: [parsing, rules]
allowed_file_substrate: [bin/envlint.mjs, package.json, test/cli.test.mjs]
shared_substrate: []
e2e_verification_fixtures: ["node --test test/cli.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope — cli

## Why this slice

The whole user-facing call chain: argv → file reads → parser → rules → stdout/stderr/exit code, plus
the `bin` entry in `package.json` (this scope is its only owner) and the end-to-end suite that drives the
binary against temp-dir fixtures. It consumes both pure engines, so it builds after them.

## Affordances

| test_id | role | required_states | source |
|---|---|---|---|
| envlint-cli | command | [idle, error, success, empty] | ux-behavior state table |
