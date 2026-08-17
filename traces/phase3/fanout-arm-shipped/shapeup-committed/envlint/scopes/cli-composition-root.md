---
type: scope-contract
scope_id: cli-composition-root
feature: envlint
topology_type: LAYER_CAKE
tasks: [TASK-003]
allowed_file_substrate: [bin/envlint.mjs, test/cli.test.mjs]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/cli.test.mjs"]
---

# Scope Contract: `cli-composition-root`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| envlint-cli-invocation | cli-command | N/A (non-interactive CLI) | N/A (non-interactive CLI) | `findings.length === 0` → stdout `ok: N keys checked` (N=`Object.keys(schema).length`), exit 0; `--json` clean → stdout exactly `{"ok":true,"findings":[],"checked":N}`, exit 0; `≥1` finding → stdout one line per finding `<envfile>:<line>: <KEY>: <message>` in file order then `N problem(s)`, exit 1; `--json` findings → stdout exactly one JSON doc `{"ok":false,"findings":[...],"checked":N}`, exit 1; `--json` never changes which branch is taken or the exit code (INV-04) | missing `--schema` → exit 2, stderr `Error: ` prefix, single line, no schema/env file read (E_NOFLAG); unreadable/missing schema → exit 2, stderr `Error: cannot read schema file: <path>` (E_SCHEMA_UNREADABLE); schema not valid JSON → exit 2, stderr `Error: schema is not valid JSON: <path>` (E2); unreadable/missing env file → exit 2, stderr `Error: cannot read env file: <path>` (E1); no exit-2 path ever prints a raw stack trace or anything to stdout | n/a — the CLI always takes exactly one of the branches above; there is no separate "nothing happened" state |

## Why this slice

The one scope in this feature that genuinely crosses layers: per wiring-map.md, `bin/envlint.mjs`
IS the composition root and the entry point declared in project-profile.md — it reads argv, calls
`node:fs.readFileSync` for both input files (I/O), calls `parseEnv` from `parsing-engine` and
`evaluate` from `rules-engine` (frozen, call-only — neither `src/parsing.mjs` nor `src/rules.mjs`
is in this scope's substrate; TASK-003's Non-Go: "No parsing logic, no rule logic... this task
only wires and renders their output"), then renders one of two output modes and sets the exit
code (presentation). `LAYER_CAKE`: thin, balanced glue over both engines, not itself where the
complexity lives — TASK-003 depends on TASK-001 and TASK-002 both completing first (scope-summary
Wave 2), so this scope builds only after `parsing-engine` and `rules-engine` are green.
