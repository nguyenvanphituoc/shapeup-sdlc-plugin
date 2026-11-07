---
type: domain-model
feature: one-page-site
bounded_context: SiteBuild
entities: [SiteContent]
value_objects: [Project, Contact]
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: draft
---

# Domain Model: one-page personal website

## Bounded Context
`SiteBuild` context — owns turning one content file into one static HTML page. It does not own
serving, hosting, theming or authoring the content.

## SiteContent (entity, new)
Read from the content file (`content.json` by default, `$CONTENT_FILE` when set). Never written.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | the page's only `<h1>` and its `<title>` |
| `tagline` | string | — | shown below the `<h1>` |
| `about` | string | — | one paragraph, rendered as text (no Markdown) |
| `projects` | Project[] | — | zero or more |
| `contact` | Contact | — | |

## Project (value object)
`{ title: string, summary: string, url?: string }` — with a `url` the title is a link to it; without
one the title is plain text.

## Contact (value object)
`{ email: string }` — rendered as a `mailto:` link.

## Rules
- Every text value from the content file is HTML-escaped before it is placed in the page.
- Validation (file present, JSON parses, `name` present) completes before anything is written.

## Repositories
None — the content file is read with `node:fs`; the output is one file write. No library dependencies,
no network.

## Spec gap (raised, not filled)
The pitch names only `name` as required and is silent on an absent `tagline`, `about`, `contact` or
`contact.email`, and on a non-string `name`. No behavior is specified for those cases here.
