---
schema_version: 1
archetype: library
entry_point: build.mjs
build_probe: "node --test test/build.test.mjs"
---

# Project profile — personal-site

A zero-dependency Node ESM script (`build.mjs`) that reads `content.json` (or `$CONTENT_FILE`) and
writes one static `dist/index.html` (or `$OUT_DIR/index.html`). No server, no browser, no launch step:
the built artifact is the HTML file itself, so there is no `launch_probe`.

- `entry_point` — `build.mjs` is the composition root; every use case is reached from `node build.mjs`.
- `build_probe` — `node --test test/build.test.mjs` (a named file, so the probe fails when the suite
  is absent instead of passing over zero tests) drives `node build.mjs` over temporary content files and asserts on
  the generated HTML text, which is the built artifact.
