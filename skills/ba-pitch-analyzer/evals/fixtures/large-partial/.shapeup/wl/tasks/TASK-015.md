---
id: TASK-015
type: feature
package: transfer
status: todo
estimated_hours: 2
use_case_refs: [UC-12]
depends_on: [TASK-016, TASK-001]
unlocks: [TASK-020]
touched_files: [src/transfer/import.js]
oracle: process
---

# TASK-015 — `import` command

Implement the behaviour UC-12 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
