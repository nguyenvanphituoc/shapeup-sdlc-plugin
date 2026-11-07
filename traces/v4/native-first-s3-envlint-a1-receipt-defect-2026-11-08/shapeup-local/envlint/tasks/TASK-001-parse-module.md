---
type: task
feature: envlint
id: TASK-001
title: "Implement the pure .env parser in src/parse.mjs"
lens: standard
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-ParseEnvText]
entities: [EnvPair, ParseProblem]
repositories: []
linked_docs: ["[[usecases/UC-ParseEnvText]]", "[[contracts/env-pairs.contract]]"]
estimated_hours: 3
tags: [parsing]
completed_at: 2026-11-07
---

# TASK-001: Implement the pure .env parser in src/parse.mjs

## Context
Implements [[usecases/UC-ParseEnvText]]: `export function parse(text)` returning `{pairs, problems}` per
[[contracts/env-pairs.contract]]. Pure — imports nothing from the project.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/parse.mjs` exports `parse(text)` returning `{pairs, problems}`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-15)
- [x] `KEY=value` yields `{key:"KEY", value:"value", line:1}` (covers: REQ-9)
- [x] `#` comment lines are skipped and produce no pair and no problem (covers: REQ-10)
- [x] blank lines are skipped and do not shift line numbers of later pairs (covers: REQ-11)
- [x] `export KEY=value` yields key `KEY` (covers: REQ-12)
- [x] `K='a b'` and `K="a b"` both yield value `a b` (covers: REQ-13)
- [x] `"A=1\nbad line\nB=2"` yields one problem at line 2 (1-based) and pairs on lines 1 and 3 (covers: REQ-14)
- [x] `src/parse.mjs` has no import of `rules` or `bin/` — `grep -E "import .*(rules|bin/)" src/parse.mjs` finds nothing (covers: REQ-21)

### 📭 Empty & Null States
- [x] `parse("")` returns `{pairs: [], problems: []}` (covers: REQ-5)
- [x] text of only comments and blank lines returns no pairs and no problems (covers: REQ-5)

### 🔢 Boundary Values
- [x] malformed lines (`=`, an unterminated quote, a line with no `=`) never throw; each is one problem with its line (covers: REQ-6, REQ-14)
- [x] `A=${HOME}` keeps the literal value `${HOME}` (covers: REQ-23)

## Non-Go (not in this task)
- Rule checking ([[usecases/UC-CheckEnvAgainstSchema]]) and any file I/O ([[usecases/UC-LintEnvFile]]).


## Execution Log — 2026-11-07 (envlint/parsing-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/parse.mjs` exports `parse(text)` returning `{pairs, problems}`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-15): pass (node --test test/parse.test.mjs -> 10/10 pass)
- `KEY=value` yields `{key:"KEY", value:"value", line:1}` (covers: REQ-9): pass (test 'KEY=value' passes)
- `#` comment lines are skipped and produce no pair and no problem (covers: REQ-10): pass (test 'comments skipped' passes)
- blank lines are skipped and do not shift line numbers of later pairs (covers: REQ-11): pass (test 'blank lines keep numbering' passes)
- `export KEY=value` yields key `KEY` (covers: REQ-12): pass (test 'export prefix' passes)
- `K='a b'` and `K="a b"` both yield value `a b` (covers: REQ-13): pass (test 'quotes' passes)
- `"A=1\nbad line\nB=2"` yields one problem at line 2 (1-based) and pairs on lines 1 and 3 (covers: REQ-14): pass (test 'bad line in the middle' passes)
- `src/parse.mjs` has no import of `rules` or `bin/` — `grep -E "import .*(rules|bin/)" src/parse.mjs` finds nothing (covers: REQ-21): pass (grep output empty)
- `parse("")` returns `{pairs: [], problems: []}` (covers: REQ-5): pass (test 'empty' passes)
- text of only comments and blank lines returns no pairs and no problems (covers: REQ-5): pass (test 'only comments and blanks' passes)
- malformed lines (`=`, an unterminated quote, a line with no `=`) never throw; each is one problem with its line (covers: REQ-6, REQ-14): pass (test 'malformed never throw' passes)
- `A=${HOME}` keeps the literal value `${HOME}` (covers: REQ-23): pass (test 'no interpolation' passes)
