---
id: TASK-008
type: feature
package: render
status: todo
estimated_hours: 1
use_case_refs: [UC-02, UC-03]
depends_on: []
unlocks: []
touched_files: [src/render/lines.js, src/render/errors.js]
oracle: process
---

# TASK-008 — Output rendering

One place that turns a message into a stdout line, and one that turns a refusal into a stderr line
plus a non-zero exit. Read by every command flow.

## Acceptance Criteria
- [ ] AC1 — Every refusal writes to stderr and returns non-zero.
