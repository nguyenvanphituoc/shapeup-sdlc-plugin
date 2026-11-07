---
schema_version: 1
feature: one-page-site
entry_point: build.mjs
---

# Wiring map — one-page-site

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-BuildPage | build.mjs | CLI command: the module's top-level code runs read → validate → render → write when invoked by `node build.mjs` | build.mjs — top-level script body | `node build.mjs` writes `dist/index.html` (or `$OUT_DIR/index.html`) |

## Deviations

The engine and the entry point are the same file: the pitch fixes the deliverable as a single
zero-dependency script, so there is no separate module to attach.
