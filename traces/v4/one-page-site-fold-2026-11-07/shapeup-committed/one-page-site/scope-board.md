# Scope board — one-page-site

A view of the scope contracts; rebuildable from them.

| scope_id | topology | use_cases | depends_on | files | lint |
|---|---|---|---|---|---|
| build-site | ICEBERG | [UC-BuildSite, UC-RejectInvalidContent] | [] | [build.mjs, test/**, content.json] | — |

Riskiest first: build-site is the only scope; its riskiest area is escaping and no-write-on-failure.
No breadboard, so no V# slices to record.
