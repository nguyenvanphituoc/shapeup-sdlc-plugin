---
type: usecase
feature: envlint
id: UC-CheckEnvAgainstSchema
bounded_context: envlint
actor: System
entities: [EnvPair, Schema, Finding]
repositories: []
domain_events_emitted: []
tags: [rules, pure]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: CheckEnvAgainstSchema

## Summary
The CLI hands `check(pairs, schema)` the parsed pairs and the schema, which returns one finding per thing that is wrong.

## Preconditions
- `pairs` follows [[contracts/env-pairs.contract]]; `schema` is a parsed JSON object.

## Input

```typescript
interface CheckEnvAgainstSchemaInput {
  pairs: Array<{ key: string; value: string; line: number }>;
  schema: { [key: string]: { required?: boolean; type?: "string" | "int" | "bool" | "url"; enum?: string[] } };
}
```

## Steps

```
1. For each schema key with required: true and no pair → MISSING_REQUIRED (line null)
2. For each pair whose key is in the schema:
   a. type int  → value must match /^-?\d+$/
      type bool → value must be `true` or `false`
      type url  → value must parse as an absolute URL (string shape only, no network)
      type string → any value
      mismatch → TYPE_MISMATCH with the pair's line
   b. enum present → value must be one of the listed strings, else NOT_IN_ENUM with the pair's line
3. Return findings
```

## Output

```typescript
type CheckEnvAgainstSchemaOutput = Array<{ key: string; line: number | null; code: string; message: string }>;
```

## System Flow

```
[CLI: bin/envlint.mjs has pairs + schema]
  → [Use Case: check(pairs, schema) — src/rules.mjs]
    ← [findings]
```

## Invariants
- [INV-01] `check` makes no network access; `url` validates the string shape only.
- [INV-02] `src/rules.mjs` imports nothing from `src/parse.mjs` or `bin/`.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `MISSING_REQUIRED` | a `required: true` key has no pair | — | finding with `line: null` |
| `TYPE_MISMATCH` | a value does not match its `type` | — | finding with the pair's line |
| `NOT_IN_ENUM` | a value is not one of `enum` | — | finding with the pair's line |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | `check` a `url` value `https://example.invalid/x` with network unavailable | suite green: no finding, no request made | D1: INV-01 |
| TS-INV-02 | test | load `src/rules.mjs` imports | suite green: no import of `parse` or `bin/` | D1: INV-02 |
| TS-ERR-MISSING_REQUIRED | test | schema `{A:{required:true}}`, pairs `[]` | suite green: one MISSING_REQUIRED for A, line null | D2 |
| TS-ERR-TYPE_MISMATCH | test | `int` value `abc`, `bool` value `yes`, `url` value `not a url` | suite green: one TYPE_MISMATCH each, with its line | D2 + D3 (dedup) |
| TS-ERR-NOT_IN_ENUM | test | enum `["dev","prod"]`, value `staging` | suite green: one NOT_IN_ENUM with its line | D2 + D3 (dedup) |
| TS-REQ-type-valid | test | `int` `-42`, `bool` `true`/`false`, `url` `https://a.b`, `string` anything | suite green: no findings | D3 |
| TS-NOGO-01 | test | `url` value pointing at an unreachable host | suite green: accepted on shape alone, no network call | D4: no network access |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — findings flow to the CLI
- ← [[contracts/env-pairs.contract]] — the pairs consumed
