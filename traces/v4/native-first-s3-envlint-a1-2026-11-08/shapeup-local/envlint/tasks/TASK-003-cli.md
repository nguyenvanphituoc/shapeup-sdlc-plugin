---
type: task
feature: envlint
id: TASK-003
title: "Wire the envlint CLI and its process tests"
lens: standard
package: bin
status: done
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: []
use_case_refs: [UC-LintEnvFile]
entities: [EnvFile, Schema]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile]]", "[[ux-behavior]]", "[[contracts/envlint.contract]]"]
estimated_hours: 4
tags: [cli]
completed_at: 2026-11-07
---

# TASK-003: Wire the envlint CLI and its process tests

## Context
Implement `bin/envlint.mjs` per [[usecases/UC-LintEnvFile#Steps]] and the Terminal Output screen in
[[ux-behavior]]: it is the only module importing both `src/parse.mjs` and `src/rules.mjs`. Tests in
`test/cli.test.mjs` write throwaway fixtures to a temp dir and spawn `node bin/envlint.mjs`.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `bin/envlint.mjs` starts with `#!/usr/bin/env node` and `node --test` exits 0 (covers: REQ-26)
- [x] `envlint --schema s.json e.env` reads exactly those two fixture files (covers: REQ-1, REQ-8)
- [x] run in a temp dir holding its own `.env`, pointed at a fixture elsewhere, only the fixture's problems are reported and the dir listing is unchanged afterwards (covers: REQ-9, REQ-28, REQ-30)
- [x] env `PORT=abc\nJUNK` with schema `{"PORT":{"type":"int"},"DB":{"required":true}}` prints `<f>:1: PORT: expected int, got "abc"`, `<f>:2: expected KEY=value`, `<f>: DB: required key is missing` and exits 1 (covers: REQ-2, REQ-3)
- [x] a valid env file satisfying its schema exits 0 with empty stdout and stderr (covers: REQ-3)
- [x] no args, only `--schema s.json`, or only an env path → exit 2 with the usage line on stderr (covers: REQ-26)
- [x] a missing env file → exit 2, stderr names the path, no `    at ` stack frame (covers: REQ-4)
- [x] a missing schema, a schema `{not json`, and a schema `{"A":{"type":"float"}}` → exit 2, stderr names the schema, no stack frame (covers: REQ-5)
- [x] a binary-garbage env file with a valid schema exits 1 or 0 with no stack frame (covers: REQ-7)
- [x] stdout of a findings run contains no `\x1b[` and the process exits with stdin left open and unused (covers: REQ-31)

### 📭 Empty & Null States
- [x] an empty env file with a one-required-key schema exits 1 with the missing-key line; with a schema of no required keys it exits 0 (covers: REQ-6)

### 🔗 Integration Flow
**shell → CLI → parse → check**
Given fixture files written by the test
When  `node bin/envlint.mjs --schema <schema> <env>` is spawned
Then  stdout carries one line per problem and finding, in the order the spec fixes
And   the exit code is 0, 1 or 2 per [[ux-behavior#States]]

## Non-Go (not in this task)
- Colors, a `--fix` mode, implicit `.env` lookup, `${VAR}` interpolation, any network call.


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `bin/envlint.mjs` starts with `#!/usr/bin/env node` and `node --test` exits 0 (covers: REQ-26): pass (shebang test + verify t0 green (1/1 fixture, node --test test/cli.test.mjs))
- `envlint --schema s.json e.env` reads exactly those two fixture files (covers: REQ-1, REQ-8): pass (test 'reads exactly the two named files'; CLI reads only the two argv paths)
- run in a temp dir holding its own `.env`, pointed at a fixture elsewhere, only the fixture's problems are reported and the dir listing is unchanged afterwards (covers: REQ-9, REQ-28, REQ-30): pass (test 'ignores a .env in the cwd and leaves the dir unchanged')
- env `PORT=abc\nJUNK` with schema `{"PORT":{"type":"int"},"DB":{"required":true}}` prints `<f>:1: PORT: expected int, got "abc"`, `<f>:2: expected KEY=value`, `<f>: DB: required key is missing` and exits 1 (covers: REQ-2, REQ-3): pass (test 'findings in spec order')
- a valid env file satisfying its schema exits 0 with empty stdout and stderr (covers: REQ-3): pass (test 'clean file is silent')
- no args, only `--schema s.json`, or only an env path → exit 2 with the usage line on stderr (covers: REQ-26): pass (test 'usage errors')
- a missing env file → exit 2, stderr names the path, no `    at ` stack frame (covers: REQ-4): pass (test 'missing env file')
- a missing schema, a schema `{not json`, and a schema `{"A":{"type":"float"}}` → exit 2, stderr names the schema, no stack frame (covers: REQ-5): pass (test 'unreadable schemas')
- a binary-garbage env file with a valid schema exits 1 or 0 with no stack frame (covers: REQ-7): pass (test 'binary garbage env file does not crash')
- stdout of a findings run contains no `\x1b[` and the process exits with stdin left open and unused (covers: REQ-31): pass (test 'no ANSI and does not wait on open stdin' (piped stdin never closed))
- an empty env file with a one-required-key schema exits 1 with the missing-key line; with a schema of no required keys it exits 0 (covers: REQ-6): pass (test 'empty env file')
