---
type: task
feature: envlint
id: TASK-003
title: "Implement the envlint CLI entry point"
lens: lite
package: bin
status: done
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-LintEnvFile]
scope_id: ""
entities: [EnvFile, Schema]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile]]", "[[ux-behavior#Screen: Terminal]]", "[[domain-model#Planning decisions]]"]
estimated_hours: 3
tags: [cli]
completed_at: 2026-11-07
eval_verdict: fail
eval_at: 2026-11-07
---

# TASK-003: Implement the envlint CLI entry point

## Context
Build `bin/envlint.mjs` per [[usecases/UC-LintEnvFile#Steps]] and the states in
[[ux-behavior#Screen: Terminal]]: it composes `parse` and `checkSchema`/`check`, with exit codes and
output format from PD-13 and PD-14.
Reference: [[usecases/UC-LintEnvFile]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `bin/envlint.mjs` exists with a `#!/usr/bin/env node` shebang and `node --check bin/envlint.mjs` exits 0 (covers: REQ-21)
- [x] `envlint --schema <schema.json> <envfile>` reads both files from argv; `--schema=x` and a schema after the env file also work (TS-REQ-schema-position) (covers: REQ-8)
- [x] a `.env` in the working directory is never read (TS-NOGO-01) (covers: REQ-9)
- [x] usage errors (no args, `--schema` with no value, no env file, two env files, unknown option) exit 2 with `envlint:` and `usage:` on stderr (TS-ERR-USAGE) (covers: REQ-21)
- [x] findings and parse problems print one stdout line each, `<envfile>:<line>: <key>: <message>` (TS-ERR-FINDINGS) (covers: REQ-2)
- [x] exit 1 when anything is printed, exit 0 with empty stdout when clean (TS-REQ-clean) (covers: REQ-3)
- [x] stdout and stderr carry no ANSI escapes and the CLI never reads stdin (TS-INV-03) (covers: REQ-25)
- [x] `node --test test/cli.test.mjs` passes, driving the binary with `spawnSync` over temp-dir fixtures

### 🧪 BDD Scenarios

**Scenario: CI fails on a bad env file**
Given a schema `{"A":{"type":"int"},"B":{"required":true}}` and an env file `A=x`
When  `envlint --schema s.json app.env` runs
Then  stdout names `A` with line 1 and `B` as missing, and the exit code is 1

## Non-Go (not in this task)
- Missing-file, bad-schema and empty-file edges — TASK-004


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `bin/envlint.mjs` exists with a `#!/usr/bin/env node` shebang and `node --check bin/envlint.mjs` exits 0 (covers: REQ-21): pass (node --check bin/envlint.mjs exit 0; test 'REQ-21: shebang present and node --check passes' passes)
- `envlint --schema <schema.json> <envfile>` reads both files from argv; `--schema=x` and a schema after the env file also work (TS-REQ-schema-position) (covers: REQ-8): pass (test 'TS-REQ-schema-position' passes: `app.env --schema=s.json`, `--schema=s.json app.env`, `app.env --schema s.json` give identical status and stdout to `--schema s.json app.env`)
- a `.env` in the working directory is never read (TS-NOGO-01) (covers: REQ-9): pass (test 'TS-NOGO-01' passes: temp cwd with a failing .env, clean.env passed → exit 0, empty stdout)
- usage errors (no args, `--schema` with no value, no env file, two env files, unknown option) exit 2 with `envlint:` and `usage:` on stderr (TS-ERR-USAGE) (covers: REQ-21): pass (test 'TS-ERR-USAGE' passes for [], [a.env --schema], [--schema s.json], two env files, --bogus, --schema= : exit 2, stderr ^envlint: and contains usage:)
- findings and parse problems print one stdout line each, `<envfile>:<line>: <key>: <message>` (TS-ERR-FINDINGS) (covers: REQ-2): pass (test 'TS-ERR-FINDINGS' passes: env `A=x\nGARBAGE`, schema {A:int,B:required} → exit 1, lines `app.env:1: A: …`, `app.env:2: …`, `app.env: B: …`)
- exit 1 when anything is printed, exit 0 with empty stdout when clean (TS-REQ-clean) (covers: REQ-3): pass (tests 'TS-REQ-clean' (exit 0, stdout '') and 'TS-ERR-FINDINGS' (exit 1) pass)
- stdout and stderr carry no ANSI escapes and the CLI never reads stdin (TS-INV-03) (covers: REQ-25): pass (test 'TS-INV-03' passes: stdin 'ignore', process exits within timeout, no \x1b[ in stdout+stderr, bin source has no process.stdin reference)
- `node --test test/cli.test.mjs` passes, driving the binary with `spawnSync` over temp-dir fixtures: pass (node --test test/cli.test.mjs test/cli-edges.test.mjs → 12/12 pass; T0 verify r1-a1 overall green, fixtures 2/2)


## Execution Log — 2026-11-07 (envlint/cli-r2-a1)
- executor: task-executor via ingest-result
- status: done
- stdout and stderr carry no ANSI escapes and the CLI never reads stdin (TS-INV-03) (covers: REQ-25): pass (BUG-1 fixed: bin/envlint.mjs adds visible() which prints C0/DEL/C1 control chars as literal \xHH, applied at the stdout print site and both stderr print sites. New test 'TS-INV-03: ESC in an env value, env key or schema key never reaches the output raw' (ESC in value, env key -> PARSE_BAD_KEY line, schema key -> missing-key line) asserts 3 stdout lines, no raw control bytes, and literal '\x1b[31mred'. node --test test/cli.test.mjs test/cli-edges.test.mjs -> 13/13 pass; harness verify t0 cli --round 2 --attempt 1 -> green 2/2)
