---
schema_version: 1
feature: personal-site
entry_point: build.mjs
---

# Wiring map — personal-site

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-BuildSite | build.mjs | CLI script: top-level module code runs load → validate → render → write when invoked as `node build.mjs` | build.mjs — top-level script body (the entry point is the engine) | `node build.mjs` writes `dist/index.html`, the PortfolioPage |

## Deviations

- The entry point and the engine are the same file: the pitch asks for one zero-dependency script, so
  there is no separate composition root to register into. The script runs only when invoked directly,
  and `build.test.mjs` reaches it by spawning that same command.
