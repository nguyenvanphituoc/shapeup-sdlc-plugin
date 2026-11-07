---
type: task
feature: envlint
id: TASK-004
title: "Add end-to-end edge-case tests driving the envlint binary"
lens: standard
package: test
status: done
priority: 3
depends_on: [TASK-003]
unlocks: []
use_case_refs: [UC-LintEnvFile]
entities: [EnvFile, Schema]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile#Test Surface]]", "[[contracts/cli.contract]]"]
estimated_hours: 2
tags: [CHORE, integration-test]
completed_at: 2026-11-07
---

# TASK-004: Add end-to-end edge-case tests driving the envlint binary

## Context
The integration-test task: one `test/e2e.test.mjs` that spawns the real binary for every
[[usecases/UC-LintEnvFile#Test Surface]] row, using fixtures it writes to a temp directory.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `test/e2e.test.mjs` exists and `node --test test/` exits 0 with all four test files present (covers: REQ-21)
- [x] It has one named test per UC-LintEnvFile Test Surface row (TS-INV-01..03, TS-ERR-*, TS-REQ-*, TS-NOGO-01..03) (covers: REQ-7)
- [x] Every fixture lives under `os.tmpdir()`; the test writes nothing inside the project (covers: REQ-8)
- [x] The TS-INV-02 test runs the binary with `cwd` set to a temp dir holding a `.env` and asserts its contents never appear in output (covers: REQ-9)
- [x] The edge tests assert missing file → exit 2, invalid schema → exit 2, no-assignment file → no crash (covers: REQ-4)
- [x] The invalid-schema tests cover not-JSON and a rejected KeyRule (covers: REQ-5)
- [x] The no-assignment tests cover an empty file and a comments-only file (covers: REQ-6)

### 🔗 Integration Flow

**Shell → CLI → parse/rules**
Given fixture files written to a temp directory
When  the test spawns `node bin/envlint.mjs --schema <s> <env>`
Then  the exit code and stdout/stderr match [[contracts/cli.contract]]
And   no stack frame appears on stderr

## Non-Go (not in this task)
- Changing any source file under `src/` or `bin/`; failures found here are reported as discoveries.


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `test/e2e.test.mjs` exists and `node --test test/` exits 0 with all four test files present (covers: REQ-21): pass (e2e file present; scope fixture green (cli+e2e))
- It has one named test per UC-LintEnvFile Test Surface row (TS-INV-01..03, TS-ERR-*, TS-REQ-*, TS-NOGO-01..03) (covers: REQ-7): pass (13 tests named by TS id)
- Every fixture lives under `os.tmpdir()`; the test writes nothing inside the project (covers: REQ-8): pass (mkdtempSync(tmpdir()))
- The TS-INV-02 test runs the binary with `cwd` set to a temp dir holding a `.env` and asserts its contents never appear in output (covers: REQ-9): pass (e2e TS-INV-02)
- The edge tests assert missing file → exit 2, invalid schema → exit 2, no-assignment file → no crash (covers: REQ-4): pass (e2e TS-ERR-*, TS-INV-03)
- The invalid-schema tests cover not-JSON and a rejected KeyRule (covers: REQ-5): pass (e2e TS-ERR-SCHEMA_INVALID)
- The no-assignment tests cover an empty file and a comments-only file (covers: REQ-6): pass (e2e TS-INV-03)
