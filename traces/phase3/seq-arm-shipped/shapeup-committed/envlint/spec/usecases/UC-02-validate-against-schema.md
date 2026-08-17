---
schema_version: 1
doc_type: usecase
feature: envlint
id: UC-02
engine: rules
actor: CLI (internal caller)
---

# UC-02 — Validate parsed pairs against schema

**Actor**: the CLI, calling `lib/rules.mjs` directly after UC-01. Verified alone against its own
fixtures (pitch); imports nothing from `lib/parse.mjs`.

## Input
`{ pairs, problems }` (UC-01 output) + `schema: Record<string, SchemaKeyRule>` (parsed JSON from
the schema file, parsing owned by the CLI per UC-03).

## Output
`{ findings: Finding[], checked: number, ok: boolean }` — see
[[contracts/rules-contract|rules-contract]].

## Steps
1. `findings = []`.
2. For each `p` in `problems`: push `{ key: "", line: p.line, message: "not a KEY=VALUE assignment", rawText: p.rawText }`.
3. `checked = Object.keys(schema).length`.
4. For each `key, rule` in `schema`:
   a. If `rule.required` and `key` not in `pairs` → push `{ key, line: 0, message: "required key missing" }`.
   b. If `key` in `pairs`: run type/enum check (see below) against `pairs.get(key).value`; on
      failure push `{ key, line: pairs.get(key).line, message: "<type/enum failure message>" }`.
5. Keys in `pairs` not present in `schema` → no finding.
6. `ok = findings.length === 0`.
7. Return `{ findings, checked, ok }`.

## Type/enum check
- `int` — `/^-?\d+$/`. `bool` — `/^(true|false|1|0)$/i`. `url` — `new URL(value)` succeeds AND
  protocol ∈ `{http:, https:}`. `string` — always passes. `enum` — exact match in the list.
- Empty value (`KEY=`) passes `string`, fails `int`/`bool`/`url`/`enum`.

## Error cases
| Code | Condition | Result |
|---|---|---|
| E3 | `pairs` empty (zero assignments in file) | every `required` key still produces a `finding`; `ok` is `false` (never reports `ok` per EXPECTED.md) |
| — | key in `pairs`, absent from `schema` | no finding (Schema format rule) |

This engine never throws.

## System Flow
`lib/parse.mjs` output (UC-01) → `lib/rules.mjs::checkRules` (UC) with schema parsed by CLI →
`{findings, checked, ok}` → CLI (UC-03) renders + sets exit code. No DB, no network.

## Test Surface
| ID | Source | Assertion |
|---|---|---|
| TS-UC02-01 | D1 (Type rules) | `int` value `"01"` passes; `"1.5"`, `"1e3"`, `""` fail |
| TS-UC02-02 | D1 (Type rules) | `bool` accepts `true`/`false`/`1`/`0` case-insensitively; rejects `"yes"` |
| TS-UC02-03 | D1 (Type rules) | `url` accepts `http://a.com`/`https://a.com`; rejects `ftp://a.com` (wrong protocol) and `not a url`/`http://` (throws internally, caught → finding) |
| TS-UC02-04 | D1 (Type rules) | `string` type accepts any value including empty |
| TS-UC02-05 | D1 (Type rules) | `enum` accepts an exact listed value, rejects anything else |
| TS-UC02-06 | D1 (Type rules) | `KEY=` (empty value) passes `string`, fails `int`/`bool`/`url`/`enum` |
| TS-UC02-07 | D1 (Schema format) | key present in file but absent from schema → no finding |
| TS-UC02-08 | D2 (E3, from UC-01) | zero-assignment input + a `required` key in schema → finding for that key, `line: 0`, `ok: false`, never `ok: true` |
| TS-UC02-09 | D3 (contract) | `checked === Object.keys(schema).length` regardless of how many keys are present in `pairs` |
| TS-UC02-10 | D1 (Parsing rules, duplicate key) | duplicate key in the source file: type/enum check runs only against the winning (last) value (`pairs` already resolved this in UC-01) |
| TS-UC02-11 | D4 (no-go: no network) | `url` type check never performs a network request — string/protocol shape only |
