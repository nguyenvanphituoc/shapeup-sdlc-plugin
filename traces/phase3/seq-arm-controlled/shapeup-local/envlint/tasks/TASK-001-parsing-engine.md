---
type: task
feature: envlint
id: TASK-001
title: "Create Parsing engine (src/parsing.mjs)"
lens: standard
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003, TASK-004]
use_case_refs: [UC-01]
entities: []
repositories: []
linked_docs: ["[[usecases/UC-01#Steps]]", "[[domain-model#Value-Objects]]"]
estimated_hours: 3
tags: [parsing, pure-function]
completed_at: 2026-08-17
---

# TASK-001: Create Parsing engine (src/parsing.mjs)

## Context
Pure engine: `.env` text in, `{pairs, problems}` out. Never imports Rules. Reference:
[[usecases/UC-01#Steps]] step 4 for the exact parsing rules, and
[[domain-model#Value-Objects]] for the `EnvPair`/`ParseProblem` shapes.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/parsing.mjs` exports `parseEnv(text: string): { pairs: EnvPair[], problems: ParseProblem[] }`
- [x] `node --test test/parsing.test.mjs` passes
- [x] Comment lines (`# ...`) and blank lines produce neither a pair nor a problem
- [x] `export KEY=value` parses identically to `KEY=value`
- [x] `export KEY="value"` strips both the `export` prefix and the matching quotes (combined form)
- [x] `KEY="value"` / `KEY='value'` strip matching surrounding quotes only
- [x] `KEY="value` (no closing quote) is left untouched — leading quote stays in the value
- [x] Whitespace around `KEY` and around the value is trimmed (outside quotes)
- [x] A line that is not blank/comment/`[export] KEY=VALUE` produces a `ParseProblem` with its
      correct 1-based line number and the raw, untrimmed line text
- [x] A key assigned more than once produces one `EnvPair` per occurrence, in file order (no
      dedup at parse time — dedup is Rules' job, per INV-02)
- [x] Every `EnvPair`/`ParseProblem` carries the correct 1-based line number

### 🔢 Boundary Values
- [x] Line 1 of the file is correctly reported as line `1` (not `0`), and the last line of a
      file with no trailing newline is still parsed and numbered correctly
- [x] An entirely empty file (`""`) returns `{ pairs: [], problems: [] }`
- [x] A file that is only comments/blank lines returns `{ pairs: [], problems: [] }` (this is
      the E3 precondition — Parsing itself reports nothing wrong; UC-01's E3 finding is
      produced downstream by Rules against an empty `pairs` array)

## Implementation Notes
Keep this file free of any import from `src/rules.mjs` or `bin/envlint.mjs` — the pitch's
independent-buildability guarantee (and TASK-004's fixture coverage) depends on Parsing and
Rules sharing no file and no import.

## Non-Go (not in this task)
- No schema evaluation, no `required`/`type`/`enum` logic — that's TASK-002 (Rules engine).
- No file reading, no argv, no exit codes — that's TASK-003 (CLI).


## Execution Log — 2026-08-17 (envlint/parsing-engine-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/parsing.mjs` exports `parseEnv(text: string): { pairs: EnvPair[], problems: ParseProblem[] }`: pass (src/parsing.mjs exports parseEnv returning {pairs, problems})
- `node --test test/parsing.test.mjs` passes: pass (node --test test/parsing.test.mjs -> tests 13, pass 13, fail 0)
- Comment lines (`# ...`) and blank lines produce neither a pair nor a problem: pass (test: 'comments and blank lines produce neither a pair nor a problem')
- `export KEY=value` parses identically to `KEY=value`: pass (test: 'export KEY=value parses identically to KEY=value')
- `export KEY="value"` strips both the `export` prefix and the matching quotes (combined form): pass (test: 'export KEY="value" strips both export prefix and matching quotes')
- `KEY="value"` / `KEY='value'` strip matching surrounding quotes only: pass (test: 'KEY="value" / KEY=''value'' strip matching surrounding quotes only')
- `KEY="value` (no closing quote) is left untouched — leading quote stays in the value: pass (test: 'KEY="value (no closing quote) is left untouched' -> value === '"value')
- Whitespace around `KEY` and around the value is trimmed (outside quotes): pass (test: 'whitespace around KEY and value is trimmed (outside quotes)')
- A line that is not blank/comment/`[export] KEY=VALUE` produces a `ParseProblem` with its: pass (test: 'invalid line produces a ParseProblem with correct line number and raw untrimmed text' + 'ParseProblem preserves raw untrimmed indentation')
- A key assigned more than once produces one `EnvPair` per occurrence, in file order (no: pass (test: 'a key assigned more than once produces one EnvPair per occurrence, in file order')
- Every `EnvPair`/`ParseProblem` carries the correct 1-based line number: pass (test: 'every EnvPair/ParseProblem carries the correct 1-based line number')
- Line 1 of the file is correctly reported as line `1` (not `0`), and the last line of a: pass (test: 'line 1 is reported as 1, and last line with no trailing newline is parsed and numbered')
- An entirely empty file (`""`) returns `{ pairs: [], problems: [] }`: pass (test: 'an entirely empty file returns { pairs: [], problems: [] }')
- A file that is only comments/blank lines returns `{ pairs: [], problems: [] }` (this is: pass (test: 'a file that is only comments/blank lines returns { pairs: [], problems: [] }')


## Execution Log — 2026-08-17 (envlint/parsing-engine-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/parsing.mjs` exports `parseEnv(text: string): { pairs: EnvPair[], problems: ParseProblem[] }`: pass (src/parsing.mjs exports parseEnv returning {pairs, problems})
- `node --test test/parsing.test.mjs` passes: pass (node --test test/parsing.test.mjs -> tests 13, pass 13, fail 0)
- Comment lines (`# ...`) and blank lines produce neither a pair nor a problem: pass (test: 'comments and blank lines produce neither a pair nor a problem')
- `export KEY=value` parses identically to `KEY=value`: pass (test: 'export KEY=value parses identically to KEY=value')
- `export KEY="value"` strips both the `export` prefix and the matching quotes (combined form): pass (test: 'export KEY="value" strips both export prefix and matching quotes')
- `KEY="value"` / `KEY='value'` strip matching surrounding quotes only: pass (test: quote-stripping tests for double and single quotes both pass)
- `KEY="value` (no closing quote) is left untouched — leading quote stays in the value: pass (test: 'KEY="value (no closing quote) is left untouched' -> value === '"bar')
- Whitespace around `KEY` and around the value is trimmed (outside quotes): pass (test: 'whitespace around KEY and value is trimmed (outside quotes)')
- A line that is not blank/comment/`[export] KEY=VALUE` produces a `ParseProblem` with its: pass (tests: 'invalid line produces a ParseProblem with correct line number and raw untrimmed text' + 'ParseProblem preserves raw untrimmed indentation')
- A key assigned more than once produces one `EnvPair` per occurrence, in file order (no: pass (test: 'a key assigned more than once produces one EnvPair per occurrence, in file order')
- Every `EnvPair`/`ParseProblem` carries the correct 1-based line number: pass (test: 'every EnvPair/ParseProblem carries the correct 1-based line number')
- Line 1 of the file is correctly reported as line `1` (not `0`), and the last line of a: pass (test: 'line 1 is reported as 1, and last line with no trailing newline is parsed and numbered')
- An entirely empty file (`""`) returns `{ pairs: [], problems: [] }`: pass (test: 'an entirely empty file returns { pairs: [], problems: [] }')
- A file that is only comments/blank lines returns `{ pairs: [], problems: [] }` (this is: pass (test: 'a file that is only comments/blank lines returns { pairs: [], problems: [] }')


## Execution Log — 2026-08-17 (envlint/parsing-engine-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `src/parsing.mjs` exports `parseEnv(text: string): { pairs: EnvPair[], problems: ParseProblem[] }`: pass (src/parsing.mjs exports parseEnv with { pairs, problems } shape)
- `node --test test/parsing.test.mjs` passes: pass (node --test test/parsing.test.mjs → 13 pass, 0 fail)
- Comment lines (`# ...`) and blank lines produce neither a pair nor a problem: pass (test 'comments and blank lines produce neither a pair nor a problem' passes)
- `export KEY=value` parses identically to `KEY=value`: pass (test 'export KEY=value parses identically to KEY=value' passes)
- `export KEY="value"` strips both the `export` prefix and the matching quotes (combined form): pass (test 'export KEY="value" strips both export prefix and matching quotes' passes)
- `KEY="value"` / `KEY='value'` strip matching surrounding quotes only: pass (test 'KEY="value" / KEY=\'value\' strip matching surrounding quotes only' passes)
- `KEY="value` (no closing quote) is left untouched — leading quote stays in the value: pass (test 'KEY="value (no closing quote) is left untouched' passes)
- Whitespace around `KEY` and around the value is trimmed (outside quotes): pass (test 'whitespace around KEY and value is trimmed (outside quotes)' passes)
- A line that is not blank/comment/`[export] KEY=VALUE` produces a `ParseProblem` with its: pass (test 'invalid line produces a ParseProblem with correct line number and raw untrimmed text' passes)
- A key assigned more than once produces one `EnvPair` per occurrence, in file order (no: pass (test 'a key assigned more than once produces one EnvPair per occurrence, in file order' passes)
- Every `EnvPair`/`ParseProblem` carries the correct 1-based line number: pass (test 'every EnvPair/ParseProblem carries the correct 1-based line number' passes)
- Line 1 of the file is correctly reported as line `1` (not `0`), and the last line of a: pass (test 'line 1 is reported as 1, and last line with no trailing newline is parsed and numbered' passes)
- An entirely empty file (`""`) returns `{ pairs: [], problems: [] }`: pass (test 'an entirely empty file returns { pairs: [], problems: [] }' passes)
- A file that is only comments/blank lines returns `{ pairs: [], problems: [] }` (this is: pass (test 'a file that is only comments/blank lines returns { pairs: [], problems: [] }' passes)
