---
type: task
feature: one-page-site
id: TASK-001
title: "Load and validate the content file in build.mjs"
package: .
status: done
priority: 1
depends_on: []
unlocks: [TASK-002, TASK-004, TASK-005]
use_case_refs: [UC-RejectInvalidContent]
entities: []
repositories: []
linked_docs: []
estimated_hours: 1
tags: []
completed_at: 2026-11-07
---

# TASK-001: Load and validate the content file in build.mjs

## Context
Implement the load/validate step of `build.mjs` per [[usecases/UC-RejectInvalidContent#Steps]] and [[contracts/content-file.contract]]. Validation completes before any filesystem write.

## Acceptance Criteria

### ✅ Baseline
- [x] `build.mjs` exists at the repo root, is ESM, and imports only `node:` builtins
- [x] `node build.mjs` with `CONTENT_FILE` pointing at a nonexistent file exits 1, prints exactly one line on stderr naming the problem, and creates no `index.html` in a fresh `OUT_DIR` (covers: REQ-15, REQ-16, REQ-17)
- [x] Content file `{not json` and valid-JSON-wrong-shape inputs (`null`, `[]`, `{"name":"x","projects":"y"}`) each exit 1 with one stderr line built from a fixed prefix, not raw `err.message` (covers: REQ-15, REQ-16, REQ-17)
- [x] Valid JSON with `name` missing, empty or non-string exits 1 with one stderr line naming `name` and writes nothing (covers: REQ-18)
- [x] A valid content file with `name`, `tagline`, `about`, `projects[{title,summary,url}]`, `contact{email}` is accepted; absent `projects` is treated as empty (covers: REQ-4)
- [x] `node --test` exits 0

## Non-Go (not in this task)
- Rendering and writing the page (later tasks).


## Execution Log — 2026-11-07 (one-page-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `build.mjs` exists at the repo root, is ESM, and imports only `node:` builtins: pass (build.mjs imports node:fs, node:path; test 'source has no ... non-node imports' passes)
- `node build.mjs` with `CONTENT_FILE` pointing at a nonexistent file exits 1, prints exactly one line on stderr naming the problem, and creates no `index.html` in a fresh `OUT_DIR` (covers: REQ-15, REQ-16, REQ-17): pass (build.test.mjs failure CONTENT_MISSING; node --test green via T0)
- Content file `{not json` and valid-JSON-wrong-shape inputs (`null`, `[]`, `{"name":"x","projects":"y"}`) each exit 1 with one stderr line built from a fixed prefix, not raw `err.message` (covers: REQ-15, REQ-16, REQ-17): pass (failure tests for CONTENT_INVALID_JSON and CONTENT_BAD_SHAPE pass)
- Valid JSON with `name` missing, empty or non-string exits 1 with one stderr line naming `name` and writes nothing (covers: REQ-18): pass (NAME_MISSING tests pass)
- A valid content file with `name`, `tagline`, `about`, `projects[{title,summary,url}]`, `contact{email}` is accepted; absent `projects` is treated as empty (covers: REQ-4): pass (layout test and absent-projects test pass)
- `node --test` exits 0: pass (T0 verdict green 1/1 fixtures: .shapeup/one-page-site/t0/verdicts/r1-a1-t1.json)
