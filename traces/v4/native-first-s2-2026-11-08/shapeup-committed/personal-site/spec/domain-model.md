---
type: domain-model
feature: personal-site
bounded_context: site-generation
entities: [SiteContent, Project]
value_objects: [Contact, EscapedText, BuildPaths]
domain_events: []
repositories: [ContentSource, PageSink]
tags: [ddd]
depends_on: ["[[_index]]"]
status: ready
---

# Domain Model — personal-site

## Bounded Context
`site-generation`: one context, one process. Content in, one HTML document out. No persistence beyond
reading one JSON file and writing one HTML file.

## Aggregates

### Aggregate-SiteContent (new)
The parsed `content.json`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Page `<title>` and the only `<h1>` |
| `tagline` | string | no | Rendered below the `<h1>` |
| `about` | string | no | One paragraph, plain text (no Markdown) |
| `projects` | Project[] | no | Absent or empty → "Projects are coming soon." |
| `contact` | Contact | no | `contact.email` → `mailto:` link |

Invariant: a SiteContent without a `name` is never rendered (see [[usecases/UC-BuildSite#Error Cases]]).

### Entity-Project
| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes (for display) | Link text when `url` is present, plain text otherwise |
| `summary` | string | no | Card body |
| `url` | string | no | Absent or empty → no `<a>` at all (never `href="#"` or `href=""`) |

## Value Objects

| Value Object | Shape | Rule |
|---|---|---|
| Contact | `{ email: string }` | Rendered as `<a href="mailto:<email>">` |
| EscapedText | string | Every content string is HTML-escaped (`& < > " '`) before it reaches the document |
| BuildPaths | `{ contentFile, outDir }` | `contentFile` = `$CONTENT_FILE` or `content.json`; `outDir` = `$OUT_DIR` or `dist` |

## Domain Events
None. The build is a single synchronous pass.

## Repository Interfaces

```typescript
interface ContentSource {
  // reads and parses BuildPaths.contentFile; read-only, never writes the file
  load(path: string): SiteContent; // throws CONTENT_MISSING | CONTENT_INVALID_JSON
}

interface PageSink {
  // writes <outDir>/index.html; called only after validation and rendering both succeed
  write(outDir: string, html: string): void;
}
```
