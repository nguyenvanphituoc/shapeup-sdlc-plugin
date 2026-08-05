---
id: TASK-020
type: feature
package: cli
status: todo
estimated_hours: 2
use_case_refs: [UC-10, UC-11, UC-12]
depends_on: [TASK-017, TASK-013, TASK-014, TASK-015]
unlocks: []
touched_files: [src/cli/dispatch.js]
oracle: process
---

# TASK-020 — Wire the report and transfer commands

Implement the behaviour UC-10 / UC-11 / UC-12 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
