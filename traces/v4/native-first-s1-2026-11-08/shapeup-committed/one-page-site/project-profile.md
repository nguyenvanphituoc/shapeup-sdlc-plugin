---
schema_version: 1
archetype: library
entry_point: build.mjs
---

# Project profile — one-page-site

A zero-dependency Node CLI (`node build.mjs`) that reads `content.json` and writes a static
`dist/index.html`. `build.mjs` is the composition root: it is the only entry point and the file
every use case is wired against. Verification is `node --test` (package.json `test` script).

No `build_probe` / `launch_probe`: there is no compile step and nothing to launch — the generated
HTML is asserted as text by the test suite.
