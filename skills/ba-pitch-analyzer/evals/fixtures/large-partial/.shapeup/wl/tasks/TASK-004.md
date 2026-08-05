---
id: TASK-004
type: feature
package: capture
status: todo
estimated_hours: 2
use_case_refs: [UC-01]
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-017]
touched_files: [src/capture/add.js, src/capture/validate.js]
oracle: process
---

# TASK-004 — `add` command

Implement the behaviour UC-01 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
