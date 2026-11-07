---
type: contract
feature: envlint
tags: [contract]
depends_on: ["[[domain-model]]"]
status: ready
---

# Contracts — envlint

## parse (src/parse.mjs)

```typescript
type Pair = { key: string; value: string; line: number };      // line is 1-based
type Problem = { line: number; message: string };
export function parse(text: string): { pairs: Pair[]; problems: Problem[] };
```
- Never throws for any string input. Imports nothing.

## check (src/rules.mjs)

```typescript
type KeyRule = { required?: boolean; type?: "string" | "int" | "bool" | "url"; enum?: string[] };
type Finding = { key: string; line: number | null; message: string };
export function check(pairs: Pair[], schema: Record<string, KeyRule>): Finding[];
```
- Never throws for a schema of the shape above. Imports nothing (in particular, not `src/parse.mjs`).
- Messages: `required key is missing` · `expected int, got "<v>"` · `expected bool, got "<v>"` ·
  `expected url, got "<v>"` · `expected one of a|b|c, got "<v>"`.

## CLI (bin/envlint.mjs)

```
envlint --schema <schema.json> <envfile>
exit 0 clean · 1 problems or findings · 2 usage / unreadable env file / unreadable schema
```
