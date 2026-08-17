---
type: scope-contract
scope_id: cli-pipeline
feature: envlint
topology_type: LAYER_CAKE
tasks: [TASK-003, TASK-004]
allowed_file_substrate: [bin/envlint.mjs, test/cli.test.mjs, test/integration.test.mjs, test/fixtures/**]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/cli.test.mjs", "node --test test/integration.test.mjs"]
---

# Scope Contract: `cli-pipeline`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| cli-missing-schema-flag | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a — this row is the error path | `--schema` not given → stderr `Error: ...`, no stack trace, exit 2 | n/a |
| cli-env-unreadable | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | env file missing/unreadable → stderr `Error: cannot read env file: <path>`, exit 2 | n/a |
| cli-schema-unreadable | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | schema file missing/unreadable → stderr error pattern, exit 2 | n/a |
| cli-schema-invalid-json | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | schema file not valid JSON → stderr `Error: schema is not valid JSON: <path>`, exit 2 | n/a |
| cli-clean-human | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | 0 findings, human mode → stdout `ok: N keys checked`, exit 0 | n/a | n/a |
| cli-clean-json | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | 0 findings, `--json` → exactly one JSON document `{"ok":true,"findings":[],"checked":N}` on stdout, exit 0 | n/a | n/a |
| cli-findings-human | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | ≥1 finding, human mode → one `<envfile>:<line>: <KEY>: <message>` line per finding + `N problem(s)` trailer, exit 1 | n/a |
| cli-findings-json | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | ≥1 finding, `--json` → exactly one JSON document `{"ok":false,"findings":[...],"checked":N}`, exit 1 | n/a |
| cli-malformed-line-e4 | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | malformed line (E4) → `<envfile>:<line>: <line text truncated to 30 chars>: not a KEY=VALUE assignment`, exit 1 | n/a |
| cli-empty-file-e3 | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | n/a | n/a | zero-assignment env file → every `required` key reported missing, exit 1, no `ok` line |
| cli-integration-full-chain | integration-test | N/A (non-interactive CLI) | N/A (non-interactive CLI) | real binary spawn/exec against fixture files covers E1–E5 plus clean/findings human + `--json` paths together, at least one exit-0 and one exit-1 run via the real binary (not direct `lib/*` calls) | same fixture matrix's error rows (E1–E5) verified via the real binary | fixtures written to a temp dir or `test/fixtures/`, never touching the developer's real `.env`; no network access during the run |

## Why this slice

`LAYER_CAKE` — `bin/envlint.mjs` is the composition root that plays both the "front" (argv
parse, stdout/stderr render, exit-code selection — the only player-visible surface per
`wiring-map.md`) and the "back" (file reads, wiring `lib/parse.mjs` and `lib/rules.mjs`
together) in one balanced call chain, per `domain-model.md`'s Engines table: "CLI ... Imports
both `lib/parse.mjs` and `lib/rules.mjs`". `bin/envlint.mjs` is the only file in the feature
that imports both engines (`scope-summary.md`'s substrate-disjointness constraint), so this
scope owns it exclusively — no other scope's `allowed_file_substrate` includes it, and neither
`lib/parse.mjs` nor `lib/rules.mjs` appears here (frozen/read-call-only from this scope's
perspective). TASK-004's integration test is folded in here rather than split into its own
`CHOWDER` scope because it shares the exact same flow and substrate concern (drive the real
binary end-to-end against fixtures) rather than being a topological stray with no shared
business flow — it is the same call chain as TASK-003, verified at the process boundary instead
of the module boundary. Builds last, after `env-parsing` and `schema-rules` land, per
`scope-summary.md`'s dependency graph (TASK-001/TASK-002 → TASK-003 → TASK-004).
