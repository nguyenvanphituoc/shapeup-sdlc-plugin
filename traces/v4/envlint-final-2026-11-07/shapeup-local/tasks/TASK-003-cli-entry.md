---
type: task
feature: envlint
id: TASK-003
title: "Implement the envlint CLI entry point"
lens: standard
package: bin
status: done
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-LintEnvFile]
entities: [EnvFile, Schema, Finding]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile]]", "[[contracts/cli.contract]]", "[[ux-behavior#Screen: TerminalOutput]]"]
estimated_hours: 3
tags: [FEAT, cli]
completed_at: 2026-11-07
---

# TASK-003: Implement the envlint CLI entry point

## Context
Implement `bin/envlint.mjs` per [[contracts/cli.contract]] and [[ux-behavior#Screen: TerminalOutput]],
realising [[usecases/UC-LintEnvFile#Steps]]. It is the only module doing I/O and the sole importer of
`src/parse.mjs` and `src/rules.mjs`.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `bin/envlint.mjs` exists, imports `parse` from `../src/parse.mjs` and `validateSchema`, `lint` from `../src/rules.mjs` (covers: REQ-21)
- [x] `test/cli.test.mjs` exists, spawns `node bin/envlint.mjs` against fixtures it writes to a temp directory, and `node --test test/cli.test.mjs` exits 0 (covers: REQ-8)
- [x] `node bin/envlint.mjs --schema <s.json> <app.env>` reads exactly those two files; `<app.env> --schema <s.json>` is equivalent (covers: REQ-8)
- [x] With no env path given, it exits 2 with the usage line and never reads `./.env` in the working directory (covers: REQ-9)
- [x] Missing `--schema`, a `--schema` with no value, two positional paths, or an unknown flag → exit 2, usage line on stderr (covers: REQ-21)
- [x] Parse problems print as `<env>:<line>: parse: <message>` and findings as `<env>:<line>: <KEY>: <message>` (or `<env>: <KEY>: <message>` for a missing required key), problems first (covers: REQ-2)
- [x] Exit 1 when anything is printed, exit 0 with empty stdout when clean (covers: REQ-3)
- [x] A missing env file → exit 2, `envlint: cannot read <path>: …` on stderr (covers: REQ-4)
- [x] A missing schema file, a schema that is not JSON, or one `validateSchema` rejects → exit 2, `envlint: cannot read …` / `envlint: invalid schema <path>: …` (covers: REQ-5)
- [x] No input produces a stack trace: stderr never contains a `    at ` frame line, and unexpected errors are one `envlint: …` line with exit 2 (covers: REQ-7)
- [x] The tool never writes the env file (bytes and mtime unchanged after a run) — pitch no-go, graded as UC-LintEnvFile TS-NOGO-01
- [x] The tool does not load the env file into `process.env` (no dotenv-compatible loading) — pitch no-go, graded as UC-LintEnvFile TS-NOGO-03

### 📭 Empty & Null States
- [x] An empty or comments-only env file with schema `{}` → exit 0, no output; with `{"A":{"required":true}}` → exit 1, one `A` line (covers: REQ-6)

### 🧪 BDD Scenarios

**Scenario: CI fails on a bad value**
Given `app.env` contains `PORT=abc` on line 2 and `s.json` is `{"PORT":{"required":true,"type":"int"}}`
When  `node bin/envlint.mjs --schema s.json app.env` runs
Then  stdout is `app.env:2: PORT: …` and the exit code is 1

**Scenario: unreadable schema**
Given `s.json` does not exist
When  `node bin/envlint.mjs --schema s.json app.env` runs
Then  stderr is one `envlint: cannot read s.json: …` line, exit 2, no stack trace

## Non-Go (not in this task)
- Changing `src/parse.mjs` or `src/rules.mjs`; `.env` writing; interpolation; dotenv loading.


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `bin/envlint.mjs` exists, imports `parse` from `../src/parse.mjs` and `validateSchema`, `lint` from `../src/rules.mjs` (covers: REQ-21): pass (bin/envlint.mjs lines 2-4 imports; T0 green)
- `test/cli.test.mjs` exists, spawns `node bin/envlint.mjs` against fixtures it writes to a temp directory, and `node --test test/cli.test.mjs` exits 0 (covers: REQ-8): pass (verify t0 green 1/1 fixtures)
- `node bin/envlint.mjs --schema <s.json> <app.env>` reads exactly those two files; `<app.env> --schema <s.json>` is equivalent (covers: REQ-8): pass (cli.test 'argument order is irrelevant')
- With no env path given, it exits 2 with the usage line and never reads `./.env` in the working directory (covers: REQ-9): pass (cli.test 'never reads ./.env')
- Missing `--schema`, a `--schema` with no value, two positional paths, or an unknown flag → exit 2, usage line on stderr (covers: REQ-21): pass (cli.test 'usage errors exit 2')
- Parse problems print as `<env>:<line>: parse: <message>` and findings as `<env>:<line>: <KEY>: <message>` (or `<env>: <KEY>: <message>` for a missing required key), problems first (covers: REQ-2): pass (cli.test 'parse problems print before findings')
- Exit 1 when anything is printed, exit 0 with empty stdout when clean (covers: REQ-3): pass (cli.test bad value / clean)
- A missing env file → exit 2, `envlint: cannot read <path>: …` on stderr (covers: REQ-4): pass (cli.test missing files)
- A missing schema file, a schema that is not JSON, or one `validateSchema` rejects → exit 2, `envlint: cannot read …` / `envlint: invalid schema <path>: …` (covers: REQ-5): pass (cli.test missing files)
- No input produces a stack trace: stderr never contains a `    at ` frame line, and unexpected errors are one `envlint: …` line with exit 2 (covers: REQ-7): pass (top-level try/catch; e2e TS-INV-01)
- The tool never writes the env file (bytes and mtime unchanged after a run) — pitch no-go, graded as UC-LintEnvFile TS-NOGO-01: pass (e2e TS-NOGO-01)
- The tool does not load the env file into `process.env` (no dotenv-compatible loading) — pitch no-go, graded as UC-LintEnvFile TS-NOGO-03: pass (e2e TS-NOGO-03; no process.env writes in bin)
- An empty or comments-only env file with schema `{}` → exit 0, no output; with `{"A":{"required":true}}` → exit 1, one `A` line (covers: REQ-6): pass (cli.test 'empty and comments-only files')
