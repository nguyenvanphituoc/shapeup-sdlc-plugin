---
schema_version: 1
doc_type: task
feature: envlint
id: TASK-004
title: Integration test — end-to-end fixture-driven run
use_case_refs: [UC-01-parse-env-file, UC-02-validate-against-schema, UC-03-run-cli-lint]
depends_on: [TASK-003]
unlocks: []
estimated_hours: 2
status: done
completed_at: 2026-08-17
---

# TASK-004 — Integration test: full binary against fixtures

Write `test/integration.test.mjs`: spawn/exec the built `bin/envlint.mjs` (not module-level
mocks) against a matrix of throwaway fixture `.env` + schema files covering every E1–E5 edge
case and the clean/findings human + `--json` paths together, per EXPECTED.md's Verification
section ("Every rule above is covered by a test that drives the built binary or the module
directly") and the pitch's fixture-pointing constraint.

## Acceptance Criteria
- [x] `npm test` (== `node --test test/`) passes and includes this file.
- [x] At least one fixture run covers each of E1, E2, E3, E4, E5.
- [x] At least one run asserts exit 0 (clean) and one asserts exit 1 (findings) via the real
      binary (child process or programmatic entry call), not by calling `lib/*` directly.
- [x] Fixtures are written to a temp directory per test (or `test/fixtures/`), never touch the
      developer's real `.env` (no implicit lookup — pitch constraint).
- [x] No network access occurs during the test run (no-go).

## 🔗 Integration Flow
Full chain: argv → fs → `lib/parse.mjs` → `lib/rules.mjs` → stdout/stderr → exit code, verified
against real files on disk for both human and `--json` render paths.

## Test Surface covered
Composition check across TS-UC03-01..12 exercised via the real binary rather than direct module
calls — the "drives the built binary" half of EXPECTED.md's Verification requirement.


## Execution Log — 2026-08-17 (envlint/cli-pipeline-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `npm test` (== `node --test test/`) passes and includes this file.: pass (test/integration.test.mjs is discovered and run by both `node --test` (no-arg auto-discovery, 45/45 pass across all four test files) and by the scope's e2e fixture command `node --test test/integration.test.mjs` (8/8 pass); note in deviations about a `node --test <dir>/` positional-arg environment quirk)
- At least one fixture run covers each of E1, E2, E3, E4, E5.: pass (test/integration.test.mjs has one test per E1..E5 by name)
- At least one run asserts exit 0 (clean) and one asserts exit 1 (findings) via the real: pass ('clean run: exit 0 via the real binary' and 'findings run: exit 1 via the real binary' tests, both spawn the built bin/envlint.mjs via child_process.spawnSync)
- Fixtures are written to a temp directory per test (or `test/fixtures/`), never touch the: pass (withTempDir() uses fs.mkdtempSync(os.tmpdir()) per test and rmSync cleanup in a finally block; no reference to a real .env anywhere)
- No network access occurs during the test run (no-go).: pass ('no network access occurs during a run' test — offline-safe url regex/protocol check only, no fetch/http/https client calls in bin/envlint.mjs or lib/*)
