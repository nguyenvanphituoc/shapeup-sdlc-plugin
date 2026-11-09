---
type: task
feature: envlint
id: TASK-003
title: "Implement the envlint CLI composing parseEnv and checkRules"
package: "."
status: ready
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-LintEnvFile]
scope_id: ""
entities: [Finding]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile]]", "[[ux-behavior]]"]
files: [bin/envlint.mjs, test/cli.test.mjs]
estimated_hours: 3
tags: [cli]
---

# TASK-003: Implement the envlint CLI

## Context
Implements [[usecases/UC-LintEnvFile#Steps]] and the process contract in [[ux-behavior]]: argv, reading both files, printing, exit codes (SD-4, SD-5).
Imports `parseEnv` from `src/parse.mjs` and `checkSchema`/`checkRules` from `src/rules.mjs` — it must not reimplement them.

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `bin/envlint.mjs` exists, imports `../src/parse.mjs` and `../src/rules.mjs`, and runs as `node bin/envlint.mjs --schema <s> <env>` (covers: REQ-21, REQ-24)
- [ ] `test/cli.test.mjs` spawns the binary against fixtures it writes to a tmp dir; `node --test test/cli.test.mjs` exits 0
- [ ] both paths come from argv; `--schema` before or after the env path both work (covers: REQ-8)
- [ ] with no env path the run is a usage error and `./.env` in the cwd is never read (covers: REQ-9)
- [ ] findings print one line each as `<env>:<line>: <KEY>: <message>`, in the ux-behavior order (covers: REQ-2, REQ-1)
- [ ] exit 1 on any finding or parse problem, 0 when clean (covers: REQ-3)
- [ ] a missing env file → exit 2, stderr names the path (covers: REQ-4)
- [ ] a missing schema, invalid JSON and an invalid schema shape → exit 2 with an `envlint:` line, no stack trace (covers: REQ-5, REQ-7)
- [ ] a file with zero assignments → `no assignments found` on stderr and the rules still run (covers: REQ-6)
- [ ] every row of the UC-LintEnvFile Test Surface TS-ERR-*, TS-REQ-* and TS-INV-01 is a named test case in `test/cli.test.mjs` and passes

### 🧪 BDD Scenarios

**Scenario: CI fails on a typo**
Given a schema requiring `PORT` as int and an env file with `PORT=8O8O`
When  `node bin/envlint.mjs --schema schema.json .env` runs
Then  stdout is `.env:1: PORT: expected int, got "8O8O"` and the exit code is 1

**Scenario: a clean file passes**
Given the same schema and `PORT=8080`
When  the CLI runs
Then  stdout is empty and the exit code is 0

### 🔗 Integration Flow

**CLI → Parsing → Rules**
Given both fixture files written by the test
When  the CLI reads them and calls `parseEnv` then `checkSchema`/`checkRules`
Then  the printed lines are exactly the module outputs formatted per ux-behavior
And   the process exits 0 / 1 / 2 per SD-4

## Non-Go (not in this task)
- Colors, prompts, watching files, a default `.env` lookup.
