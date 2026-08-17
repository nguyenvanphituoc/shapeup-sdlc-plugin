---
type: scope-contract
scope_id: schema-rules
feature: envlint
topology_type: ICEBERG
tasks: [TASK-002]
allowed_file_substrate: [lib/rules.mjs, test/rules.test.mjs]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/rules.test.mjs"]
---

# Scope Contract: `schema-rules`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| rules-int-type | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | `int` regex `/^-?\d+$/`: `"0"`, `"-1"`, `"01"` pass | `"1.5"`, `"1e3"`, `""` fail | `KEY=` (empty value) fails `int` |
| rules-bool-type | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | `bool` regex `/^(true|false|1|0)$/i`, case-insensitive accept | rejects `"yes"` | `KEY=` (empty value) fails `bool` |
| rules-url-type | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | `new URL(value)` succeeds AND protocol ∈ `{http:, https:}` | `ftp://a.com`, `not a url`, bare `http://` (throws inside `new URL`) rejected without throwing out of `checkRules` | `KEY=` (empty value) fails `url` |
| rules-string-enum-type | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | `string` accepts any value including empty; `enum` requires exact match against listed values | enum value not in the list fails | `KEY=` (empty value) passes `string` |
| rules-required-missing | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | key present in `pairs` but absent from `schema` → no finding | `required` key absent from `pairs` → finding with `line: 0` | zero-assignment input + a `required` schema key → finding for it, `ok: false` (never `ok: true`) |
| rules-checked-count | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | `checked === Object.keys(schema).length` regardless of which keys are present in `pairs` | n/a | `schema = {}` → `checked: 0`, no findings; `pairs` empty + no `required` keys → `findings: []`, `ok: true` |

## Why this slice

`ICEBERG` — the type-checking rules (four type regexes/validators plus `required`/`enum`
semantics and the `checked`-count invariant) carry all the real complexity of this scope; its
own test file is thin by comparison. `lib/rules.mjs` is exclusive to this scope per
`domain-model.md`'s Engines table and `scope-summary.md`'s substrate-disjointness constraint —
it imports nothing from `lib/parse.mjs` and no other scope's `allowed_file_substrate` may touch
it. This is the second of the two scopes `scope-summary.md` calls out as independently
buildable in parallel with `env-parsing` (no `depends_on` between TASK-001 and TASK-002).
