---
type: task
feature: one-page-site
id: TASK-005
title: "Add a starter content.json"
package: .
status: done
priority: 5
depends_on: [TASK-001]
unlocks: []
use_case_refs: [UC-BuildSite]
entities: []
repositories: []
linked_docs: []
estimated_hours: 1
tags: []
completed_at: 2026-11-07
---

# TASK-005: Add a starter content.json

## Context
Ship a sample `content.json` at the repo root so `node build.mjs` works out of the box. Shape per [[contracts/content-file.contract]].

## Acceptance Criteria

### ✅ Baseline
- [x] `content.json` exists at the repo root and passes the validation in `build.mjs`
- [x] `content.json` has a name, tagline, about, one project with a url, one project without a url, and a contact email
- [x] `node --test` exits 0

## Non-Go (not in this task)
- Any change to `build.mjs`.


## Execution Log — 2026-11-07 (one-page-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `content.json` exists at the repo root and passes the validation in `build.mjs`: pass (test 'real content.json is valid' builds it with exit 0)
- `content.json` has a name, tagline, about, one project with a url, one project without a url, and a contact email: pass (content.json inspected)
- `node --test` exits 0: pass (T0 green)
