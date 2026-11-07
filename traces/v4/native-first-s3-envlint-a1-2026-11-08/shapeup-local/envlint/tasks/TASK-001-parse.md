---
type: task
feature: envlint
id: TASK-001
title: "Implement the pure .env parser"
lens: standard
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-ParseEnvText]
entities: [EnvFile]
repositories: []
linked_docs: ["[[usecases/UC-ParseEnvText]]", "[[contracts/envlint.contract]]", "[[domain-model]]"]
estimated_hours: 3
tags: [parsing]
completed_at: 2026-11-07
---

# TASK-001: Implement the pure .env parser

## Context
Implement `parse(text)` exactly as [[usecases/UC-ParseEnvText#Steps]] and [[contracts/envlint.contract#parse (src/parse.mjs)]]
describe, with its tests. The dialect decisions (quotes, keys, duplicates) are in [[_index#Decisions taken at spec time]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/parse.mjs` exports `parse(text)` returning `{ pairs, problems }`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-10, REQ-18)
- [x] `parse("A=1")` yields pair `{key:"A", value:"1", line:1}` (covers: REQ-11)
- [x] a line starting with `#` yields no pair and no problem (covers: REQ-12)
- [x] blank lines yield no pair and no problem, and later line numbers still count them (covers: REQ-13)
- [x] `parse("export A=1")` yields pair `A`=`1` (covers: REQ-14)
- [x] `parse("A='x y'")` yields value `x y` (covers: REQ-15)
- [x] `parse('A="x # y"')` yields value `x # y` (covers: REQ-16)
- [x] `parse("A=1\nJUNK")` yields problem `{line: 2}`; `1BAD=x` and `A="open` each yield a problem at their 1-based line (covers: REQ-17)
- [x] `src/parse.mjs` contains no `import` statement — a test reads the file and asserts it (covers: REQ-27, REQ-18)
- [x] `parse("A=${B}")` yields the literal value `${B}` (covers: REQ-29)

### 📭 Empty & Null States
- [x] `parse("")` and `parse("# only\n\n")` return `{pairs: [], problems: []}` (covers: REQ-6)
- [x] `parse` never throws on `"="`, `"\0\n'"`, or a long random string — asserted in the test (covers: REQ-7)

## Non-Go (not in this task)
- Reading files, the schema, printing — the CLI's.
- Escape sequences, multiline values, inline-comment stripping.


## Execution Log — 2026-11-07 (envlint/parsing-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/parse.mjs` exports `parse(text)` returning `{ pairs, problems }`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-10, REQ-18): pass (node --test test/parse.test.mjs -> 12/12; T0 green)
- `parse("A=1")` yields pair `{key:"A", value:"1", line:1}` (covers: REQ-11): pass (test 'simple pair' deepEqual)
- a line starting with `#` yields no pair and no problem (covers: REQ-12): pass (test 'comment line yields nothing')
- blank lines yield no pair and no problem, and later line numbers still count them (covers: REQ-13): pass (test 'blank lines...' line 3)
- `parse("export A=1")` yields pair `A`=`1` (covers: REQ-14): pass (test 'export prefix')
- `parse("A='x y'")` yields value `x y` (covers: REQ-15): pass (test 'single quotes')
- `parse('A="x # y"')` yields value `x # y` (covers: REQ-16): pass (test 'double quotes keep #')
- `parse("A=1\nJUNK")` yields problem `{line: 2}`; `1BAD=x` and `A="open` each yield a problem at their 1-based line (covers: REQ-17): pass (test 'problems carry 1-based lines')
- `src/parse.mjs` contains no `import` statement — a test reads the file and asserts it (covers: REQ-27, REQ-18): pass (test 'parse.mjs has no import statement')
- `parse("A=${B}")` yields the literal value `${B}` (covers: REQ-29): pass (test 'no interpolation')
- `parse("")` and `parse("# only\n\n")` return `{pairs: [], problems: []}` (covers: REQ-6): pass (test 'empty inputs')
- `parse` never throws on `"="`, `"\0\n'"`, or a long random string — asserted in the test (covers: REQ-7): pass (test 'never throws')
