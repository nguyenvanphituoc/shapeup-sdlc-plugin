---
type: domain-model
feature: envlint
bounded_context: EnvValidation
entities: [EnvPair, ParseProblem]
value_objects: [KeyRule, Schema, Finding]
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: draft
---

# Domain Model: envlint

## Bounded Context
`EnvValidation` — owns turning `.env` text into pairs and judging pairs against a schema. It does NOT own
loading values into a process environment, interpolation, or writing files (see [[_index#Non-Go (pitch Boundaries)]]).

Three modules, two of them pure and mutually independent:

| Module | Role | Imports |
|---|---|---|
| `src/parse.mjs` | Parsing — text → `{pairs, problems}` | nothing |
| `src/rules.mjs` | Rules — schema check + pairs × schema → findings | nothing |
| `bin/envlint.mjs` | CLI — composition root | `node:fs`, `node:process`, `src/parse.mjs`, `src/rules.mjs` |

**Invariant (module):** `src/parse.mjs` never imports `src/rules.mjs` and vice versa; neither imports any `node:` I/O or network module.

---

## Value Objects

| Value Object | Fields | Invariants |
|---|---|---|
| `EnvPair` | `key: string`, `value: string`, `line: number` | `key` matches `/^[A-Za-z_][A-Za-z0-9_]*$/`; `line` ≥ 1 |
| `ParseProblem` | `line: number`, `message: string` | `line` ≥ 1, the 1-based line of the unparseable text |
| `KeyRule` | `required?: boolean`, `type?: "string"\|"int"\|"bool"\|"url"`, `enum?: string[]` | no other fields; `enum` non-empty array of strings |
| `Schema` | `{ [key: string]: KeyRule }` (a plain JSON object) | top level is an object (not array/null) |
| `SchemaProblem` | `key: string \| null`, `message: string` | — |
| `Finding` | `key: string`, `line: number \| null`, `rule: "required"\|"type"\|"enum"`, `message: string` | `line` is the line of the pair judged (the last occurrence), `null` for a missing key |

## Interfaces

```typescript
// src/parse.mjs
export function parseEnv(text: string): { pairs: EnvPair[]; problems: ParseProblem[] }

// src/rules.mjs
export function checkSchema(schema: unknown): SchemaProblem[]          // [] = valid
export function checkRules(pairs: EnvPair[], schema: Schema): Finding[] // assumes checkSchema(schema) is []
```

## Related
- [[ux-behavior]] — how findings are printed and which exit code results
- [[usecases/_index]] — use cases that operate on these values
