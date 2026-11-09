---
type: task
feature: envlint
id: TASK-004
title: "Add the boundary regression suite (no writes, no network, no color, module independence)"
package: "."
status: ready
priority: 3
depends_on: [TASK-001, TASK-002, TASK-003]
unlocks: []
use_case_refs: [UC-LintEnvFile]
scope_id: ""
entities: []
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile#Invariants]]", "[[_index#Non-Go (pitch Boundaries)]]"]
files: [test/boundaries.test.mjs]
estimated_hours: 1.5
tags: [integration, regression]
---

# TASK-004: Boundary regression suite

## Context
The pitch's Boundaries have no actor of their own; they are the invariants INV-02..05 of [[usecases/UC-LintEnvFile]] and the module-independence invariant in [[domain-model]]. This is the integration-test task that follows the implementation tasks.

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `test/boundaries.test.mjs` exists and `node --test test/boundaries.test.mjs` exits 0
- [ ] TS-INV-02: after a findings run the tmp dir's files hash identically and no file was added (covers: REQ-25)
- [ ] TS-INV-03: a `.env` in the cwd with no env-path argument is never read; `process.env` is never populated from the file (covers: REQ-27, REQ-9)
- [ ] TS-INV-04: stdout/stderr contain no `\x1b[` with `FORCE_COLOR=1`, and the run never waits on stdin (covers: REQ-28)
- [ ] TS-INV-05: a run with a preload (`node --import`) that makes `net` connect and `dns.lookup` throw still exits 0 on a url-typed key (covers: REQ-29, REQ-30)
- [ ] `src/parse.mjs` and `src/rules.mjs` import neither each other nor any module; `bin/envlint.mjs` is the only file importing both (covers: REQ-22, REQ-24)

## Non-Go (not in this task)
- Changing any module's behaviour; this task only adds tests.
