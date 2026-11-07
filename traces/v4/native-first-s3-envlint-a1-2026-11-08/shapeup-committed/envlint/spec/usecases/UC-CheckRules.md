---
type: usecase
feature: envlint
id: UC-CheckRules
bounded_context: env-validation
actor: System
entities: [Schema]
repositories: []
domain_events_emitted: []
tags: [rules]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: CheckRules

## Summary
The CLI hands parsed pairs and a schema to `check`, which returns one finding per rule a key breaks.

## Preconditions
- `schema` already has the KeyRule shape (the CLI rejects any other shape before calling).

## Input

```typescript
interface CheckRulesInput {
  pairs: { key: string; value: string; line: number }[];
  schema: Record<string, { required?: boolean; type?: "string" | "int" | "bool" | "url"; enum?: string[] }>;
}
```

## Steps

```
1. For each schema key in schema order:
2.   No pair for the key: required → finding { key, line: null, "required key is missing" }; else skip.
3.   type int  and value not /^-?[0-9]+$/        → finding "expected int, got \"<v>\"".
4.   type bool and value not true|false           → finding "expected bool, got \"<v>\"".
5.   type url  and (new URL(value) throws or host is empty) → finding "expected url, got \"<v>\"".
6.   type string → any value passes.
7.   enum present and value not in enum           → finding "expected one of a|b|c, got \"<v>\"".
8. Return findings: line-bearing ones sorted by line, then the missing-key ones in schema order.
```

## Output

```typescript
type CheckRulesOutput = { key: string; line: number | null; message: string }[];
```

## System Flow

```
[CLI: bin/envlint.mjs, after parse]
  → [Use Case: check(pairs, schema) in src/rules.mjs]
    ← [Finding[]]
```

## Invariants
- [INV-01] `src/rules.mjs` imports no other module (pure: data in, findings out; does not import Parsing).
- [INV-02] `url` validation never touches the network: it checks the string's shape only.
- [INV-03] `check` never throws for a schema of the KeyRule shape.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `MISSING_REQUIRED` | a `required` key has no pair | n/a | finding with `line: null` |
| `BAD_INT` | `type: int`, value not an integer | n/a | finding at the pair's line |
| `BAD_BOOL` | `type: bool`, value not `true`/`false` | n/a | finding at the pair's line |
| `BAD_URL` | `type: url`, `new URL` rejects it or its host is empty | n/a | finding at the pair's line |
| `NOT_IN_ENUM` | `enum` set, value not one of it | n/a | finding at the pair's line |

## Test Surface
<!-- DERIVED — D1–D4 only. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | read `src/rules.mjs` imports from the test suite | suite green: no `import` statement in the module | D1: INV-01 |
| TS-INV-02 | test | `check` with `type: url` on `https://example.invalid` while `globalThis.fetch` is replaced by a thrower | suite green: no finding, fetch never called | D1: INV-02 + D4: NOGO-05 |
| TS-INV-03 | test | `check([], {})`, `check([], {A:{}})`, `check(pairs, {A:{enum:[]}})` | suite green: arrays returned, never throws | D1: INV-03 |
| TS-ERR-MISSING_REQUIRED | test | `check([], {A:{required:true}})` | one finding, key A, line null | D2 |
| TS-ERR-BAD_INT | test | `PORT=80x` with `type: int`; also `80`, `-1` | finding for `80x` only | D2 + D3 |
| TS-ERR-BAD_BOOL | test | `DEBUG=yes` with `type: bool`; also `true`, `false` | finding for `yes` only | D2 + D3 |
| TS-ERR-BAD_URL | test | `foo`, `http://`, `a:b`, `mailto:x@y` vs `https://example.com` | findings for the four, none for the last | D2 + D3 |
| TS-ERR-NOT_IN_ENUM | test | `ENV=qa` with `enum: [dev, prod]` | one finding | D2 + D3 |
| TS-REQ-type-string | test | any value with `type: string` | no finding | D3 |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — findings flow to the CLI for printing.
