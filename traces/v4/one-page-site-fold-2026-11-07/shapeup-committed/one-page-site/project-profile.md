---
schema_version: 1
archetype: cli
entry_point: build.mjs
build_probe: node --test
---

# Project profile — one-page-site

A zero-dependency Node CLI (`node build.mjs`) that reads `content.json` and writes a static
`dist/index.html`. No runtime app to launch: the artifact is a file, verified by `node --test`
against the generated HTML text. No `launch_probe` (not a mobile or served app).
