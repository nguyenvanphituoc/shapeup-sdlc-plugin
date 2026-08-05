---
id: TASK-003
type: feature
package: review
status: todo
estimated_hours: 1
use_case_refs: [UC-02]
depends_on: [TASK-002]
unlocks: [TASK-004]
touched_files: [src/review/list.js, src/review/format.js, src/cli/dispatch.js]
oracle: process
---

# TASK-003 — `list` command

Implement UC-02: print every item as `<n>. [ ] <text>`, or `no todos` when empty.

## Acceptance Criteria
- [ ] AC1 — `list` succeeds against a store that does not exist.
- [ ] AC2 — Numbers shown are 1-based positions in the store array.
