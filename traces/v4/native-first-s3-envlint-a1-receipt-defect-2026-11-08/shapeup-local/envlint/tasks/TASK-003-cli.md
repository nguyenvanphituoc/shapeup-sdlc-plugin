---
type: task
feature: envlint
id: TASK-003
title: "Compose the envlint CLI in bin/envlint.mjs"
lens: standard
package: bin
status: done
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-LintEnvFile]
entities: [EnvPair, ParseProblem, Schema, Finding]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile]]", "[[ux-behavior]]"]
estimated_hours: 4
tags: [cli]
completed_at: 2026-11-07
---

# TASK-003: Compose the envlint CLI in bin/envlint.mjs

## Context
Implements [[usecases/UC-LintEnvFile]]: argv handling, reading the two files, printing per
[[ux-behavior]], exit codes. Composes `parse` (src/parse.mjs) and `check` (src/rules.mjs).

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `node bin/envlint.mjs --schema <schema.json> <envfile>` reads both files given as arguments; `node --test test/cli.test.mjs` exits 0 (covers: REQ-7, REQ-20)
- [x] a run with no env file argument exits 2 with a usage line, even when the cwd holds a `.env` (covers: REQ-8)
- [x] `PORT=abc` with schema `{"PORT":{"type":"int"}}` prints a stdout line naming `PORT` and line 1, and exits 1 (covers: REQ-1, REQ-2)
- [x] a valid env file matching its schema prints nothing and exits 0 (covers: REQ-20)
- [x] a missing env file exits 2 with stderr naming the file and no stack trace (covers: REQ-3, REQ-6)
- [x] a missing schema file, and a schema file holding `{not json`, each exit 2 with stderr naming the schema file and no stack trace (covers: REQ-4, REQ-6)
- [x] an env file with no assignments (only comments/blank lines) and a schema with a required key exits 1 with one missing-key line, no crash (covers: REQ-5)

### 🔁 Inverse Conditions
- [x] stdout and stderr contain no `\x1b[` escape sequence; the process never waits on stdin (covers: REQ-24)
- [x] after any run the env file's bytes and the fixture directory listing are unchanged (covers: REQ-22)
- [x] `A=${HOME}` with schema `{"A":{"enum":["x"]}}` reports the literal `${HOME}` (covers: REQ-23)
- [x] `bin/envlint.mjs` makes no network access — `grep -E "fetch|node:http|node:https|node:net" bin/envlint.mjs` finds nothing (covers: REQ-25)

### 🧪 BDD Scenarios

**Scenario: CI fails on a typo**
Given an env file `PORT=80a` and schema `{"PORT":{"type":"int","required":true}}`
When  `node bin/envlint.mjs --schema schema.json app.env` runs
Then  stdout names `PORT` at line 1 and the exit code is 1

**Scenario: unreadable schema**
Given a schema file holding `{not json`
When  the CLI runs against it
Then  it exits 2 with one stderr line naming the schema file

## Non-Go (not in this task)
- Changing parse or rules semantics — that is [[usecases/UC-ParseEnvText]] / [[usecases/UC-CheckEnvAgainstSchema]].


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node bin/envlint.mjs --schema <schema.json> <envfile>` reads both files given as arguments; `node --test test/cli.test.mjs` exits 0 (covers: REQ-7, REQ-20): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- a run with no env file argument exits 2 with a usage line, even when the cwd holds a `.env` (covers: REQ-8): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- `PORT=abc` with schema `{"PORT":{"type":"int"}}` prints a stdout line naming `PORT` and line 1, and exits 1 (covers: REQ-1, REQ-2): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- a valid env file matching its schema prints nothing and exits 0 (covers: REQ-20): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- a missing env file exits 2 with stderr naming the file and no stack trace (covers: REQ-3, REQ-6): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- a missing schema file, and a schema file holding `{not json`, each exit 2 with stderr naming the schema file and no stack trace (covers: REQ-4, REQ-6): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- an env file with no assignments (only comments/blank lines) and a schema with a required key exits 1 with one missing-key line, no crash (covers: REQ-5): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- stdout and stderr contain no `\x1b[` escape sequence; the process never waits on stdin (covers: REQ-24): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- after any run the env file's bytes and the fixture directory listing are unchanged (covers: REQ-22): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- `A=${HOME}` with schema `{"A":{"enum":["x"]}}` reports the literal `${HOME}` (covers: REQ-23): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- `bin/envlint.mjs` makes no network access — `grep -E "fetch|node:http|node:https|node:net" bin/envlint.mjs` finds nothing (covers: REQ-25): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
