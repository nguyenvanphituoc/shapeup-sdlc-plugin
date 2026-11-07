---
type: ux-spec
feature: one-page-site
entities: [SiteContent, Project]
usecases: [UC-BuildSite, UC-RejectInvalidContent]
screens: [GeneratedPage, BuildOutcome]
tags: [ux]
depends_on: ["[[domain-model]]"]
status: draft
---

# UX Behavior: One-page site

## Screen Flow

```
[BuildOutcome] ── valid content ──► [GeneratedPage]  (dist/index.html)
      └───────── invalid content ──► stderr line, exit 1, no page
```

---

## Screen: GeneratedPage

Static document, no script. Order: h1 name + tagline, About, Projects, Contact.

### States

| State | Trigger | UI Behavior | CTA |
|-------|---------|-------------|-----|
| `with-projects` | `projects` non-empty | one card per project, in array order; title is a link when `url` is an allowed http(s) url, else plain text | — |
| `no-projects` | `projects` empty or absent | Projects section shows "Projects are coming soon."; no list element | — |
| `contact-shown` | `contact.email` present | `mailto:` link | link |

### Behavior Rules

- [RULE-01] The name is the page's only `<h1>` and the `<title>`; the tagline sits under it.
- [RULE-02] All content text and attribute values are HTML-escaped (`& < > " '`); `<b>Rock & Roll</b>` shows as text.
- [RULE-03] A project with no `url` never renders `href="#"` or an empty href.
- [RULE-04] CSS is inline in the document; no `<script>`, no external resource.
- [RULE-05] Output depends only on the content: no timestamps or randomness, so two builds are byte-identical.

### Error Catalog

None on the page itself; build failures are on BuildOutcome.

---

## Screen: BuildOutcome

CLI result of `node build.mjs`.

### States

| State | Trigger | UI Behavior | CTA |
|-------|---------|-------------|-----|
| `success` | valid content | exit 0, `dist/index.html` written | — |
| `failure` | any invalid input | exactly one stderr line, exit 1, no file written | fix `content.json` |

### Behavior Rules

- [RULE-01] The stderr line is built from a fixed prefix, never raw `err.message`, so it is always one line.

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `CONTENT_MISSING` | content file absent/unreadable | `build: cannot read content file` | create it |
| `CONTENT_INVALID_JSON` | not parsable | `build: content file is not valid JSON` | fix JSON |
| `CONTENT_BAD_SHAPE` | not an object, or `projects` not an array | `build: content file has the wrong shape` | fix shape |
| `NAME_MISSING` | `name` missing or empty | `build: missing required field: name` | add name |

---

## Platform Differences

| Behavior | Mobile | Web |
|---|---|---|
| Page | same static file | same static file |
