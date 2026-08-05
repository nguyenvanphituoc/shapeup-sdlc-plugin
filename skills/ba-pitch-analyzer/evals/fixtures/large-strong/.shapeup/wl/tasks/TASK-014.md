---
id: TASK-014
type: feature
package: transfer
status: todo
estimated_hours: 2
use_case_refs: [UC-11]
depends_on: [TASK-001]
unlocks: [TASK-020]
touched_files: [src/transfer/export.js]
oracle: process
---

# TASK-014 — `export` command

Implement the behaviour UC-11 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
