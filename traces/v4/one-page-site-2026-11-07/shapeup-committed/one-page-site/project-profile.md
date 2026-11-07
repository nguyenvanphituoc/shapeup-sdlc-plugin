---
schema_version: 1
archetype: cli
entry_point: build.mjs
build_probe: node --test
---

# Project profile — one-page-site

A zero-dependency Node ESM CLI. `node build.mjs` reads `content.json` (or `$CONTENT_FILE`) and writes
`dist/index.html` (or `$OUT_DIR/index.html`). Verification is `node --test` (the `npm test` script).
No launch probe: the output is a static file graded by its text, with no app to launch.
