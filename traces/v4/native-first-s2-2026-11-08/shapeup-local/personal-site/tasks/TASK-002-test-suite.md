---
type: task
feature: personal-site
id: TASK-002
title: "Add the node --test suite that drives build.mjs over temporary content files"
lens: lite
package: build.test.mjs
status: done
priority: 2
depends_on: [TASK-001]
unlocks: []
use_case_refs: [UC-BuildSite]
entities: [SiteContent, Project]
repositories: []
linked_docs: ["[[usecases/UC-BuildSite#Test Surface]]"]
estimated_hours: 2
tags: [test, integration]
completed_at: 2026-11-07
---

# TASK-002: Add the node --test suite

## Context
The integration-test task for [[usecases/UC-BuildSite]]: one test file, discovered by `node --test`,
that spawns `node build.mjs` with `CONTENT_FILE` / `OUT_DIR` pointed at temporary files and asserts on the
generated HTML text. One test per row of [[usecases/UC-BuildSite#Test Surface]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `build.test.mjs` exists at the repo root, uses only `node:` builtins, and `npm test` (`node --test`) exits 0 (covers: REQ-21)
- [x] Every test sets `CONTENT_FILE` and `OUT_DIR` to temporary paths; the repo's `content.json` and `dist/` are never read or written by the suite (covers: REQ-14, REQ-21)
- [x] The suite has one named test per Test Surface row (TS-INV-01..08, TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_INVALID_JSON, TS-REQ-name-missing, TS-NOGO-01..03) (covers: REQ-21)
- [x] The suite asserts escaping of `<b>Rock & Roll</b>` (covers: REQ-17)
- [x] The suite asserts the no-url and no-projects edge behaviour (covers: REQ-15, REQ-16)
- [x] The suite asserts exit 1, exactly one stderr line and no `index.html` for missing, unparseable and name-less content (covers: REQ-18, REQ-19)
- [x] The suite asserts byte-identical output across two builds (covers: REQ-20)

### 🔗 Integration Flow

**Test → CLI process → file system**
Given a temporary content file written by the test
When  the test spawns `node build.mjs` with `CONTENT_FILE` and `OUT_DIR` set
Then  `<OUT_DIR>/index.html` is written (or not, on the error paths)
And   the test reads it back and asserts on its text, the exit code and stderr

## Non-Go (not in this task)
- Browser-based checks; the assertions are on HTML text only.
- Changing `build.mjs` behaviour (TASK-001 owns it).


## Execution Log — 2026-11-07 (personal-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `build.test.mjs` exists at the repo root, uses only `node:` builtins, and `npm test` (`node --test`) exits 0 (covers: REQ-21): pass (npm test exit 0; verify t0 r1 a1 green 1/1 fixtures)
- Every test sets `CONTENT_FILE` and `OUT_DIR` to temporary paths; the repo's `content.json` and `dist/` are never read or written by the suite (covers: REQ-14, REQ-21): pass (run() always sets both env vars from mkdtemp paths)
- The suite has one named test per Test Surface row (TS-INV-01..08, TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_INVALID_JSON, TS-REQ-name-missing, TS-NOGO-01..03) (covers: REQ-21): pass (14 tests named by row id)
- The suite asserts escaping of `<b>Rock & Roll</b>` (covers: REQ-17): pass (TS-INV-05)
- The suite asserts the no-url and no-projects edge behaviour (covers: REQ-15, REQ-16): pass (TS-INV-06, TS-INV-07)
- The suite asserts exit 1, exactly one stderr line and no `index.html` for missing, unparseable and name-less content (covers: REQ-18, REQ-19): pass (TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_INVALID_JSON, TS-REQ-name-missing)
- The suite asserts byte-identical output across two builds (covers: REQ-20): pass (TS-INV-03)
