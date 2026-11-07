---
schema_version: 1
archetype: library
entry_point: build.mjs
build_probe: node --test
---

# Project profile — personal-site

A zero-dependency Node script (`node build.mjs`) that reads `content.json` (or `$CONTENT_FILE`) and
writes one static page, `dist/index.html` (or `$OUT_DIR/index.html`). There is no running app: the
artifact is the generated HTML file. `build.mjs` is the composition root every use case is wired against.

- `build_probe`: `node --test`. The test suite drives `node build.mjs` over temporary content files
  and asserts on the generated HTML, so a green run proves the built artifact covers the feature.
- `launch_probe`: none. This is not a server or a device app, so there is nothing to launch.
