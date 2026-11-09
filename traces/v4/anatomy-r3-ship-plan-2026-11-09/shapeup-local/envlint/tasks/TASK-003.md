---
type: task
feature: envlint
id: TASK-003
title: "Implement the envlint CLI composition root"
package: bin
status: ready
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-LintEnvFile]
entities: [ParseResult, Schema, Finding]
repositories: []
linked_docs: ["shapeup/envlint/spec/usecases/UC-LintEnvFile.md", "shapeup/envlint/spec/ux-behavior.md"]
estimated_hours: 3
tags: [cli]
---

# TASK-003: Implement the envlint CLI composition root

## Context
Build `bin/envlint.mjs` per [[usecases/UC-LintEnvFile#Steps]] and the output contract in [[ux-behavior]]. It imports `parse` and `check` and is the only module doing I/O.

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `node --check bin/envlint.mjs` exits 0 and the file imports `../src/parse.mjs` and `../src/rules.mjs`
- [ ] `node bin/envlint.mjs --schema <schema.json> <envfile>` reads exactly those two files (covers: REQ-8, REQ-21)
- [ ] run from a directory holding its own `.env`, only the passed env path is read (covers: REQ-9)
- [ ] findings print one per line as `<envfile>:<line>: <message>` or `<envfile>: <KEY>: <message>` (covers: REQ-2)
- [ ] exit 0 with no findings, exit 1 with ≥ 1 finding (covers: REQ-3)
- [ ] a missing env file exits 2 with `envlint: error:` naming the path, no stack trace (covers: REQ-4)
- [ ] a missing, non-JSON or non-object schema exits 2 with `envlint: error:` naming the path, no stack trace (covers: REQ-5)
- [ ] missing `--schema`, missing env path, or an unknown argument exits 2 with a usage message (covers: REQ-21)

### 📭 Empty & Null States
- [ ] an env file with no assignments and a schema with no required keys exits 0 without crashing (covers: REQ-6)

### 🧪 BDD Scenarios

**Scenario: CI fails on a bad env file**
Given an env file with a wrong-type value on line 5 and a schema typing that key `int`
When  `envlint --schema schema.json app.env` runs
Then  stdout has `app.env:5: …` and the exit code is 1 (covers: REQ-3)

## Non-Go (not in this task)
- No `bin` field in package.json, no colors, no writing files, no `process.env` population
