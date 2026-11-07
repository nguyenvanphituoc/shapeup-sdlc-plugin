---
type: pitch
feature: one-page-site
appetite: "single build round"
status: draft
bounded_context: SiteBuild
entities: [SiteContent, Project]
tags: [cli, static-site]
skill_version: "2.5"
audit_rules_version: "2.5"
---

# Pitch: One-page personal site, built from a content file

## Problem
A freelancer keeps a portfolio in a slide deck and sends a PDF. They want a real, host-anywhere web page without a framework, build service or CMS: edit one small content file, get a page.

## Appetite
**Single build round** — if scope grows, cut features, do not extend.

## Boundaries

### In Scope
- `node build.mjs` reads `content.json` and writes one static `dist/index.html` (inline CSS, no script).
- Sections in order: name (`<h1>`) + tagline, About, Projects (card per project), Contact (`mailto:`); `<title>` is the name.
- Edge behaviour: url-less project, zero projects, HTML escaping, missing/unparsable content, missing `name`, deterministic output.
- `$CONTENT_FILE` / `$OUT_DIR` overrides; `node --test` verification.

### Non-Go
- No dependencies, no network calls, no JavaScript in the generated page.
- No overwriting `content.json`.
- No markdown in `about`, themes, multiple pages, images, watch or serve mode.

## Solution Elements

### Breadboarding
No separate breadboard (CLI). The only surface is the generated page and the CLI exit/stderr contract.

```
content.json ──node build.mjs──► validate ──ok──► render ──► dist/index.html
                                    └─ invalid ─► stderr (one line) + exit 1, nothing written
```

### Key Interactions
1. Freelancer edits `content.json`, runs `node build.mjs`, opens `dist/index.html`.
2. Invalid input: one-line stderr message, exit 1, no output file.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Failure leaves a partial or stale output file | med | Validate and render fully in memory before any write |
| `javascript:` url violates "no JavaScript" | med | Allowlist url schemes (http, https); other schemes render the title as plain text |
| Valid JSON of the wrong shape slips through | med | Shape validation (object, non-empty string `name`, `projects` array) |
| Multi-line stderr | low | Fixed-prefix single-line message, never raw `err.message` |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ⬜ draft |
| [[ux-behavior]] | UX Spec | ⬜ draft |
| [[usecases/_index]] | Use Cases | ⬜ draft |
| [[integration]] | Integration Map | ⬜ draft |
| [[scope-summary]] | Scope Summary | ⬜ draft |
| [[synthesis]] | Health Dashboard + Traceability + Risk + Dependency | ⬜ draft |
| [[feedback]] | Post-Sprint Feedback | ⬜ pending |

---

## Audit Report

*Generated from harness verify spec output — do not edit manually.*

### Execution Gate
⬜ *Pending audit*
