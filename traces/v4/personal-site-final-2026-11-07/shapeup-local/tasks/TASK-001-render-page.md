---
type: task
feature: personal-site
id: TASK-001
title: "Create build.mjs that renders content.json to dist/index.html"
lens: standard
package: "."
status: done
priority: 1
depends_on: []
unlocks: [TASK-002, TASK-003]
use_case_refs: [UC-BuildSite]
entities: [SiteContent, Project, Contact]
repositories: [ContentSource, PageSink]
linked_docs: ["[[usecases/UC-BuildSite]]", "[[ux-behavior#Screen: PersonalPage]]", "[[contracts/build-cli.contract]]"]
estimated_hours: 2
tags: [cli, render]
completed_at: 2026-11-07
---

# TASK-001: Create build.mjs that renders content.json to dist/index.html

## Context
Implements the happy path of [[usecases/UC-BuildSite#Steps]] (steps 1, 5–7) and the page layout in
[[ux-behavior#Screen: PersonalPage]]. Also adds a sample `content.json` so `node build.mjs` works in the repo.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `build.mjs` exists at the project root, imports only `node:` builtins, and `package.json` gains no dependencies (covers: REQ-1)
- [x] A valid sample `content.json` exists at the project root with `name`, `tagline`, `about`, `projects` (`{title, summary, url}`), `contact.email` (covers: REQ-3)
- [x] `node build.mjs` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-10)
- [x] The output has an inline `<style>` element, no `<link rel="stylesheet">` and no `<script>` (covers: REQ-2)
- [x] The output's `<title>` text equals `name` (covers: REQ-9)
- [x] The output has exactly one `<h1>`, containing `name`, with the tagline directly after it (covers: REQ-4)
- [x] The output has an About section containing the `about` text (covers: REQ-5)
- [x] The output has a Projects section with one card per project, each title an `<a href>` to its `url` (covers: REQ-6)
- [x] The output has a Contact section with an `<a href="mailto:EMAIL">` link (covers: REQ-7)
- [x] The sections appear in the order h1+tagline, About, Projects, Contact (covers: REQ-8)
- [x] `CONTENT_FILE=/tmp/x.json OUT_DIR=/tmp/out node build.mjs` reads the named file and writes `/tmp/out/index.html` (creating the dir), leaving `dist/` untouched (covers: REQ-11)
- [x] Running the build twice produces byte-identical `index.html` (covers: REQ-18)

### 🔁 Inverse Conditions
- [x] A project with no `url` renders its title as plain text: no `<a>`, no `href="#"`, no `href=""` (covers: REQ-12)
- [x] `projects: []` renders the Projects section with "Projects are coming soon." and no `<ul>`/`<ol>`/`<li>` (covers: REQ-13)

### 🔢 Boundary Values
- [x] A title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; every interpolated string (attributes included) is escaped (covers: REQ-14)

### 🧪 BDD Scenarios

**Scenario: owner builds the page**
Given a valid `content.json` with two projects
When  the owner runs `node build.mjs`
Then  `dist/index.html` exists, exit code is 0, and the page shows name, tagline, About, two project cards, Contact

## Implementation Notes
- One `esc()` helper for `& < > " '`, `&` first.
- No timestamps; iterate arrays only; fixed trailing newline.

## Non-Go (not in this task)
- Failure paths (missing / unparsable file, missing `name`) — TASK-002
- Markdown, themes, multiple pages, images, watch/serve mode


## Execution Log — 2026-11-07 (personal-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `build.mjs` exists at the project root, imports only `node:` builtins, and `package.json` gains no dependencies (covers: REQ-1): pass (imports node:fs, node:path only; package.json untouched)
- A valid sample `content.json` exists at the project root with `name`, `tagline`, `about`, `projects` (`{title, summary, url}`), `contact.email` (covers: REQ-3): pass (content.json written with all fields; node build.mjs parses it)
- `node build.mjs` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-10): pass (T0 fixture node build.mjs green; dist/index.html present)
- The output has an inline `<style>` element, no `<link rel="stylesheet">` and no `<script>` (covers: REQ-2): pass (inspected dist/index.html: one <style>, no link/script)
- The output's `<title>` text equals `name` (covers: REQ-9): pass (<title>Jane Doe</title>)
- The output has exactly one `<h1>`, containing `name`, with the tagline directly after it (covers: REQ-4): pass (dist/index.html inspected; TS-INV-04 green)
- The output has an About section containing the `about` text (covers: REQ-5): pass (section#about inspected)
- The output has a Projects section with one card per project, each title an `<a href>` to its `url` (covers: REQ-6): pass (two article.card with anchors inspected)
- The output has a Contact section with an `<a href="mailto:EMAIL">` link (covers: REQ-7): pass (mailto:jane@example.com anchor inspected)
- The sections appear in the order h1+tagline, About, Projects, Contact (covers: REQ-8): pass (order verified in dist/index.html)
- `CONTENT_FILE=/tmp/x.json OUT_DIR=/tmp/out node build.mjs` reads the named file and writes `/tmp/out/index.html` (creating the dir), leaving `dist/` untouched (covers: REQ-11): pass (env-var path exercised by every test in build.test.mjs (temp dirs, mkdirSync recursive))
- Running the build twice produces byte-identical `index.html` (covers: REQ-18): pass (TS-INV-01 green)
- A project with no `url` renders its title as plain text: no `<a>`, no `href="#"`, no `href=""` (covers: REQ-12): pass (TS-INV-05 green)
- `projects: []` renders the Projects section with "Projects are coming soon." and no `<ul>`/`<ol>`/`<li>` (covers: REQ-13): pass (TS-INV-06 green)
- A title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; every interpolated string (attributes included) is escaped (covers: REQ-14): pass (TS-INV-03 green; all interpolations go through esc())
