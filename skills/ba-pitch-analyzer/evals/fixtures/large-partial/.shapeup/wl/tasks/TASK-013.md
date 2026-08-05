---
id: TASK-013
type: feature
package: report
status: todo
estimated_hours: 2
use_case_refs: [UC-13]
depends_on: [TASK-009, TASK-011, TASK-002]
unlocks: [TASK-020]
touched_files: [src/report/stats.js]
oracle: process
---

# TASK-013 — `stats` report

Implement the behaviour UC-10 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
