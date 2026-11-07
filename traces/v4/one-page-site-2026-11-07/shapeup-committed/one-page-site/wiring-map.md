---
schema_version: 1
feature: one-page-site
entry_point: build.mjs
---

# Wiring map: One-page site

Entry point echoes the project profile (`build.mjs`, archetype `cli`).

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-BuildSite | src/render.mjs | build.mjs imports renderPage and calls it on the loaded SiteContent, then writes the returned string once to the output dir | build.mjs - main flow after content load | `node build.mjs` writes dist/index.html |
| UC-RejectInvalidContent | src/content.mjs | build.mjs imports loadContent and calls it first; a thrown BuildFailure is caught in build.mjs, which prints one stderr line and exits 1 before any write | build.mjs - main flow start, wrapped in a try/catch | `node build.mjs` on bad content exits 1 with one stderr line, nothing written |

## Deviations

- The spec names no engine module paths. `src/content.mjs` (ContentSource: read, parse, validate) and `src/render.mjs` (render to HTML string) are inferred from the System Flow; the builder may rename them but each must stay imported by `build.mjs`.
- UC-BuildSite also depends on `src/content.mjs` for loading; it is mapped under UC-RejectInvalidContent, which owns validation.
- Both seams are the same composition root (`build.mjs`), so scopes that both write it will serialize.
