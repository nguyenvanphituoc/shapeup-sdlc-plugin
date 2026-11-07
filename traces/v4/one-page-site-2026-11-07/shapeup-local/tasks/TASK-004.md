---
type: task
feature: one-page-site
id: TASK-004
title: "Write dist/index.html deterministically with env overrides"
package: .
status: done
priority: 4
depends_on: [TASK-001, TASK-002, TASK-003]
unlocks: [TASK-006]
use_case_refs: [UC-BuildSite]
entities: []
repositories: []
linked_docs: []
estimated_hours: 1
tags: []
completed_at: 2026-11-07
---

# TASK-004: Write dist/index.html deterministically with env overrides

## Context
Wire `build.mjs` end to end per [[usecases/UC-BuildSite#Steps]] steps 1, 7 and 8: resolve paths, write once after full validation and render.

## Acceptance Criteria

### ✅ Baseline
- [x] `node build.mjs` with defaults reads `content.json` and writes a single `dist/index.html` (covers: REQ-1, REQ-24)
- [x] `CONTENT_FILE` overrides the input path and `OUT_DIR` the output dir, writing `<OUT_DIR>/index.html`; the default `dist/` is untouched in that case (covers: REQ-25)
- [x] Running the build twice against the same content produces byte-identical files; the source uses no `Date` and no `Math.random` (covers: REQ-19)
- [x] `build.mjs` contains no write to the content file path (covers: REQ-23)
- [x] `build.mjs` imports only `node:` builtins and makes no network call (covers: REQ-20, REQ-21)
- [x] `node --test` exits 0

## Non-Go (not in this task)
- Watch or serve mode; extra output files.


## Execution Log — 2026-11-07 (one-page-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node build.mjs` with defaults reads `content.json` and writes a single `dist/index.html` (covers: REQ-1, REQ-24): pass (defaults in build.mjs: content.json / dist; real content.json builds OK in test (via env override, to keep dist untouched))
- `CONTENT_FILE` overrides the input path and `OUT_DIR` the output dir, writing `<OUT_DIR>/index.html`; the default `dist/` is untouched in that case (covers: REQ-25): pass (test 'env overrides' - OUT_DIR holds only index.html; tests run with cwd in a temp dir)
- Running the build twice against the same content produces byte-identical files; the source uses no `Date` and no `Math.random` (covers: REQ-19): pass (tests 'determinism' and source check)
- `build.mjs` contains no write to the content file path (covers: REQ-23): pass (only writeFileSync targets join(outDir,'index.html'); content.json hash test passes)
- `build.mjs` imports only `node:` builtins and makes no network call (covers: REQ-20, REQ-21): pass (source check test)
- `node --test` exits 0: pass (T0 green)
