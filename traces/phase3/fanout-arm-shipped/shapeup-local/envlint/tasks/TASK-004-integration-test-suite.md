---
type: task
feature: envlint
id: TASK-004
title: "Integration test suite covering the full Test Surface"
lens: standard
package: test
status: done
priority: 3
depends_on: [TASK-001, TASK-002, TASK-003]
unlocks: []
use_case_refs: [UC-01]
entities: []
repositories: []
linked_docs: ["[[usecases/UC-01#Test-Surface]]"]
estimated_hours: 3
tags: [test, integration]
completed_at: 2026-08-17
---

# TASK-004: Integration test suite covering the full Test Surface

## Context
One `node --test test/` run must exercise every row of
[[usecases/UC-01#Test-Surface]] by driving the built `bin/envlint.mjs` binary
against throwaway fixtures it writes itself (per idea.md: "a linter that cannot be pointed at a
fixture cannot be verified"), satisfying EXPECTED.md's Verification section.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `npm test` (== `node --test test/`) exits 0
- [x] Every `TS-*` row in [[usecases/UC-01#Test-Surface]] has a corresponding test
      that drives the built binary (via `child_process.spawnSync` or equivalent) or the module
      directly, per EXPECTED.md's Verification line
- [x] Fixtures (env files, schema files) are written to a temp directory per test run and never
      committed as golden files that could go stale silently
- [x] `TS-NOGO-02` (no `.env` writing) is verified by comparing fixture file contents/mtime
      before and after the run, not just by code inspection

## Implementation Notes
Group tests by the four TS prefixes (`TS-INV-*`, `TS-ERR-*`, `TS-REQ-*`/`TS-TYPE-*`,
`TS-NOGO-*`) for traceability back to the UC's D1–D4 sources.

## Non-Go (not in this task)
- No new engine or CLI behavior — this task only adds coverage for TASK-001/002/003's already
  -implemented behavior. A failing assertion here means one of those tasks is incomplete, not
  that this task should patch around it.


## Execution Log — 2026-08-17 (envlint/test-surface-suite-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `npm test` (== `node --test test/`) exits 0: pass (npm test -> 64 tests, 64 pass, 0 fail, exit 0)
- Every `TS-*` row in [[usecases/UC-01#Test-Surface]] has a corresponding test: pass (test/test-surface.test.mjs has one test per TS-INV-01..06, TS-ERR-E_NOFLAG/E_SCHEMA_UNREADABLE/E2/E1/E3/E4/E5, TS-REQ-schema-missing/envfile-missing, TS-TYPE-int/bool/url-scheme-gate/url-leniency/enum/empty-value, TS-NOGO-01..04 (26 tests), driving bin/envlint.mjs via spawnSync)
- Fixtures (env files, schema files) are written to a temp directory per test run and never: pass (fixture() helper writes into mkdtempSync(tmpdir(), 'envlint-ts-') per call; no fixture file is committed to the repo)
- `TS-NOGO-02` (no `.env` writing) is verified by comparing fixture file contents/mtime: pass (TS-NOGO-02 test reads content+mtimeMs via statSync/readFileSync before and after run(), asserts both unchanged)
