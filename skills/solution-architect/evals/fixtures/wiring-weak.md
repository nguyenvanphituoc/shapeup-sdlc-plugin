---
schema_version: 1
feature: todo-cli
entry_point: src/cli/main.js
---

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-01 | src/capture/add.js |  |  |  |
| UC-02 | src/review/list.js |  |  |  |
| UC-03 | src/review/search.js |  |  |  |
| UC-06 | src/legacy/archive.js |  |  |  |

## Why this map

One row per module that looks like a feature entry point.
