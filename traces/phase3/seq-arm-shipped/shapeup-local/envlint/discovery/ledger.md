---
feature: envlint
---
# Discovery Ledger — envlint

## Discovered — envlint/analyze (2026-08-17)
~ E4 truncation semantics (byte vs char count, ellipsis or not) remain unspecified by EXPECTED.md — no Test Surface row asserts a specific algorithm beyond '≤30 chars of the line text'; flagged in shapeup/envlint/spec/synthesis.md risk register for PO/TL decision before TASK-003 is graded on exact bytes.

## Discovered — envlint/cli-pipeline-r1-a1 (2026-08-17)
~ `node --test test/` (bare directory positional arg, space-separated) fails in this sandbox with `Error: Cannot find module '.../test'`, while `node --test` (no args, auto-discovery), `node --test test/<file>.mjs` (file-level), and `node --test=test/` (equals form) all work correctly — looks like a Node 24.15.0 / this-environment argument-parsing quirk on directory positional args, not a defect in the test files themselves. package.json's `test` script (`node --test test/`) is outside this scope's substrate so it was not touched; the scope's own e2e_verification_fixtures use the file-level form and pass.

## Discovered — envlint/hunt (2026-08-17)
~ [lens:①boundary] [QA-001] [UC-01] CRLF (\r\n) line endings make every valid KEY=VALUE line fail to parse: the assignment regex's `.` never matches `\r`, so each line falls through to the no-match branch and is reported as an E4 problem
    repro: 1. write an env file with `FOO=bar\r\nBAZ=qux\r\n` (actual CRLF line endings)
2. write a schema requiring FOO and BAZ
3. run `envlint --schema <schema> <envfile>`
4. observe: both lines reported `not a KEY=VALUE assignment`, both FOO/BAZ reported `required key missing`, exit 1 — despite the file being syntactically valid KEY=VALUE per line
    severity-hint: data-integrity
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-03] E4 line truncation in bin/envlint.mjs's truncate() slices by UTF-16 code unit, not codepoint — a multi-byte character (e.g. emoji surrogate pair) straddling the 30-char cutoff is split, producing an unpaired surrogate that renders as U+FFFD (�) on stdout
    repro: 1. write an env file with a malformed line = 29 ASCII chars + an emoji (surrogate pair) + more text
2. run `envlint --schema <any> <envfile>` (human mode, no --json)
3. observe: the rendered `<KEY>` slot shows 29 'x' chars followed by the replacement character `�` instead of a clean 30-char truncation
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-03] An unrecognized flag (e.g. --verbose) placed before the positional envfile argument is silently captured by parseArgv as the envfile path itself, since it matches neither --schema nor --json and envfile is still unset — the real envfile argument that follows is dropped
    repro: 1. run `envlint --schema <valid schema.json> --verbose <real-envfile>`
2. observe: `Error: cannot read env file: --verbose`, exit 2 — the flag is misreported as a missing file rather than surfaced as an unknown option, and the real envfile path is never read
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-004] [UC-03] Passing two positional file arguments silently uses only the first and drops the second with no warning
    repro: 1. run `envlint --schema <schema.json> a.env b.env`
2. observe: only a.env is checked (exit code / findings reflect a.env alone); b.env is silently ignored, no error or warning printed
    severity-hint: ux-degradation
    test-gap: unit
