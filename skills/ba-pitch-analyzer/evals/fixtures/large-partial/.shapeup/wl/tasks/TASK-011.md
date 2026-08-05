---
id: TASK-011
type: feature
package: schedule
status: todo
estimated_hours: 2
use_case_refs: [UC-08]
depends_on: [TASK-001, TASK-003]
unlocks: [TASK-012, TASK-013]
touched_files: [src/schedule/due.js, src/schedule/dates.js]
oracle: process
---

# TASK-011 — `due` command

Implement the behaviour UC-08 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
