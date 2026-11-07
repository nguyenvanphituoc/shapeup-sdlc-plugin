---
type: task
feature: one-page-site
id: TASK-002
title: "Add a node --test suite that drives build.mjs over temporary content files"
package: .
status: done
priority: 2
depends_on: [TASK-001]
unlocks: []
use_case_refs: ["[[usecases/UC-BuildPage]]"]
entities: [SiteContent]
repositories: []
linked_docs: ["[[usecases/UC-BuildPage#Test Surface]]"]
estimated_hours: 2
tags: [test]
completed_at: 2026-11-07
---

# TASK-002: Add a node --test suite that drives build.mjs over temporary content files

## Context
The integration-test task for [[usecases/UC-BuildPage]]: one test per Test Surface row, each spawning
`node build.mjs` with `CONTENT_FILE`/`OUT_DIR` pointed at a temp dir, asserting on exit code, stderr and
the generated HTML text. No browser.
Reference: [[usecases/UC-BuildPage#Test Surface]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `build.test.mjs` exists at the repo root, uses only `node:test`, `node:assert`, `node:child_process`, `node:fs`, `node:os`, `node:path` (covers: REQ-24)
- [x] `npm test` (`node --test`) exits 0 (covers: REQ-24)
- [x] The suite never reads or writes the real `content.json` or `dist/` — every case uses a temp dir via `CONTENT_FILE`/`OUT_DIR` (covers: REQ-14, REQ-15)

### 🔗 Integration Flow

**test → build.mjs → file system**
Given a temp content file
When  the test spawns `node build.mjs` with `CONTENT_FILE` and `OUT_DIR` set
Then  it asserts on the exit code, stderr and the written `index.html`

- [x] Has a passing case per Test Surface row TS-INV-01 … TS-INV-08 (covers: REQ-13, REQ-23, REQ-21, REQ-18, REQ-3, REQ-6, REQ-11, REQ-16, REQ-17)
- [x] Has a passing case per TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_UNPARSEABLE and TS-REQ-name-missing (covers: REQ-19, REQ-20, REQ-22)
- [x] Has a passing case per TS-NOGO-01 … TS-NOGO-03 (covers: REQ-1)

## Non-Go (not in this task)
- Any change to `build.mjs` behavior.


## Execution Log — 2026-11-07 (one-page-site/build-page-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `build.test.mjs` exists at the repo root, uses only `node:test`, `node:assert`, `node:child_process`, `node:fs`, `node:os`, `node:path` (covers: REQ-24): pass (imports limited to those six modules)
- `npm test` (`node --test`) exits 0 (covers: REQ-24): pass (T0 verify t0 round 1 attempt 1: green, fixtures 1/1)
- The suite never reads or writes the real `content.json` or `dist/` — every case uses a temp dir via `CONTENT_FILE`/`OUT_DIR` (covers: REQ-14, REQ-15): pass (build() helper always sets CONTENT_FILE/OUT_DIR under mkdtemp dir)
- Has a passing case per Test Surface row TS-INV-01 … TS-INV-08 (covers: REQ-13, REQ-23, REQ-21, REQ-18, REQ-3, REQ-6, REQ-11, REQ-16, REQ-17): pass (eight TS-INV-0N tests, suite green)
- Has a passing case per TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_UNPARSEABLE and TS-REQ-name-missing (covers: REQ-19, REQ-20, REQ-22): pass (three tests present, suite green)
- Has a passing case per TS-NOGO-01 … TS-NOGO-03 (covers: REQ-1): pass (three TS-NOGO tests present, suite green)
