---
type: integration
feature: one-page-site
tags: [integration]
depends_on: ["[[domain-model]]"]
status: draft
---

# Integration Map: One-page site

No cross-system flows. The build touches the local filesystem only.

## Data flow

```
$CONTENT_FILE | content.json ──read──► build.mjs ──write once──► $OUT_DIR/index.html | dist/index.html
```

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `CONTENT_FILE` | override input path | `content.json` |
| `OUT_DIR` | override output directory | `dist` |

## Silent-failure risks

- A failed build must not leave a partial file: validate and render in memory, write last.
- A stale `dist/index.html` from an earlier good run is not removed by a failing build; tests check failure against a fresh `OUT_DIR`.
- No network access and no dependencies (Node built-ins only).

## Events
None.
