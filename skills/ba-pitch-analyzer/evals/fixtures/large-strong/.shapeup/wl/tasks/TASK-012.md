---
id: TASK-012
type: feature
package: schedule
status: todo
estimated_hours: 2
use_case_refs: [UC-09]
depends_on: [TASK-011, TASK-002]
unlocks: [TASK-019]
touched_files: [src/schedule/overdue.js]
oracle: process
---

# TASK-012 — `overdue` report

Implement the behaviour UC-09 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
