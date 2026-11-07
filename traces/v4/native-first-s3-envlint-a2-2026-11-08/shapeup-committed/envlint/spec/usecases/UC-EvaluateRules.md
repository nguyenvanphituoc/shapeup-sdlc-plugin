---
type: usecase
feature: envlint
id: UC-EvaluateRules
bounded_context: env-validation
actor: System
entities: [Schema]
repositories: []
domain_events_emitted: []
tags: [rules, pure]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: EvaluateRules

## Summary
The rules module takes parsed pairs and a schema object and decides what is wrong, one finding per
violated rule.

## Preconditions
- `pairs` has the shape in [[contracts/envlint.contract]] §1. The schema is an already-parsed JSON value.

## Input

```typescript
interface EvaluateRulesInput {
  pairs: { key: string; value: string; line: number }[];
  schema: unknown; // validated here against contract §2
}
```

## Steps

```
1. Validate schema shape (contract §2); any violation → schemaErrors, findings []
2. Index pairs by key, last occurrence wins
3. For each schema key: required and absent → finding {key, line:null, rule:"required"}
4. For each present key with a type: check int / bool / url / string (contract §3)
5. For each present key with an enum: check membership
6. Return {findings, schemaErrors}
```

## Output

```typescript
interface EvaluateRulesOutput {
  findings: { key: string; line: number | null; rule: "required" | "type" | "enum"; message: string }[];
  schemaErrors: string[];
}
```

## System Flow

```
[CLI: bin/envlint.mjs passes pairs + parsed schema]
  → [Use Case: checkRules(pairs, schema) in src/rules.mjs]
    ← [{findings, schemaErrors} returned to CLI]
```

## Invariants
- [INV-01] `checkRules` never throws, for any `schema` value (including `null`, arrays and strings).
- [INV-02] `src/rules.mjs` imports nothing from the parsing module and makes no network access.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `REQUIRED_MISSING` | a `required: true` key does not occur in pairs | n/a | finding `required key is missing`, line null |
| `TYPE_MISMATCH` | a present value fails its `type` check | n/a | finding `expected <type>, got "<value>"` with the pair's line |
| `ENUM_MISMATCH` | a present value is not in `enum` | n/a | finding `expected one of …` with the pair's line |
| `SCHEMA_INVALID` | schema not an object, a rule not an object, unknown field, unknown `type`, `enum` not a string array | n/a | `schemaErrors` non-empty, findings `[]` |

## Test Surface
<!-- DERIVED — D1 Invariants · D2 Error Cases · D3 contract shape · D4 no-gos. Oracle: test (library module). -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | `checkRules([], null)`, `([], [])`, `([], "x")`, `([], {A:5})` | each returns `schemaErrors` non-empty, no throw | D1: INV-01 + D2: SCHEMA_INVALID (dedup) |
| TS-INV-02 | test | read `src/rules.mjs` imports in a test | no import of `parse`, no `http`/`https`/`net`/`fetch` use | D1: INV-02 |
| TS-ERR-REQUIRED_MISSING | test | schema `{A:{required:true}}`, pairs `[]` | one finding `{key:"A", line:null, rule:"required"}` | D2 |
| TS-ERR-TYPE_MISMATCH | test | `int` with `"12"`, `"-3"` (pass) and `"1.5"`, `"x"`, `""` (fail); `bool` with `true`/`false` (pass) and `yes`/`1` (fail) | passes give no finding; fails give `rule:"type"` with the pair's line | D2 + D3: contract §3 type rules |
| TS-REQ-url-shape | test | `url` with `https://x.com/p`, `postgres://u@h:5432/db` (pass) and `foo:bar`, `localhost:3000`, `http://`, `not a url` (fail) | passes give no finding, fails give `rule:"type"`; no network | D3: contract §3 + D4: no network |
| TS-ERR-ENUM_MISMATCH | test | `enum:["dev","prod"]` with `dev` (pass) and `stage` (fail) | fail gives `rule:"enum"` | D2 |
| TS-REQ-last-wins | test | pairs `A=x (line 1)`, `A=5 (line 2)`, schema `{A:{type:"int"}}` | no finding (last occurrence used) | D3: contract §1 duplicates |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — findings are printed by the CLI
- ← [[contracts/envlint.contract]] — §2 schema shape, §3 rules
