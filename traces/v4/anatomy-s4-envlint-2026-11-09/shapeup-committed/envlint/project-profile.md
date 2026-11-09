---
schema_version: 1
archetype: library
entry_point: bin/envlint.mjs
note: envlint is a command-line tool with two pure modules (parsing, rules) composed by one CLI module; no archetype names a CLI, and library is the closest — the CLI file is the composition root the wiring map names its call sites against.
---

# Project profile — envlint

- **Archetype:** `library` — a plain Node ESM command-line tool with no dependencies. The two pure
  pieces (Parsing, Rules) are library modules; the CLI is the only piece that composes them.
- **Entry point:** `bin/envlint.mjs` — invoked as `node bin/envlint.mjs --schema <schema.json> <envfile>`.
  This is the composition root: it is the only module that imports both Parsing and Rules.
- **Run command:** `node --test` (the project's `npm test`).
- **build_probe / launch_probe:** none declared. Node runs the source directly (no compile step that could
  leave a file outside the built set), and the pitch's verification drives the binary from the tests.
