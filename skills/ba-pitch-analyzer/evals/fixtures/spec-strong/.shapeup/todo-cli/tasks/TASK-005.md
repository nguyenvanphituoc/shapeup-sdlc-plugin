---
id: TASK-005
type: feature
package: complete
status: todo
estimated_hours: 2
use_case_refs: [UC-04]
depends_on: [TASK-002]
unlocks: []
touched_files: [src/complete/done.js, src/complete/selectors.js, src/cli/dispatch.js]
oracle: process
---

# TASK-005 — `done` command

Implement UC-04: resolve every selector against the original list, then mark.

## Acceptance Criteria
- [ ] AC1 — One bad selector refuses the whole batch and writes nothing.
- [ ] AC2 — Marking an already-done item is a no-op.
