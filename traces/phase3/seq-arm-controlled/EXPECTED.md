# Expected output — `envlint`

The acceptance contract this run is graded against. Every line is a checkable assertion.

## Interface

```
envlint --schema <schema.json> <envfile>      # human-readable findings
envlint --schema <schema.json> --json <envfile>   # one JSON document on stdout
```

- **exit 0** — no findings. Prints `ok: N keys checked` to stdout.
- **exit 1** — one or more findings. Each finding is printed on its own line as
  `<envfile>:<line>: <KEY>: <message>`, to **stdout**; the trailing summary
  `N problem(s)` goes to stdout too. Line is `0` for a finding with no line
  (a required key that is absent from the file entirely).
- **exit 2** — the tool could not run: the env file or the schema file is missing or unreadable,
  the schema is not valid JSON, or `--schema` was not given. The message goes to **stderr**,
  prefixed `Error: `, and is never a bare stack trace.

## Schema format

```json
{ "PORT":     { "required": true,  "type": "int" },
  "DEBUG":    { "required": false, "type": "bool" },
  "API_URL":  { "required": true,  "type": "url" },
  "LOG_LEVEL":{ "required": false, "enum": ["debug", "info", "warn", "error"] } }
```

A key present in the file but absent from the schema is **not** a finding.

## E — edge cases that must be handled

- **E1** missing env file → exit 2, `Error: cannot read env file: <path>`, no stack trace.
- **E2** schema file is not valid JSON → exit 2, `Error: schema is not valid JSON: <path>`.
- **E3** env file with zero assignments (empty, or only comments and blanks) → the run still
  reports every `required` key as missing, exit 1. It must not report `ok`.
- **E4** a line that is not `KEY=VALUE` and not a comment or blank → a finding
  `<file>:<line>: <line text truncated to 30 chars>: not a KEY=VALUE assignment`, exit 1.
- **E5** `--json` prints exactly one JSON document, `{"ok":bool,"findings":[…],"checked":N}`,
  and prints nothing else on stdout. Exit codes are unchanged by `--json`.

## Type rules

- `int` — matches `/^-?\d+$/`. `01` is fine; `1.5`, `1e3` and `` are findings.
- `bool` — one of `true`, `false`, `1`, `0` (case-insensitive).
- `url` — parses with `new URL()` **and** has protocol `http:` or `https:`.
- `string` — any value, including empty.
- `enum` — exact match against one of the listed values.
- A key that is present but empty (`KEY=`) satisfies `string`, fails `int`/`bool`/`url`/`enum`.

## Parsing rules

- `# comment` lines and blank lines are skipped.
- `export KEY=value` is the same as `KEY=value`.
- `KEY="value"` and `KEY='value'` strip the surrounding quotes, matching pairs only.
  `KEY="value` keeps the leading quote — it is not a matching pair.
- Whitespace around `KEY` and around the value is trimmed (outside quotes).
- A later assignment of the same key wins; the earlier one is not a finding.

## Verification

`npm test` runs `node --test test/` and exits 0. Every rule above is covered by a test that
drives the built binary or the module directly.
