---
type: usecase
feature: envlint
id: UC-03
title: Developer lints an env file from the command line
actor: developer / CI job
engine: bin/envlint.mjs
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-21, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30]
---

# UC-03 — Developer lints an env file from the command line

Output contract: [[ux-behavior]] · data contracts: [[domain-model]] · Back to [[_index]]

## Input / Output

```ts
input:  argv = ["--schema", schemaPath, envPath]
output: stdout lines + stderr line + exit code ∈ {0, 1, 2}   // per ux-behavior state table
```

## Steps

1. Parse argv with `node:util` `parseArgs` (strict): exactly one `--schema <path>` and exactly one positional.
2. Read the schema file; `JSON.parse` it; run `checkSchema`.
3. Read the env file as UTF-8 text.
4. `parseEnv(text)` ([[usecases/UC-01-parse-env-text]]); `checkPairs(pairs, schema)` ([[usecases/UC-02-check-pairs-against-schema]]).
5. Print problems and findings in the [[ux-behavior#Output lines (findings state)]] order to stdout.
6. Exit 0 when nothing was printed, 1 when anything was; any usage / IO / schema / internal error prints one `envlint: …` line to stderr and exits 2.

## Invariants

- [INV-01] No input — missing file, directory, unreadable file, malformed env text, malformed schema, bad argv — produces a stack trace or an uncaught exception; every failure is one `envlint: …` stderr line.
- [INV-02] Exit is 1 if and only if at least one parse problem or finding was printed; usage/IO/schema errors exit 2; clean exits 0.
- [INV-03] An env file with no assignments is not an error in itself: with no required keys it exits 0; with required keys it reports each missing key and exits 1.
- [INV-04] The only files read are the two named on the command line; nothing is written.
- [INV-05] Output is plain ASCII-safe text with no ANSI escape sequences, and nothing is read from stdin.

## Error Cases

| Code | Condition | Result |
|---|---|---|
| USAGE | no args, missing `--schema`, zero or several positionals, unknown flag | stderr `envlint: …` + usage line, exit 2 |
| ENV_NOT_FOUND | env file path does not exist | stderr `envlint: cannot read env file <p>: ENOENT`, exit 2 |
| ENV_UNREADABLE | env path is a directory or unreadable | stderr `envlint: cannot read env file <p>: <code>`, exit 2 |
| SCHEMA_NOT_FOUND | schema path missing or unreadable | stderr `envlint: cannot read schema file <p>: <code>`, exit 2 |
| SCHEMA_INVALID_JSON | schema text is not JSON | stderr `envlint: invalid schema <p>: not valid JSON`, exit 2 |
| SCHEMA_INVALID | `checkSchema` returns errors | stderr `envlint: invalid schema <p>: <first error>`, exit 2 |
| FINDINGS | ≥ 1 problem or finding | stdout lines, exit 1 |

## System Flow

argv → `bin/envlint.mjs` → `node:fs` `readFileSync` ×2 → `src/rules.mjs` `checkSchema` → `src/parse.mjs` `parseEnv` → `src/rules.mjs` `checkPairs` → stdout/stderr + exit code.

## Test Surface
<!-- DERIVED — regenerate via a retrofit-surface spec step; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | Run the binary on each error case below and on an env file of binary garbage | stderr never contains `    at ` or `Error:` stack lines; one `envlint: ` line or findings | D1: INV-01 |
| TS-INV-02 | process | Valid env + schema with one `int` violation on line 2 and one missing required key | stdout `<env>:2: PORT: expected int, got "abc"` then `<env>: TOKEN: required key is missing`; exit 1 | D1: INV-02 |
| TS-INV-03 | process | Env file containing only comments and blank lines; schema `{}` then schema requiring `A` | exit 0 with empty stdout; then exit 1 with `<env>: A: required key is missing` | D1: INV-03 |
| TS-INV-04 | process | Run in a temp cwd; compare its directory listing before and after | listing unchanged, no `.env` created | D1: INV-04 + D4: never writes a `.env` |
| TS-INV-05 | process | Any findings run | no `\x1b` byte in stdout or stderr; process does not wait on stdin | D1: INV-05 + D4: no colors / TUI / prompts |
| TS-ERR-USAGE | process | No args; `--schema s.json` alone; two positionals; `--color` | exit 2, stderr starts `envlint: `, includes `usage:` | D2 |
| TS-ERR-ENV_NOT_FOUND | process | Env path that does not exist | exit 2, stderr names the path and `ENOENT` | D2 |
| TS-ERR-ENV_UNREADABLE | process | Env path is a directory | exit 2, stderr names the path | D2 |
| TS-ERR-SCHEMA_NOT_FOUND | process | Schema path that does not exist | exit 2, stderr `cannot read schema file` | D2 |
| TS-ERR-SCHEMA_INVALID_JSON | process | Schema file `{not json` | exit 2, stderr `not valid JSON` | D2 |
| TS-ERR-SCHEMA_INVALID | process | Schema `{"A":{"type":"float"}}` | exit 2, stderr `invalid schema` | D2 |
| TS-ERR-FINDINGS | process | Env with a parse problem on line 3 | stdout `<env>:3: parse error: missing '='`, exit 1 | D2 |
| TS-NOGO-01 | process | Run with `--schema s.json` and no env path in a cwd holding a `.env` | exit 2 usage; the `.env` is not read (no findings printed) | D4: no implicit lookup of the developer's `.env` |
| TS-NOGO-02 | process | Env `A=${HOME}` with schema `{"A":{"enum":["${HOME}"]}}` | exit 0: value compared literally | D4: never interpolates `${VAR}` |
