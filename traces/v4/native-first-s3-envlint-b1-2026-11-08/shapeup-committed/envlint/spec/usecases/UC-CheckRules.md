---
type: usecase
feature: envlint
id: UC-CheckRules
bounded_context: envlint
actor: System
entities: [Schema]
repositories: []
domain_events_emitted: []
tags: [rules, pure]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: CheckRules

## Summary
The system checks parsed pairs against a schema and returns one finding per violation; a separate
check says whether the schema itself is well formed.

## Preconditions
- `pairs` has the EnvPair shape from [[domain-model#Value Objects]].
- `schema` passed `checkSchema` (the CLI guarantees this).

## Input

```typescript
type Schema = Record<string, { required?: boolean; type?: "string" | "int" | "bool" | "url"; enum?: string[] }>;
interface CheckRulesInput {
  pairs: { key: string; value: string; line: number }[];
  schema: Schema;
}
// checkSchema(schema: unknown): string[]   — empty array = valid
```

## Steps

```
1. checkSchema: reject a non-object or array schema, a non-object rule, a `type` outside the four,
   a non-boolean `required`, an `enum` that is not an array of strings (PD-7) → list of reasons
2. check: for each schema key, take the LAST pair with that key (PD-6)
3. absent and `required: true` → Finding{rule:"required", line:null}
4. present and `type` set → int ^-?[0-9]+$ (PD-8) · bool true|false (PD-9) · url new URL() ok (PD-10) · string always ok
5. present and `enum` set → value must equal one entry (PD-11)
6. Keys not in the schema are ignored
7. Return findings in schema key order
```

## Output

```typescript
interface Finding { key: string; line: number | null; rule: "required" | "type" | "enum"; message: string }
type CheckRulesOutput = Finding[];
```

## System Flow

```
[CLI: bin/envlint.mjs has pairs + parsed schema JSON]
  → [src/rules.mjs: checkSchema(schema)]  → reasons[]
  → [src/rules.mjs: check(pairs, schema)] → findings[]
```

## Invariants
- [INV-01] `rules` is pure: the module imports neither `node:fs`, nor any network module, nor the parse module.
- [INV-02] A `url` value is judged by its shape only; checking it opens no network connection.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `RULE_REQUIRED` | required key absent | n/a | Finding rule `required`, line null |
| `RULE_TYPE` | value does not match `type` | n/a | Finding rule `type`, line of the pair |
| `RULE_ENUM` | value not in `enum` | n/a | Finding rule `enum`, line of the pair |
| `SCHEMA_INVALID` | schema shape breaks PD-7 | n/a | `checkSchema` returns a non-empty reason list |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | inspect `src/rules.mjs` imports | suite green: no `node:fs`, `node:http(s)`, `node:net` or parse import | D1: INV-01 |
| TS-INV-02 | test | `check([{key:"U",value:"https://nonexistent.invalid",line:1}], {U:{type:"url"}})` | suite green: no findings, returns synchronously | D1: INV-02 + D4: no network |
| TS-ERR-RULE_REQUIRED | test | schema `{A:{required:true}}`, no pairs | suite green: one finding rule `required`, line null | D2 |
| TS-ERR-RULE_TYPE | test | one bad value per type: int `1.5`, bool `yes`, url `localhost` | suite green: one `type` finding each with the pair's line; `-3`, `true`, `https://x.y` give none | D2 + D3 |
| TS-ERR-RULE_ENUM | test | schema `{E:{enum:["a","b"]}}`, value `c` | suite green: one `enum` finding; value `a` gives none | D2 |
| TS-ERR-SCHEMA_INVALID | test | `checkSchema([])`, `{A:1}`, `{A:{type:"float"}}`, `{A:{enum:"x"}}` | suite green: each returns a non-empty reason list; a valid schema returns `[]` | D2 + D3 |
| TS-REQ-duplicate-last | test | pairs `A=x` (line 1), `A=1` (line 2), schema `{A:{type:"int"}}` | suite green: no findings (the last occurrence is judged) | D3 |

## Integration Points
- ← [[usecases/UC-ParseEnv]] — pairs are its input
- → [[usecases/UC-LintEnvFile]] — findings are printed by the CLI
