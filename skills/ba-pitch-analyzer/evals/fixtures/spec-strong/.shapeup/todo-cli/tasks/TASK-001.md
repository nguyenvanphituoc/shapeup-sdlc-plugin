---
id: TASK-001
type: feature
package: capture
status: todo
estimated_hours: 2
use_case_refs: [UC-01]
depends_on: [TASK-002]
unlocks: []
touched_files: [src/capture/add.js, src/capture/validate.js, src/cli/dispatch.js]
oracle: process
---

# TASK-001 — `add` command

Implement UC-01: validate the text, append one item, print the confirmation.

## Acceptance Criteria
- [ ] AC1 — Empty text is refused non-zero and the store is not written.
- [ ] AC2 — A successful add appends exactly one item.
