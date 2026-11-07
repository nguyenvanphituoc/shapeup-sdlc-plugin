---
type: domain-model
feature: one-page-site
bounded_context: SiteBuild
entities: [SiteContent, Project]
value_objects: [ContentPath, OutDir, BuildFailure]
domain_events: []
repositories: [ContentSource, PageSink]
tags: [ddd]
depends_on: ["[[_index]]"]
status: draft
---

# Domain Model: One-page site

## Bounded Context
`SiteBuild` — owns turning one content file into one static HTML page. It does not own hosting, content authoring, or any runtime behaviour of the page.

---

## Aggregate: SiteContent (new)

**Aggregate Root:** `SiteContent`

**Invariants:**
- `name` is a non-empty string; without it no SiteContent exists.
- `projects` is an array (absent is treated as empty); each Project has a `title`.
- A SiteContent is only ever read, never written back.

```
SiteContent (Aggregate Root)
├── name: string (required)
├── tagline: string (optional)
├── about: string (optional, one paragraph, plain text)
├── contact: { email: string } (optional)
└── projects: Project[]
    ├── title: string
    ├── summary: string (optional)
    └── url: string (optional)
```

**State Transitions:**
```
file ──parse──► raw JSON ──validate──► SiteContent ──render──► html string ──write──► dist/index.html
   └─ any failure ──► BuildFailure (nothing written)
```

---

## Value Objects

| Value Object | Fields | Invariants |
|---|---|---|
| `ContentPath` | value: string | `$CONTENT_FILE` or `content.json`, resolved from cwd |
| `OutDir` | value: string | `$OUT_DIR` or `dist`; output file is `<OutDir>/index.html` |
| `BuildFailure` | reason: string | Rendered as one stderr line; exit code 1 |

---

## Domain Events

None — a synchronous one-shot build.

---

## Repository Interfaces

```typescript
interface ContentSource {
  load(path: ContentPath): SiteContent   // throws BuildFailure
}
interface PageSink {
  write(dir: OutDir, html: string): void // called only after full validation and render
}
```

---

## Related
- [[ux-behavior]] — page sections and CLI outcomes
- [[usecases/_index]] — use cases operating on this aggregate
