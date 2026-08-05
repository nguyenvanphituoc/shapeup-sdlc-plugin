---
id: TASK-001
type: feature
package: store
status: todo
estimated_hours: 2
use_case_refs: [UC-01, UC-02]
depends_on: []
unlocks: [TASK-004, TASK-005, TASK-007, TASK-008, TASK-009, TASK-011, TASK-014, TASK-015, TASK-016]
touched_files: [src/store/json-store.js, src/store/paths.js]
oracle: process
---

# TASK-001 — JSON store read/write

Implement the behaviour UC-01 / UC-02 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
