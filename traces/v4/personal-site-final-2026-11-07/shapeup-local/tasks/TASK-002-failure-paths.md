---
type: task
feature: personal-site
id: TASK-002
title: "Make build.mjs fail cleanly on missing, unparsable or name-less content"
lens: standard
package: "."
status: done
priority: 2
depends_on: [TASK-001]
unlocks: [TASK-003]
use_case_refs: [UC-BuildSite]
entities: [SiteContent]
repositories: [ContentSource]
linked_docs: ["[[usecases/UC-BuildSite#Error Cases]]", "[[contracts/build-cli.contract]]"]
estimated_hours: 1
tags: [cli, errors]
completed_at: 2026-11-07
---

# TASK-002: Make build.mjs fail cleanly on missing, unparsable or name-less content

## Context
Implements steps 2–4 and the error rule of [[usecases/UC-BuildSite#Steps]]; error codes in
[[usecases/UC-BuildSite#Error Cases]] and [[contracts/build-cli.contract]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `CONTENT_FILE=<nonexistent> node build.mjs` exits 1, stderr is exactly one line naming the problem (covers: REQ-15)
- [x] `CONTENT_FILE=<file containing {not json> node build.mjs` exits 1, stderr is exactly one line naming the problem (covers: REQ-15)
- [x] In both cases above, no `index.html` is written to `OUT_DIR` (covers: REQ-16)
- [x] Valid JSON without `name` exits 1 with exactly one stderr line, and writes no `index.html` (covers: REQ-17)

### 🧪 BDD Scenarios

**Scenario: broken content file**
Given `content.json` contains `{not json`
When  the owner runs `node build.mjs`
Then  exit code is 1, stderr is one line, and no `index.html` exists in the output dir

## Implementation Notes
- Validate fully before any `mkdir`/write. Collapse newlines in parser messages to keep stderr to one line.

## Non-Go (not in this task)
- URL scheme filtering, validation of optional fields (pitch is silent)


## Execution Log — 2026-11-07 (personal-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `CONTENT_FILE=<nonexistent> node build.mjs` exits 1, stderr is exactly one line naming the problem (covers: REQ-15): pass (TS-ERR-CONTENT_MISSING green)
- `CONTENT_FILE=<file containing {not json> node build.mjs` exits 1, stderr is exactly one line naming the problem (covers: REQ-15): pass (TS-ERR-CONTENT_INVALID_JSON green)
- In both cases above, no `index.html` is written to `OUT_DIR` (covers: REQ-16): pass (validation precedes mkdir/write; TS-INV-02 and error tests assert absence)
- Valid JSON without `name` exits 1 with exactly one stderr line, and writes no `index.html` (covers: REQ-17): pass (TS-ERR-NAME_MISSING green)
