---
type: ux-spec
feature: personal-site
entities: [SiteContent, Project]
usecases: [UC-BuildSite]
screens: [PortfolioPage]
tags: [ux]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX Behavior — personal-site

## Screen Flow

```
freelancer edits content.json
        │
        ▼
  node build.mjs ──(invalid / missing / no name)──► stderr: one line, exit 1, no file written
        │
        ▼ (valid)
  dist/index.html  ──►  PortfolioPage (opened in any browser, no JS)
```

## Screen: PortfolioPage

- **Figma Frame**: none (no mocks exist).
- **Visual & Layout Specs**: one centred column (max width ~40rem), sections stacked vertically in the
  fixed order Header → About → Projects → Contact; project cards stacked one per row. Readable on desktop
  and mobile without media queries.
- **Design Tokens**: CSS lives in one inline `<style>` element in `<head>`; no external stylesheet, no
  `<script>` element, no inline event handlers.

### Document structure (render order)
1. `<title>` = `name`
2. Header: `<h1>` = `name` (the only `<h1>` in the document), tagline directly below it
3. About section: the `about` paragraph
4. Projects section: one card per project; the card title is `<a href="<url>">` when `url` is present
5. Contact section: `<a href="mailto:<email>">`

### States

| State | Condition | What renders |
|---|---|---|
| Populated | `projects` has ≥ 1 item | One card per project, in input order |
| Empty projects | `projects` absent or `[]` | The sentence "Projects are coming soon." and no list element |
| Project without url | a project's `url` is absent or empty | The title as plain text; no `<a>`, no `href="#"`, no empty `href` |

### Behavior Rules
- Every string from `content.json` is HTML-escaped: `<b>Rock & Roll</b>` shows as literal text.
- The same input produces byte-identical output (no timestamps, no random ids).
- The page contains no JavaScript.

### Error States

| Error | Trigger | Message (stderr, one line) | Action |
|---|---|---|---|
| `CONTENT_MISSING` | content file does not exist | names the missing file | exit 1, nothing written |
| `CONTENT_INVALID_JSON` | content file is not valid JSON | names the parse problem | exit 1, nothing written |
| `NAME_MISSING` | `name` is absent | names the missing field `name` | exit 1, nothing written |
