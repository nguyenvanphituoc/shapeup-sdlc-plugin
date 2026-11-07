---
schema_version: 1
archetype: library
entry_point: bin/envlint.mjs
---

# Project profile — envlint

A zero-dependency Node ESM command-line tool (`"type": "module"`, tests via `node --test`).
`bin/envlint.mjs` is the composition root: it parses argv, reads the two files, and composes the
pure parsing and rules modules. Interpreted JavaScript has no build artifact, so no `build_probe`
is set; with no app to launch, no `launch_probe` is set either.
