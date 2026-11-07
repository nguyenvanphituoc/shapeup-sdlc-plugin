---
type: task
feature: one-page-site
id: TASK-001
title: "Render content.json into a static dist/index.html with build.mjs"
package: root
status: done
priority: 1
depends_on: []
unlocks: [TASK-002, TASK-003]
use_case_refs: ["[[usecases/UC-BuildSite]]"]
entities: [SiteContent, Project]
repositories: [ContentSource, PageSink]
linked_docs: ["[[ux-behavior]]", "[[contracts/content-file.contract]]"]
estimated_hours: 2
tags: [feat, cli]
completed_at: 2026-11-07
---

# TASK-001: Render content.json into a static dist/index.html with build.mjs

## Context
Implement the happy path of [[usecases/UC-BuildSite#Steps]]: read the content file, render the page described
in [[ux-behavior#Screen: SitePage]] in memory, write it once.
Reference: [[domain-model#SiteContent (new)]] / [[usecases/UC-BuildSite#Steps]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `build.mjs` exists at the project root and `node build.mjs` with a valid `content.json` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-10)
- [x] The output has one `<style>` block and no `<script>`, no `on*=` attribute, no `<link>` and no `src=` (covers: REQ-2)
- [x] `build.mjs` imports only `node:` builtins and makes no network calls (TS-NOGO-01)
- [x] A project titled `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;` with no raw `<b>` from content (covers: REQ-14)
- [x] `<title>` equals `name`, and the page has exactly one `<h1>` whose text is `name`, with the tagline after it (covers: REQ-4, REQ-9)
- [x] Sections appear in order h1+tagline, About (with the `about` text), Projects, Contact (covers: REQ-5, REQ-8)
- [x] Each project renders as one card in array order; its title is an `<a href>` to its `url` (covers: REQ-6)
- [x] Contact renders a `mailto:<email>` link (covers: REQ-7)
- [x] `CONTENT_FILE=<tmp>/c.json OUT_DIR=<tmp>/out node build.mjs` reads that file and writes `<tmp>/out/index.html` (covers: REQ-11)
- [x] Two consecutive builds of the same content produce byte-identical files (covers: REQ-17)
- [x] The content file's bytes are unchanged after a build (TS-NOGO-03)

### 🔁 Inverse Conditions
- [x] A project with no `url` (or a blank or non-`http(s)` url such as `javascript:alert(1)`) renders its title as plain text: no `<a>`, no `href="#"`, no `href=""` (covers: REQ-12)

### 📭 Empty & Null States
- [x] `projects: []` or absent → the Projects section contains "Projects are coming soon." and no `<ul>`/`<li>` (covers: REQ-13)
- [x] Absent `tagline`, `about` or `contact.email` → no crash; that element is omitted

### 🧪 BDD Scenarios

**Scenario: escaping content**
Given a project titled `<b>Rock & Roll</b>`
When  `node build.mjs` runs
Then  the output contains `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;` and no raw `<b>` from content (covers: REQ-14)

## Implementation Notes
Render the whole document to one string before any filesystem write; escape `&` first, then `< > " '`.

## Non-Go (not in this task)
- Validation and error exits (TASK-002). Tests (TASK-003). Markdown, themes, images, serve/watch.


## Execution Log — 2026-11-07 (one-page-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `build.mjs` exists at the project root and `node build.mjs` with a valid `content.json` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-10): pass (TS-REQ-env-override; node --test 20/20)
- The output has one `<style>` block and no `<script>`, no `on*=` attribute, no `<link>` and no `src=` (covers: REQ-2): pass (TS-INV-02)
- `build.mjs` imports only `node:` builtins and makes no network calls (TS-NOGO-01): pass (TS-NOGO-01)
- A project titled `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;` with no raw `<b>` from content (covers: REQ-14): pass (TS-INV-04)
- `<title>` equals `name`, and the page has exactly one `<h1>` whose text is `name`, with the tagline after it (covers: REQ-4, REQ-9): pass (TS-INV-06, TS-REQ-layout)
- Sections appear in order h1+tagline, About (with the `about` text), Projects, Contact (covers: REQ-5, REQ-8): pass (TS-REQ-layout)
- Each project renders as one card in array order; its title is an `<a href>` to its `url` (covers: REQ-6): pass (TS-REQ-projects-order)
- Contact renders a `mailto:<email>` link (covers: REQ-7): pass (TS-REQ-layout)
- `CONTENT_FILE=<tmp>/c.json OUT_DIR=<tmp>/out node build.mjs` reads that file and writes `<tmp>/out/index.html` (covers: REQ-11): pass (TS-REQ-env-override)
- Two consecutive builds of the same content produce byte-identical files (covers: REQ-17): pass (TS-INV-01)
- The content file's bytes are unchanged after a build (TS-NOGO-03): pass (TS-NOGO-03, TS-INV-03)
- A project with no `url` (or a blank or non-`http(s)` url such as `javascript:alert(1)`) renders its title as plain text: no `<a>`, no `href="#"`, no `href=""` (covers: REQ-12): pass (TS-INV-05, TS-NOGO-02)
- `projects: []` or absent → the Projects section contains "Projects are coming soon." and no `<ul>`/`<li>` (covers: REQ-13): pass (TS-REQ-projects-empty)
- Absent `tagline`, `about` or `contact.email` → no crash; that element is omitted: pass (TS-REQ-projects-empty builds {name:'X'} exit 0)
