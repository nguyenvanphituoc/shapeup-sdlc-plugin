---
type: domain-model
feature: personal-site
bounded_context: site-generation
entities: [SiteContent, Project, Contact]
value_objects: [EscapedText]
domain_events: []
repositories: [ContentSource, PageSink]
tags: [ddd]
depends_on: ["[[_index]]"]
status: ready
---

# Domain Model — personal-site

## Bounded Context
**site-generation** — one script turns a content file into one static page. No other context.

## Aggregates

### Aggregate: SiteContent (new)
Root of `content.json`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | page `<title>` and the one `<h1>` |
| `tagline` | string | per pitch | shown under the `<h1>` |
| `about` | string | per pitch | one paragraph, rendered as text (no Markdown — NOGO-01) |
| `projects` | Project[] | per pitch | zero → "Projects are coming soon." |
| `contact` | Contact | per pitch | `mailto:` link |

### Entity: Project
`{ title: string, summary: string, url?: string }` — a project with no `url` renders its title as plain text.

### Entity: Contact
`{ email: string }`.

## Value Objects

| Value Object | Rule |
|---|---|
| EscapedText | every string from `content.json` is HTML-escaped before it reaches the page, attribute values included |

## Domain Events

| Event | Emitted by | Notes |
|---|---|---|
| — | — | none; a single synchronous build |

## Repository Interfaces

```typescript
interface ContentSource {
  // reads $CONTENT_FILE (default ./content.json); throws ContentMissing | ContentInvalidJson
  load(): SiteContent;
}

interface PageSink {
  // writes <$OUT_DIR or ./dist>/index.html; called only after validation passed
  write(html: string): void;
}
```
