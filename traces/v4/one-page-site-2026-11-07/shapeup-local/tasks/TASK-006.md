---
type: task
feature: one-page-site
id: TASK-006
title: "Write the node --test suite"
package: .
status: done
priority: 6
depends_on: [TASK-004]
unlocks: []
use_case_refs: [UC-BuildSite, UC-RejectInvalidContent]
entities: []
repositories: []
linked_docs: []
estimated_hours: 2
tags: []
completed_at: 2026-11-07
---

# TASK-006: Write the node --test suite

## Context
Add `build.test.mjs` driving `node build.mjs` via `spawnSync(process.execPath, ...)` with `mkdtempSync` content and output dirs, asserting on the generated HTML text. The real `content.json` is never touched. See [[usecases/UC-BuildSite#Test Surface]] and [[usecases/UC-RejectInvalidContent#Test Surface]].

## Acceptance Criteria

### ✅ Baseline
- [x] `node --test` exits 0 with a test file that spawns `node build.mjs` against throwaway content files and asserts on HTML text, no browser (covers: REQ-26)
- [x] Tests cover the Test Surface rows of both use cases: determinism, escaping, url-less project, zero projects, layout order, env overrides, and each failure code with one stderr line and a fresh `OUT_DIR` holding no `index.html`
- [x] Every test runs `node build.mjs` with `CONTENT_FILE` and `OUT_DIR` pointing at temp dirs, and one test asserts the real `content.json` hash is unchanged

## Non-Go (not in this task)
- Browser-based checks.


## Execution Log — 2026-11-07 (one-page-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node --test` exits 0 with a test file that spawns `node build.mjs` against throwaway content files and asserts on HTML text, no browser (covers: REQ-26): pass (build.test.mjs; T0 green)
- Tests cover the Test Surface rows of both use cases: determinism, escaping, url-less project, zero projects, layout order, env overrides, and each failure code with one stderr line and a fresh `OUT_DIR` holding no `index.html`: pass (build.test.mjs covers each listed row)
- Every test runs `node build.mjs` with `CONTENT_FILE` and `OUT_DIR` pointing at temp dirs, and one test asserts the real `content.json` hash is unchanged: pass (run() helper sets both env vars; hash test present)
