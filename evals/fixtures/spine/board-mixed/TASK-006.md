---
id: TASK-006
type: feature
package: complete
status: todo
estimated_hours: 2
use_case_refs: [UC-05]
depends_on: [TASK-002]
unlocks: []
touched_files: [src/complete/remove.js, src/complete/selectors.js, src/cli/dispatch.js]
oracle: process
---

# TASK-006 — `rm` command

Implement UC-05: batch removal resolved against the ORIGINAL list.

## Acceptance Criteria
- [ ] AC1 — A batch removal never shifts the items it has not removed yet.
- [ ] AC2 — One bad selector refuses the whole batch.
