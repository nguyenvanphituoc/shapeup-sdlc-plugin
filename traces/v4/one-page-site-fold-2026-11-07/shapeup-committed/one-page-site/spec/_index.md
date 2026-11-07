---
type: pitch
feature: one-page-site
appetite: "small batch — a single build round"
status: draft
bounded_context: SiteBuild
entities: [SiteContent, Project]
tags: [cli, static-site]
---

# Pitch: One-page personal site, built from a content file

## Problem
A freelancer keeps a portfolio in a slide deck and sends a PDF. They want a real, host-anywhere web page
without a framework, build service or CMS: edit one small content file, get a page.

## Appetite
**Small batch — a single build round.** If scope grows, cut, do not extend.

## Boundaries

### In Scope
- `node build.mjs` reads `content.json` and writes one static `dist/index.html` (inline CSS, no script).
- Sections in order: name (`<h1>`) + tagline, About, Projects (one card per project), Contact (`mailto:`);
  `<title>` is the name.
- Edge behaviour: url-less project, zero projects, HTML escaping, missing/unparsable content, missing
  `name`, byte-identical rebuilds.
- `$CONTENT_FILE` / `$OUT_DIR` overrides; verification by `node --test`.

### Non-Go
- No dependencies, no network calls, no JavaScript in the generated page.
- No overwriting `content.json`.
- Rabbit holes left out: Markdown in `about`, themes, multiple pages, images, watch or serve mode.

## Solution Elements

### Breadboarding
No separate breadboard (CLI). The surfaces are the generated page and the CLI exit/stderr contract.

```
content.json ──node build.mjs──► validate ──ok──► render (in memory) ──► dist/index.html, exit 0
                                    └─ invalid ─► one stderr line, exit 1, nothing written
```

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Failure leaves a partial or stale output file | med | Validate and render fully in memory before any write |
| Valid JSON of the wrong shape (null, array) slips through | med | Root must be a plain object with a non-empty string `name` |
| A `javascript:` url puts script in the page | med | Only `http:`/`https:` urls become links; others render as plain text (derived from the no-JavaScript no-go) |
| Multi-line stderr / stack traces | low | Catch everything; print one fixed-prefix line |

## Open Questions (for the PO at Board Review)
- Missing `contact` / `contact.email`, `tagline`, `about`: the pitch names only `name` as required. The
  spec treats the others as optional and omits the element they would fill (the section heading stays).

## Document Map

| Document | Type |
|----------|------|
| [[domain-model]] | DDD Model |
| [[contracts/content-file.contract]] | Contract |
| [[ux-behavior]] | UX Spec |
| [[usecases/_index]] | Use Cases |
