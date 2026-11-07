---
schema_version: 1
archetype: library
entry_point: bin/envlint.mjs
source_extensions: [".mjs"]
build_probe: "node --test \"test/*.test.mjs\""
---

# Project profile — envlint

A zero-dependency Node ESM command-line tool. `bin/envlint.mjs` is the CLI entry point and the root
of the import walk: it composes the parser and the rules modules. There is no compile step, so the
build probe is the project's own test suite, scoped to `test/` by a quoted glob (`node --test "test/*.test.mjs"`, expanded by Node itself) so it never
picks up test files vendored elsewhere in the checkout. A bare directory argument (`node --test test/`) is
read by Node 24 as a module path and fails. No launch probe: the tool is graded by
invoking the binary against fixture files, not by bringing up a long-running app.
