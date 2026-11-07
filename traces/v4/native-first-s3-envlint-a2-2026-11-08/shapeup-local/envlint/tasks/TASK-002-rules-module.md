---
type: task
feature: envlint
id: TASK-002
title: "Implement the pure schema rules in src/rules.mjs"
lens: standard
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-EvaluateRules]
entities: [Schema]
repositories: []
linked_docs: ["[[usecases/UC-EvaluateRules]]", "[[contracts/envlint.contract]]"]
estimated_hours: 2
tags: [rules]
completed_at: 2026-11-07
---

# TASK-002: Implement the pure schema rules in src/rules.mjs

## Context
Implement `checkRules(pairs, schema)` as [[usecases/UC-EvaluateRules#Steps]] and contract §2–§3 of
[[contracts/envlint.contract]] describe. It is a pure function: data in, `{findings, schemaErrors}` out, with
no IO, no network and no imports from the parsing module.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/rules.mjs` exports `checkRules(pairs, schema)` returning `{findings, schemaErrors}`; `node --test test/rules.test.mjs` exits 0 (covers: REQ-20)
- [x] a schema of the form `{KEY: {required?, type?, enum?}}` is accepted; any other shape (not an object, unknown field, unknown type, non-string-array enum) yields non-empty `schemaErrors` and `findings: []` (covers: REQ-1)
- [x] `required: true` with the key absent yields `{key, line: null, rule: "required"}`; `K=` counts as present (covers: REQ-17)
- [x] `type` `string` always passes; `int` accepts `^-?[0-9]+$`; `bool` accepts exactly `true`/`false`; a failing value yields `rule: "type"` with the pair's line (covers: REQ-18)
- [x] `type: url` accepts `https://x.com/p` and `postgres://u@h:5432/db`, and rejects `foo:bar`, `localhost:3000`, `http://` and `not a url` (covers: REQ-27)
- [x] `enum` rejects a value not in the list, with `rule: "enum"` (covers: REQ-19)
- [x] `src/rules.mjs` has no import of a parse module and no `http`/`https`/`net`/`fetch` use; a test asserts this by reading the file (covers: REQ-21)

### 🔢 Boundary Values
- [x] `int`: `"0"`, `"-3"` pass; `""`, `"1.5"`, `"+1"` fail (covers: REQ-18)

### 📭 Empty & Null States
- [x] `checkRules([], null)`, `checkRules([], [])` and `checkRules([], "x")` return schemaErrors without throwing (covers: REQ-7)

## Implementation Notes
- The last occurrence of a duplicate key wins.
- The `url` check is `value.includes("://")`, then `new URL(value)` in a try block, then a non-empty `host`.

## Non-Go (not in this task)
- Parsing text, reading files, printing output.


## Execution Log — 2026-11-07 (envlint/rules-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/rules.mjs` exports `checkRules(pairs, schema)` returning `{findings, schemaErrors}`; `node --test test/rules.test.mjs` exits 0 (covers: REQ-20): pass (node --test test/rules.test.mjs -> 10/10 pass; T0 green)
- a schema of the form `{KEY: {required?, type?, enum?}}` is accepted; any other shape (not an object, unknown field, unknown type, non-string-array enum) yields non-empty `schemaErrors` and `findings: []` (covers: REQ-1): pass (test 'bad schema shapes yield schemaErrors and no findings')
- `required: true` with the key absent yields `{key, line: null, rule: "required"}`; `K=` counts as present (covers: REQ-17): pass (test 'required')
- `type` `string` always passes; `int` accepts `^-?[0-9]+$`; `bool` accepts exactly `true`/`false`; a failing value yields `rule: "type"` with the pair's line (covers: REQ-18): pass (tests 'type string/bool and line', 'int boundaries')
- `type: url` accepts `https://x.com/p` and `postgres://u@h:5432/db`, and rejects `foo:bar`, `localhost:3000`, `http://` and `not a url` (covers: REQ-27): pass (test 'url')
- `enum` rejects a value not in the list, with `rule: "enum"` (covers: REQ-19): pass (test 'enum')
- `src/rules.mjs` has no import of a parse module and no `http`/`https`/`net`/`fetch` use; a test asserts this by reading the file (covers: REQ-21): pass (test 'rules.mjs is pure')
- `int`: `"0"`, `"-3"` pass; `""`, `"1.5"`, `"+1"` fail (covers: REQ-18): pass (test 'int boundaries')
- `checkRules([], null)`, `checkRules([], [])` and `checkRules([], "x")` return schemaErrors without throwing (covers: REQ-7): pass (test 'null/array/string schema returns schemaErrors without throwing')
