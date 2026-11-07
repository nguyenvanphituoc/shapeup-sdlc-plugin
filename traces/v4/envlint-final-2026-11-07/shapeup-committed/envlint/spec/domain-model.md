---
type: domain-model
feature: envlint
bounded_context: env-validation
entities: [EnvFile, Assignment, Schema, Finding]
value_objects: [Line, ParseProblem, KeyRule, ValueType]
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: ready
---

# Domain model — envlint

## Bounded Context
`env-validation` — one context, no persistence, no events. Two pure modules (Parsing, Rules) and one
I/O shell (CLI). Parsing and Rules share only data shapes; neither imports the other.

## Aggregates

### EnvFile (Parsing)
The text of one `.env` file, parsed into an ordered list of `Assignment`s and a list of
`ParseProblem`s. Built by `parse(text)` in `src/parse.mjs` — see [[contracts/parse.contract]].

### Schema (Rules)
A JSON object mapping a key name to its `KeyRule`. Validated by `validateSchema(schema)` and applied
by `lint(pairs, schema)` in `src/rules.mjs` — see [[contracts/rules.contract]].

## Value Objects

| Name | Shape | Notes |
|---|---|---|
| Line | integer ≥ 1 | 1-based line number in the env file |
| Assignment | `{ key: string, value: string, line: Line }` | one per parsed `KEY=value` line, in file order; duplicates kept |
| ParseProblem | `{ line: Line, message: string }` | a line the parser could not read |
| ValueType | `"string" \| "int" \| "bool" \| "url"` | the four supported types |
| KeyRule | `{ required?: boolean, type?: ValueType, enum?: string[] }` | per-key schema entry |
| Finding | `{ key: string, line: Line \| null, rule: "required" \| "type" \| "enum", message: string }` | `line` is `null` only for a missing required key |

## Domain Events
None.

## Repository Interfaces
None — the only I/O is the CLI reading two files, specified in [[contracts/cli.contract]].

```typescript
// Pure module surfaces (no repositories)
export function parse(text: string): { pairs: Assignment[]; problems: ParseProblem[] };
export function validateSchema(schema: unknown): string[];          // [] = valid
export function lint(pairs: Assignment[], schema: Schema): Finding[];
```
