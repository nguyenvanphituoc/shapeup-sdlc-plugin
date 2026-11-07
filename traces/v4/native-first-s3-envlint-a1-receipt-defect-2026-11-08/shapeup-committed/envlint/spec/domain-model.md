---
type: domain-model
feature: envlint
bounded_context: envlint
entities: [EnvPair, ParseProblem, Schema, Finding]
value_objects: [KeyRule]
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: ready
---

# Domain model — envlint

## Bounded Context
`envlint` — one context, no persistence, no events. Two pure modules and one composition root:
`src/parse.mjs` (text → pairs), `src/rules.mjs` (pairs + schema → findings), `bin/envlint.mjs` (I/O).

## Aggregates

### EnvPair
A parsed assignment: `{ key: string, value: string, line: number }` — `line` is 1-based. Quotes are
stripped from `value`; `${VAR}` text is kept literally.

### ParseProblem
A line the parser could not read: `{ line: number, message: string }`.

### Schema
A JSON object mapping each key name to a KeyRule: `{ "<KEY>": { "required"?: boolean, "type"?:
"string"|"int"|"bool"|"url", "enum"?: string[] } }`.

### Finding
One thing wrong: `{ key: string, line: number | null, code: string, message: string }` — `line` is the
EnvPair's line, `null` for a missing key.

## Value Objects

| Name | Shape | Rule |
|---|---|---|
| KeyRule | `{required?, type?, enum?}` | `type` is one of `string`, `int`, `bool`, `url` |

## Domain Events

| Event | Emitted by | Payload |
|---|---|---|
| — | — | none: the tool is a pure check |

## Repository Interfaces

```typescript
// None. The CLI reads two files with node:fs; nothing is persisted.
```
