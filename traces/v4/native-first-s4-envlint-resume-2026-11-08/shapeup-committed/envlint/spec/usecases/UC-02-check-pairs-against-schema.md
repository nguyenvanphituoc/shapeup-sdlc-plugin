---
type: usecase
feature: envlint
id: UC-02
title: Check parsed pairs against a schema
actor: envlint CLI (caller of the rules engine)
engine: src/rules.mjs
covers: [REQ-17, REQ-18, REQ-19, REQ-20, REQ-22, REQ-23, REQ-30, REQ-31]
---

# UC-02 — Check parsed pairs against a schema

Contracts: [[domain-model#C2 — `Schema` (user file → Rules)]] · [[domain-model#C3 — `Finding` (Rules → CLI)]] · Back to [[_index]]

## Input / Output

```ts
checkSchema(schema: unknown) → string[]                       // empty = valid
checkPairs(pairs: {key, value, line}[], schema: Schema) → {key: string, line: number|null, rule: "required"|"type"|"enum", message: string}[]
```

`checkPairs` is only called with a schema for which `checkSchema` returned `[]`.

## Steps

1. `checkSchema`: reject a non-object top level, non-object rules, unknown rule fields, a non-boolean `required`, an unknown `type`, an `enum` that is not a non-empty string array.
2. `checkPairs`: index pairs by key, the last occurrence winning.
3. For each schema key present in the index: apply `type`, then `enum`; emit a finding per failure with the pair's line.
4. For each schema key with `required: true` absent from the index: emit a `required` finding with line `null`.
5. Order: lined findings ascending by line, then `required` findings in schema key order.

## Invariants

- [INV-01] `src/rules.mjs` is pure: no `import` statement, no I/O, no network — `url` is checked by string shape alone.
- [INV-02] A finding names the key and, for a present key, the line of the occurrence checked.
- [INV-03] Keys absent from the schema produce no finding.
- [INV-04] Neither function throws for a schema `checkSchema` accepts and pairs in the C1 shape.

## Error Cases

| Code | Condition | Result |
|---|---|---|
| REQUIRED_MISSING | `required: true` and the key is absent | finding `rule: "required"`, `line: null` |
| TYPE_MISMATCH | value fails its `type` predicate | finding `rule: "type"` with `expected <type>, got "<value>"` |
| ENUM_MISMATCH | value is not an exact member of `enum` | finding `rule: "enum"` |
| SCHEMA_INVALID | `checkSchema` finds a structural fault | non-empty error list |

## System Flow

`bin/envlint.mjs` parses the schema JSON → `checkSchema` → `checkPairs(pairs from [[usecases/UC-01-parse-env-text]], schema)` → findings printed per [[ux-behavior]].

## Test Surface
<!-- DERIVED — regenerate via a retrofit-surface spec step; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | Inspect `src/rules.mjs`; check `url` on `http://unreachable.invalid` | no `import`; the URL passes by shape, no network module referenced | D1: INV-01 + D4: no network |
| TS-INV-02 | test | Duplicate key `A` on lines 1 and 3, failing type on line 3 | one finding with `line: 3` | D1: INV-02 |
| TS-INV-03 | test | Pairs include `EXTRA` not in the schema | no finding for `EXTRA` | D1: INV-03 |
| TS-INV-04 | test | `checkSchema` on an accepted schema (`url`+`enum`, `required`), then `checkPairs` on C1 pairs including a value `::::` and an empty value, and on keys `__proto__`/`constructor`/`toString` | `checkSchema` returns `[]`; neither call throws | D1: INV-04 |
| TS-ERR-REQUIRED_MISSING | test | Schema requires `PORT`; pairs empty | `{key:"PORT", line:null, rule:"required"}` | D2 |
| TS-ERR-TYPE_MISMATCH | test | `int` on `1.0`, `0x10`, `1e3`, `""`; `bool` on `yes`; `url` on `localhost:3000`, `javascript:alert(1)`, `file:///etc` | a `type` finding for each | D2 + D3 |
| TS-REQ-type-boundary | test | `int` on `0`, `-5`, `42`; `bool` on `true`/`false`; `url` on `https://a.example/x`; `string` on `""` | no finding | D3 |
| TS-ERR-ENUM_MISMATCH | test | `enum: ["dev","prod"]` on `Dev` and `staging` | an `enum` finding for each; `dev` passes | D2 + D3 |
| TS-ERR-SCHEMA_INVALID | test | `checkSchema` on `[]`, `null`, `{"A":{"type":"float"}}`, `{"A":{"enum":[]}}`, `{"A":{"required":"yes"}}`, `{"A":{"min":1}}` | a non-empty error list for each; `{}` and a valid schema → `[]` | D2 + D3 |
