---
id: TASK-003
type: feature
package: select
status: todo
estimated_hours: 2
use_case_refs: [UC-04, UC-05]
depends_on: []
unlocks: [TASK-007, TASK-008, TASK-009, TASK-011]
touched_files: [src/select/selectors.js]
oracle: process
---

# TASK-003 — Selector resolution

Implement the behaviour UC-04 / UC-05 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
