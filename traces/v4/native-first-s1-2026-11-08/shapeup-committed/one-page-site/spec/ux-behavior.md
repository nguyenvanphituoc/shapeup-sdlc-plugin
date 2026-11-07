---
type: ux-spec
feature: one-page-site
entities: [SiteContent]
usecases: [UC-BuildPage]
screens: [GeneratedPage]
tags: [ux]
depends_on: ["[[domain-model]]"]
status: draft
---

# UX Behavior: one-page personal website

## Screen Flow

```
[terminal: node build.mjs]
    │
    ├─ content valid ──► [GeneratedPage]  (index.html written, exit 0)
    │
    └─ content missing / unparseable / no name ──► [stderr: one error line]  (exit 1, nothing written)
```

## GeneratedPage

A single static HTML document. Inline `<style>`; no `<script>`. `<title>` = name.

Section order, top to bottom:

1. Header — `<h1>` with the name (the page's only `<h1>`), tagline below it.
2. About — the `about` paragraph.
3. Projects — one card per project: title (a link to `url` when present, plain text when not) and
   summary.
4. Contact — a `mailto:` link to `contact.email`.

### States

| State | Condition | What the page shows |
|---|---|---|
| projects present | `projects` has ≥ 1 item | one card per project, in content order |
| no projects | `projects` empty or absent | the sentence "Projects are coming soon." and no list element |
| url-less project | a project has no `url` | its title as plain text — no `<a>`, no `href="#"`, no empty href |

### Error cases (terminal)

| Condition | Message | Action |
|---|---|---|
| content file missing | one stderr line naming the missing file | exit 1, no `index.html` written |
| content file not valid JSON | one stderr line naming the parse problem | exit 1, no `index.html` written |
| `name` missing | one stderr line naming `name` | exit 1, no `index.html` written |
