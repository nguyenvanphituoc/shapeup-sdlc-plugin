---
id: TASK-005
type: feature
package: review
status: todo
estimated_hours: 2
use_case_refs: [UC-02]
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-006, TASK-017]
touched_files: [src/review/list.js, src/review/format.js]
oracle: process
---

# TASK-005 — `list` command

Implement the behaviour UC-02 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
