---
type: task
feature: envlint
id: TASK-004
title: "Add the end-to-end integration test driving the binary"
lens: standard
package: test
status: done
priority: 3
depends_on: [TASK-003]
unlocks: []
use_case_refs: [UC-LintEnvFile]
entities: [EnvPair, Finding]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile]]"]
estimated_hours: 2
tags: [integration]
completed_at: 2026-11-07
---

# TASK-004: Add the end-to-end integration test driving the binary

## Context
One integration test over [[usecases/UC-LintEnvFile]]'s Test Surface: spawn `bin/envlint.mjs` against
temp-dir fixtures the test writes, for every TS row.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `test/integration.test.mjs` spawns `node bin/envlint.mjs` against fixtures it writes to a temp dir; `npm test` exits 0 (covers: REQ-7)
- [x] it asserts exit 0 clean / 1 findings / 2 usage-or-I/O for each `TS-ERR-*` row of the use case (covers: REQ-2, REQ-3, REQ-4)
- [x] it asserts a fixture with every parse feature (comment, blank, `export`, both quote styles) and every rule (`required`, each `type`, `enum`) yields exactly the expected stdout lines (covers: REQ-1, REQ-9, REQ-16, REQ-17, REQ-18)

### 🔗 Integration Flow

**CLI → parse → rules**
Given a temp dir with `app.env` and `schema.json`
When  `node bin/envlint.mjs --schema schema.json app.env` runs
Then  parse problems and rule findings both reach stdout in line order
And   the exit code is 1

## Non-Go (not in this task)
- Unit tests of parse or rules alone (those live with TASK-001 / TASK-002).


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `test/integration.test.mjs` spawns `node bin/envlint.mjs` against fixtures it writes to a temp dir; `npm test` exits 0 (covers: REQ-7): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- it asserts exit 0 clean / 1 findings / 2 usage-or-I/O for each `TS-ERR-*` row of the use case (covers: REQ-2, REQ-3, REQ-4): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
- it asserts a fixture with every parse feature (comment, blank, `export`, both quote styles) and every rule (`required`, each `type`, `enum`) yields exactly the expected stdout lines (covers: REQ-1, REQ-9, REQ-16, REQ-17, REQ-18): pass (node --test test/cli.test.mjs test/integration.test.mjs -> all pass; T0 r1-a1-t3 green)
