# Spike — CLI fixture harness (RESOLVED)

## Scope (GATE O-B, auto-confirmed, `pause_gates: false`)

- **Area:** the CLI seam (`bin/envlint.mjs`), where argv, two file reads and exit codes meet. The
  pitch says the run is graded by driving this binary against fixture files a test wrote, so if
  this seam cannot be driven, nothing else can be verified.
- **Question:** Can a zero-dependency `node --test` suite start `bin/envlint.mjs` as a subprocess
  against throwaway fixtures in a temp dir, and can `node:util` `parseArgs` handle
  `--schema <schema.json> <envfile>` in a way that keeps the edge cases (missing env file,
  directory as schema, malformed JSON, unknown flag, `--schema` with no value, extra positional)
  apart by stderr and exit code?
- **Time-box:** 30 min. **Fallback:** hand-rolled argv loop, with tests importing a `main(argv)`
  function in-process instead of spawning.

## Method

I wrote a throwaway probe CLI and a `node:test` file under the orient dir, ran them, then
deleted them. Nothing outside the orient dir was written. Node v24.15.0.

- CLI: `parseArgs({ options: { schema: { type: 'string' } }, allowPositionals: true, strict: true })`
  in try/catch, then `readFileSync(envfile)` and `JSON.parse(readFileSync(schema))`, each in its
  own try/catch writing a tagged line to stderr and exiting 2.
- Test: `spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' })`, where
  `BIN = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url))`, with fixtures written to
  `mkdtempSync(join(tmpdir(), 'el-'))`.

## Findings (all observed: 1 test, pass, ~260 ms)

| Input | Observed |
|-------|----------|
| `--schema s.json .env` | exit 0 |
| `.env --schema=s.json` (reordered, `=` form) | exit 0, so parseArgs takes options in any position and in both forms |
| missing env file | `readFileSync` throws `code: 'ENOENT'`, caught, exit 2 |
| schema path is a directory | throws `code: 'EISDIR'`, caught, exit 2 |
| schema `{` (malformed JSON) | `JSON.parse` throws `SyntaxError` (no `.code`, so tag by `e.name`), caught, exit 2 |
| `--bogus` | parseArgs throws `code: 'ERR_PARSE_ARGS_UNKNOWN_OPTION'` |
| `--schema` with no value | parseArgs throws `code: 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE'` |
| extra positional | parseArgs accepts it, so the CLI has to check `positionals.length !== 1` itself |
| missing `--schema` | parseArgs accepts it, so the CLI has to check `values.schema` itself |

Runner facts, from running `node --test` at the repo root:

- With no test files it reports `tests 0` and **exits 0**. An empty or mis-named suite passes
  green, so the round build gate / EVAL should check a test count above zero, not just the exit code.
- Default discovery did **not** pick up `.test.mjs` files under the dot-directory `.shapeup/`,
  so run-trace files do not pollute the suite.
- Node's default patterns run *every* `.js`/`.mjs`/`.cjs` under any `test/` directory as a test
  file. Fixture data should therefore be written to `os.tmpdir()` at test time (as the pitch
  wants) or kept as non-JS files. A helper `.mjs` under `test/` will run as a test.
- `node --check` on a missing `bin/envlint.mjs` exits 1 (`MODULE_NOT_FOUND`), so the profile's
  `build_probe` is red until the CLI scope lands. Scopes that build before it will see a red
  build gate.

## Answer

**RESOLVED: yes.** Both halves of the question are confirmed with zero dependencies. Subprocess
tests against tmpdir fixtures work and are fast. `parseArgs` in strict mode covers flag errors, but
the CLI must enforce "exactly one positional" and "`--schema` present" itself. Each I/O edge case
throws a distinct, catchable error.

## Residual unknowns (pitch is silent; spec must decide, not the builder)

1. Exit-code numbers: the pitch requires non-zero on findings but does not say whether usage/IO
   errors get a different code from lint findings (convention: 0 clean, 1 findings, 2 usage/IO).
2. Output format of a finding line (e.g. `<file>:<line>: <KEY>: <message>`), and whether errors
   go to stderr and findings to stdout.
3. Schema JSON shape (per-key object vs top-level `required` list) and who rejects a schema that
   parses but is the wrong shape.
