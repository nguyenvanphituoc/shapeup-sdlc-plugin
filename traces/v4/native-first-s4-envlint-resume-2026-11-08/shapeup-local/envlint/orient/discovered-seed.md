# Discovered-task seed — envlint

Raw material for the planner. No ids, no order, no dependencies. Grouped by suspected scope.
Discovered tasks cite a real file:line or seam; everything else is Imagined.

## Suspected scope: Parsing (`src/` parser module, pure)

**Imagined**
- Parse `KEY=value` lines into pairs; skip blank lines and full-line `#` comments.
- Accept `export KEY=value`.
- Strip single and double quotes from values.
- Report each unparseable line as a problem with its 1-based line number.
- Own fixture-driven unit tests (text in, `{pairs, problems}` out), importing nothing from Rules.
- Decide/implement edge cases: inline `#` after an unquoted value, `KEY=` (empty value),
  unterminated quote, escapes inside double quotes, CRLF line endings, leading BOM, duplicate keys,
  invalid key characters, `export FOO` with no `=`.

**Discovered**
- Each pair must carry its source line number so Rules findings can be printed "line by line" —
  the cross-scope data contract C1 (`code-surface.md`, "Cross-scope contracts"). Seam: parser
  return value consumed by `bin/envlint.mjs` (`shapeup/envlint/project-profile.md:4`).

## Suspected scope: Rules (`src/` rules module, pure)

**Imagined**
- `required`: flag a schema key absent from the pairs.
- `type: string` (anything passes), `int`, `bool`, `url`.
- `enum`: value must be one of a listed set.
- Own fixture-driven unit tests (data in, findings out), importing nothing from Parsing — test
  inputs are hand-built pair objects matching contract C1.
- Validate the schema object's own structure (unknown `type`, non-array `enum`) or hand that to the CLI.

**Discovered**
- `int` must be a strict pattern, not `Number()`: `Number.isInteger(Number(v))` accepts `"1.0"`,
  `"0x10"`, `" 7"`, `"1e3"` and `""` (probe output in `hill-signal.md`). Seam: rules `int` predicate.
- `url` must not be `URL.canParse` alone: it accepts `localhost:3000` (protocol `localhost:`),
  `javascript:alert(1)`, `mailto:x@y`, `file:///etc`. Needs a scheme/host rule, and no network ever
  (pitch Boundaries). Seam: rules `url` predicate, `node:url` `URL`.

## Suspected scope: CLI (`bin/envlint.mjs`, composition root)

**Imagined**
- Read the env file and the schema file; print findings; exit non-zero when any exist.
- Friendly one-line errors for missing file, unreadable file, invalid schema JSON — never a stack trace.
- Plain-text output, no colors, no prompts (pitch Boundaries).
- End-to-end tests driving the binary against fixtures written to `os.tmpdir()`.
- File with no assignments: defined output and exit code.

**Discovered**
- Composition root lives at `bin/envlint.mjs` (`shapeup/envlint/project-profile.md:4`); `bin/` is empty.
- `package.json:1` has `"name":"site"` and no `"bin"` field — add `"bin": {"envlint": "bin/envlint.mjs"}`
  (and arguably rename) if the tool is to be invoked as `envlint`. Belongs to whichever scope owns
  `package.json`; only one should.
- Explicit argument validation: missing `--schema`, zero or multiple positionals, unknown flags.
  `readFileSync(undefined)` throws `ERR_INVALID_ARG_TYPE` (spike-cli-seam.md, case "no positional").
  Seam: `node:util` `parseArgs` strict mode.
- Map read errors (ENOENT, EISDIR, EACCES) and schema `SyntaxError` to messages + an exit code
  distinct from "findings" (spike-cli-seam.md). Seam: `node:fs` `readFileSync`, `JSON.parse`.
- Test harness pattern: `spawnSync(process.execPath, [BIN, ...args], {encoding:'utf8'})` with
  `BIN` resolved via `fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url))` — proven
  6/6 in the spike. Seam: `test/` (empty).

## Cross-cutting

**Discovered**
- `build_probe: node --test` (`shapeup/envlint/project-profile.md:5`) currently exits green with
  0 tests (verified at repo root). The round build gate proves nothing until each scope lands
  `test/*.test.mjs` files; each scope should own distinct test file names so substrates stay disjoint
  (`test/` is shared territory).
- The data contracts C1–C3 (`code-surface.md`) must be pinned in the spec before Parsing and Rules
  build concurrently — not as a shared `src/` module, which both scopes would write.
