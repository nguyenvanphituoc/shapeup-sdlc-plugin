---
type: task
feature: envlint
id: TASK-003
title: "Wire the envlint CLI in bin/envlint.mjs"
lens: standard
package: bin
status: done
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-LintEnvFile]
entities: [EnvFile, Schema]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile]]", "[[contracts/envlint.contract]]"]
estimated_hours: 2
tags: [cli]
completed_at: 2026-11-07
---

# TASK-003: Wire the envlint CLI in bin/envlint.mjs

## Context
`bin/envlint.mjs` is the composition root. It parses argv, reads the two files, calls `parseEnv` and
`checkRules`, prints, and exits, per [[usecases/UC-LintEnvFile#Steps]] and contract §4 of
[[contracts/envlint.contract]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `bin/envlint.mjs` has a `#!/usr/bin/env node` shebang and `node --check bin/envlint.mjs` exits 0
- [x] `envlint --schema <schema.json> <envfile>` reads exactly those two paths, with no implicit `./.env` lookup (covers: REQ-8) (covers: REQ-9)
- [x] missing `--schema`, `--schema` with no value, an unknown option, or anything other than one positional → exit 2, stderr `envlint: …` plus a `usage:` line (covers: REQ-22)
- [x] findings and parse problems print one per line to stdout, in line order, as `<envfile>:<line>: <KEY>: <message>`, `<envfile>:<line>: <message>` or `<envfile>: <KEY>: <message>` (covers: REQ-2)
- [x] exit 0 when nothing is printed, exit 1 when any problem or finding is printed (covers: REQ-3)
- [x] the CLI never writes any file and does no dotenv-style loading into `process.env` (covers: REQ-23) (covers: REQ-25)
- [x] output has no ANSI escape codes and the CLI never reads stdin (covers: REQ-26)

### 🔗 Integration Flow
**CLI → parse + rules**
Given an env file `PORT=abc` and a schema `{"PORT":{"type":"int"}}`
When  `node bin/envlint.mjs --schema s.json e.env` runs
Then  stdout is `e.env:1: PORT: expected int, got "abc"`
And   the exit code is 1

## Implementation Notes
- Use `node:util` `parseArgs({options:{schema:{type:"string"}}, allowPositionals:true, strict:true})` inside a try block.
- Error messages name the path: `envlint: cannot read env file <p>`, `envlint: invalid schema <p>: …`.

## Non-Go (not in this task)
- The end-to-end edge-case test suite (TASK-004), colors, watch mode.


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `bin/envlint.mjs` has a `#!/usr/bin/env node` shebang and `node --check bin/envlint.mjs` exits 0: pass (shebang on line 1; T0 fixture node --check green (2/2))
- `envlint --schema <schema.json> <envfile>` reads exactly those two paths, with no implicit `./.env` lookup (covers: REQ-8) (covers: REQ-9): pass (only readFileSync on the two argv paths; cli.test 'only given files are read' green)
- missing `--schema`, `--schema` with no value, an unknown option, or anything other than one positional → exit 2, stderr `envlint: …` plus a `usage:` line (covers: REQ-22): pass (cli.test 'usage errors exit 2 with a usage line' green)
- findings and parse problems print one per line to stdout, in line order, as `<envfile>:<line>: <KEY>: <message>`, `<envfile>:<line>: <message>` or `<envfile>: <KEY>: <message>` (covers: REQ-2): pass (cli.test scenario prints the three specified lines in order)
- exit 0 when nothing is printed, exit 1 when any problem or finding is printed (covers: REQ-3): pass (cli.test no-assignments (0) and findings (1))
- the CLI never writes any file and does no dotenv-style loading into `process.env` (covers: REQ-23) (covers: REQ-25): pass (no write APIs or process.env use in bin/envlint.mjs; cwd listing unchanged in test)
- output has no ANSI escape codes and the CLI never reads stdin (covers: REQ-26): pass (no stdin read; test asserts no \x1b[ in stdout/stderr)
