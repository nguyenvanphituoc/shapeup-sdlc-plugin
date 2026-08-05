---
id: TASK-009
type: feature
package: tags
status: todo
estimated_hours: 3
use_case_refs: [UC-02]
depends_on: [TASK-002]
unlocks: []
touched_files: [src/tags/tag.js, src/tags/untag.js, src/cli/dispatch.js]
oracle: process
---

# TASK-009 — `tag` and `untag` commands

NOT BUILT YET. Attach and remove free-form tags on items, and let `list` show them.

## Acceptance Criteria
- [ ] AC1 — `todo tag 1 work` attaches a tag; `todo untag 1 work` removes it.
- [ ] AC2 — Tagging an item twice with the same tag is a no-op.
