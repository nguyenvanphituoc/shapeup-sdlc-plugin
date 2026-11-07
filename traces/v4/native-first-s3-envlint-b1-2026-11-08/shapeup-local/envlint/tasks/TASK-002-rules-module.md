---
type: task
feature: envlint
id: TASK-002
title: "Implement the pure schema rules module"
lens: lite
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-CheckRules]
scope_id: ""
entities: [Schema]
repositories: []
linked_docs: ["[[usecases/UC-CheckRules]]", "[[domain-model#Value Objects]]", "[[domain-model#Planning decisions]]"]
estimated_hours: 3
tags: [rules, pure]
completed_at: 2026-11-07
---

# TASK-002: Implement the pure schema rules module

## Context
Build `checkSchema(schema)` and `check(pairs, schema)` per [[usecases/UC-CheckRules#Steps]], over the
EnvPair shape in [[domain-model#Value Objects]], following PD-6 to PD-11.
Reference: [[usecases/UC-CheckRules]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/rules.mjs` exports `checkSchema` and `check`; `node --test test/rules.test.mjs` passes with at least one test (covers: REQ-20)
- [x] `src/rules.mjs` imports neither `node:fs`, network modules, nor `src/parse.mjs` (TS-INV-01) (covers: REQ-22)
- [x] `checkSchema` accepts a `KEY → {required,type,enum}` object and returns reasons for `[]`, `{A:1}`, `{A:{type:"float"}}`, `{A:{enum:"x"}}` (TS-ERR-SCHEMA_INVALID) (covers: REQ-1)
- [x] a `required: true` key with no pair yields a `required` finding with `line: null` (TS-ERR-RULE_REQUIRED) (covers: REQ-17)
- [x] `type` int/bool/url/string: `1.5`, `yes`, `localhost` each yield a `type` finding with the pair's line; `-3`, `true`, `https://x.y` and any string yield none (TS-ERR-RULE_TYPE) (covers: REQ-18)
- [x] a value outside `enum` yields an `enum` finding; a listed value yields none (TS-ERR-RULE_ENUM) (covers: REQ-19)
- [x] `url` is judged by `new URL()` only and opens no connection (TS-INV-02) (covers: REQ-26)
- [x] with duplicate keys the last occurrence is judged (TS-REQ-duplicate-last)

## Non-Go (not in this task)
- Parsing text — UC-ParseEnv
- Printing findings and exit codes — UC-LintEnvFile


## Execution Log — 2026-11-07 (envlint/rules-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/rules.mjs` exports `checkSchema` and `check`; `node --test test/rules.test.mjs` passes with at least one test (covers: REQ-20): pass (node --test test/rules.test.mjs → 9/9 pass; harness verify t0 rules r1 a1 → overall green, fixtures 1/1 (.shapeup/envlint/t0/verdicts/r1-a1-t2.json))
- `src/rules.mjs` imports neither `node:fs`, network modules, nor `src/parse.mjs` (TS-INV-01) (covers: REQ-22): pass (src/rules.mjs has zero import statements; test 'TS-INV-01' scans import specifiers for fs/http/https/net/tls/dns and parse, and require/fetch → pass)
- `checkSchema` accepts a `KEY → {required,type,enum}` object and returns reasons for `[]`, `{A:1}`, `{A:{type:"float"}}`, `{A:{enum:"x"}}` (TS-ERR-SCHEMA_INVALID) (covers: REQ-1): pass (test 'TS-ERR-SCHEMA_INVALID': each of the four (plus null, 'x', non-boolean required, non-string enum entry) returns non-empty reasons; {} and a full valid rule return [] → pass)
- a `required: true` key with no pair yields a `required` finding with `line: null` (TS-ERR-RULE_REQUIRED) (covers: REQ-17): pass (test 'TS-ERR-RULE_REQUIRED': check([], {A:{required:true}}) → [{key:'A',line:null,rule:'required',message}] → pass)
- `type` int/bool/url/string: `1.5`, `yes`, `localhost` each yield a `type` finding with the pair's line; `-3`, `true`, `https://x.y` and any string yield none (TS-ERR-RULE_TYPE) (covers: REQ-18): pass (test 'TS-ERR-RULE_TYPE': 1.5/yes/localhost → one type finding each with line 7; -3, true, false, https://x.y, string values → [] → pass)
- a value outside `enum` yields an `enum` finding; a listed value yields none (TS-ERR-RULE_ENUM) (covers: REQ-19): pass (test 'TS-ERR-RULE_ENUM': {E:{enum:['a','b']}} value c → one enum finding line 3; value a → [] → pass)
- `url` is judged by `new URL()` only and opens no connection (TS-INV-02) (covers: REQ-26): pass (test 'TS-INV-02': https://nonexistent.invalid → [] returned synchronously (array, not promise); isUrl uses only try { new URL(value) }; module has no imports → pass)
- with duplicate keys the last occurrence is judged (TS-REQ-duplicate-last): pass (test 'TS-REQ-duplicate-last': A=x(l1),A=1(l2) with type int → []; reversed order → one finding at line 2 → pass)
