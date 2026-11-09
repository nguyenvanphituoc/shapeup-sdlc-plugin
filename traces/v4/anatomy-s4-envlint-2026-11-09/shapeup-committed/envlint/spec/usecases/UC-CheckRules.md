---
type: usecase
feature: envlint
id: UC-CheckRules
bounded_context: EnvValidation
actor: System
entities: [EnvPair, Finding]
repositories: []
domain_events_emitted: []
tags: [pure, rules]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: CheckRules

## Summary
The CLI hands a parsed schema to `checkSchema`, and — when it is valid — the pairs and schema to `checkRules`, which returns one finding per rule broken.

## Preconditions
- Module `src/rules.mjs` imports nothing. `pairs` has the shape SD-1 (array of `{key, value, line}`).

## Input

```typescript
interface CheckRulesInput {
  schema: unknown                 // JSON.parse output; checkSchema decides whether it is a Schema
  pairs: { key: string; value: string; line: number }[]
}
// Schema = { [KEY: string]: { required?: boolean; type?: "string"|"int"|"bool"|"url"; enum?: string[] } }
```

## Steps

```
1. checkSchema(schema):
   - not a plain object (null, array, string, number) → SchemaProblem{key: null}
   - per key: rule not a plain object, an unknown field, `required` not boolean, `type` not one of
     string|int|bool|url, `enum` not a non-empty array of strings → SchemaProblem{key}
   - return problems ([] = valid). Never throws.
2. checkRules(pairs, schema), for each schema key in the schema's own key order:
   a. find the LAST pair with that key (SD-1).
   b. absent and required === true → Finding{key, line: null, rule: "required", message: "missing required key"}.
   c. absent and not required → nothing.
   d. present: type int → /^-?[0-9]+$/; bool → "true" | "false"; url → new URL(value) succeeds and
      protocol is "http:" or "https:"; string → always ok. Mismatch → Finding{rule: "type", line: pair.line}.
   e. present and enum given and value not in enum → Finding{rule: "enum", line: pair.line}.
   (an empty value satisfies `required` and is checked by d/e — SD-2; keys not in the schema are ignored — SD-6)
3. Return findings.
```

## Output

```typescript
type SchemaProblem = { key: string | null; message: string }
type Finding = { key: string; line: number | null; rule: "required" | "type" | "enum"; message: string }
```

## System Flow

```
[CLI: bin/envlint.mjs has JSON.parse(schemaText) and parseEnv(...).pairs]
  → [checkSchema(schema) in src/rules.mjs]   ─(problems)─► CLI exits 2
  → [checkRules(pairs, schema) in src/rules.mjs]
    ← findings
```

## Invariants
- [INV-01] `checkSchema` and `checkRules` never throw for any JSON value / any well-formed pairs array.
- [INV-02] Rules is pure and makes no network access: `url` is decided by string shape alone; the module imports nothing.
- [INV-03] Rules never reads a value from anywhere but `pairs` (no `process.env`, no file).

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `SCHEMA_NOT_OBJECT` | schema is null / array / scalar | n/a | SchemaProblem, key null |
| `SCHEMA_BAD_RULE` | a key's rule is not an object, has an unknown field, a non-boolean `required`, an unknown `type`, or a bad `enum` | n/a | SchemaProblem naming the key |
| `RULE_REQUIRED` | required key absent from pairs | n/a | Finding rule `required`, line null |
| `RULE_TYPE` | present value fails its type grammar | n/a | Finding rule `type`, line of the last pair |
| `RULE_ENUM` | present value not in `enum` | n/a | Finding rule `enum`, line of the last pair |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | `checkSchema` on `null`, `[]`, `"x"`, `5`, `{A: null}`, `{A: {type: 7}}` | each returns ≥ 1 problem, none throws | D1: INV-01 |
| TS-INV-02 | test | `checkRules` with `URL=https://example.invalid/x`, type url; inspect the module's imports | finding-free; `src/rules.mjs` has no `import` | D1: INV-02 + D4: NOGO-05 |
| TS-INV-03 | test | set `process.env.A = "1"`, schema `{A:{required:true}}`, pairs `[]` | one `required` finding for A | D1: INV-03 + D4: NOGO-03 |
| TS-ERR-SCHEMA_NOT_OBJECT | test | `checkSchema([])` | one problem, key null | D2 |
| TS-ERR-SCHEMA_BAD_RULE | test | `checkSchema({A:{type:"float"}})`, `{A:{enum:[]}}`, `{A:{required:"yes"}}`, `{A:{min:1}}` | one problem each, key `A` | D2 |
| TS-ERR-RULE_REQUIRED | test | schema `{A:{required:true}}`, pairs `[]` | `[{key:"A", line:null, rule:"required"}]` | D2 |
| TS-ERR-RULE_TYPE | test | int: `12`, `-3` ok · `1.5`, `x`, `` fail; bool: `true`,`false` ok · `True`,`1` fail; url: `http://a.b`, `https://a.b/c` ok · `mailto:x`, `a.b`, `` fail | failures yield rule `type` with the pair's line | D2 + D3 (SD-3) |
| TS-ERR-RULE_ENUM | test | schema `{E:{enum:["dev","prod"]}}`, value `prod` ok, `test` fails | one `enum` finding on fail | D2 |
| TS-REQ-empty | test | schema `{A:{required:true}}`, pair `A=""` | no finding | D3 (SD-2) |
| TS-REQ-dup | test | int A, pairs A=`x`@1, A=`5`@2 | no finding (last wins) | D3 (SD-1) |
| TS-REQ-unknown-key | test | schema `{}`, pair `Z=1` | no finding | D3 (SD-6) |

## Integration Points
- ← [[usecases/UC-ParseEnvText]] — `pairs`
- ← [[usecases/UC-LintEnvFile]] — the CLI calls `checkSchema` then `checkRules`
