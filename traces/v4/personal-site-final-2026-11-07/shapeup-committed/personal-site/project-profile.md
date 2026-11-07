---
schema_version: 1
archetype: library
entry_point: build.mjs
build_probe: node build.mjs
---

# Project profile — personal-site

A zero-dependency Node script (`build.mjs`) that reads `content.json` and writes a static
`dist/index.html`. No app server and nothing to launch: the built artifact is the HTML file, so
the build probe runs the script itself and there is no launch probe.
