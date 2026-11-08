---
type: task
feature: envlint
id: TASK-002
title: "Implement the pure schema rules engine"
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-02]
entities: [Schema, Finding]
repositories: []
linked_docs: [domain-model, usecases/UC-02-check-pairs-against-schema]
estimated_hours: 3
tags: [FEAT, rules]
files: [src/rules.mjs, test/rules.test.mjs]
---

# TASK-002: Implement the pure schema rules engine

## Context
Implements C2 and C3 exactly as written. Reference: [[domain-model#C2 — `Schema` (user file → Rules)]], [[domain-model#C3 — `Finding` (Rules → CLI)]] / [[usecases/UC-02-check-pairs-against-schema#Steps]].
Test inputs are hand-built pair arrays in the C1 shape — never produced by importing the parser.

## Acceptance Criteria

### ✅ Baseline
- [ ] `src/rules.mjs` exports `checkSchema(schema)` and `checkPairs(pairs, schema)` per C2/C3 (covers: REQ-20)
- [ ] `src/rules.mjs` contains no `import` statement and no network or fs access (covers: REQ-20, REQ-22, REQ-30)
- [ ] `node --test test/rules.test.mjs` exits 0, importing only `src/rules.mjs` and `node:` builtins (covers: REQ-23)

### 🧪 BDD Scenarios
- [ ] A `required` key absent from pairs yields `{rule:"required", line:null}` (covers: REQ-17)
- [ ] `int` rejects `1.0`, `0x10`, `1e3`, `""` and accepts `-5`, `0`, `42` (covers: REQ-18)
- [ ] `bool` accepts only `true`/`false`; `string` accepts anything (covers: REQ-18)
- [ ] `url` accepts `https://a.example/x` and `http://unreachable.invalid`, rejects `localhost:3000`, `javascript:alert(1)`, `file:///etc` — with no network call (covers: REQ-18, REQ-31)
- [ ] `enum` is an exact, case-sensitive match (covers: REQ-19)
- [ ] Duplicate key → only the last occurrence is checked, its line reported; keys not in the schema → no finding (covers: REQ-17)

### 🔢 Boundary Values
- [ ] `checkSchema` returns errors for `[]`, `null`, unknown `type`, empty `enum`, non-boolean `required`, unknown rule field; `[]` for `{}` (covers: REQ-1)
