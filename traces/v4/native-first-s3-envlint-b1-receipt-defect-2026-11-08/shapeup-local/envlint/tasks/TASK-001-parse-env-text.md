---
type: task
feature: envlint
id: TASK-001
title: "Implement the pure .env parser in src/parse.mjs"
lens: lite
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-ParseEnvText]
entities: [EnvFile]
repositories: []
linked_docs: ["[[usecases/UC-ParseEnvText]]", "[[domain-model#Value Objects]]"]
estimated_hours: 3
tags: [parse, pure]
completed_at: 2026-11-07
---

# TASK-001: Implement the pure .env parser in src/parse.mjs

## Context
Implements [[usecases/UC-ParseEnvText#Steps]] exactly: `parse(text) → {pairs, problems}` with the `Pair`
and `ParseProblem` shapes from [[domain-model#Value Objects]]. Pure; imports nothing from `src/rules.mjs`.
Reference: [[usecases/UC-ParseEnvText]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/parse.mjs` exports `parse(text)` returning `{ pairs: {key,value,line}[], problems: {line,message}[] }` (covers: REQ-10, REQ-17)
- [x] `node --check src/parse.mjs` exits 0 and `node --test test/parse.test.mjs` passes
- [x] `KEY=value` lines yield a pair with the 1-based line number (covers: REQ-11)
- [x] `#` comment lines and an unquoted value's trailing ` # comment` yield nothing / are stripped (covers: REQ-12)
- [x] Blank and whitespace-only lines yield nothing and still advance the line count (covers: REQ-13)
- [x] `export KEY=value` yields the pair `KEY=value` (covers: REQ-14)
- [x] Single-quoted values are literal; double-quoted values support `\n`, `\"`, `\\`; a `#` inside quotes is part of the value (covers: REQ-15)
- [x] Every Error Case in [[usecases/UC-ParseEnvText#Error Cases]] produces exactly its message at the right 1-based line (covers: REQ-16)
- [x] `${VAR}` and `$VAR` are returned literally (covers: REQ-27)
- [x] `src/parse.mjs` has no import of `./rules.mjs` and no `node:` I/O import; `test/parse.test.mjs` imports only `src/parse.mjs` and `node:test`/`node:assert` (covers: REQ-24, REQ-25)

### 📭 Empty & Null States
- [x] `parse("")` and comment-only text return `{ pairs: [], problems: [] }` (covers: REQ-6)

### 🔢 Boundary Values
- [x] CRLF input yields the same pairs as LF input; a value of `KEY=` yields `value: ""`

## Non-Go (not in this task)
- Multi-line quoted values (a quote unclosed on its line is a problem, not a continuation).
- Any schema or rule logic; any file reading.


## Execution Log — 2026-11-07 (envlint/parse-env-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/parse.mjs` exports `parse(text)` returning `{ pairs: {key,value,line}[], problems: {line,message}[] }` (covers: REQ-10, REQ-17): pass (test 'returns { pairs, problems } with KEY=value at its 1-based line' deep-equals {pairs:[{key,value,line}],problems:[]}; node --test test/parse.test.mjs -> 15/15 pass)
- `node --check src/parse.mjs` exits 0 and `node --test test/parse.test.mjs` passes: pass (node --check src/parse.mjs -> exit 0; node --test test/parse.test.mjs -> tests 15, pass 15, fail 0; harness verify t0 parse-env --round 1 --attempt 1 -> overall green, fixtures 2/2 (.shapeup/envlint/t0/verdicts/r1-a1-t2.json))
- `KEY=value` lines yield a pair with the 1-based line number (covers: REQ-11): pass (tests 'returns { pairs, problems }...' and 'TS-REQ-forms' -> {key:'KEY',value:'value',line:1})
- `#` comment lines and an unquoted value's trailing ` # comment` yield nothing / are stripped (covers: REQ-12): pass (TS-REQ-forms: '# c' yields nothing, 'C=v # c' -> value 'v'; REQ-12 test: 'B=x   # c' -> 'x', 'A=x#y' -> 'x#y')
- Blank and whitespace-only lines yield nothing and still advance the line count (covers: REQ-13): pass (TS-INV-03: 'A=1\n\n# comment\nnope\n   \nB=2' -> B at line 6, problem at line 4)
- `export KEY=value` yields the pair `KEY=value` (covers: REQ-14): pass (TS-REQ-forms line 2 -> {key:'KEY',value:'value',line:2}; CRLF test 'export B="x"' -> B=x)
- Single-quoted values are literal; double-quoted values support `\n`, `\"`, `\\`; a `#` inside quotes is part of the value (covers: REQ-15): pass (REQ-15 test: A='a\nb "q"' kept literally; B="say \"hi\" \\ \t # not comment" -> 'say "hi" \ \t # not comment'; TS-REQ-forms A='x # y' -> 'x # y', B="a\nb" -> newline)
- Every Error Case in [[usecases/UC-ParseEnvText#Error Cases]] produces exactly its message at the right 1-based line (covers: REQ-16): pass (tests TS-ERR-NO_EQUALS, TS-ERR-INVALID_KEY (incl. line 2), TS-ERR-UNTERMINATED_SINGLE, TS-ERR-UNTERMINATED_DOUBLE, TS-ERR-TRAILING_AFTER_QUOTE all deep-equal the exact {line,message}; TS-INV-03 checks a problem at line 4)
- `${VAR}` and `$VAR` are returned literally (covers: REQ-27): pass (TS-INV-02: parse('A=${B}\nC=$D') -> values '${B}', '$D')
- `src/parse.mjs` has no import of `./rules.mjs` and no `node:` I/O import; `test/parse.test.mjs` imports only `src/parse.mjs` and `node:test`/`node:assert` (covers: REQ-24, REQ-25): pass (grep -n import src/parse.mjs -> no matches; grep -n import test/parse.test.mjs -> node:test, node:assert, ../src/parse.mjs only)
- `parse("")` and comment-only text return `{ pairs: [], problems: [] }` (covers: REQ-6): pass (test 'TS-REQ-empty / REQ-6': parse('') and parse('# only\n  # comments\n') deep-equal {pairs:[],problems:[]})
- CRLF input yields the same pairs as LF input; a value of `KEY=` yields `value: ""`: pass (test 'CRLF matches LF; KEY= yields empty value; duplicates kept': CRLF result deep-equals LF result; 'C=' -> value '')
