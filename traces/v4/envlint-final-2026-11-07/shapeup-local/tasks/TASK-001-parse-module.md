---
type: task
feature: envlint
id: TASK-001
title: "Implement the pure .env parser module"
lens: standard
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-ParseEnvText]
entities: [EnvFile, Assignment]
repositories: []
linked_docs: ["[[usecases/UC-ParseEnvText]]", "[[contracts/parse.contract]]", "[[domain-model]]"]
estimated_hours: 3
tags: [FEAT, parsing]
completed_at: 2026-11-07
---

# TASK-001: Implement the pure .env parser module

## Context
Implement `parse(text)` per [[contracts/parse.contract]], realising [[usecases/UC-ParseEnvText#Steps]].
Pure, zero-dependency Node ESM; imports nothing from `src/rules.mjs`.
Reference: [[domain-model#Value Objects]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/parse.mjs` exists and exports a named function `parse` (covers: REQ-16)
- [x] `test/parse.test.mjs` exists; `node --test test/parse.test.mjs` exits 0 run on its own (covers: REQ-22)
- [x] `src/parse.mjs` contains no import of `./rules.mjs` or any non-`node:` module (covers: REQ-22)
- [x] `parse` returns `{pairs, problems}` where each pair is `{key, value, line}` with 1-based `line`, in file order (covers: REQ-16)
- [x] `KEY=value` yields a pair with the trimmed text after the first `=` as value (covers: REQ-10)
- [x] Lines whose trimmed text starts with `#` are ignored (covers: REQ-11)
- [x] Blank and whitespace-only lines are ignored (covers: REQ-12)
- [x] `export KEY=value` yields the same pair as `KEY=value` (covers: REQ-13)
- [x] `K='a b'` and `K="a b"` both yield value `a b`; a `#…` comment after the closing quote is allowed (covers: REQ-14)
- [x] A line with no `=`, an invalid key, an unterminated quote, or trailing text after a closing quote yields `{line, message}` in `problems` with its 1-based line (covers: REQ-15)
- [x] `parse` does not throw for malformed input (`=x`, `"open`, `KEY`, `1A=b`, random bytes) (covers: REQ-7)
- [x] `A=${B}` yields value `${B}` literally — no interpolation (pitch no-go; graded as UC-ParseEnvText TS-NOGO-02)

### 📭 Empty & Null States
- [x] `parse("")` and `parse("# only\n\n")` return `{pairs: [], problems: []}` (covers: REQ-6)

## Implementation Notes
Handle `\r\n` line endings. Duplicate keys are all kept in `pairs`; the rules module decides which wins.

## Non-Go (not in this task)
- Any schema/rule logic (TASK-002), file I/O or CLI (TASK-003), `${VAR}` interpolation.


## Execution Log — 2026-11-07 (envlint/parsing-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/parse.mjs` exists and exports a named function `parse` (covers: REQ-16): pass (T0 r1-a1-t1 green; test imports { parse })
- `test/parse.test.mjs` exists; `node --test test/parse.test.mjs` exits 0 run on its own (covers: REQ-22): pass (T0 fixture node --test test/parse.test.mjs 1/1 green)
- `src/parse.mjs` contains no import of `./rules.mjs` or any non-`node:` module (covers: REQ-22): pass (file has no import statements)
- `parse` returns `{pairs, problems}` where each pair is `{key, value, line}` with 1-based `line`, in file order (covers: REQ-16): pass (test 'basic, order, lines' green in T0)
- `KEY=value` yields a pair with the trimmed text after the first `=` as value (covers: REQ-10): pass (test 'basic, order, lines' green in T0)
- Lines whose trimmed text starts with `#` are ignored (covers: REQ-11): pass (test 'comments and blanks ignored' green in T0)
- Blank and whitespace-only lines are ignored (covers: REQ-12): pass (test 'comments and blanks ignored' green in T0)
- `export KEY=value` yields the same pair as `KEY=value` (covers: REQ-13): pass (test 'export' green in T0)
- `K='a b'` and `K="a b"` both yield value `a b`; a `#…` comment after the closing quote is allowed (covers: REQ-14): pass (test 'quotes' green in T0)
- A line with no `=`, an invalid key, an unterminated quote, or trailing text after a closing quote yields `{line, message}` in `problems` with its 1-based line (covers: REQ-15): pass (test 'problems' green in T0)
- `parse` does not throw for malformed input (`=x`, `"open`, `KEY`, `1A=b`, random bytes) (covers: REQ-7): pass (tests 'problems' and 'no throw on garbage' green in T0)
- `A=${B}` yields value `${B}` literally — no interpolation (pitch no-go; graded as UC-ParseEnvText TS-NOGO-02): pass (test 'no interpolation' green in T0)
- `parse("")` and `parse("# only\n\n")` return `{pairs: [], problems: []}` (covers: REQ-6): pass (test 'empty' green in T0)
