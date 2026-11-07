---
schema_version: 1
archetype: library
entry_point: bin/envlint.mjs
build_probe: node --check bin/envlint.mjs && node --check src/parse.mjs && node --check src/rules.mjs
---

# Project profile — envlint

A zero-dependency Node ESM command-line tool. `bin/envlint.mjs` is the composition root: it reads
the two files named on its command line, calls the pure parser (`src/parse.mjs`) and the pure rules
engine (`src/rules.mjs`), prints findings and sets the exit code. Tests run with `node --test`.

No `launch_probe`: there is no app to install or start; the CLI is driven directly by the tests.
