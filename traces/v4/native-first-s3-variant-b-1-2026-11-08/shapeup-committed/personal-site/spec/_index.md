---
type: pitch
feature: personal-site
appetite: "small batch — one build round"
status: ready
lens: lite
bounded_context: site-publishing
entities: [SiteContent, Project, Contact]
tags: [static-site, cli, node]
---

# Pitch: a one-page personal website, built from one content file

## Problem
A freelancer keeps their portfolio in a slide deck and sends a PDF copy. They want a real web page
they can host anywhere, without a framework, a build service or a CMS: edit one small content file,
get one page.

## Appetite
**Small batch — one build round.** If scope grows beyond this, cut, do not extend.

## Boundaries

### In Scope
- `node build.mjs` — a zero-dependency Node ESM script, `node:` builtins only, no network.
- Reads `content.json` (or `$CONTENT_FILE`), writes one static `dist/index.html` (or `$OUT_DIR/index.html`).
- CSS inline in a `<style>` element; no JavaScript in the generated page.
- Page order: `<h1>` name + tagline → About → Projects (one card each) → Contact (`mailto:`); `<title>` = name.
- Edge behaviour: no-`url` project as plain text; empty projects sentence; HTML escaping; exit 1 with
  one stderr line and nothing written on a missing/unparseable file or a missing `name`; byte-identical reruns.
- A `node --test` suite driving the script over temporary content files.

### Non-Go
- Markdown in `about`, themes, multiple pages, images, any tracking or serving mode.
- Library dependencies of any kind; network calls; JavaScript in the page.
- Writing to the content file.

## Solution Elements

### Breadboarding
No breadboard was given; the one "screen" is the generated page.
```
content.json ──node build.mjs──► validate ──ok──► render ──► dist/index.html
                                    │
                                    └─fail─► stderr (1 line), exit 1, nothing written
```

### Key Interactions
1. The freelancer edits `content.json` and runs `node build.mjs`.
2. A broken or incomplete content file is reported in one stderr line and leaves no output.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| A bare `node --test` passes over zero tests, so a missing suite would read green | high | the build probe names the test file explicitly |
| Escaping missed in attribute values (`href`, `mailto:`) | med | one escape function used for text and attributes; Test Surface row |
| A `javascript:` project URL puts JavaScript into the page | low | only `http:`/`https:`/relative URLs become links (INV-01) |
| Partial output on the error path | med | validate fully before any directory or file is created |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ✅ ready |
| [[ux-behavior]] | UX Spec (central, lite lens) | ✅ ready |
| [[usecases/_index]] | Use Cases | ✅ ready |
| [[usecases/UC-BuildPage]] | Use Case | ✅ ready |
