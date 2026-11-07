---
schema_version: 1
archetype: library
entry_point: bin/envlint.mjs
build_probe: node --check bin/envlint.mjs
---

# Project profile — envlint

A zero-dependency Node ESM command-line tool. There is no compile step: the entry point
`bin/envlint.mjs` is the composition root that wires the parsing and rules modules into the CLI.

- `build_probe` asserts the entry point parses as valid ESM.
- No `launch_probe`: the binary is driven end to end by the test suite and the evaluator.
