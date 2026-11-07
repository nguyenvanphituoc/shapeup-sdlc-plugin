---
type: task
feature: envlint
id: TASK-004
title: "Harden the CLI edges with end-to-end fixture tests"
lens: lite
package: bin
status: done
priority: 3
depends_on: [TASK-003]
unlocks: []
use_case_refs: [UC-LintEnvFile]
scope_id: ""
entities: [EnvFile, Schema]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile#Error Cases]]", "[[usecases/UC-LintEnvFile#Invariants]]"]
estimated_hours: 2
tags: [cli, integration]
completed_at: 2026-11-07
---

# TASK-004: Harden the CLI edges with end-to-end fixture tests

## Context
The integration task: drive the built binary over the pitch's edge cases, per
[[usecases/UC-LintEnvFile#Error Cases]] and [[usecases/UC-LintEnvFile#Invariants]].
Reference: [[usecases/UC-LintEnvFile]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] a missing env file or missing schema exits 2 with `envlint: cannot read <path>`, no stack trace (TS-ERR-IO) (covers: REQ-4)
- [x] a schema that is a directory, not valid JSON, or fails `checkSchema` exits 2 with `envlint:` on stderr (TS-ERR-IO, TS-ERR-SCHEMA) (covers: REQ-5)
- [x] an empty or comments-only env file exits 0 with no required keys and exits 1 naming the key when one is required (TS-REQ-empty-file) (covers: REQ-6)
- [x] a binary-garbage env file and a `null` schema never produce a stack trace (TS-INV-02) (covers: REQ-7)
- [x] the fixture directory is unchanged after every run (TS-INV-01) (covers: REQ-23)
- [x] `node --test test/cli-edges.test.mjs` passes, and `npm test` runs more than 0 tests

## Non-Go (not in this task)
- New flags or output formats


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- a missing env file or missing schema exits 2 with `envlint: cannot read <path>`, no stack trace (TS-ERR-IO) (covers: REQ-4): pass (test 'TS-ERR-IO: missing env file or schema…' passes: exit 2, stderr ^envlint: cannot read nope.env / nope.json, no `at ` frames)
- a schema that is a directory, not valid JSON, or fails `checkSchema` exits 2 with `envlint:` on stderr (TS-ERR-IO, TS-ERR-SCHEMA) (covers: REQ-5): pass (test 'TS-ERR-IO / TS-ERR-SCHEMA' passes: dir schema → `envlint: cannot read schemadir`; `{not json` and {A:{type:float}} → exit 2 `envlint: invalid schema <path>`)
- an empty or comments-only env file exits 0 with no required keys and exits 1 naming the key when one is required (TS-REQ-empty-file) (covers: REQ-6): pass (test 'TS-REQ-empty-file' passes for empty.env and comments.env: exit 0 with optional schema, exit 1 with `<env>: A: …` when A required)
- a binary-garbage env file and a `null` schema never produce a stack trace (TS-INV-02) (covers: REQ-7): pass (test 'TS-INV-02' passes: garbage bytes env → exit 1/2 no stack frames; `null` schema → exit 2 `envlint: invalid schema null.json`)
- the fixture directory is unchanged after every run (TS-INV-01) (covers: REQ-23): pass (test 'TS-INV-01' passes: directory listing + base64 contents identical after clean (0), findings (1) and bad-schema (2) runs)
- `node --test test/cli-edges.test.mjs` passes, and `npm test` runs more than 0 tests: pass (node --test test/cli-edges.test.mjs → 5/5 pass; `node --test` from project root (the npm test script body) → 37 tests, 37 pass. `npm test` itself was not run: the permission layer required approval for it)
