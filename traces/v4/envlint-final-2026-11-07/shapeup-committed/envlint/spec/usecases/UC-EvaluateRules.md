---
type: usecase
feature: envlint
id: UC-EvaluateRules
bounded_context: env-validation
actor: System
entities: [Schema, Finding]
repositories: []
domain_events_emitted: []
tags: [rules, pure]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: EvaluateRules

## Summary
The system validates a schema and judges parsed pairs against it, returning one finding per broken
`required` / `type` / `enum` rule, per [[contracts/rules.contract]].

## Preconditions
- `pairs` has the shape of [[contracts/parse.contract]]'s Response; the schema is a parsed JSON value.

## Input

```typescript
interface EvaluateRulesInput {
  pairs: { key: string; value: string; line: number }[];
  schema: Record<string, { required?: boolean; type?: "string" | "int" | "bool" | "url"; enum?: string[] }>;
}
```

## Steps

```
1. validateSchema(schema) → defects; non-empty defects are the caller's SCHEMA_INVALID
2. For each schema key in order, take the LAST assignment of that key in pairs
3. Absent and required → `required` finding (line null)
4. Present and typed → check type; mismatch → `type` finding at its line
5. Present and enum'd → check membership; miss → `enum` finding at its line
6. Return findings
```

## Output

```typescript
interface EvaluateRulesOutput {
  findings: { key: string; line: number | null; rule: "required" | "type" | "enum"; message: string }[];
}
```

## System Flow

```
[CLI: bin/envlint.mjs has parsed schema JSON + pairs]
  → [Module: validateSchema(schema), lint(pairs, schema) in src/rules.mjs]
    ← [Finding[] returned to the CLI]
```

## Invariants
- [INV-01] `validateSchema` and `lint` never throw — a malformed schema yields defects, not an exception.
- [INV-02] `src/rules.mjs` imports nothing from `src/parse.mjs`, and is verifiable alone against its own fixtures.
- [INV-03] The `url` check is shape-only: no network call, and a non-`http(s)` scheme is rejected.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `REQUIRED_MISSING` | `required: true` key absent from pairs | — | finding, rule `required`, line null |
| `TYPE_MISMATCH` | present value fails its `type` check | — | finding, rule `type`, at the value's line |
| `ENUM_MISMATCH` | present value not in `enum` | — | finding, rule `enum`, at the value's line |
| `SCHEMA_INVALID` | schema or a KeyRule breaks the contract shape | — | `validateSchema` returns ≥1 defect |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | `validateSchema` over `null`, `[]`, `"x"`, `{A: 1}`, `{A: {type: "float"}}`, `{A: {enum: []}}` | suite green: each returns ≥1 defect, no throw | D1: INV-01 + D2 SCHEMA_INVALID (dedup) |
| TS-INV-02 | test | Check `src/rules.mjs` import graph and run its test file alone (`node --test test/rules.test.mjs`) | suite green; no import of `parse` | D1: INV-02 |
| TS-INV-03 | test | `lint` with `type: url` over `https://a.b`, `http://a.b`, `foo:bar`, `ftp://x`, `not a url` | first two pass; last three → `type` findings; no network | D1: INV-03 |
| TS-ERR-REQUIRED_MISSING | test | schema `{A: {required: true}}`, pairs `[]` | one finding `{key: "A", line: null, rule: "required"}` | D2 |
| TS-ERR-TYPE_MISMATCH | test | `int` over `12`, `-3`, `1.5`, `x`; `bool` over `true`, `false`, `yes`, `TRUE` | `1.5`, `x`, `yes`, `TRUE` → `type` findings at their lines | D2 |
| TS-ERR-ENUM_MISMATCH | test | schema `{L: {enum: ["a","b"]}}`, value `c` at line 3 | one finding `{key: "L", line: 3, rule: "enum"}` | D2 |
| TS-REQ-pairs-duplicate | test | pairs with `A` at line 1 (`x`) and line 2 (`5`), schema `A: int` | no finding (last value `5` judged) | D3 |
| TS-REQ-schema-optional | test | schema `{A: {type: "int"}}`, pairs `[]` | no finding | D3 |

## Integration Points
- ← [[usecases/UC-ParseEnvText]] — consumes `pairs`
- ← [[usecases/UC-LintEnvFile]] — called by the CLI; findings are printed there
