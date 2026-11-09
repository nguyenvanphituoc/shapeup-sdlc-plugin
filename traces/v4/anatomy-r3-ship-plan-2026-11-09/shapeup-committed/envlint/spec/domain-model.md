---
type: domain-model
feature: envlint
bounded_context: EnvValidation
status: draft
---

# Domain model — envlint

One bounded context, **EnvValidation**. No aggregates with identity and no persistence: everything is an
immutable value object passed between two pure services. No repositories.

## Value objects

| Value object | Shape | Notes |
|---|---|---|
| `EnvPair` | `{ key: string, value: string, line: number }` | `line` is 1-based; `value` has surrounding matching quotes removed |
| `ParseProblem` | `{ line: number, message: string }` | a line that is not blank, not a comment, and not a valid assignment |
| `ParseResult` | `{ pairs: EnvPair[], problems: ParseProblem[] }` | output of parsing |
| `KeyRule` | `{ required?: boolean, type?: "string"\|"int"\|"bool"\|"url", enum?: string[] }` | one schema entry |
| `Schema` | `{ [key: string]: KeyRule }` | the parsed schema file |
| `Finding` | `{ key: string, line: number \| null, message: string }` | `line` is `null` for a missing required key |

## Services (pure)

| Service | Module | Signature | Imports |
|---|---|---|---|
| Parser | `src/parse.mjs` | `parse(text: string): ParseResult` | nothing from this project |
| Rules | `src/rules.mjs` | `check(pairs: EnvPair[], schema: Schema): Finding[]` | nothing from this project |

The CLI (`bin/envlint.mjs`) is the composition root: it reads the two files with `node:fs`, calls `parse`,
then `check`, prints, and sets the exit code. Parser and Rules never import each other.

## Domain events

None.
