---
type: contract
feature: envlint
usecases: [UC-ParseEnvText, UC-CheckEnvAgainstSchema]
tags: [contract]
depends_on: ["[[domain-model]]"]
status: ready
---

# Contract — the parse → rules data shape

Parsing and Rules never import each other; this shape is the only thing they share.

## Request — `parse(text: string)` (src/parse.mjs)

| Field | Type | Required |
|---|---|---|
| `text` | string | yes |

## Response — `parse`

```typescript
interface ParseResult {
  pairs: Array<{ key: string; value: string; line: number }>; // line is 1-based
  problems: Array<{ line: number; message: string }>;
}
```

## Request — `check(pairs, schema)` (src/rules.mjs)

| Field | Type | Required |
|---|---|---|
| `pairs` | `Array<{key, value, line}>` | yes |
| `schema` | `{ [key]: { required?: boolean; type?: "string"\|"int"\|"bool"\|"url"; enum?: string[] } }` | yes |

## Response — `check`

```typescript
type Findings = Array<{ key: string; line: number | null; code: "MISSING_REQUIRED" | "TYPE_MISMATCH" | "NOT_IN_ENUM"; message: string }>;
```

## Errors
Neither function throws on a string / array input it was given; malformed input becomes a problem or a
finding.
