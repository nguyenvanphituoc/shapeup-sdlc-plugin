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
entities: [EnvFile]
repositories: []
linked_docs: ["[[usecases/UC-ParseEnvText]]", "[[contracts/envlint.contract]]"]
estimated_hours: 2
tags: [parsing]
completed_at: 2026-11-07
---

# TASK-001: Implement the pure .env parser in src/parse.mjs

## Context
Implement `parseEnv(text)` exactly as [[usecases/UC-ParseEnvText#Steps]] and contract §1 of
[[contracts/envlint.contract]] describe. It is a pure function: text in, `{pairs, problems}` out, with no IO
and no imports from the rules module.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/parse.mjs` exports `parseEnv(text)` returning `{pairs: {key,value,line}[], problems: {line,message}[]}`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-16)
- [x] `KEY=value` lines become pairs with 1-based `line`, key and value trimmed (covers: REQ-10)
- [x] lines whose first non-space char is `#` are ignored (covers: REQ-11)
- [x] blank and whitespace-only lines are ignored (covers: REQ-12)
- [x] `export KEY=value` yields the pair `KEY=value` (covers: REQ-13)
- [x] `S='a b'` and `D="c d"` yield values `a b` and `c d`, with no escape processing (covers: REQ-14)
- [x] a line with no `=`, an invalid key or an unterminated quote yields a problem carrying its 1-based line number, and the line is skipped (covers: REQ-15)
- [x] `src/parse.mjs` has no `import` of a rules module; a test asserts this by reading the file (covers: REQ-21)
- [x] `A=${HOME}` yields the literal value `${HOME}` (covers: REQ-24)

### 📭 Empty & Null States
- [x] `parseEnv("")` and a comments-only text return `{pairs: [], problems: []}` (covers: REQ-6)
- [x] `parseEnv` never throws for any string, tested over `""`, `"="`, a lone quote and non-UTF8-ish text (covers: REQ-7)

## Implementation Notes
- Split on `\n` and strip a trailing `\r`. Split each line on the first `=`. The key regex is `^[A-Za-z_][A-Za-z0-9_]*$`.
- Duplicate keys are all kept in file order.

## Non-Go (not in this task)
- Rule checks, file IO, the CLI.
- Inline `# comments` after a value, multiline values, escape sequences.


## Execution Log — 2026-11-07 (envlint/parsing-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/parse.mjs` exports `parseEnv(text)` returning `{pairs: {key,value,line}[], problems: {line,message}[]}`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-16): pass (node --test test/parse.test.mjs -> 10/10; T0 green r1-a1-t1)
- `KEY=value` lines become pairs with 1-based `line`, key and value trimmed (covers: REQ-10): pass (test 'KEY=value with line numbers and trimming')
- lines whose first non-space char is `#` are ignored (covers: REQ-11): pass (test 'comments ignored')
- blank and whitespace-only lines are ignored (covers: REQ-12): pass (test 'blank lines ignored')
- `export KEY=value` yields the pair `KEY=value` (covers: REQ-13): pass (test 'export prefix')
- `S='a b'` and `D="c d"` yield values `a b` and `c d`, with no escape processing (covers: REQ-14): pass (test 'quotes, no escapes')
- a line with no `=`, an invalid key or an unterminated quote yields a problem carrying its 1-based line number, and the line is skipped (covers: REQ-15): pass (test 'problems carry line and skip')
- `src/parse.mjs` has no `import` of a rules module; a test asserts this by reading the file (covers: REQ-21): pass (test 'no rules import' reads the source)
- `A=${HOME}` yields the literal value `${HOME}` (covers: REQ-24): pass (test 'no interpolation')
- `parseEnv("")` and a comments-only text return `{pairs: [], problems: []}` (covers: REQ-6): pass (test 'empty and comments-only')
- `parseEnv` never throws for any string, tested over `""`, `"="`, a lone quote and non-UTF8-ish text (covers: REQ-7): pass (test 'never throws')
