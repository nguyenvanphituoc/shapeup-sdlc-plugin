---
type: task
feature: one-page-site
id: TASK-002
title: "Reject missing or invalid content with exit 1, one stderr line, nothing written"
package: root
status: done
priority: 2
depends_on: [TASK-001]
unlocks: [TASK-003]
use_case_refs: ["[[usecases/UC-RejectInvalidContent]]"]
entities: [SiteContent]
repositories: [ContentSource]
linked_docs: ["[[contracts/content-file.contract]]"]
estimated_hours: 1
tags: [feat, cli, validation]
completed_at: 2026-11-07
---

# TASK-002: Reject missing or invalid content

## Context
Implement [[usecases/UC-RejectInvalidContent#Steps]] in `build.mjs`: validate before any write, fail with the
errors of [[contracts/content-file.contract#Errors]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] A missing content file → exit 1, exactly one stderr line naming the path, no `index.html` and no output dir created (covers: REQ-15)
- [x] An unparsable file (`{not json`) or a non-object root (`null`, `[]`) → exit 1, one stderr line, nothing written (covers: REQ-15, REQ-3)
- [x] Missing, non-string or blank `name` → exit 1, one stderr line mentioning `name`, nothing written (covers: REQ-16, REQ-3)
- [x] stderr never contains a stack trace (no line starting with `    at `) (covers: REQ-15)

### 🧪 BDD Scenarios

**Scenario: missing name**
Given a content file `{"tagline":"x"}` and a fresh `OUT_DIR`
When  `node build.mjs` runs
Then  it exits 1, prints one line, and `OUT_DIR/index.html` does not exist (covers: REQ-16)

## Non-Go (not in this task)
- Validating optional fields beyond their type-safe rendering.


## Execution Log — 2026-11-07 (one-page-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- A missing content file → exit 1, exactly one stderr line naming the path, no `index.html` and no output dir created (covers: REQ-15): pass (TS-ERR-E_CONTENT_MISSING, TS-INV-01 reject)
- An unparsable file (`{not json`) or a non-object root (`null`, `[]`) → exit 1, one stderr line, nothing written (covers: REQ-15, REQ-3): pass (TS-ERR-E_CONTENT_INVALID)
- Missing, non-string or blank `name` → exit 1, one stderr line mentioning `name`, nothing written (covers: REQ-16, REQ-3): pass (TS-ERR-E_NAME_MISSING, TS-REQ-name-missing)
- stderr never contains a stack trace (no line starting with `    at `) (covers: REQ-15): pass (TS-INV-02 reject)
