---
schema_version: 1
feature: one-page-site
entry_point: build.mjs
---

# Wiring map — one-page-site

The project is a single-file CLI: the entry point is also the engine. Both use cases run on the same
`node build.mjs` invocation; the rejection path is the validation stage that runs before any write.

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-BuildSite | build.mjs | CLI top-level: main() loads content, renders in memory, writes index.html once | build.mjs — top-level main() invocation | `node build.mjs` → `dist/index.html` (or `$OUT_DIR/index.html`) |
| UC-RejectInvalidContent | build.mjs | CLI top-level: main() validates before rendering; caught error → one stderr line, exit 1 | build.mjs — top-level main() invocation, catch branch | `node build.mjs` on bad content → one stderr line, exit 1, nothing written |

## Deviations
None. Engine and entry point coincide by design (zero-dependency single script, per the pitch).
