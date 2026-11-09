---
type: task
feature: envlint
id: TASK-002
title: "Implement the pure schema rules checker"
package: src
status: ready
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-CheckRules]
entities: [EnvPair, Schema, KeyRule, Finding]
repositories: []
linked_docs: ["shapeup/envlint/spec/usecases/UC-CheckRules.md", "shapeup/envlint/spec/domain-model.md"]
estimated_hours: 3
tags: [pure, rules]
---

# TASK-002: Implement the pure schema rules checker

## Context
Build `check(pairs, schema)` per [[usecases/UC-CheckRules#Steps]] and its own test file. Pure: no I/O, no import of the parser module.
Reference: [[domain-model#Value objects]] / [[usecases/UC-CheckRules#Test Surface]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/rules.mjs` exists and exports `check(pairs, schema)` returning an array of `{key, line, message}` findings (covers: REQ-20)
- [ ] `node --test test/rules.test.mjs` exits 0 and covers every UC-CheckRules Test Surface row
- [ ] the schema shape `{KEY: {required?, type?, enum?}}` is the only input form accepted (covers: REQ-1)
- [ ] `required: true` with no pair yields one finding with `line: null` (covers: REQ-17)
- [ ] `type` `int`/`bool`/`url` mismatches each yield one finding with the pair's line; `string` accepts any value (covers: REQ-18)
- [ ] a value outside `enum` yields one finding with the pair's line (covers: REQ-19)
- [ ] every finding names its key, and its line where a pair exists (covers: REQ-2)
- [ ] `src/rules.mjs` imports neither `src/parse.mjs` nor any `node:fs`, `node:http`, `node:https` or `node:net` module (covers: REQ-22, REQ-27)
- [ ] `url` is validated with the URL parser only: `http://unreachable.invalid` passes with no network call (covers: REQ-28)

### 🔢 Boundary Values
- [ ] `int` accepts `0`, `-42`, rejects `1.5`, `""`, `1e3`; `bool` accepts only `true`/`false` (covers: REQ-18)

### 📭 Empty & Null States
- [ ] `check([], {})` returns `[]` and never throws for a plain-object schema (covers: REQ-7)

## Non-Go (not in this task)
- Parsing text (TASK-001); reading or validating the schema file itself (TASK-003)
