---
type: domain-model
feature: envlint
bounded_context: env-validation
entities: [EnvFile, Schema]
value_objects: [Pair, Problem, Finding, KeyRule]
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: ready
---

# Domain Model — envlint

## Bounded Context
`env-validation`: one process, no persistence, no network. Two pure modules (Parsing, Rules) that share
nothing, joined only by the CLI composition root.

## Aggregates

### Aggregate: EnvFile (NEW)
The parsed form of a `.env` text: `{ pairs: Pair[], problems: Problem[] }`. Produced by Parsing from text
alone; it never reads a file itself.

### Aggregate: Schema (NEW)
A JSON object mapping each key name to a `KeyRule`. Read and shape-checked by the CLI, consumed by Rules.

## Value Objects

| Value object | Shape | Notes |
|---|---|---|
| Pair | `{ key: string, value: string, line: number }` | `line` is 1-based; the last assignment of a key wins |
| Problem | `{ line: number, message: string }` | a line Parsing could not parse |
| KeyRule | `{ required?: boolean, type?: "string"\|"int"\|"bool"\|"url", enum?: string[] }` | |
| Finding | `{ key: string, line: number \| null, message: string }` | `line` is null for a missing required key |

## Domain Events
None.

## Repository Interfaces
None — the only IO is the CLI reading its two argument files.

```typescript
// Module seams (no repositories)
export function parse(text: string): { pairs: Pair[]; problems: Problem[] }            // src/parse.mjs
export function check(pairs: Pair[], schema: Record<string, KeyRule>): Finding[]       // src/rules.mjs
```
