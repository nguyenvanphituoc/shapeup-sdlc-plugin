---
schema_version: 1
doc_type: task
feature: envlint
id: TASK-002
title: Implement lib/rules.mjs
use_case_refs: [UC-02-validate-against-schema]
depends_on: []
unlocks: [TASK-003]
estimated_hours: 3
status: done
completed_at: 2026-08-17
---

# TASK-002 — Implement `lib/rules.mjs`

Implement `checkRules({pairs, problems}, schema)` exactly per
[[../contracts/rules-contract|rules-contract]] and
[[../usecases/UC-02-validate-against-schema|UC-02]]. Pure function, no I/O, no imports from
`lib/parse.mjs` or `bin/envlint.mjs`.

## Acceptance Criteria
- [x] `node --test test/rules.test.mjs` passes.
- [x] `int` regex `/^-?\d+$/`: `"01"` passes; `"1.5"`, `"1e3"`, `""` fail.
- [x] `bool` regex `/^(true|false|1|0)$/i`: case-insensitive accept, rejects `"yes"`.
- [x] `url`: `new URL(value)` succeeds AND protocol ∈ `{http:, https:}`; `ftp://a.com` rejected;
      `not a url` / `http://` rejected without throwing out of `checkRules`.
- [x] `string` type accepts any value including empty.
- [x] `enum` requires exact match against the listed values.
- [x] `KEY=` (empty value) passes `string`, fails `int`/`bool`/`url`/`enum`.
- [x] key present in `pairs` but absent from `schema` → no finding.
- [x] `required` key absent from `pairs` → finding with `line: 0`.
- [x] zero-assignment input + a `required` schema key → finding for it, `ok: false` (never `ok: true`).
- [x] `checked === Object.keys(schema).length` regardless of which keys are present in `pairs`.
- [x] `lib/rules.mjs` has zero imports of `lib/parse.mjs` (substrate disjointness).

## 🔢 Boundary Values
- `int`: `"0"`, `"-1"`, `"01"` pass; `"1.5"`, `"1e3"`, `""`, `" 1"` (if not pre-trimmed) fail per regex.
- `url`: bare `http://` (no host) throws inside `new URL` → caught, treated as failing, not a crash.

## 📭 Empty & Null States
- `pairs` empty Map + no `required` keys in schema → `findings: []`, `ok: true`, `checked: Object.keys(schema).length`.
- `schema` = `{}` → `checked: 0`, no findings regardless of `pairs` content.

## Test Surface covered
TS-UC02-01 … TS-UC02-11 (full — see [[../usecases/UC-02-validate-against-schema|UC-02]] Test Surface).


## Execution Log — 2026-08-17 (envlint/schema-rules-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node --test test/rules.test.mjs` passes.: pass (node --test test/rules.test.mjs → 15/15 pass, 0 fail)
- `int` regex `/^-?\d+$/`: `"01"` passes; `"1.5"`, `"1e3"`, `""` fail.: pass (TS-UC02-01, TS-UC02-01b pass)
- `bool` regex `/^(true|false|1|0)$/i`: case-insensitive accept, rejects `"yes"`.: pass (TS-UC02-02 passes)
- `url`: `new URL(value)` succeeds AND protocol ∈ `{http:, https:}`; `ftp://a.com` rejected;: pass (TS-UC02-03 passes; checkRules never throws (try/catch around new URL))
- `string` type accepts any value including empty.: pass (TS-UC02-04 passes)
- `enum` requires exact match against the listed values.: pass (TS-UC02-05 passes)
- `KEY=` (empty value) passes `string`, fails `int`/`bool`/`url`/`enum`.: pass (TS-UC02-06 passes)
- key present in `pairs` but absent from `schema` → no finding.: pass (TS-UC02-07 passes)
- `required` key absent from `pairs` → finding with `line: 0`.: pass (TS-UC02-08 passes)
- zero-assignment input + a `required` schema key → finding for it, `ok: false` (never `ok: true`).: pass (TS-UC02-08 passes (ok === false asserted))
- `checked === Object.keys(schema).length` regardless of which keys are present in `pairs`.: pass (TS-UC02-09 passes)
- `lib/rules.mjs` has zero imports of `lib/parse.mjs` (substrate disjointness).: pass (regex test on file source in rules.test.mjs finds no 'parse.mjs' import; lib/rules.mjs has no import statements at all)
