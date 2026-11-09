---
type: usecase
feature: envlint
id: UC-CheckRules
bounded_context: EnvValidation
actor: System
entities: [EnvPair, Schema, KeyRule, Finding]
repositories: []
domain_events_emitted: []
tags: [pure, rules]
depends_on: ["[[domain-model]]"]
status: draft
---

# Use Case: CheckRules

## Summary
The rules checker takes parsed pairs and a schema and returns one finding per violated rule, naming the key and, where one exists, the line.

## Preconditions
- `schema` is a plain object (the CLI rejects anything else before calling).

## Input

```typescript
interface CheckRulesInput {
  pairs: { key: string; value: string; line: number }[]
  schema: { [key: string]: { required?: boolean; type?: "string" | "int" | "bool" | "url"; enum?: string[] } }
}
```

## Steps

```
1. For each schema key, in schema order, take the LAST pair with that key (if any)
2. required && no pair            → Finding {key, line: null, "required key is missing"}
3. pair && type=int  && !/^-?\d+$/ → Finding {key, line, "expected int, got \"<value>\""}
4. pair && type=bool && value ∉ {true,false} → Finding {key, line, "expected bool, got \"<value>\""}
5. pair && type=url  && !URL.canParse(value) → Finding {key, line, "expected url, got \"<value>\""}
6. pair && enum && value ∉ enum   → Finding {key, line, "expected one of [<enum>], got \"<value>\""}
7. type=string accepts any value; keys absent from the schema are ignored
8. Return findings
```

## Output

```typescript
type CheckRulesOutput = { key: string; line: number | null; message: string }[]
```

## System Flow

```
[Use Case: check(pairs, schema)]  — src/rules.mjs, pure, no I/O, imports nothing from src/parse.mjs
```

## Invariants
- [INV-01] Checking never throws for a pairs array and a plain-object schema.
- [INV-02] The rules module does not import the parser module and performs no I/O or network access.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `RULE_REQUIRED` | `required: true` and no pair has the key | n/a | Finding with `line: null` |
| `RULE_TYPE` | a pair's value does not match its `type` (`int`, `bool`, `url`) | n/a | Finding with the pair's line |
| `RULE_ENUM` | a pair's value is not in its `enum` | n/a | Finding with the pair's line |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | `check([], {})`, `check([], {A:{}})` | returns `[]`, no throw | D1: INV-01 |
| TS-INV-02 | test | static import graph of `src/rules.mjs` | no import of `src/parse.mjs`, no `node:fs`/`node:http`/`node:net` | D1: INV-02 |
| TS-ERR-RULE_REQUIRED | test | schema `{A:{required:true}}`, no pair `A` | one finding `{key:"A", line:null}` | D2 |
| TS-ERR-RULE_TYPE | test | `int` with `"1.5"`, `bool` with `"yes"`, `url` with `"not a url"` | one finding each with the pair's line | D2 |
| TS-ERR-RULE_ENUM | test | `enum:["a","b"]` with `"c"` | one finding with the pair's line | D2 |
| TS-REQ-type-accept | test | `int` `"-42"`, `bool` `"true"`/`"false"`, `url` `"https://x.example/p"`, `string` anything | no findings | D3 |
| TS-NOGO-01 | test | `url` value `"http://unreachable.invalid"` | no finding, no network call (shape only) | D4: url validates shape only; no network |

## Integration Points
- ← [[usecases/UC-LintEnvFile]] — called by the CLI with the parser's pairs and the schema file's JSON
