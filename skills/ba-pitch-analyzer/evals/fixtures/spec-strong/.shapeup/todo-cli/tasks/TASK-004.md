---
id: TASK-004
type: feature
package: review
status: todo
estimated_hours: 1
use_case_refs: [UC-03]
depends_on: [TASK-003]
unlocks: []
touched_files: [src/review/search.js, src/review/format.js, src/cli/dispatch.js]
oracle: process
---

# TASK-004 — `search` command

Implement UC-03: case-insensitive substring filter, printed in list format.

## Acceptance Criteria
- [ ] AC1 — Search never writes the store.
- [ ] AC2 — No match prints `no todos` and exits 0.
