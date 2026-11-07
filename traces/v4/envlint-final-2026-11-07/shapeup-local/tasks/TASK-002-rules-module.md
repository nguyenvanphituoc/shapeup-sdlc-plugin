---
type: task
feature: envlint
id: TASK-002
title: "Implement the pure schema rules module"
lens: standard
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-EvaluateRules]
entities: [Schema, Finding]
repositories: []
linked_docs: ["[[usecases/UC-EvaluateRules]]", "[[contracts/rules.contract]]", "[[domain-model]]"]
estimated_hours: 3
tags: [FEAT, rules]
completed_at: 2026-11-07
---

# TASK-002: Implement the pure schema rules module

## Context
Implement `validateSchema(schema)` and `lint(pairs, schema)` per [[contracts/rules.contract]],
realising [[usecases/UC-EvaluateRules#Steps]]. Pure, zero-dependency Node ESM; imports nothing from
`src/parse.mjs` (its tests build `pairs` literals by hand).

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/rules.mjs` exists and exports named functions `validateSchema` and `lint` (covers: REQ-20)
- [x] `test/rules.test.mjs` exists; `node --test test/rules.test.mjs` exits 0 run on its own (covers: REQ-22)
- [x] `src/rules.mjs` contains no import of `./parse.mjs` or any non-`node:` module (covers: REQ-22)
- [x] `validateSchema` accepts `{KEY: {required?, type?, enum?}}` objects and returns `[]` for a valid one (covers: REQ-1)
- [x] `validateSchema` returns ≥1 defect, without throwing, for `null`, `[]`, `"x"`, `{A: 1}`, `{A: {type: "float"}}`, `{A: {required: "yes"}}`, `{A: {enum: []}}` (covers: REQ-7)
- [x] A `required: true` key absent from pairs yields one finding `{key, line: null, rule: "required", message}` (covers: REQ-17)
- [x] `type: int` accepts `12`, `-3` and flags `1.5`, `x`; `type: bool` accepts `true`, `false` and flags `yes`, `TRUE`; `type: string` accepts anything (covers: REQ-18)
- [x] `type: url` accepts `https://a.b` and `http://a.b` and flags `foo:bar`, `ftp://x`, `not a url`, with no network access (covers: REQ-18)
- [x] `enum: ["a","b"]` flags value `c` with a finding at that value's line (covers: REQ-19)
- [x] Every finding names the key and its line (or `null` for `required`), so output can be key by key, line by line (covers: REQ-2)
- [x] For a duplicated key, only the last assignment is judged (covers: REQ-20)

### 📭 Empty & Null States
- [x] `lint([], {A: {type: "int"}})` returns `[]` (optional key absent → no finding) (covers: REQ-6)

## Non-Go (not in this task)
- Parsing text (TASK-001), file I/O and printing (TASK-003).


## Execution Log — 2026-11-07 (envlint/rules-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/rules.mjs` exists and exports named functions `validateSchema` and `lint` (covers: REQ-20): pass (file written; test imports both; T0 green 1/1)
- `test/rules.test.mjs` exists; `node --test test/rules.test.mjs` exits 0 run on its own (covers: REQ-22): pass (verify t0 fixture 'node --test test/rules.test.mjs' green 1/1)
- `src/rules.mjs` contains no import of `./parse.mjs` or any non-`node:` module (covers: REQ-22): pass (module has no import statements; test 'rules.mjs has no imports' passes)
- `validateSchema` accepts `{KEY: {required?, type?, enum?}}` objects and returns `[]` for a valid one (covers: REQ-1): pass (test 'validateSchema accepts valid' passes in T0)
- `validateSchema` returns ≥1 defect, without throwing, for `null`, `[]`, `"x"`, `{A: 1}`, `{A: {type: "float"}}`, `{A: {required: "yes"}}`, `{A: {enum: []}}` (covers: REQ-7): pass (test 'rejects bad schemas without throwing' passes in T0)
- A `required: true` key absent from pairs yields one finding `{key, line: null, rule: "required", message}` (covers: REQ-17): pass (test 'required missing' passes in T0)
- `type: int` accepts `12`, `-3` and flags `1.5`, `x`; `type: bool` accepts `true`, `false` and flags `yes`, `TRUE`; `type: string` accepts anything (covers: REQ-18): pass (test 'int and bool' passes in T0)
- `type: url` accepts `https://a.b` and `http://a.b` and flags `foo:bar`, `ftp://x`, `not a url`, with no network access (covers: REQ-18): pass (test 'url shape only' passes in T0; new URL() only)
- `enum: ["a","b"]` flags value `c` with a finding at that value's line (covers: REQ-19): pass (test 'enum' passes in T0)
- Every finding names the key and its line (or `null` for `required`), so output can be key by key, line by line (covers: REQ-2): pass (all findings built as {key, line, rule, message}; asserted in required/int/enum tests)
- For a duplicated key, only the last assignment is judged (covers: REQ-20): pass (test 'duplicate key judges last' passes in T0)
- `lint([], {A: {type: "int"}})` returns `[]` (optional key absent → no finding) (covers: REQ-6): pass (test 'optional absent yields nothing' passes in T0)
