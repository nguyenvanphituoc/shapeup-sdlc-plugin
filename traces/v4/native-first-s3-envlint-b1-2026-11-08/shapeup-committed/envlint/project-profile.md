---
schema_version: 1
archetype: library
entry_point: bin/envlint.mjs
build_probe: node --check bin/envlint.mjs
---

# Project profile — envlint

A zero-dependency Node ESM command-line tool. `bin/envlint.mjs` is the composition root: it wires
the pure parsing and rules modules under `src/` to argument handling, file reads, output and exit
codes. Tests run with `node --test`.
