---
type: usecase
feature: envlint
id: UC-EvaluateRules
bounded_context: EnvValidation
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
The CLI hands a parsed schema to `validateSchema(schema)` and then the pairs and schema to `evaluate(pairs, schema)` in `src/rules.mjs`, which returns the findings, with no I/O.

## Preconditions
- `src/rules.mjs` imports nothing from `src/parse.mjs`; it is written against the `Pair` shape in [[domain-model#Value Objects]].
- `evaluate` is called only with a schema for which `validateSchema` returned `[]`.

## Input

```typescript
validateSchema(schema: unknown): string[]
evaluate(pairs: { key: string; value: string; line: number }[], schema: Schema): Finding[]
```

## Steps

```
validateSchema:
1. Not a plain object (null, array, primitive) → ["schema must be a JSON object"].
2. For each key K: rule not a plain object → "K: rule must be an object".
   required present and not boolean → "K: required must be true or false".
   type present and not one of string|int|bool|url → "K: unknown type <t>".
   enum present and not a non-empty array of strings → "K: enum must be a non-empty array of strings".
   any other property P → "K: unknown property P".
3. Return the list (empty = valid).

evaluate:
1. For each key K in schema order, take the LAST pair whose key is K (a later duplicate wins).
2. No pair and rule.required === true → Finding MISSING_REQUIRED, line null, "required key is missing".
3. No pair → nothing more for K. Keys present in pairs but absent from the schema are ignored.
4. type present and the value fails its predicate ([[domain-model#Value Types]]) →
   Finding INVALID_TYPE at the pair's line, message "expected <type>, got \"<value>\"".
5. enum present and value is not exactly (case-sensitive) one of its entries →
   Finding NOT_IN_ENUM at the pair's line, message "expected one of <a>, <b>, …; got \"<value>\"".
   A value can yield both INVALID_TYPE and NOT_IN_ENUM.
6. Return findings in schema key order (the CLI sorts for output).
```

## Output

```typescript
interface Finding { key: string; line: number | null; code: "MISSING_REQUIRED" | "INVALID_TYPE" | "NOT_IN_ENUM"; message: string }
```

## System Flow

```
[CLI: bin/envlint.mjs has JSON.parse(schemaText) and parse(envText).pairs]
  → [Module: src/rules.mjs validateSchema(schema)] ← string[]
  → [Module: src/rules.mjs evaluate(pairs, schema)] ← Finding[]   (no I/O, no event)
```

## Invariants

- [INV-01] `validateSchema` and `evaluate` are pure: no I/O, no network, no mutation of their arguments.
- [INV-02] Type predicates judge the raw string: `int` rejects `""`, `" 7"`, `"1e3"`, `"0x10"`, `"3.0"`; `url` rejects `localhost:3000`, `mailto:x@y`, `http:/x`.
- [INV-03] An empty value (`KEY=`) is present for `required`, and is still type- and enum-checked.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `MISSING_REQUIRED` | `required: true`, key absent | — | Finding, `line: null` |
| `INVALID_TYPE` | value fails the type predicate | — | Finding at the pair's line |
| `NOT_IN_ENUM` | value not in `enum` | — | Finding at the pair's line |
| `SCHEMA_INVALID` | schema shape violates [[domain-model#Aggregate: Schema]] | — | `validateSchema` returns ≥1 message |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | call both functions, deep-compare arguments before/after | arguments unchanged; no fs/net import in `src/rules.mjs` | D1: INV-01 |
| TS-INV-02 | test | `int` on `42`,`-1`,`+3` and `""`,`" 7"`,`1e3`,`0x10`,`3.0`; `url` on `https://a.b`,`postgres://u:p@h:5432/db` and `localhost:3000`,`mailto:x@y`,`http:/x`,`https://`; `bool` on `true`,`FALSE`,`1`,`0` and `yes`,`""` | accepts/rejects exactly as listed | D1: INV-02 |
| TS-INV-03 | test | schema `{A:{required:true,type:"int"}}`, pair `A=""` | one INVALID_TYPE, no MISSING_REQUIRED | D1: INV-03 |
| TS-ERR-MISSING_REQUIRED | test | required key absent from pairs | one Finding MISSING_REQUIRED, `line: null` | D2 |
| TS-ERR-INVALID_TYPE | test | `PORT=abc` with `type:"int"` | Finding INVALID_TYPE at that pair's line | D2 |
| TS-ERR-NOT_IN_ENUM | test | `MODE=prod` with `enum:["dev","test"]` | Finding NOT_IN_ENUM at that pair's line | D2 |
| TS-ERR-SCHEMA_INVALID | test | `validateSchema` on `[]`, `null`, `{A:{type:"float"}}`, `{A:{enum:[]}}`, `{A:{required:"yes"}}`, `{A:{foo:1}}` | each returns ≥1 message; a valid schema returns `[]` | D2 |
| TS-REQ-duplicate | test | pairs `A=x` (line 1) then `A=1` (line 2), `type:"int"` | no finding (last wins) | D3 |
| TS-NOGO-01 | test | grep `src/rules.mjs` imports | no import of `./parse.mjs`, no `node:fs`/`node:net`/`node:http`/`node:dns` | D4 |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — the CLI is the only caller
- ← [[domain-model#Value Types]] — the predicate table
