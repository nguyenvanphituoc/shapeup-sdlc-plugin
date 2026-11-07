# Discovered-task seed — envlint

Raw material for the planner. No ids, order or dependencies. Grouped by suspected scope. The repo
is greenfield, so the Discovered tasks cite the anchors that do exist (`package.json:1`, the
project profile, Node built-ins observed in the spike) plus the seams the spike exercised.

## Suspected scope: parsing (`src/` parse module + its own test file)

### Imagined
- Parse `KEY=value` lines into pairs; skip `#` comment lines and blank lines.
- Accept the `export KEY=value` prefix.
- Strip single and double quotes from values.
- Report each unparseable line as a problem carrying its 1-based line number.
- Unit tests over inline text strings (pure, no fs).

### Discovered
- Pin the pair shape to include the source line (`{key, value, line}`). Rules needs it so that the
  CLI can print findings "line by line". This is the cross-piece contract (code-surface E2d), and
  without it Parsing and Rules will each invent one.
- Decide CRLF handling: split on `/\r?\n/`, or a Windows-authored fixture produces `\r` in values.
  The seam is the text-in boundary of the parse function.
- Decide inline `#` after an unquoted value, escapes inside `"..."`, unterminated quotes, and
  duplicate keys. The pitch is silent on each, and each needs a fixture row.
- Keep the module free of `node:fs` and of any import from the rules module, so that it is
  verifiable alone (pitch disjointness; `package.json:1` `type: module` means plain ESM exports).

## Suspected scope: rules (`src/` rules module + its own test file)

### Imagined
- `required`: a missing key gives a finding.
- `type`: `string`, `int`, `bool`, `url`; a mismatch gives a finding.
- `enum`: a value outside the list gives a finding.
- Unit tests over in-memory pairs + schema objects.

### Discovered
- `url` validation can use the global `URL` constructor (available in Node v24.15.0, zero deps).
  It parses shape only with no network, which satisfies the pitch boundary. Decide whether a
  scheme is required (`new URL('localhost')` throws, `new URL('a:b')` passes).
- Pin `bool` spellings (`true/false` only, or also `1/0`, `yes/no`) and `int` (sign? leading
  zeros?). A test fixture cannot grade an undecided rule.
- Pin the schema JSON shape. The pitch names the keywords but not the structure, and the CLI
  scope's "unreadable schema" edge sits on the same decision.
- Must not import the parse module. Input is the pinned pair shape from parsing.

## Suspected scope: CLI (`bin/envlint.mjs` + CLI subprocess tests)

### Imagined
- `envlint --schema <schema.json> <envfile>`: read both files, run parse then rules, print
  findings, exit non-zero when there are findings.
- Plain-text output only, no colors or prompts.

### Discovered
- The entry path is already fixed: `package.json:1` `bin.envlint = bin/envlint.mjs` and
  `project-profile.md:4`. Add a `#!/usr/bin/env node` shebang so the `bin` mapping works when
  installed.
- Use `node:util` `parseArgs` in strict mode, inside try/catch. The spike saw
  `ERR_PARSE_ARGS_UNKNOWN_OPTION` and `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`. The CLI still has to
  check the "`--schema` present" and "exactly one positional" rules itself, because parseArgs
  accepts both violations.
- Map I/O failures to clean messages + exit code: `ENOENT` (missing env or schema), `EISDIR`, and
  `SyntaxError` from `JSON.parse`, which has no `.code`, so branch on `e.name`. All observed in
  the spike. No stack traces should reach the user.
- Pin the exit-code table (proposed: 0 clean, 1 findings, 2 usage/IO error) and the finding line
  format. EVAL grades by driving the binary, so these are what the Test Surface rows assert.
- Subprocess test harness: `spawnSync(process.execPath, [fileURLToPath(new URL('../bin/envlint.mjs',
  import.meta.url)), ...args], {encoding:'utf8'})` with fixtures in `mkdtempSync(join(tmpdir(),
  'el-'))`. Proven in the spike, about 260 ms for 8 invocations.
- Edge: env file with no assignments (empty, or comments only). Decide whether it passes when the
  schema has no `required` keys.
- The profile's `build_probe` (`node --check bin/envlint.mjs`, `project-profile.md:5`) is red until
  this scope lands (baseline exit 1, MODULE_NOT_FOUND). A round in which parsing/rules are green
  but the CLI is not will show a red build gate.

## Cross-cutting (no single scope; planner to place)

- `node --test` with zero test files exits 0 (observed at the repo root), so a gate must assert
  tests > 0.
- Every `.mjs` under `test/` is run as a test by Node's default discovery. Keep fixtures out of
  `test/` as JS, or write them to tmpdir at test time.
- Test file names per scope must be disjoint (e.g. one test file per module) so the three scopes
  share no write path.
