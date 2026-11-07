---
type: ux-spec
feature: personal-site
entities: [SiteContent, Project, Contact]
usecases: [UC-BuildSite]
screens: [PersonalPage]
tags: [ux]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX Behavior — personal-site

## Screen Flow
```
content.json ──node build.mjs──► dist/index.html (PersonalPage)
```

## Screen: PersonalPage

**Figma Frame**: none (no mocks).

**Visual & Layout Specs**: one column, sections stacked in this fixed order:
1. header — `<h1>` with the name, tagline directly under it
2. About section — the `about` paragraph
3. Projects section — one card per project (title, summary)
4. Contact section — a `mailto:` link to `contact.email`

**Design Tokens**: inline `<style>` only; no external stylesheet, no `<script>` (readable with JavaScript off).

### States

| State | Condition | Rendered |
|---|---|---|
| projects-present | `projects.length ≥ 1` | one card per project, in array order |
| projects-empty | `projects.length = 0` | Projects section with the sentence "Projects are coming soon." and no list element |
| project-linked | project has `url` | title is `<a href="url">` |
| project-unlinked | project has no `url` | title is plain text; no `<a>`, no `href="#"`, no empty `href` |

### Behavior Rules
- Exactly one `<h1>` on the page; `<title>` equals the name.
- Every string from `content.json` appears as text: `<b>Rock & Roll</b>` shows literally.

### Error States

| Error | Surface | Action |
|---|---|---|
| content file missing / unparsable | stderr, one line, exit 1 | fix `content.json`, rerun |
| `name` missing | stderr, one line, exit 1 | add `name`, rerun |
