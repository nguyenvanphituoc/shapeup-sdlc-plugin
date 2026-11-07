---
type: task
feature: one-page-site
id: TASK-003
title: "Render the project edge cases"
package: .
status: done
priority: 3
depends_on: [TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-BuildSite]
entities: []
repositories: []
linked_docs: []
estimated_hours: 1
tags: []
completed_at: 2026-11-07
---

# TASK-003: Render the project edge cases

## Context
Handle the pitch's edge behaviour in the render function per [[usecases/UC-BuildSite#Steps]] steps 4 and 5.

## Acceptance Criteria

### ✅ Baseline
- [x] A project with no `url` renders its title as plain text; the output contains no `href="#"` and no `href=""` (covers: REQ-11)
- [x] A project whose url scheme is not http or https (for example `javascript:`) renders its title as plain text, never as an anchor
- [x] Zero or absent projects renders the sentence "Projects are coming soon." in the Projects section (covers: REQ-12)
- [x] Zero projects renders no `<ul>`, `<ol>` or `<li>` in the Projects section (covers: REQ-13)
- [x] `node --test` exits 0

## Non-Go (not in this task)
- Writing the output file.


## Execution Log — 2026-11-07 (one-page-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- A project with no `url` renders its title as plain text; the output contains no `href="#"` and no `href=""` (covers: REQ-11): pass (test 'url-less and non-http...')
- A project whose url scheme is not http or https (for example `javascript:`) renders its title as plain text, never as an anchor: pass (same test asserts no javascript: in output)
- Zero or absent projects renders the sentence "Projects are coming soon." in the Projects section (covers: REQ-12): pass (test 'zero or absent projects')
- Zero projects renders no `<ul>`, `<ol>` or `<li>` in the Projects section (covers: REQ-13): pass (same test)
- `node --test` exits 0: pass (T0 green)
