---
id: TASK-007
type: feature
package: complete
status: todo
estimated_hours: 2
use_case_refs: [UC-04]
depends_on: [TASK-001, TASK-003]
unlocks: [TASK-018]
touched_files: [src/complete/done.js]
oracle: process
---

# TASK-007 — `done` command

Implement the behaviour UC-04 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
