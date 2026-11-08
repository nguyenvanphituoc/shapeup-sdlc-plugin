---
schema_version: 1
archetype: library
entry_point: bin/envlint.mjs
build_probe: node --test
---

# Project profile — envlint

A zero-dependency Node (ESM, `node:` builtins only) command-line tool. `bin/envlint.mjs` is the
composition root: it wires the pure parser and the pure rules engine to argument handling, file
reads, output and exit codes. No server, no UI, nothing to launch beyond the binary itself, so
there is no `launch_probe`; `build_probe` runs the project's own `node --test` suite.
