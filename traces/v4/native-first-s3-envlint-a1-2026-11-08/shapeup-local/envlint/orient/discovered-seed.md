# Discovered-task seed

## Scope: parsing (`src/parse.mjs`)
Imagined
- Parse KEY=value, comments, blank lines, `export KEY=`, single/double quotes.
- Report 1-based line number for unparseable lines; return `{pairs, problems}`.
- Handle empty / assignment-free input without throwing.

Discovered
- Pairs must carry their line number so rules findings can be reported line by line (seam: `src/parse.mjs` to `bin/envlint.mjs`; the CLI is the only joiner).

## Scope: rules (`src/rules.mjs`)
Imagined
- `required`, `type` string/int/bool/url, `enum` checks producing findings.

Discovered
- `url` check: `new URL` accepts `a:b` and `mailto:x@y` (probed, see spike-not-needed.md); decide protocol policy. Seam: `src/rules.mjs` (NEW).
- Rules must not import parse (pitch constraint); input is plain data (seam: `src/rules.mjs`).

## Scope: CLI (`bin/envlint.mjs`)
Imagined
- `--schema <schema.json> <envfile>` args, usage error on bad args, exit non-zero on findings.
- Missing env file / unreadable or invalid-JSON schema produce a clean message and non-zero exit.

Discovered
- `package.json:1` already declares bin `bin/envlint.mjs` and `node --test`; the file needs a shebang, and `node bin/envlint.mjs` is the safe test invocation.
- Tests must spawn the binary against fixtures written by the test (`test/` is empty today).
