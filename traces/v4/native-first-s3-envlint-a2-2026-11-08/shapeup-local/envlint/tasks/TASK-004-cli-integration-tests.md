---
type: task
feature: envlint
id: TASK-004
title: "Add end-to-end CLI tests over fixtures in test/cli.test.mjs"
lens: standard
package: test
status: done
priority: 3
depends_on: [TASK-003]
unlocks: []
use_case_refs: [UC-LintEnvFile]
entities: [EnvFile, Schema]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile#Test Surface]]"]
estimated_hours: 2
tags: [cli, integration-test]
completed_at: 2026-11-07
---

# TASK-004: Add end-to-end CLI tests over fixtures in test/cli.test.mjs

## Context
Drive the real binary against throwaway fixtures that each test writes to a temp dir. This covers every
row of [[usecases/UC-LintEnvFile#Test Surface]], above all the edge cases the pitch insists on.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `test/cli.test.mjs` spawns `node bin/envlint.mjs` with fixture files written under `os.tmpdir()`; `npm test` exits 0
- [x] a missing env file → exit 2, stderr names the path, no stack trace (covers: REQ-4)
- [x] a missing schema file, a non-JSON schema and a schema with an unknown `type` → exit 2, stderr names the schema path, no stack trace (covers: REQ-5)
- [x] an env file of only comments and blank lines → exit 0 with no required keys; exit 1 with exactly the required-missing line when one key is required (covers: REQ-6)
- [x] malformed env input (a line with no `=`, an unterminated quote, binary garbage) never yields a stack trace or an exit code outside {0,1,2} (covers: REQ-7)
- [x] run from a temp cwd containing its own `.env`, the output reflects only the given files and no file in the cwd is created or modified (covers: REQ-9) (covers: REQ-23)

### 🧪 BDD Scenarios
**Scenario: CI fails on a bad env file**
Given `PORT=abc` and `BROKEN` in the env file and a schema requiring `HOST` and typing `PORT` as int
When  the binary runs
Then  it exits 1 and prints the three lines specified in TS-ERR-FINDINGS (covers: REQ-2) (covers: REQ-3)

## Non-Go (not in this task)
- Changing `src/` or `bin/`. A failing test here is a bug filed against the CLI scope.


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `test/cli.test.mjs` spawns `node bin/envlint.mjs` with fixture files written under `os.tmpdir()`; `npm test` exits 0: pass (T0 fixture node --test test/cli.test.mjs green (2/2))
- a missing env file → exit 2, stderr names the path, no stack trace (covers: REQ-4): pass (cli.test 'missing env file')
- a missing schema file, a non-JSON schema and a schema with an unknown `type` → exit 2, stderr names the schema path, no stack trace (covers: REQ-5): pass (cli.test 'bad schemas name the schema path')
- an env file of only comments and blank lines → exit 0 with no required keys; exit 1 with exactly the required-missing line when one key is required (covers: REQ-6): pass (cli.test 'no assignments')
- malformed env input (a line with no `=`, an unterminated quote, binary garbage) never yields a stack trace or an exit code outside {0,1,2} (covers: REQ-7): pass (cli.test 'malformed input never crashes')
- run from a temp cwd containing its own `.env`, the output reflects only the given files and no file in the cwd is created or modified (covers: REQ-9) (covers: REQ-23): pass (cli.test 'only given files are read; cwd untouched')
