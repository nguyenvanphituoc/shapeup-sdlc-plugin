---
schema_version: 1
feature: personal-site
entry_point: build.mjs
---

# Wiring map — personal-site

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-BuildSite | build.mjs | CLI script: top-level code runs load → validate → render → write when invoked by `node build.mjs` | build.mjs — module top level (the entry point is the engine) | `node build.mjs` writes `dist/index.html` |

## Deviations

The entry point and the engine are the same file: the pitch names one zero-dependency script, so there is
no separate composition root to attach to.
