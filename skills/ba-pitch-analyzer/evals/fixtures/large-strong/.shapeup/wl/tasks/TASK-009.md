---
id: TASK-009
type: feature
package: tags
status: todo
estimated_hours: 2
use_case_refs: [UC-06]
depends_on: [TASK-001, TASK-003]
unlocks: [TASK-010, TASK-013]
touched_files: [src/tags/tag.js]
oracle: process
---

# TASK-009 — `tag` command

Implement the behaviour UC-06 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
