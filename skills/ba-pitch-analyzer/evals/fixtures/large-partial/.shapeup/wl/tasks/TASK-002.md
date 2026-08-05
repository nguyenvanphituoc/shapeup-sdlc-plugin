---
id: TASK-002
type: feature
package: render
status: todo
estimated_hours: 2
use_case_refs: [UC-02]
depends_on: []
unlocks: [TASK-004, TASK-005, TASK-012, TASK-013]
touched_files: [src/render/lines.js, src/render/errors.js]
oracle: process
---

# TASK-002 — Output rendering

Implement the behaviour UC-02 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
