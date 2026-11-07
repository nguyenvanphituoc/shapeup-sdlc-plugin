---
type: ux-spec
feature: personal-site
lens: lite
entities: [SiteContent, Project, Contact]
usecases: [UC-BuildPage]
screens: [PersonalPage]
tags: [ux]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX Behaviour — personal-site

## Screen Flow

```
[terminal] node build.mjs
   ├─ content ok ─────► [PersonalPage] written to <OUT_DIR|dist>/index.html, exit 0, no stderr
   └─ content bad ────► one stderr line naming the problem, exit 1, no file written
```

## Screen: PersonalPage

The generated `index.html`. Static, readable with JavaScript disabled — it contains none.

### Visual & Layout Specs
- One column, centred, readable max width; sections stacked top to bottom in this fixed order:
  1. Header: `<h1>` = `name` (the only `<h1>` in the document), tagline in a paragraph directly below.
  2. About: a section with heading "About" and `about` as one paragraph of plain text.
  3. Projects: a section with heading "Projects" — one card per project, in the content file's order.
  4. Contact: a section with heading "Contact" and a `mailto:` link to `contact.email`.
- `<title>` = `name`.

### Design Tokens
- All CSS lives in one inline `<style>` element in `<head>`; no external stylesheet, no `<link>`, no font load.

### States

| State | Condition | What renders |
|---|---|---|
| projects-listed | `projects` has ≥ 1 item | a list of cards; each card shows the title (link or plain text) and the summary |
| projects-empty | `projects` absent or `[]` | the sentence "Projects are coming soon." and **no** list element |
| card-linked | project `url` present with an `http:`, `https:` or relative URL | the title is `<a href="url">title</a>` |
| card-unlinked | project `url` absent, empty, or any other scheme | the title is plain text — no `<a>`, no `href="#"`, no empty `href` |

### Behavior Rules
- Every content string is HTML-escaped wherever it appears, including inside `href` values.
- The page contains no `<script>` element, no `on*` event attribute and no `javascript:` URL.
- Output is a pure function of the content: no timestamp, no randomness, fixed key order, a single trailing newline.

### Error States

| Trigger | stderr (one line) | Exit | Output |
|---|---|---|---|
| content file missing | names the missing path | 1 | not written |
| content file not valid JSON | names the file and that it cannot be parsed | 1 | not written |
| `name` missing or not a non-empty string | names the `name` field | 1 | not written |
