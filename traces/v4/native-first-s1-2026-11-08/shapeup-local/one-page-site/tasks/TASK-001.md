---
type: task
feature: one-page-site
id: TASK-001
title: "Create build.mjs that renders content.json to dist/index.html"
package: .
status: done
priority: 1
depends_on: []
unlocks: [TASK-002]
use_case_refs: ["[[usecases/UC-BuildPage]]"]
entities: [SiteContent]
repositories: []
linked_docs: ["[[domain-model]]", "[[ux-behavior]]"]
estimated_hours: 3
tags: [cli]
completed_at: 2026-11-07
---

# TASK-001: Create build.mjs that renders content.json to dist/index.html

## Context
Implements every step of [[usecases/UC-BuildPage#Steps]] in one zero-dependency Node ESM script, plus a
sample `content.json` so `node build.mjs` works out of the box.
Reference: [[domain-model#SiteContent (entity, new)]] / [[ux-behavior#GeneratedPage]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `build.mjs` exists at the repo root and imports only `node:` builtins (no `import` of a package name, no `package.json` dependencies) (covers: REQ-4)
- [x] `content.json` exists at the repo root with `name`, `tagline`, `about`, `projects` (`{title, summary, url}`) and `contact` (`{email}`) (covers: REQ-5)
- [x] `node build.mjs` exits 0 and writes `dist/index.html` from `content.json` (covers: REQ-1)
- [x] The output has an inline `<style>` element and no `<link rel="stylesheet">` (covers: REQ-2)
- [x] The output contains no `<script` (covers: REQ-3)
- [x] The output's only `<h1>` holds the name, with the tagline in the next element after it (covers: REQ-6, REQ-7)
- [x] The output's sections appear in order: header, About, Projects, Contact (covers: REQ-8)
- [x] Each project renders as one card whose title is `<a href="<url>">` (covers: REQ-9)
- [x] The Contact section has `<a href="mailto:<email>">` (covers: REQ-10)
- [x] `<title>` is the name (covers: REQ-11)
- [x] `build.mjs` contains no `fetch`, `http`, `https`, `net` or `dns` use (covers: REQ-12)
- [x] `build.mjs` never opens the content file for writing; its hash is unchanged after a build (covers: REQ-13)
- [x] `CONTENT_FILE=<tmp>/c.json node build.mjs` reads that file instead of `content.json` (covers: REQ-14)
- [x] `OUT_DIR=<tmp>/out node build.mjs` writes `<tmp>/out/index.html` and not `dist/index.html` (covers: REQ-15)

### 🔁 Inverse Conditions
- [x] A project with no `url` renders its title as plain text — no `<a>`, no `href="#"`, no `href=""` (covers: REQ-16)
- [x] With `projects: []` the Projects section shows "Projects are coming soon." and no `<ul>`/`<li>` (covers: REQ-17)

### 📭 Empty & Null States
- [x] Missing content file → exit 1, exactly one stderr line naming the file, no `index.html` written (covers: REQ-19, REQ-20, REQ-21)
- [x] Unparseable content file → exit 1, exactly one stderr line naming the parse problem, no `index.html` written (covers: REQ-19, REQ-20, REQ-21)
- [x] Content without `name` → exit 1, exactly one stderr line naming `name`, no `index.html` written (covers: REQ-22)

### 🧪 BDD Scenarios

**Scenario: escaped content builds deterministically**
Given a content file whose project title is `<b>Rock & Roll</b>`
When  `node build.mjs` runs twice into the same `OUT_DIR`
Then  the output contains `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;` (covers: REQ-18)
And   the two outputs are byte-identical (covers: REQ-23)

- [x] Every content value (text and attribute values) is HTML-escaped; `<b>Rock & Roll</b>` appears as text (covers: REQ-18)
- [x] Two runs over the same content produce byte-identical `index.html` (covers: REQ-23)

## Implementation Notes
Validate fully before any write — do not create `OUT_DIR` until validation passes. No timestamps or
randomness in the output.

## Non-Go (not in this task)
- The automated test file (TASK-002).
- Markdown, themes, multiple pages, images, serving.


## Execution Log — 2026-11-07 (one-page-site/build-page-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `build.mjs` exists at the repo root and imports only `node:` builtins (no `import` of a package name, no `package.json` dependencies) (covers: REQ-4): pass (imports only node:fs, node:path; package.json has no dependencies)
- `content.json` exists at the repo root with `name`, `tagline`, `about`, `projects` (`{title, summary, url}`) and `contact` (`{email}`) (covers: REQ-5): pass (content.json written with all fields)
- `node build.mjs` exits 0 and writes `dist/index.html` from `content.json` (covers: REQ-1): pass (T0 verify green 1/1 (node --test); TS-NOGO-03 exit 0)
- The output has an inline `<style>` element and no `<link rel="stylesheet">` (covers: REQ-2): pass (template has inline <style>, no <link>)
- The output contains no `<script` (covers: REQ-3): pass (TS-INV-05 passes)
- The output's only `<h1>` holds the name, with the tagline in the next element after it (covers: REQ-6, REQ-7): pass (TS-INV-06 passes; <p>tagline</p> follows <h1>)
- The output's sections appear in order: header, About, Projects, Contact (covers: REQ-8): pass (template order header, about, projects, contact)
- Each project renders as one card whose title is `<a href="<url>">` (covers: REQ-9): pass (renderProject emits li.card with <a href> when url present)
- The Contact section has `<a href="mailto:<email>">` (covers: REQ-10): pass (contactHtml mailto link)
- `<title>` is the name (covers: REQ-11): pass (TS-INV-06 passes)
- `build.mjs` contains no `fetch`, `http`, `https`, `net` or `dns` use (covers: REQ-12): pass (grep -cE 'fetch|http|net|dns' build.mjs -> 0)
- `build.mjs` never opens the content file for writing; its hash is unchanged after a build (covers: REQ-13): pass (only readFileSync on content; TS-INV-01 passes)
- `CONTENT_FILE=<tmp>/c.json node build.mjs` reads that file instead of `content.json` (covers: REQ-14): pass (all tests use CONTENT_FILE temp path and pass)
- `OUT_DIR=<tmp>/out node build.mjs` writes `<tmp>/out/index.html` and not `dist/index.html` (covers: REQ-15): pass (all tests read <tmp>/out/index.html; TS-NOGO-02 passes)
- A project with no `url` renders its title as plain text — no `<a>`, no `href="#"`, no `href=""` (covers: REQ-16): pass (TS-INV-07 passes)
- With `projects: []` the Projects section shows "Projects are coming soon." and no `<ul>`/`<li>` (covers: REQ-17): pass (TS-INV-08 passes)
- Missing content file → exit 1, exactly one stderr line naming the file, no `index.html` written (covers: REQ-19, REQ-20, REQ-21): pass (TS-ERR-CONTENT_MISSING passes)
- Unparseable content file → exit 1, exactly one stderr line naming the parse problem, no `index.html` written (covers: REQ-19, REQ-20, REQ-21): pass (TS-ERR-CONTENT_UNPARSEABLE passes)
- Content without `name` → exit 1, exactly one stderr line naming `name`, no `index.html` written (covers: REQ-22): pass (TS-REQ-name-missing passes)
- Every content value (text and attribute values) is HTML-escaped; `<b>Rock & Roll</b>` appears as text (covers: REQ-18): pass (TS-INV-04 passes; esc() applied to all values incl. href)
- Two runs over the same content produce byte-identical `index.html` (covers: REQ-23): pass (TS-INV-02 passes)
