---
type: task
feature: envlint
id: TASK-002
title: "Implement the pure schema rules in src/rules.mjs"
lens: standard
package: src
status: ready
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-CheckEnvAgainstSchema]
entities: [EnvPair, Schema, Finding]
repositories: []
linked_docs: ["[[usecases/UC-CheckEnvAgainstSchema]]", "[[contracts/env-pairs.contract]]"]
estimated_hours: 3
tags: [rules]
---

# TASK-002: Implement the pure schema rules in src/rules.mjs

## Context
Implements [[usecases/UC-CheckEnvAgainstSchema]]: `export function check(pairs, schema)` returning findings
per [[contracts/env-pairs.contract]]. Pure — imports nothing from the project.

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/rules.mjs` exports `check(pairs, schema)` returning an array of findings; `node --test test/rules.test.mjs` exits 0 (covers: REQ-19)
- [ ] a `required: true` key with no pair yields one `MISSING_REQUIRED` finding with `line: null` (covers: REQ-16)
- [ ] `type: "int"` rejects `abc`, accepts `-42`; `type: "bool"` rejects `yes`, accepts `true`/`false`; `type: "string"` accepts anything — each rejection is a `TYPE_MISMATCH` with the pair's line (covers: REQ-17)
- [ ] `type: "url"` accepts `https://a.b` and rejects `not a url` (covers: REQ-17)
- [ ] `enum: ["dev","prod"]` rejects `staging` with `NOT_IN_ENUM` and the pair's line (covers: REQ-18)
- [ ] every finding carries `key` and `line`, so the CLI can report key by key, line by line (covers: REQ-1)
- [ ] `src/rules.mjs` has no import of `parse` or `bin/` — `grep -E "import .*(parse|bin/)" src/rules.mjs` finds nothing (covers: REQ-21)

### 🔢 Boundary Values
- [ ] the url check uses only string parsing (`URL`); `grep -E "fetch|node:http|node:https|node:net|node:dns" src/rules.mjs` finds nothing (covers: REQ-25)
- [ ] `check([], {})` returns `[]` (covers: REQ-6)

## Non-Go (not in this task)
- Parsing ([[usecases/UC-ParseEnvText]]) and any file I/O ([[usecases/UC-LintEnvFile]]).
