---
id: TASK-006
type: feature
package: review
status: todo
estimated_hours: 2
use_case_refs: [UC-03]
depends_on: [TASK-005]
unlocks: [TASK-018]
touched_files: [src/review/search.js]
oracle: process
---

# TASK-006 — `search` command

Implement the behaviour UC-03 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
