# Discovered-task seed — envlint

## Suspected scope: parsing
Imagined
- Parse KEY=value, comments, blank lines, `export KEY=value`.
- Single/double-quoted values; report 1-based line of unparseable lines.
- Return `{pairs, problems}`; fixtures per case.
Discovered
- Pairs must carry line numbers for rules' line-by-line output (seam: parser output to rules input; new `src/parse.mjs`, see code-surface.md row "Parsing").
- Unterminated-quote and duplicate-key behaviour needs a decision (seam: `src/parse.mjs`, NEW).

## Suspected scope: rules
Imagined
- required, type string/int/bool/url, enum; findings list.
- Fixtures per rule.
Discovered
- url type is shape-only, never network; `new URL` is permissive for arbitrary schemes (seam: url check in `src/rules.mjs`, NEW).
- Malformed schema entries must yield an error, not a crash (seam: rules input contract).

## Suspected scope: cli
Imagined
- Arg handling `--schema <file> <envfile>`, no implicit .env lookup.
- Print findings, exit non-zero on findings.
Discovered
- Missing env file, unreadable/invalid-JSON schema, and empty file each need a distinct non-crash path and exit code (seam: `bin/envlint.mjs`, entry_point in project-profile.md).
- Missing or extra args need a usage error (seam: `bin/envlint.mjs`).
- Tests spawn the binary against fixtures the test writes (seam: build_probe `node --test` in project-profile.md).
