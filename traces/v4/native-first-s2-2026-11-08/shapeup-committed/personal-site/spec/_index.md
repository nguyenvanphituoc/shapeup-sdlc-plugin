---
type: pitch
feature: personal-site
lens: lite
appetite: "small batch — one build round (~1 week)"
status: ready
bounded_context: site-generation
entities: [SiteContent, Project]
tags: [static-site, node, cli]
---

# personal-site — Pitch Digest

## Problem
A freelancer keeps their portfolio in a slide deck and mails a PDF. They want a real web page they can
host anywhere, with no framework, no build service and no CMS: edit one small content file, get one page.

## Appetite
Small batch: one build round (~1 week).

## Boundaries
- In: a zero-dependency Node script `node build.mjs` that reads `content.json` (or `$CONTENT_FILE`) and
  writes one static `dist/index.html` (or `$OUT_DIR/index.html`), with inline CSS and no JavaScript.
- In: the edge behaviour the pitch names (no-url project, no projects, HTML escaping, missing or
  unparseable content, missing `name`, byte-identical re-runs).
- In: a `node --test` suite that drives the script over temporary content files.
- Out: everything under Rabbit Holes.

## Breadboarding
No separate breadboard. The only "place" is the generated page, specified in [[ux-behavior]].

## Rabbit Holes
Markdown in `about`, themes, multiple pages, images, and any tracking or serving mode.

## Document Map
- [[domain-model]] — the content model and the render/validate seam
- [[ux-behavior]] — the generated page (central document for the lite lens)
- [[usecases/_index]] — use case index
- [[usecases/UC-BuildSite]] — the one use case: the freelancer builds the page
- Requirements registry: `shapeup/personal-site/requirements.md`
