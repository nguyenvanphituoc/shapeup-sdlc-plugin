---
type: task
feature: personal-site
id: TASK-002
title: "Render the personal page as escaped, script-free, deterministic HTML"
lens: lite
package: root
status: done
priority: 2
depends_on: [TASK-001]
unlocks: [TASK-003]
use_case_refs: [UC-BuildPage]
entities: [SiteContent, Project, Contact]
repositories: []
linked_docs: ["[[ux-behavior#Screen: PersonalPage]]", "[[usecases/UC-BuildPage#Invariants]]"]
estimated_hours: 3
tags: [render]
completed_at: 2026-11-07
---

# TASK-002: Render the personal page as escaped, script-free, deterministic HTML

## Context
Step 4 of [[usecases/UC-BuildPage#Steps]]: a pure `render(content)` in `build.mjs` producing the
page laid out in [[ux-behavior#Screen: PersonalPage]], holding INV-01 and INV-03 to INV-07.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] the content model `name`, `tagline`, `about`, `projects[{title, summary, url}]`, `contact{email}` is read; only `name` is required (covers: REQ-4)
- [x] the page's only `<h1>` is `name` and the tagline follows it (covers: REQ-5)
- [x] an About section renders `about` as one paragraph (covers: REQ-6)
- [x] a Projects section renders one card per project, title linked to `url` (covers: REQ-7)
- [x] a Contact section renders a `mailto:` link to `contact.email` (covers: REQ-8)
- [x] `<title>` is `name` (covers: REQ-9)
- [x] sections appear in the order h1+tagline → About → Projects → Contact (covers: REQ-10)
- [x] the CSS is one inline `<style>` in `<head>`; no `<link>` element (covers: REQ-3)
- [x] the output contains no `<script`, no ` on…=` attribute and no `javascript:` (a `javascript:` url renders its title as plain text) (covers: REQ-12)
- [x] two runs over the same content give byte-identical files (covers: REQ-20)

### 🔁 Inverse Conditions
- [x] a project with no `url` (or an empty one) renders its title with no `<a>`; the page has no `href="#"` and no `href=""` (covers: REQ-15)

### 📭 Empty & Null States
- [x] `projects: []` or no `projects` → "Projects are coming soon." and no `<ul>`/`<ol>`/`<li>` (covers: REQ-16)
- [x] a missing `tagline`, `about`, `summary` or `contact` renders empty, with no `undefined` or `null` text in the page (covers: REQ-4)

### 🔢 Boundary Values
- [x] a title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; `"` and `'` are escaped inside `href` values (covers: REQ-17)

## Implementation Notes
- One `escape()` for text and attributes: `&` first, then `<`, `>`, `"`, `'`.
- No timestamp or generator comment with a date; end the file with exactly one `\n`.

## Non-Go (not in this task)
- Markdown in `about`, themes, images, multiple pages.


## Execution Log — 2026-11-07 (personal-site/site-build-r1-a1)
- executor: task-executor via ingest-result
- status: done
- the content model `name`, `tagline`, `about`, `projects[{title, summary, url}]`, `contact{email}` is read; only `name` is required (covers: REQ-4): pass (render reads name/tagline/about/projects[{title,summary,url}]/contact.email; only name validated as required; {name:"A"} builds exit 0 (TS-INV-07); node --test test/build.test.mjs -> 13/13 pass)
- the page's only `<h1>` is `name` and the tagline follows it (covers: REQ-5): pass (TS-INV-05: exactly one <h1>, equal to <h1>Ada Lovelace</h1>, tagline index after it; node --test test/build.test.mjs -> 13/13 pass)
- an About section renders `about` as one paragraph (covers: REQ-6): pass (TS-INV-05: about text appears inside the About section after <h2>About</h2> as one <p>; node --test test/build.test.mjs -> 13/13 pass)
- a Projects section renders one card per project, title linked to `url` (covers: REQ-7): pass (TS-INV-05: <a href="https://example.com/engine">Engine</a> inside an article.card per project; node --test test/build.test.mjs -> 13/13 pass)
- a Contact section renders a `mailto:` link to `contact.email` (covers: REQ-8): pass (TS-INV-05: output contains <a href="mailto:ada@example.com">; node --test test/build.test.mjs -> 13/13 pass)
- `<title>` is `name` (covers: REQ-9): pass (TS-INV-05: <title>Ada Lovelace</title>; node --test test/build.test.mjs -> 13/13 pass)
- sections appear in the order h1+tagline → About → Projects → Contact (covers: REQ-10): pass (TS-INV-05: index order h1 < tagline < About < about text < Projects < Contact; node --test test/build.test.mjs -> 13/13 pass)
- the CSS is one inline `<style>` in `<head>`; no `<link>` element (covers: REQ-3): pass (TS-INV-05: exactly one <style> before </head>, no <link; node --test test/build.test.mjs -> 13/13 pass)
- the output contains no `<script`, no ` on…=` attribute and no `javascript:` (a `javascript:` url renders its title as plain text) (covers: REQ-12): pass (TS-INV-01: javascript:alert(1) and " JaVa<TAB>Script:alert(1)" urls -> no <script, no on*= attribute, no javascript:, no <a>, titles present as text; node --test test/build.test.mjs -> 13/13 pass)
- two runs over the same content give byte-identical files (covers: REQ-20): pass (TS-INV-03: Buffer.compare of two runs == 0, file ends with exactly one newline; node --test test/build.test.mjs -> 13/13 pass)
- a project with no `url` (or an empty one) renders its title with no `<a>`; the page has no `href="#"` and no `href=""` (covers: REQ-15): pass (TS-INV-06: url absent and url "" -> no <a>, no href="#", no href=""; node --test test/build.test.mjs -> 13/13 pass)
- `projects: []` or no `projects` → "Projects are coming soon." and no `<ul>`/`<ol>`/`<li>` (covers: REQ-16): pass (TS-INV-07: projects [] and projects absent -> "Projects are coming soon.", no ul/ol/li; node --test test/build.test.mjs -> 13/13 pass)
- a missing `tagline`, `about`, `summary` or `contact` renders empty, with no `undefined` or `null` text in the page (covers: REQ-4): pass (TS-INV-06/TS-INV-07/TS-INV-05 assert no undefined/null text with tagline, about, summary, contact absent; node --test test/build.test.mjs -> 13/13 pass)
- a title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; `"` and `'` are escaped inside `href` values (covers: REQ-17): pass (TS-INV-04: &lt;b&gt;Rock &amp; Roll&lt;/b&gt; present, no <b>; href="https://x.test/?q=&quot;a&#39;b" and href="mailto:x&quot;y@example.com"; node --test test/build.test.mjs -> 13/13 pass)
