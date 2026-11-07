---
type: task
feature: envlint
id: TASK-002
title: "Implement schema validation and rule evaluation in src/rules.mjs"
lens: lite
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-EvaluateRules]
entities: [Schema, Finding]
repositories: []
linked_docs: ["[[usecases/UC-EvaluateRules]]", "[[domain-model#Value Types]]"]
estimated_hours: 3
tags: [rules, pure]
completed_at: 2026-11-07
---

# TASK-002: Implement schema validation and rule evaluation in src/rules.mjs

## Context
Implements [[usecases/UC-EvaluateRules#Steps]]: `validateSchema(schema) → string[]` and
`evaluate(pairs, schema) → Finding[]`, with predicates exactly as in [[domain-model#Value Types]].
Pure; imports nothing from `src/parse.mjs`; written against the `Pair` shape in [[domain-model#Value Objects]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/rules.mjs` exports `validateSchema` and `evaluate` with the signatures in [[domain-model#Module Interfaces]] (covers: REQ-18, REQ-22)
- [x] `node --check src/rules.mjs` exits 0 and `node --test test/rules.test.mjs` passes
- [x] `required: true` with the key absent yields one `MISSING_REQUIRED` finding with `line: null`; an empty value counts as present (covers: REQ-19)
- [x] `type` `string`/`int`/`bool`/`url` accept and reject exactly the examples in [[domain-model#Value Types]] (covers: REQ-20)
- [x] `url` is decided from the string alone — no `node:dns`/`node:net`/`node:http(s)` import and no `fetch` (covers: REQ-31, REQ-30)
- [x] `enum` yields `NOT_IN_ENUM` at the pair's line for a value outside the list (case-sensitive) (covers: REQ-21)
- [x] `validateSchema` returns ≥1 message for every malformed shape in [[usecases/UC-EvaluateRules#Test Surface]] TS-ERR-SCHEMA_INVALID and `[]` for a valid one (covers: REQ-5)
- [x] `src/rules.mjs` has no import of `./parse.mjs`; `test/rules.test.mjs` builds its pairs as literals and imports only `src/rules.mjs` (covers: REQ-24, REQ-25)

### 🔢 Boundary Values
- [x] `int`: `"+3"`, `"-1"`, `"9007199254740993"` accepted (string judged, not converted); `""`, `"3.0"`, `"1e3"`, `"0x10"`, `" 7"` rejected
- [x] Duplicate keys: the last pair for a key is the one judged

## Non-Go (not in this task)
- Reading or parsing files; formatting output; exit codes.
- Real JSON Schema (draft-07 etc.) support.


## Execution Log — 2026-11-07 (envlint/rules-engine-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/rules.mjs` exports `validateSchema` and `evaluate` with the signatures in [[domain-model#Module Interfaces]] (covers: REQ-18, REQ-22): pass (src/rules.mjs exports validateSchema(schema) -> string[] and evaluate(pairs, schema) -> Finding[]; test 'exports validateSchema and evaluate as functions' passes)
- `node --check src/rules.mjs` exits 0 and `node --test test/rules.test.mjs` passes: pass (node --check src/rules.mjs exit 0; node --test test/rules.test.mjs -> 16/16 pass; harness verify t0 r1-a1 overall green, fixtures 2/2 (.shapeup/envlint/t0/verdicts/r1-a1-t1.json sha256 f2221c87...))
- `required: true` with the key absent yields one `MISSING_REQUIRED` finding with `line: null`; an empty value counts as present (covers: REQ-19): pass (TS-ERR-MISSING_REQUIRED deepEquals [{key:'A',line:null,code:'MISSING_REQUIRED',message:'required key is missing'}]; TS-INV-03 A='' with required+int -> only INVALID_TYPE)
- `type` `string`/`int`/`bool`/`url` accept and reject exactly the examples in [[domain-model#Value Types]] (covers: REQ-20): pass (TS-INV-02 int/bool/url tests and 'string accepts any value' test assert every accept/reject example from the Value Types table; all pass)
- `url` is decided from the string alone — no `node:dns`/`node:net`/`node:http(s)` import and no `fetch` (covers: REQ-31, REQ-30): pass (url predicate = v.includes('://') && URL.canParse(v) && new URL(v).host !== ''; TS-NOGO-01 test asserts src/rules.mjs has no import statement, no dynamic import, no node:fs/net/http/https/dns, no fetch( ; grep -nE 'import|fetch' src/rules.mjs finds only the header comment)
- `enum` yields `NOT_IN_ENUM` at the pair's line for a value outside the list (case-sensitive) (covers: REQ-21): pass (TS-ERR-NOT_IN_ENUM: MODE=prod line 7 -> NOT_IN_ENUM line 7 'expected one of dev, test; got "prod"'; MODE=Dev -> NOT_IN_ENUM; MODE=dev -> [])
- `validateSchema` returns ≥1 message for every malformed shape in [[usecases/UC-EvaluateRules#Test Surface]] TS-ERR-SCHEMA_INVALID and `[]` for a valid one (covers: REQ-5): pass (TS-ERR-SCHEMA_INVALID test: [], null, {A:{type:'float'}}, {A:{enum:[]}}, {A:{required:'yes'}}, {A:{foo:1}} (plus extra malformed shapes) each return >=1 message; {} and a full valid schema return [])
- `src/rules.mjs` has no import of `./parse.mjs`; `test/rules.test.mjs` builds its pairs as literals and imports only `src/rules.mjs` (covers: REQ-24, REQ-25): pass (src/rules.mjs has zero imports (TS-NOGO-01 asserts it); test/rules.test.mjs's only project import is ../src/rules.mjs (others are node:test, node:assert/strict, node:fs builtins); all pairs are object literals)
- `int`: `"+3"`, `"-1"`, `"9007199254740993"` accepted (string judged, not converted); `""`, `"3.0"`, `"1e3"`, `"0x10"`, `" 7"` rejected: pass (TS-INV-02 int test asserts accept of '42','-1','+3','9007199254740993' and reject of '',' 7','1e3','0x10','3.0','abc'; regex ^[+-]?[0-9]+$ on raw string; passes)
- Duplicate keys: the last pair for a key is the one judged: pass (TS-REQ-duplicate: A=x(l1),A=1(l2) int -> []; A=1(l1),A=x(l2) -> one finding at line 2)
