---
type: task
feature: one-page-site
id: TASK-002
title: "Render the page layout with escaping and inline CSS"
package: .
status: done
priority: 2
depends_on: [TASK-001]
unlocks: [TASK-003, TASK-004]
use_case_refs: [UC-BuildSite]
entities: []
repositories: []
linked_docs: []
estimated_hours: 2
tags: []
completed_at: 2026-11-07
---

# TASK-002: Render the page layout with escaping and inline CSS

## Context
Implement the render function per [[usecases/UC-BuildSite#Steps]] and [[ux-behavior#Screen: GeneratedPage]]. A pure function from validated content to an HTML string; no I/O.

## Acceptance Criteria

### ✅ Baseline
- [x] Rendered HTML has CSS inside a `<style>` element and no `<script>` element or external resource (covers: REQ-2, REQ-3, REQ-22)
- [x] Rendered HTML has exactly one `<h1>` containing the name, the tagline directly after it, then About, Projects, Contact sections in that order (covers: REQ-5, REQ-6)
- [x] `<title>` equals the escaped name (covers: REQ-10)
- [x] Each project renders as one card, in array order, and its title is an `<a href>` to its url when the url is an allowed http(s) url (covers: REQ-7, REQ-8)
- [x] Contact section renders a `mailto:` link with the escaped email (covers: REQ-9)
- [x] All content text and attribute values are escaped for `& < > " '` with `&` first; a title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;` (covers: REQ-14)
- [x] `node --test` exits 0

## Non-Go (not in this task)
- Edge cases for url-less and zero projects (next task); writing the file.


## Execution Log — 2026-11-07 (one-page-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- Rendered HTML has CSS inside a `<style>` element and no `<script>` element or external resource (covers: REQ-2, REQ-3, REQ-22): pass (test 'no script, no external resource, inline style')
- Rendered HTML has exactly one `<h1>` containing the name, the tagline directly after it, then About, Projects, Contact sections in that order (covers: REQ-5, REQ-6): pass (test 'layout order...')
- `<title>` equals the escaped name (covers: REQ-10): pass (layout test asserts <title>Jane</title>)
- Each project renders as one card, in array order, and its title is an `<a href>` to its url when the url is an allowed http(s) url (covers: REQ-7, REQ-8): pass (layout test: 3 cards in order, anchor to url)
- Contact section renders a `mailto:` link with the escaped email (covers: REQ-9): pass (layout test asserts mailto href)
- All content text and attribute values are escaped for `& < > " '` with `&` first; a title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;` (covers: REQ-14): pass (test 'escaping')
- `node --test` exits 0: pass (T0 green)
