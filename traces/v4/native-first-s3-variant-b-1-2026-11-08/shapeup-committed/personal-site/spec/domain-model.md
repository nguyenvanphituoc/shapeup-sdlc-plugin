---
type: domain-model
feature: personal-site
lens: lite
bounded_context: site-publishing
entities: [SiteContent, Project, Contact]
value_objects: [EscapedText, ContentPath, OutputPath]
domain_events: []
repositories: [ContentSource, PageSink]
tags: [ddd]
depends_on: ["[[_index]]"]
status: ready
---

# Domain Model — personal-site

## Bounded Context
**site-publishing** — turning one content document into one static page. Single context, no
third party, no persistence beyond two files on disk.

## Aggregates

### SiteContent (new)
The parsed content file. Root of the only aggregate.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string (non-empty) | **yes** | the page `<title>` and its only `<h1>` |
| `tagline` | string | no | rendered below the `<h1>` |
| `about` | string | no | one paragraph, rendered as plain text (no Markdown) |
| `projects` | `Project[]` | no | absent or `[]` → the "Projects are coming soon." sentence |
| `contact` | `Contact` | no | `{ email }` → a `mailto:` link |

Only `name` is named as required by the pitch; every other field, when absent, renders as empty
(the section heading stays, its content is empty), never as an error.

### Project (entity inside SiteContent)
`{ title: string, summary?: string, url?: string }` — rendered as one card. `url` present and of an
allowed scheme → the title is a link; otherwise the title is plain text.

### Contact (value inside SiteContent)
`{ email?: string }` — rendered as `<a href="mailto:…">…</a>` when `email` is present.

## Value Objects

| Value Object | Rule |
|---|---|
| `EscapedText` | every content string, in text and in attribute values, has `&`, `<`, `>`, `"`, `'` replaced by entities |
| `ContentPath` | `$CONTENT_FILE` if set, else `content.json`; resolved against the working directory |
| `OutputPath` | `$OUT_DIR` if set, else `dist`; the file is `<OutputPath>/index.html`; the directory is created on success only |

## Domain Events
None — a single synchronous build.

## Repository Interfaces

```typescript
interface ContentSource {
  /** Read and parse ContentPath. Throws CONTENT_MISSING | CONTENT_UNPARSEABLE. Never writes. */
  load(path: string): unknown;
}

interface PageSink {
  /** Create the output directory if absent and write index.html. Called only after validation. */
  write(outDir: string, html: string): void;
}
```
