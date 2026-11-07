# Discovered-task seed — envlint

Raw material for `ba` Phase 6. No ids, no order, no dependencies — grouped by suspected scope only.
Citations: `intake.md` = `.shapeup/envlint/intake.md`; `profile` = `shapeup/envlint/project-profile.md`.

## Cross-scope (spec-level, must be fixed before scopes build concurrently)

### Discovered
- Pin the **`pairs` data shape** that Parse emits and Rules consumes — must carry each key's 1-based line number so findings can be reported "line by line" (`intake.md:12`, `intake.md:26`); likely an ordered array of `{key, value, line}` rather than a plain object. Parse and Rules may not import each other (`intake.md:31-32`), so the shape lives in the spec, and each scope's fixtures must use it verbatim. Seam: E1 → E2 via the composition root (`profile:10-12`).
- Pin **duplicate-key behaviour** (last wins? finding?) — follows from the `pairs` shape above (`intake.md:26`).
- Pin the **schema file format** — "a small JSON schema" (`intake.md:10`) is ambiguous between real JSON Schema and a bespoke `{KEY: {required, type, enum}}` map; Rules' input and the CLI's "unreadable schema" handling both depend on it (`intake.md:13`, `intake.md:27-28`).
- Pin the **finding item shape** (key, line, rule, message) Rules returns and the CLI prints (`intake.md:11-12`, `intake.md:28`).

## Scope: Parsing (`src/parse.mjs`)

### Imagined
- Parse `KEY=value` lines into pairs.
- Skip `#` comment lines and blank lines.
- Strip a leading `export ` prefix.
- Unquote single- and double-quoted values.
- Report a `{line, message}` problem for any line it cannot parse; never throw.
- Unit tests with inline text fixtures.

### Discovered
- File must be exactly `src/parse.mjs` and must pass `node --check` — the round build gate checks that name (`profile:5`).
- Decide and test inline-comment handling after unquoted values (`KEY=val # note`), escapes in double quotes, unterminated quotes, whitespace around `=`, invalid key characters — all unspecified by `intake.md:24-26`.
- Handle CRLF line endings and a trailing newline without producing a phantom line / off-by-one line numbers (`intake.md:25-26`, 1-based line requirement).
- Test files under `test/` are all executed by bare `node --test` (`package.json:1`, probed): keep parse fixtures as inline strings or non-JS files; name tests `test/parse.test.mjs` so the scope's write set stays disjoint.

## Scope: Rules (`src/rules.mjs`)

### Imagined
- `required`: report a missing key.
- `type: string|int|bool|url` predicates.
- `enum`: report a value not in the list.
- Unit tests with inline pairs + schema objects.

### Discovered
- File must be exactly `src/rules.mjs` and pass `node --check` (`profile:5`).
- `int` must be judged on the raw string with an anchored regex: `Number.isInteger(Number(s))` accepts `""`, `" 7"`, `"1e3"`, `"0x10"`, `"3.0"` and loses precision past 2^53 (spike: `spike-rules-value-types.md`, seam E2b in `code-surface.md`).
- `url` must not rely on `URL.canParse` alone: it accepts `localhost:3000`, `javascript:…`, `mailto:…`, `file:///…`, `http:/x`; add a non-empty-host and/or `://` check; no network (`intake.md:41`; spike).
- `bool` accepted spellings must be listed by the spec (spike: not probed, no builtin).
- Decide whether an empty value satisfies `required` and whether it is then type-checked (`intake.md:27`).
- Handle a schema entry with an unknown `type` without throwing (`intake.md:13-14` "worse than no linter").
- Tests as `test/rules.test.mjs`; no import of `src/parse.mjs` (`intake.md:31`).

## Scope: CLI (`bin/envlint.mjs` + `package.json`)

### Imagined
- Parse `--schema <file> <envfile>` arguments.
- Read both files; call parse then rules; print findings; exit non-zero on any finding.
- Handle missing env file, unreadable schema, file with no assignments without crashing.
- End-to-end tests that spawn the binary against fixture files written to a temp dir.

### Discovered
- File must be exactly `bin/envlint.mjs` (`profile:4`, `profile:5`); it is the only module allowed to import both `src/parse.mjs` and `src/rules.mjs` (`profile:10-12`, `intake.md:31-32`).
- `package.json:1` names the package `site` and has no `bin` field — rename to `envlint` and add `"bin": {"envlint": "bin/envlint.mjs"}` (plus a `#!/usr/bin/env node` shebang). Exactly one scope must own `package.json`, or the build serializes; this scope is the natural owner.
- Spec must pin exit codes: findings vs usage error vs IO/schema error (`intake.md:12-14`) — tests assert them.
- Spec must pin the output line format and stdout/stderr split; no colors (`intake.md:40-41`).
- Spec must decide whether "a file with no assignments at all" is a clean pass, a finding, or (with required keys) simply the missing-key findings (`intake.md:13`).
- Wrap every fs/JSON step so no input produces an uncaught stack trace (`intake.md:13-14`).
- CLI tests must write fixtures to a temp dir (`node:os` tmpdir) and spawn `process.execPath bin/envlint.mjs …` — never read the developer's own `.env` (`intake.md:16-20`). Name them `test/cli.test.mjs`; any helper must not be a `.mjs` under `test/` without tests, since bare `node --test` runs every `.mjs` there (`package.json:1`, probed).

## Invariants (candidate Test Surface rows)

### Discovered
- Never writes any file, never interpolates `${VAR}`, never touches the network (`intake.md:40-41`).
- No ANSI escape sequences in output (`intake.md:40`).
