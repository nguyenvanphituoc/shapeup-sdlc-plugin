---
schema_version: 1
archetype: library
entry_point: bin/envlint.mjs
---

# Project profile — envlint

A zero-dependency Node ESM command-line tool. `bin/envlint.mjs` is the composition root: it wires the
pure parsing and rules modules under `src/` to argument handling, file reads, output and exit codes.
Tests run with `node --test` (`npm test`). There is no build step, so no `build_probe`; there is no
app to install or launch, so no `launch_probe`.
