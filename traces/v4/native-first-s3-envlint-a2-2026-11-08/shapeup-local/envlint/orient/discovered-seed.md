# Discovered-task seed — envlint (raw material; no IDs, order or deps)

## Scope: parsing (`src/` parse module)
Imagined:
- Parse `KEY=value`, `#` comment lines, blank lines, `export KEY=value`.
- Single- and double-quoted values; strip quotes.
- Return `{pairs, problems}` with 1-based line numbers for unparseable lines.
- Fixture-driven tests for each form, including a text with no assignments.
Discovered:
- None citing existing code: `src/` is empty. Open parse decisions are in hill-signal rather than invented as tasks.

## Scope: rules (`src/` rules module)
Imagined:
- `required` check; `type` string/int/bool/url; `enum` membership; findings carry key and message.
- Fixtures per type, valid and invalid.
Discovered:
- The `url` check must not rely on `new URL()` alone: it accepts `foo:bar` and `localhost:3000` (spike-url-and-args.md, probe on Node v24.15.0). Seam: the url check in the rules module.

## Scope: CLI (`bin/envlint.mjs`)
Imagined:
- Read `--schema <file>` and one positional env file; print findings; non-zero exit on findings.
- Handle missing env file, unreadable or invalid-JSON schema, and a file with no assignments without crashing.
Discovered:
- Entry point is fixed at `bin/envlint.mjs` (`shapeup/envlint/project-profile.md:5`, `package.json` bin) and must pass `node --check` (`project-profile.md:6`).
- Wrap `parseArgs` so `ERR_PARSE_ARGS_UNKNOWN_OPTION` / `ERR_PARSE_ARGS_INVALID_OPTION_VALUE` become a usage message and non-zero exit; explicitly check missing `--schema` / missing positional (seam: arg handling in `bin/envlint.mjs`).
- Surface parse `problems` (unparseable lines with line numbers) as reported findings; the CLI is the only place that joins parse output to rules input.
- Tests spawn the binary against fixtures the test writes to a temp dir (`test/` is empty today; `package.json:1` `test` script is `node --test`).
