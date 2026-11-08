---
type: usecase
feature: envlint
id: UC-01
title: Parse .env text into pairs and problems
actor: envlint CLI (caller of the parser)
engine: src/parse.mjs
covers: [REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-22, REQ-23, REQ-26]
---

# UC-01 — Parse .env text into pairs and problems

Contract: [[domain-model#C1 — `ParseResult` (Parsing → Rules, via the CLI)]] · Back to [[_index]]

## Input / Output

```ts
input:  text: string
output: { pairs: {key: string, value: string, line: number}[], problems: {line: number, message: string}[] }
```

## Steps

1. Strip a leading UTF-8 BOM; split `text` into physical lines on `\n` (dropping a trailing `\r`), numbering from 1.
2. Skip blank / whitespace-only lines and lines whose first non-whitespace character is `#`.
3. Remove a leading `export` followed by whitespace.
4. Split at the first `=`; trim the key and validate it; trim the raw value.
5. Unquote a single- or double-quoted value (verbatim inner text); keep an unquoted value verbatim.
6. Emit a pair `{key, value, line}`, or a problem `{line, message}` for the line.

## Invariants

- [INV-01] Every pair and every problem carries the 1-based number of the physical line it came from.
- [INV-02] `parseEnv` is pure: it reads no file, writes nothing, touches no global state, and `src/parse.mjs` has no `import` statement.
- [INV-03] `${VAR}` references are never expanded: the value is returned literally.
- [INV-04] `parseEnv` never throws for any string input.

## Error Cases

| Code | Condition | Result |
|---|---|---|
| MISSING_EQUALS | a non-blank, non-comment line has no `=` | problem `missing '='` at that line, no pair |
| INVALID_KEY | the key does not match `^[A-Za-z_][A-Za-z0-9_]*$` (includes empty key) | problem `invalid key` at that line, no pair |
| UNTERMINATED_QUOTE | value starts with `"` or `'` and does not end with the same quote | problem `unterminated quote` at that line, no pair |

## System Flow

`bin/envlint.mjs` reads the env file → `parseEnv(text)` → `{pairs, problems}` handed to Rules ([[usecases/UC-02-check-pairs-against-schema]]) and to output ([[ux-behavior]]).

## Test Surface
<!-- DERIVED — regenerate via a retrofit-surface spec step; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | Parse a text with blank lines, comments and assignments on known lines | every pair/problem `line` equals its 1-based physical line | D1: INV-01 |
| TS-INV-02 | test | Inspect module imports and call `parseEnv` twice on the same input | no `import` in `src/parse.mjs`; identical results | D1: INV-02 |
| TS-INV-03 | test | Parse `A=${HOME}/x` | value is the literal `${HOME}/x` | D1: INV-03 + D4: no interpolation |
| TS-INV-04 | test | Call `parseEnv` on `""`, `"\n\n"`, `"="`, `"'"`, a BOM-prefixed and a CRLF text | returns `{pairs, problems}` arrays, never throws | D1: INV-04 |
| TS-ERR-MISSING_EQUALS | test | Parse `JUSTAKEY` on line 2 | one problem `{line: 2, message: "missing '='"}` | D2 |
| TS-ERR-INVALID_KEY | test | Parse `1BAD=x` and `=x` | problem `invalid key` for each line | D2 |
| TS-ERR-UNTERMINATED_QUOTE | test | Parse `A="abc` and `B='x` | problem `unterminated quote` for each line | D2 |
