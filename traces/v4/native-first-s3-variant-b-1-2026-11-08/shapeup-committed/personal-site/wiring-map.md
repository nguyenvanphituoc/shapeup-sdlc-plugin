---
schema_version: 1
feature: personal-site
entry_point: build.mjs
---

# Wiring map — personal-site

The archetype is `library` with a single-file CLI as its composition root: the engine *is* the entry
point. `node build.mjs` runs top-level code that resolves paths, loads and validates the content,
calls `render(content)` and writes the page — so the render function is reachable only through that
top-level call, which the build must create.

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-BuildPage | build.mjs | top-level script body: resolve env paths → load + validate content → call render(content) → write index.html | build.mjs — top-level main flow run by `node build.mjs` | `node build.mjs` writes `<OUT_DIR\|dist>/index.html` |

## Deviations
- Engine and entry point are the same file by design (the pitch names one script, no dependencies);
  the seam to verify is that `render` is called from the top-level flow, not merely defined.
