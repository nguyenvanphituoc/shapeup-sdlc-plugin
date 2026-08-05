---
id: TASK-018
type: feature
package: cli
status: todo
estimated_hours: 2
use_case_refs: [UC-03, UC-04, UC-05]
depends_on: [TASK-017, TASK-006, TASK-007, TASK-008]
unlocks: []
touched_files: [src/cli/dispatch.js]
oracle: process
---

# TASK-018 — Wire the retrieval and completion commands

Implement the behaviour UC-03 / UC-04 / UC-05 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
