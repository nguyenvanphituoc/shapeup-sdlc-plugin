---
type: task
feature: personal-site
id: TASK-001
title: "Create the zero-dependency build.mjs that renders content.json to dist/index.html"
lens: lite
package: build.mjs
status: done
priority: 1
depends_on: []
unlocks: [TASK-002]
use_case_refs: [UC-BuildSite]
entities: [SiteContent, Project]
repositories: [ContentSource, PageSink]
linked_docs: ["[[usecases/UC-BuildSite]]", "[[ux-behavior#Screen: PortfolioPage]]", "[[domain-model]]"]
estimated_hours: 3
tags: [cli, render]
completed_at: 2026-11-07
---

# TASK-001: Create the zero-dependency build.mjs

## Context
Implements the whole of [[usecases/UC-BuildSite#Steps]]: resolve paths, load and validate content,
render the page in the order of [[ux-behavior#Screen: PortfolioPage]], write one file. Greenfield —
`package.json` already sets `"type":"module"`, so `build.mjs` uses `node:fs` / `node:path` imports only.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `build.mjs` exists at the repo root and imports only `node:` builtins; `package.json` declares no `dependencies` (covers: REQ-1, REQ-11)
- [x] `node build.mjs` with a valid `content.json` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-2)
- [x] With `CONTENT_FILE=<tmp>/c.json OUT_DIR=<tmp>/out node build.mjs`, the page is written to `<tmp>/out/index.html` and the repo's `dist/` is untouched (covers: REQ-14)
- [x] The output has one inline `<style>` element and no `<link rel="stylesheet">` (covers: REQ-3)
- [x] The output contains no `<script` element, no `on*=` attribute and no `javascript:` URL (covers: REQ-3, REQ-12)
- [x] `<title>` is the `name`, and the document has exactly one `<h1>`, whose text is the `name`, with the tagline directly after it (covers: REQ-5, REQ-10)
- [x] The rendered order is header, About section, Projects section, Contact section (covers: REQ-6, REQ-9)
- [x] Each project renders one card whose title is `<a href="<url>">` when `url` is set, with its summary (covers: REQ-4, REQ-7)
- [x] The Contact section contains `<a href="mailto:<email>">` (covers: REQ-8)
- [x] The content file's bytes and mtime are unchanged after a build (covers: REQ-13)
- [x] Two builds of the same content produce byte-identical `index.html` (`cmp` exits 0) (covers: REQ-20)

### 🔁 Inverse Conditions
- [x] A project with no `url` (or an empty one) renders its title as plain text: the output has no `href="#"` and no `href=""` (covers: REQ-15)
- [x] With `projects: []` or `projects` absent, the Projects section shows "Projects are coming soon." and contains no `<ul>`/`<ol>`/`<li>` (covers: REQ-16)

### 📭 Empty & Null States
- [x] A title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; every content string is escaped, attribute values included (covers: REQ-17)
- [x] A missing content file → exit 1, exactly one stderr line naming the file, no `index.html` written (covers: REQ-18)
- [x] A content file containing `{not json` → exit 1, exactly one stderr line, no `index.html` written (covers: REQ-18)
- [x] Content with no `name` → exit 1, exactly one stderr line naming `name`, no `index.html` written (covers: REQ-19)

### 🧪 BDD Scenarios

**Scenario: freelancer builds the page**
Given a `content.json` with name, tagline, about, two projects and a contact email
When  they run `node build.mjs`
Then  `dist/index.html` exists, opens with no JavaScript, and shows the sections in order

**Scenario: broken content is rejected**
Given a `content.json` that is not valid JSON
When  they run `node build.mjs`
Then  it exits 1 with one stderr line and `dist/index.html` is not written

## Implementation Notes
- Validate fully before any write, so every exit-1 path leaves the output directory untouched.
- No timestamps or random values in the output (byte-identical re-runs).
- Errors are a single `console.error` line, not a stack trace.

## Non-Go (not in this task)
- The `node --test` suite (TASK-002).
- Markdown, themes, multiple pages, images, tracking or a serve mode.


## Execution Log — 2026-11-07 (personal-site/build-site-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `build.mjs` exists at the repo root and imports only `node:` builtins; `package.json` declares no `dependencies` (covers: REQ-1, REQ-11): pass (TS-INV-08 in node --test build.test.mjs; verify t0 r1 a1 green)
- `node build.mjs` with a valid `content.json` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-2): pass (TS-INV-01/04 build exit 0 and index.html written (via CONTENT_FILE/OUT_DIR); default paths share the same code path)
- With `CONTENT_FILE=<tmp>/c.json OUT_DIR=<tmp>/out node build.mjs`, the page is written to `<tmp>/out/index.html` and the repo's `dist/` is untouched (covers: REQ-14): pass (every suite test uses temp paths; repo has no dist/ after npm test)
- The output has one inline `<style>` element and no `<link rel="stylesheet">` (covers: REQ-3): pass (TS-INV-02 asserts one <style>, no stylesheet link)
- The output contains no `<script` element, no `on*=` attribute and no `javascript:` URL (covers: REQ-3, REQ-12): pass (TS-INV-02 with hostile script/onclick/onmouseover content)
- `<title>` is the `name`, and the document has exactly one `<h1>`, whose text is the `name`, with the tagline directly after it (covers: REQ-5, REQ-10): pass (TS-INV-04)
- The rendered order is header, About section, Projects section, Contact section (covers: REQ-6, REQ-9): pass (TS-INV-04 index ordering of h1/about/projects/contact)
- Each project renders one card whose title is `<a href="<url>">` when `url` is set, with its summary (covers: REQ-4, REQ-7): pass (TS-INV-04 asserts <a href="https://e.com/1">P1</a>; cards are <article> with summary <p>)
- The Contact section contains `<a href="mailto:<email>">` (covers: REQ-8): pass (TS-INV-04 asserts mailto link)
- The content file's bytes and mtime are unchanged after a build (covers: REQ-13): pass (TS-INV-01 sha256 and mtime unchanged)
- Two builds of the same content produce byte-identical `index.html` (`cmp` exits 0) (covers: REQ-20): pass (TS-INV-03 string-equal outputs from two OUT_DIRs)
- A project with no `url` (or an empty one) renders its title as plain text: the output has no `href="#"` and no `href=""` (covers: REQ-15): pass (TS-INV-06 for url absent and empty)
- With `projects: []` or `projects` absent, the Projects section shows "Projects are coming soon." and contains no `<ul>`/`<ol>`/`<li>` (covers: REQ-16): pass (TS-INV-07 both variants)
- A title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; every content string is escaped, attribute values included (covers: REQ-17): pass (TS-INV-05 incl. href="x&quot;y")
- A missing content file → exit 1, exactly one stderr line naming the file, no `index.html` written (covers: REQ-18): pass (TS-ERR-CONTENT_MISSING)
- A content file containing `{not json` → exit 1, exactly one stderr line, no `index.html` written (covers: REQ-18): pass (TS-ERR-CONTENT_INVALID_JSON)
- Content with no `name` → exit 1, exactly one stderr line naming `name`, no `index.html` written (covers: REQ-19): pass (TS-REQ-name-missing)
