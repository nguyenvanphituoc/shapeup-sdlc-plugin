---
type: domain-model
feature: one-page-site
bounded_context: SiteBuild
entities: [SiteContent, Project]
repositories: [ContentSource, PageSink]
tags: [ddd]
depends_on: ["[[_index]]"]
status: draft
---

# Domain Model: SiteBuild

## Bounded Context: SiteBuild
Turns one content file into one static HTML page. No persistence beyond the filesystem.

## Aggregates

### SiteContent (new)
- `name: string` — required, non-empty.
- `tagline?: string`, `about?: string` — optional text.
- `projects?: Project[]` — absent or `[]` both mean zero projects; array order is display order.
- `contact?: { email?: string }` — optional.
- Invariant: constructed only from a plain JSON object whose `name` is a non-empty string.

### Project (value object)
- `title: string`, `summary?: string`, `url?: string`.
- `isLinkable` — true only when `url` is a non-blank `http:` or `https:` url.

## Repositories

| Interface | Method | Backing |
|---|---|---|
| ContentSource | `load(path) → SiteContent` (throws a one-line error) | `$CONTENT_FILE` or `content.json`, read-only |
| PageSink | `write(dir, html)` | `$OUT_DIR` or `dist`, writes `index.html` once |

## Domain Events
None.

## Links
- [[contracts/content-file.contract]]
- [[usecases/UC-BuildSite]] · [[usecases/UC-RejectInvalidContent]]
