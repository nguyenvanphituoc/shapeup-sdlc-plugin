---
schema_version: 1
archetype: library
entry_point: bin/envlint.mjs
build_probe: node --check bin/envlint.mjs
---

# Project profile — envlint

A zero-dependency Node ESM command-line tool (`package.json` `"type": "module"`, tests via `node --test`).
The composition root is the CLI entry `bin/envlint.mjs`, which composes the pure parser and rules modules.
There is no app to launch, so there is no `launch_probe`; the evaluator drives the binary directly.
