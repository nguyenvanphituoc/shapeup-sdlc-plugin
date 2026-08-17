---
schema_version: 1
doc_type: usecase
feature: envlint
id: UC-03
engine: cli
actor: Developer / CI
---

# UC-03 — Run envlint from the command line

**Actor**: a developer or a CI job invoking `envlint --schema <schema.json> <envfile>`. Both
files are always explicit arguments — no implicit lookup of the caller's own `.env` (pitch
constraint; this is what makes UC-03 testable against throwaway fixtures).

## Input
`argv` — `--schema <schema.json>`, optional `--json`, positional `<envfile>`.

## Output
stdout/stderr text (see [[ux-behavior|ux-behavior]] state table) + process exit code
(0, 1, or 2).

## Steps
1. Parse argv: extract `--schema` value, `--json` presence, positional `<envfile>`.
   - `--schema` missing → E-missing-flag, exit 2 (Steps stop here).
2. Read env file at `<envfile>` path.
   - Read fails (missing/unreadable) → E1, exit 2.
3. Read schema file at `--schema` path.
   - Read fails (missing/unreadable) → E1-pattern, exit 2.
4. `JSON.parse` the schema file content.
   - Parse fails → E2, exit 2.
5. Call `lib/parse.mjs::parseEnv(envText)` (UC-01) → `{pairs, problems}`.
6. Call `lib/rules.mjs::checkRules({pairs, problems}, schema)` (UC-02) → `{findings, checked, ok}`.
7. Render:
   - `--json`: print exactly one JSON document `{"ok":bool,"findings":[...],"checked":N}` to
     stdout, nothing else on stdout.
   - human: `ok` → `ok: N keys checked` to stdout; else one line per finding,
     `<envfile>:<line>: <KEY>: <message>` (E4 findings get `<truncated line text>` in the `<KEY>`
     slot per EXPECTED.md's E4 wording), then `N problem(s)`.
8. Exit `0` if `ok`, else `1`. (Exit codes are unchanged by `--json` — EXPECTED.md E5.)

## Error cases
| Code | Condition | Message | Stream | Exit |
|---|---|---|---|---|
| E1 | env file missing/unreadable | `Error: cannot read env file: <path>` | stderr | 2 |
| E1-schema | schema file missing/unreadable | same pattern, schema path | stderr | 2 |
| E2 | schema not valid JSON | `Error: schema is not valid JSON: <path>` | stderr | 2 |
| missing-flag | `--schema` not given | `Error: ...` | stderr | 2 |
| E4 | malformed line reaches render | `<envfile>:<line>: <line text truncated to 30 chars>: not a KEY=VALUE assignment` | stdout | 1 |

Every error message is a single line prefixed `Error: `, never a bare stack trace (no-go).

## System Flow
argv → `bin/envlint.mjs` (UI + entry point) → file reads (fs) → UC-01 (`lib/parse.mjs`) →
UC-02 (`lib/rules.mjs`) → render (stdout/stderr) → `process.exit(code)`. No DB, no network
(no-gos: no `.env` writing, no `${VAR}` interpolation, no dotenv loading, no network ever).

## Test Surface
| ID | Source | Assertion |
|---|---|---|
| TS-UC03-01 | D2 (E1) | missing env file → stderr `Error: cannot read env file: <path>`, exit 2, no stack trace |
| TS-UC03-02 | D2 (E1-pattern) | missing/unreadable schema file → stderr error, exit 2 |
| TS-UC03-03 | D2 (E2) | schema file content is invalid JSON → stderr `Error: schema is not valid JSON: <path>`, exit 2 |
| TS-UC03-04 | D2 (missing-flag) | `--schema` omitted → stderr `Error: ...`, exit 2 |
| TS-UC03-05 | D2 (E3) | env file with zero assignments → every `required` schema key reported missing, exit 1, `ok` line never printed |
| TS-UC03-06 | D2 (E4) | malformed line → `<envfile>:<line>: <30-char-truncated line>: not a KEY=VALUE assignment`, exit 1 |
| TS-UC03-07 | D2 (E5) | `--json` prints exactly one JSON document `{"ok":bool,"findings":[...],"checked":N}` and nothing else on stdout; exit code unchanged by `--json` |
| TS-UC03-08 | D1 (Interface) | 0 findings, human mode → stdout `ok: N keys checked`, exit 0 |
| TS-UC03-09 | D1 (Interface) | ≥1 finding, human mode → one `<envfile>:<line>: <KEY>: <message>` line per finding + trailing `N problem(s)`, exit 1 |
| TS-UC03-10 | D1 (Interface) | a finding with no source line (required key wholly absent) renders with `line` `0` |
| TS-UC03-11 | D4 (no-go) | no network call is ever made, at any step of the CLI's execution |
| TS-UC03-12 | D3 (contract, UC-01+UC-02 composition) | `bin/envlint.mjs` calls `lib/parse.mjs` and `lib/rules.mjs` only — no direct re-implementation of parsing or rule logic in the CLI file |
