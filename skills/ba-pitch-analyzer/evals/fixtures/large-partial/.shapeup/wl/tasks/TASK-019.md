---
id: TASK-019
type: feature
package: cli
status: todo
estimated_hours: 2
use_case_refs: [UC-06, UC-07, UC-08, UC-09]
depends_on: [TASK-017, TASK-010, TASK-012]
unlocks: []
touched_files: [src/cli/dispatch.js]
oracle: process
---

# TASK-019 — Wire the tag and schedule commands

Implement the behaviour UC-06 / UC-07 / UC-08 / UC-09 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
