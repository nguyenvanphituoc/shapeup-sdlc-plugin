---
id: TASK-010
type: feature
package: tags
status: todo
estimated_hours: 2
use_case_refs: [UC-07]
depends_on: [TASK-009]
unlocks: [TASK-019]
touched_files: [src/tags/untag.js]
oracle: process
---

# TASK-010 — `untag` command

Implement the behaviour UC-07 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
