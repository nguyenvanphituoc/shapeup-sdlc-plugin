---
type: task
feature: one-page-site
id: TASK-003
title: "Add a node --test suite that drives build.mjs against throwaway content files"
package: root
status: done
priority: 3
depends_on: [TASK-001, TASK-002]
unlocks: []
use_case_refs: ["[[usecases/UC-BuildSite]]", "[[usecases/UC-RejectInvalidContent]]"]
entities: []
repositories: []
linked_docs: []
estimated_hours: 1
tags: [test]
completed_at: 2026-11-07
---

# TASK-003: node --test suite

## Context
One integration test file covering every Test Surface row of [[usecases/UC-BuildSite#Test Surface]] and
[[usecases/UC-RejectInvalidContent#Test Surface]], spawning `node build.mjs` with `CONTENT_FILE`/`OUT_DIR`
pointing at temp dirs.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `test/build.test.mjs` exists, uses only `node:test`, `node:assert`, `node:child_process`, `node:fs`, `node:os`, `node:path` (covers: REQ-21)
- [x] `node --test` exits 0 from the project root (covers: REQ-21)
- [x] The suite has one test per Test Surface row of both use cases, each named by its row id (covers: REQ-21)
- [x] Tests never read or write the real `content.json` or `dist/` (covers: REQ-21)

## Non-Go (not in this task)
- Browser tests.


## Execution Log — 2026-11-07 (one-page-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `test/build.test.mjs` exists, uses only `node:test`, `node:assert`, `node:child_process`, `node:fs`, `node:os`, `node:path` (covers: REQ-21): pass (file imports inspected)
- `node --test` exits 0 from the project root (covers: REQ-21): pass (T0 verify green r1-a1-t1)
- The suite has one test per Test Surface row of both use cases, each named by its row id (covers: REQ-21): pass (13 BuildSite rows + 6 Reject rows named by id (reject INV rows suffixed 'reject'))
- Tests never read or write the real `content.json` or `dist/` (covers: REQ-21): pass (all builds use temp CONTENT_FILE/OUT_DIR)
