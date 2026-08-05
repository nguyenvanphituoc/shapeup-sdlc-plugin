---
id: TASK-007
type: feature
package: archive
status: todo
estimated_hours: 1
use_case_refs: [UC-06]
depends_on: [TASK-002]
unlocks: []
touched_files: [src/archive/archive-engine.js, src/cli/dispatch.js]
oracle: process
---

# TASK-007 — `archive` command

Implement UC-06: drop every done item, print the count.

## Acceptance Criteria
- [ ] AC1 — Not-done items survive in their original order.
