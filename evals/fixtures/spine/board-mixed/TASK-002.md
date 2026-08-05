---
id: TASK-002
type: feature
package: store
status: todo
estimated_hours: 2
use_case_refs: [UC-01, UC-02]
depends_on: []
unlocks: [TASK-001, TASK-003, TASK-005, TASK-006, TASK-007, TASK-009, TASK-010]
touched_files: [src/store/json-store.js, src/store/paths.js]
oracle: process
---

# TASK-002 — JSON store read/write

Read and write the store array; resolve its path from `$TODO_STORE` or the working directory.
Every command flow depends on this.

## Acceptance Criteria
- [ ] AC1 — A missing store file reads as an empty list.
- [ ] AC2 — A corrupt store file reads as an empty list rather than crashing.
