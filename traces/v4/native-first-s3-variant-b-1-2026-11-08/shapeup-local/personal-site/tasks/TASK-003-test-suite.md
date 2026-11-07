---
type: task
feature: personal-site
id: TASK-003
title: "Write the node --test suite over the UC-BuildPage Test Surface"
lens: lite
package: root
status: done
priority: 3
depends_on: [TASK-001, TASK-002]
unlocks: []
use_case_refs: [UC-BuildPage]
entities: [SiteContent]
repositories: []
linked_docs: ["[[usecases/UC-BuildPage#Test Surface]]"]
estimated_hours: 3
tags: [test]
completed_at: 2026-11-07
---

# TASK-003: Write the node --test suite over the UC-BuildPage Test Surface

## Context
The pitch's verification: `node --test` drives `node build.mjs` over temporary content files and
asserts on the HTML text. One test per row of [[usecases/UC-BuildPage#Test Surface]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `test/build.test.mjs` exists and `node --test test/build.test.mjs` exits 0 reporting more than 0 tests (covers: REQ-21)
- [x] every test spawns `node build.mjs` with `CONTENT_FILE`/`OUT_DIR` set to a fresh `fs.mkdtempSync` directory and never touches the project's own `content.json` or `dist/` (covers: REQ-14)
- [x] the suite has one named test per Test Surface row: TS-INV-01 … TS-INV-07, TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_UNPARSEABLE, TS-REQ-name-missing, TS-REQ-name-type, TS-NOGO-01, TS-NOGO-02 (covers: REQ-21)
- [x] the error-path tests assert exit code 1, exactly one non-empty stderr line, and no `index.html` (covers: REQ-18)
- [x] the determinism test compares two runs byte for byte (covers: REQ-20)

## Implementation Notes
- No helper `.mjs` files under `test/` — `node --test` runs every `.mjs` there; build fixtures inline.
- Use `child_process.spawnSync(process.execPath, [buildPath], { env, cwd })`.

## Non-Go (not in this task)
- Browser tests; snapshot golden files.


## Execution Log — 2026-11-07 (personal-site/site-build-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `test/build.test.mjs` exists and `node --test test/build.test.mjs` exits 0 reporting more than 0 tests (covers: REQ-21): pass (node --test test/build.test.mjs -> tests 13, pass 13, fail 0, exit 0; harness verify t0 r1 a1 -> overall green 1/1)
- every test spawns `node build.mjs` with `CONTENT_FILE`/`OUT_DIR` set to a fresh `fs.mkdtempSync` directory and never touches the project's own `content.json` or `dist/` (covers: REQ-14): pass (build() helper spawns process.execPath build.mjs with CONTENT_FILE/OUT_DIR under fs.mkdtempSync(os.tmpdir()) and cwd = that temp dir; the project has no content.json/dist and none was created)
- the suite has one named test per Test Surface row: TS-INV-01 … TS-INV-07, TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_UNPARSEABLE, TS-REQ-name-missing, TS-REQ-name-type, TS-NOGO-01, TS-NOGO-02 (covers: REQ-21): pass (13 named tests: TS-INV-01..07, TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_UNPARSEABLE, TS-REQ-name-missing, TS-REQ-name-type, TS-NOGO-01, TS-NOGO-02; node --test test/build.test.mjs -> 13/13 pass)
- the error-path tests assert exit code 1, exactly one non-empty stderr line, and no `index.html` (covers: REQ-18): pass (assertError(): status 1, exactly one non-empty stderr line, no index.html (and no OUT_DIR); node --test test/build.test.mjs -> 13/13 pass)
- the determinism test compares two runs byte for byte (covers: REQ-20): pass (TS-INV-03 compares readFileSync buffers of two runs with Buffer.compare === 0; node --test test/build.test.mjs -> 13/13 pass)
