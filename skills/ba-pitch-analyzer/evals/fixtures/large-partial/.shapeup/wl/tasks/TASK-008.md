---
id: TASK-008
type: feature
package: complete
status: todo
estimated_hours: 2
use_case_refs: [UC-05]
depends_on: [TASK-001, TASK-003]
unlocks: [TASK-018]
touched_files: [src/complete/remove.js]
oracle: process
---

# TASK-008 — `rm` command

Implement the behaviour UC-05 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
