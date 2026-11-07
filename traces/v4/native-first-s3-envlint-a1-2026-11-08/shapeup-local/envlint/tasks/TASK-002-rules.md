---
type: task
feature: envlint
id: TASK-002
title: "Implement the pure schema rules check"
lens: standard
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-CheckRules]
entities: [Schema]
repositories: []
linked_docs: ["[[usecases/UC-CheckRules]]", "[[contracts/envlint.contract]]", "[[domain-model]]"]
estimated_hours: 3
tags: [rules]
completed_at: 2026-11-07
---

# TASK-002: Implement the pure schema rules check

## Context
Implement `check(pairs, schema)` exactly as [[usecases/UC-CheckRules#Steps]] and
[[contracts/envlint.contract#check (src/rules.mjs)]] describe, with its tests. Pairs are plain
`{key, value, line}` objects built in the test — never produced by importing the parser.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/rules.mjs` exports `check(pairs, schema)` returning an array of `{key, line, message}`; `node --test test/rules.test.mjs` exits 0 (covers: REQ-25)
- [x] `check([], {A:{required:true}})` returns one finding for `A` with `line: null` (covers: REQ-19)
- [x] `type: string` accepts any value (covers: REQ-20)
- [x] `type: int` flags `80x` and accepts `80` and `-1` (covers: REQ-21)
- [x] `type: bool` flags `yes` and accepts `true` and `false` (covers: REQ-22)
- [x] `type: url` flags `foo`, `http://`, `a:b`, `mailto:x@y` and accepts `https://example.com` (covers: REQ-23, REQ-33)
- [x] `enum: ["dev","prod"]` flags `qa` and accepts `dev` (covers: REQ-24)
- [x] `src/rules.mjs` contains no `import` statement — a test reads the file and asserts it (covers: REQ-27, REQ-25)
- [x] with `globalThis.fetch` replaced by a function that throws, `type: url` checks still pass and fetch is never called (covers: REQ-32)

### 📭 Empty & Null States
- [x] `check([], {})` returns `[]`; `check([], {A:{}})` returns `[]`; never throws (covers: REQ-7)

## Non-Go (not in this task)
- Parsing text, reading the schema file, printing.


## Execution Log — 2026-11-07 (envlint/rules-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/rules.mjs` exports `check(pairs, schema)` returning an array of `{key, line, message}`; `node --test test/rules.test.mjs` exits 0 (covers: REQ-25): pass (node --test test/rules.test.mjs → 10/10 pass; T0 green)
- `check([], {A:{required:true}})` returns one finding for `A` with `line: null` (covers: REQ-19): pass (test 'missing required key' passes)
- `type: string` accepts any value (covers: REQ-20): pass (test 'type string accepts any value' passes)
- `type: int` flags `80x` and accepts `80` and `-1` (covers: REQ-21): pass (test 'type int' passes)
- `type: bool` flags `yes` and accepts `true` and `false` (covers: REQ-22): pass (test 'type bool' passes)
- `type: url` flags `foo`, `http://`, `a:b`, `mailto:x@y` and accepts `https://example.com` (covers: REQ-23, REQ-33): pass (test 'type url' passes)
- `enum: ["dev","prod"]` flags `qa` and accepts `dev` (covers: REQ-24): pass (test 'enum' passes)
- `src/rules.mjs` contains no `import` statement — a test reads the file and asserts it (covers: REQ-27, REQ-25): pass (test 'rules module has no import statement' passes)
- with `globalThis.fetch` replaced by a function that throws, `type: url` checks still pass and fetch is never called (covers: REQ-32): pass (test 'url check never touches fetch' passes)
- `check([], {})` returns `[]`; `check([], {A:{}})` returns `[]`; never throws (covers: REQ-7): pass (test 'empty schemas never throw' passes)
