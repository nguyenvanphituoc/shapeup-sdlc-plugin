---
type: task
feature: envlint
id: TASK-002
title: "Implement the pure checkSchema / checkRules module"
package: "."
status: ready
priority: 1
depends_on: []
unlocks: [TASK-003, TASK-004]
use_case_refs: [UC-CheckRules]
scope_id: ""
entities: [KeyRule, Finding]
repositories: []
linked_docs: ["[[usecases/UC-CheckRules]]", "[[domain-model]]"]
files: [src/rules.mjs, test/rules.test.mjs]
estimated_hours: 2
tags: [pure]
---

# TASK-002: Implement the pure checkSchema / checkRules module

## Context
Implements [[usecases/UC-CheckRules#Steps]]: schema validation, then `required` / `type` / `enum` over the SD-1 pair shape, with the grammars SD-3, empty-value rule SD-2 and unknown-key rule SD-6 from [[_index]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/rules.mjs` exists and exports `checkSchema(schema)` and `checkRules(pairs, schema)`; it contains no `import` statement (covers: REQ-20, REQ-22)
- [ ] `test/rules.test.mjs` exists and `node --test test/rules.test.mjs` exits 0, run alone with fixtures built inline (covers: REQ-23)
- [ ] the schema format `{KEY: {required?, type?, enum?}}` is the one validated by `checkSchema` (covers: REQ-1)
- [ ] a required key absent from pairs yields a `required` finding with `line: null` (covers: REQ-17)
- [ ] `string`/`int`/`bool`/`url` grammars per SD-3, a mismatch yields a `type` finding carrying the pair's line (covers: REQ-18, REQ-2)
- [ ] a value outside `enum` yields an `enum` finding (covers: REQ-19)
- [ ] `url` is decided by `new URL` + protocol only; no network call (covers: REQ-30)
- [ ] every row of the UC-CheckRules Test Surface (TS-INV-01..03, TS-ERR-*, TS-REQ-empty/dup/unknown-key) is a named test case in `test/rules.test.mjs` and passes (covers: REQ-7)

### 🔢 Boundary Values
- [ ] int: `-3` and `0` pass, `1.5` and `` fail; bool: `True` fails

## Non-Go (not in this task)
- Parsing text, reading files, printing, exit codes.
