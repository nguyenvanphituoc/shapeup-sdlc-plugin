---
type: domain-model
feature: envlint
bounded_context: env-validation
entities: [EnvFile, Schema]
value_objects: [Pair, ParseProblem, KeyRule, Finding]
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: ready
---

# Domain Model — envlint

## Bounded Context
`env-validation`: a single, stateless context. Nothing is persisted; there are no repositories and no
domain events. Two pure modules (parsing, rules) and one composition root (the CLI).

## Aggregates

### Aggregate-EnvFile
The text of one `.env` file. Parsing turns it into an ordered list of `Pair` plus a list of
`ParseProblem`. Owned by the parsing module (`src/parse.mjs`). Never written back to disk.

### Aggregate-Schema
A JSON object mapping a key name to a `KeyRule`. Read by the CLI, validated for shape by the rules module
(`src/rules.mjs`), applied to the pairs to produce `Finding`s.

## Value Objects

| Value object | Fields | Notes |
|---|---|---|
| Pair | `key: string`, `value: string`, `line: number` (1-based) | value has surrounding quotes removed, no interpolation |
| ParseProblem | `line: number` (1-based), `message: string` | a line the parser cannot turn into a Pair |
| KeyRule | `required?: boolean`, `type?: "string"\|"int"\|"bool"\|"url"`, `enum?: string[]` | |
| Finding | `key: string`, `line: number\|null`, `rule: "required"\|"type"\|"enum"`, `message: string` | `line` is null for a missing required key |

## Domain Events
None.

## Repository Interfaces
None — the context persists nothing. The only shared contract is the data that crosses between the two
pure modules, through the CLI: see [[contracts/envlint.contract]].

```typescript
// The two pure functions — neither module imports the other.
declare function parseEnv(text: string): { pairs: Pair[]; problems: ParseProblem[] };
declare function checkRules(pairs: Pair[], schema: unknown): { findings: Finding[]; schemaErrors: string[] };
```
