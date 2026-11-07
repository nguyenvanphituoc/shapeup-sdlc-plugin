---
type: domain-model
feature: envlint
bounded_context: envlint
entities: [EnvFile, Schema]
value_objects: [EnvPair, ParseProblem, KeyRule, Finding]
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: ready
---

# Domain Model — envlint

## Bounded Context
`envlint` — one small context. No persistence and no events: every operation is a pure function
over text and data, plus a thin CLI that reads two files.

## Aggregates

### EnvFile
The parsed form of a `.env` text: `{ pairs: EnvPair[], problems: ParseProblem[] }`. Produced only by
`parse(text)` in `src/parse.mjs`. Pure: no `node:fs`, no import of the rules module.

### Schema
A JSON object mapping a key name to a `KeyRule`. Checked by `checkSchema(schema)` and applied by
`check(pairs, schema)`, both in `src/rules.mjs`. Pure: no `node:fs`, no import of the parse module.

## Value Objects

| Name | Shape | Notes |
|---|---|---|
| EnvPair | `{ key: string, value: string, line: number }` | `line` is 1-based. This is the one contract between Parsing and Rules. |
| ParseProblem | `{ line: number, message: string }` | `line` is 1-based |
| KeyRule | `{ required?: boolean, type?: "string"\|"int"\|"bool"\|"url", enum?: string[] }` | every field optional |
| Finding | `{ key: string, line: number\|null, rule: "required"\|"type"\|"enum", message: string }` | `line` is null for a missing key |

## Repository Interfaces
None — the CLI reads files directly with `node:fs`; there is no storage.

## Planning decisions
The pitch is silent on these; the run was unattended, so the planner pinned the simplest reading
and lists each one for the PO at the ship gate.

| # | Question | Decision |
|---|---|---|
| PD-1 | Line endings | split on `\r?\n`; a CRLF file parses the same as LF |
| PD-2 | Key syntax | `[A-Za-z_][A-Za-z0-9_]*`, after an optional `export ` prefix; whitespace around `=` and the key is trimmed |
| PD-3 | Unparseable line | a non-blank, non-comment line with no `=`, or with an invalid key → a ParseProblem with its 1-based line |
| PD-4 | Quotes | a value wrapped in a matching `'…'` or `"…"` has the quotes stripped, with no escape processing; a value that opens a quote and does not close it with the same quote is a ParseProblem |
| PD-5 | Inline `#` | not a comment after `=`; it is part of the value. Only a line whose first non-blank character is `#` is a comment |
| PD-6 | Duplicate keys | every pair is kept in order; rules judge the last occurrence of a key |
| PD-7 | Schema shape | a JSON object of `KEY → KeyRule`; any other shape (array, non-object rule, unknown `type`, non-array `enum`) is an invalid schema |
| PD-8 | `int` | `^-?[0-9]+$` |
| PD-9 | `bool` | exactly `true` or `false` |
| PD-10 | `url` | `new URL(value)` does not throw (a scheme is therefore required); no network |
| PD-11 | `enum` | the value must equal one of the listed strings exactly |
| PD-12 | Empty env file | no pairs and no problems; passes unless the schema marks a key `required` |
| PD-13 | Exit codes | `0` no findings and no problems · `1` findings or parse problems · `2` usage error, unreadable file, invalid JSON, invalid schema |
| PD-14 | Output | findings and parse problems on stdout, one per line, `<envfile>:<line>: <key>: <message>` (a missing key prints `<envfile>: <key>: <message>`; a parse problem prints `<envfile>:<line>: <message>`); usage and I/O errors on stderr as one `envlint: <message>` line, never a stack trace |
