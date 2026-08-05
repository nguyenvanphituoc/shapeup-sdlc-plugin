---
id: TASK-017
type: feature
package: cli
status: todo
estimated_hours: 2
use_case_refs: [UC-01, UC-02]
depends_on: [TASK-004, TASK-005]
unlocks: [TASK-018, TASK-019, TASK-020]
touched_files: [src/cli/main.js, src/cli/dispatch.js, src/cli/args.js]
oracle: process
---

# TASK-017 — CLI entry point and dispatch

Implement the behaviour UC-01 / UC-02 describes.

## Acceptance Criteria
- [ ] AC1 — The happy path behaves as the use case states.
- [ ] AC2 — Bad input is refused non-zero without writing the store.
