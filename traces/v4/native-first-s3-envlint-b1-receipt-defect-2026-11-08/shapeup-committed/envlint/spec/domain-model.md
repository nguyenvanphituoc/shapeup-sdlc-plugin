---
type: domain-model
feature: envlint
bounded_context: EnvValidation
entities: [EnvFile, Schema]
value_objects: [Pair, ParseProblem, KeyRule, Finding]
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: ready
---

# Domain Model: envlint

## Bounded Context
`EnvValidation` context — owns turning `.env` text into pairs, judging pairs against a schema, and
reporting the result. It does NOT own loading values into a process environment, interpolation, or
any network access.

There is no persistence and there are no repositories: every operation is a pure function over
in-memory data, except the CLI, which reads (never writes) two files.

---

## Aggregate: EnvFile

**Aggregate Root:** `EnvFile` — the result of parsing one `.env` text.

**Invariants:**
- Every `Pair` and every `ParseProblem` carries the 1-based line number it came from.
- A line yields at most one `Pair` or one `ParseProblem`, never both.
- Values are kept literally: `${VAR}` is never expanded.

```
EnvFile (Aggregate Root)            ← return value of parse(text)
├── pairs: Pair[]                   (source order; duplicates kept)
└── problems: ParseProblem[]        (source order)
```

## Aggregate: Schema

**Aggregate Root:** `Schema` — a JSON object mapping a key name to a `KeyRule`.

```
Schema = { [key: string]: KeyRule }
```

**Invariants (checked by `validateSchema`):**
- The schema is a JSON object (not an array, not null).
- Each `KeyRule` is an object; `required`, if present, is a boolean; `type`, if present, is one of
  `string` | `int` | `bool` | `url`; `enum`, if present, is a non-empty array of strings.
- Any other property on a `KeyRule` is a schema error.

---

## Value Objects

| Value Object | Fields | Invariants |
|---|---|---|
| `Pair` | `key: string`, `value: string`, `line: number` | `key` matches `^[A-Za-z_][A-Za-z0-9_]*$`; `line` ≥ 1 |
| `ParseProblem` | `line: number`, `message: string` | `line` ≥ 1; `message` is one line, no stack trace |
| `KeyRule` | `required?: boolean`, `type?: "string"\|"int"\|"bool"\|"url"`, `enum?: string[]` | see Schema invariants |
| `Finding` | `key: string`, `line: number \| null`, `code: "MISSING_REQUIRED"\|"INVALID_TYPE"\|"NOT_IN_ENUM"`, `message: string` | `line` is null only for `MISSING_REQUIRED` |

**The `Pair` shape is the one cross-module contract.** `src/parse.mjs` produces it and `src/rules.mjs`
consumes it; neither module imports the other, so both are written against this table.

### Value Types

Every type predicate judges the **raw string**, never a converted number.

| type | accepts | rejects (examples) |
|---|---|---|
| `string` | any value, including empty | — |
| `int` | `^[+-]?[0-9]+$` | `""`, `" 7"`, `"1e3"`, `"0x10"`, `"3.0"`, `"abc"` |
| `bool` | `true`, `false`, `1`, `0` — case-insensitive | `""`, `"yes"`, `"on"`, `"2"` |
| `url` | `URL.canParse(v)` **and** parsed `host` non-empty **and** `v` contains `://` | `""`, `"not a url"`, `"localhost:3000"`, `"mailto:x@y"`, `"http:/x"`, `"https://"` |

`url` accepts e.g. `https://a.b`, `http://localhost:3000`, `postgres://u:p@h:5432/db`. No predicate
performs I/O.

---

## Domain Events

None — the context has no subscribers and no state that outlives one invocation.

---

## Module Interfaces

```typescript
// src/parse.mjs — pure, imports nothing from src/rules.mjs
export function parse(text: string): { pairs: Pair[]; problems: ParseProblem[] }

// src/rules.mjs — pure, imports nothing from src/parse.mjs
export function validateSchema(schema: unknown): string[]           // [] = valid
export function evaluate(pairs: Pair[], schema: Schema): Finding[]
```

---

## Related
- [[ux-behavior]] — how findings and errors are printed
- [[usecases/_index]] — use cases that operate on these aggregates
