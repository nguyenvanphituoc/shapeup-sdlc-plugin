---
type: pitch
feature: personal-site
appetite: "small batch — a single build round"
status: ready
bounded_context: site-generation
entities: [SiteContent, Project, Contact]
tags: [static-site, node, cli]
---

# Pitch: A one-page personal site, built from a content file

Source: `pitch.md` (committed, project root). Requirements registry: `shapeup/personal-site/requirements.md`.

## Problem
A freelancer keeps their portfolio in a slide deck and sends a PDF. They want a real web page they can
host anywhere, with no framework, build service or CMS: edit one small content file, get a page.

## Appetite
**Small batch — a single build round.** If scope grows, cut; do not extend.

## Boundaries

### In Scope
- `node build.mjs` (zero dependencies) reads `content.json`, writes `dist/index.html` (inline CSS, no JS needed).
- `$CONTENT_FILE` / `$OUT_DIR` overrides.
- Sections in order: `<h1>` name + tagline, About, Projects (cards), Contact (`mailto:`); `<title>` = name.
- Edge behaviour: no-url project is plain text; zero projects → "Projects are coming soon."; HTML escaping;
  missing/unparsable content or missing `name` → exit 1, one stderr line, nothing written; deterministic output.

### Non-Go
- [NOGO-01] Markdown in `about`
- [NOGO-02] Themes
- [NOGO-03] Multiple pages
- [NOGO-04] Images
- [NOGO-05] Any watch or serve mode

## Solution Elements

### Breadboarding
No breadboard was supplied; the single output page is the only screen.
```
[content.json] ──node build.mjs──► [dist/index.html]
                      │
                 invalid → exit 1, one stderr line, nothing written
```

### Key Interactions
1. Owner edits `content.json`, runs `node build.mjs`, gets `dist/index.html`.
2. Owner makes a mistake in `content.json`; the build refuses with one line naming the problem.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Unescaped text in attributes (`href`, `mailto:`) | med | one escape helper applied to every interpolated string |
| Partial write on failure | low | validate fully before any directory or file is created |
| Non-deterministic output | low | no timestamps; iterate arrays only; fixed trailing newline |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ready |
| [[ux-behavior]] | UX Spec | ready |
| [[contracts/build-cli.contract]] | CLI Contract | ready |
| [[usecases/_index]] | Use Cases | ready |
