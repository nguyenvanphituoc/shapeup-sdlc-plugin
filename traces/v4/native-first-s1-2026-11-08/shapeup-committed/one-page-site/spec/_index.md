---
type: pitch
feature: one-page-site
appetite: "small batch — one build round"
status: draft
bounded_context: SiteBuild
entities: [SiteContent, Project]
tags: []
skill_version: "2.5"
audit_rules_version: "2.5"
---

# Pitch: one-page personal website, built from one content file

## Problem
A freelancer keeps their portfolio in a slide deck and sends a PDF. They want a real web page with no
framework, build service or CMS: edit one small content file, get a page.

## Appetite
**small batch — one build round** — if scope grows beyond this, cut features, do not extend timeline.

## Boundaries

### In Scope
- `node build.mjs` reads `content.json` (or `$CONTENT_FILE`) and writes one static `dist/index.html`
  (or `$OUT_DIR/index.html`) with inline CSS and no JavaScript.
- Page order: name (`<h1>`) + tagline, About, Projects (one card per project), Contact (`mailto:`).
- Edge behavior: url-less project, empty projects, HTML escaping, missing/unparseable content,
  missing `name`, byte-identical re-runs.
- A `node --test` test file driving the script over temporary content files.

### Non-Go
- Markdown in `about`, themes, multiple pages, images, tracking or serving mode.
- Library dependencies, network calls, writing to `content.json`.

## Solution Elements
- [[domain-model]] — SiteContent and Project value shapes.
- [[ux-behavior]] — the one generated page.
- [[usecases/UC-BuildPage]] — the owner builds the page.

## Document Map
| Doc | Purpose |
|---|---|
| [[domain-model]] | content shape, validation rule |
| [[ux-behavior]] | the generated page's sections and states |
| [[usecases/UC-BuildPage]] | steps, invariants, error cases, Test Surface |

Requirements registry: `shapeup/one-page-site/requirements.md`.
