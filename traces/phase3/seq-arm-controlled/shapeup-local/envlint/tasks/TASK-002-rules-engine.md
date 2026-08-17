---
type: task
feature: envlint
id: TASK-002
title: "Create Rules engine (src/rules.mjs)"
lens: standard
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003, TASK-004]
use_case_refs: [UC-01]
entities: []
repositories: []
linked_docs: ["[[usecases/UC-01#Steps]]", "[[usecases/UC-01#Invariants]]", "[[domain-model#Value-Objects]]"]
estimated_hours: 4
tags: [rules, pure-function]
completed_at: 2026-08-17
---

# TASK-002: Create Rules engine (src/rules.mjs)

## Context
Pure engine: `{pairs, problems}` + schema in, `Finding[]` out. Never imports Parsing. Reference:
[[usecases/UC-01#Steps]] step 5, [[usecases/UC-01#Invariants]]
INV-01/INV-02/INV-06, and the type rules in EXPECTED.md.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/rules.mjs` exports `evaluate(pairs, problems, schema): Finding[]`
- [x] `node --test test/rules.test.mjs` passes
- [x] Each `ParseProblem` becomes one `Finding`: `key` = raw line text truncated to 30 chars,
      `message` = `"not a KEY=VALUE assignment"`, `line` = the problem's line (E4)
- [x] A key present in the file but absent from the schema is never a finding (INV-01)
- [x] `required: true` + key absent from the (deduped) pairs → `Finding` with `line: 0`
- [x] When a key is assigned more than once, only the LAST occurrence in file order is
      evaluated; earlier occurrence(s) never produce a finding of their own (INV-02)
- [x] `type: "int"` matches `/^-?\d+$/`: `01`/`-5` valid, `1.5`/`1e3`/`""` invalid
- [x] `type: "bool"` matches `true`/`false`/`1`/`0` case-insensitively
- [x] `type: "url"` requires BOTH `new URL(v)` to not throw AND `protocol` to be `http:` or
      `https:` — a value that merely parses (e.g. `ftp://x.com`, `mailto:a@b.com`) is a finding
- [x] `type: "string"` accepts any value, including empty
- [x] `enum: [...]` requires an exact match against one of the listed values
- [x] A present-but-empty value (`KEY=`) satisfies `string`, fails `int`/`bool`/`url`/`enum`
- [x] Zero pairs + zero `required` keys in schema → zero findings (INV-06: this is the "ok"
      branch, not an E3 branch — E3's "no ok" only applies when ≥1 `required` key is missing)

### 🔢 Boundary Values
- [x] `int` at `01` (leading zero): valid
- [x] `int` at `1.5`, `1e3`, `""`, `"5-"`, `"+5"`: all invalid
- [x] `bool` at `TRUE`, `False`, `1`, `0`: valid; at `yes`, `2`: invalid

## Implementation Notes
The protocol gate for `url` is the one rule with a documented gotcha (see
`spike-url-type-validation.md`): `try { new URL(v) } catch { return false }` alone is NOT
sufficient — it must also check `protocol === 'http:' || protocol === 'https:'`. Do not
"improve" on `new URL()`'s WHATWG leniency (e.g. rejecting `http:/x.com` for looking malformed)
— trust it as-is and only gate on protocol.

## Non-Go (not in this task)
- No text parsing — that's TASK-001 (Parsing engine), already produced its output by this point.
- No file reading, no argv, no output rendering, no exit codes — that's TASK-003 (CLI).


## Execution Log — 2026-08-17 (envlint/rules-engine-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/rules.mjs` exports `evaluate(pairs, problems, schema): Finding[]`: pass (src/rules.mjs exports evaluate(pairs, problems, schema))
- `node --test test/rules.test.mjs` passes: pass (node --test test/rules.test.mjs -> 14 pass, 0 fail)
- Each `ParseProblem` becomes one `Finding`: `key` = raw line text truncated to 30 chars,: pass (test 'ParseProblem becomes one Finding (E4 shape)' passes)
- A key present in the file but absent from the schema is never a finding (INV-01): pass (test 'key present in file but absent from schema is never a finding (INV-01)' passes)
- `required: true` + key absent from the (deduped) pairs → `Finding` with `line: 0`: pass (test 'required:true + key absent from deduped pairs -> Finding with line:0' passes)
- When a key is assigned more than once, only the LAST occurrence in file order is: pass (test 'duplicate key: only LAST occurrence in file order is evaluated (INV-02)' passes)
- `type: "int"` matches `/^-?\d+$/`: `01`/`-5` valid, `1.5`/`1e3`/`""` invalid: pass (test 'type:int matches /^-?\d+$/' passes)
- `type: "bool"` matches `true`/`false`/`1`/`0` case-insensitively: pass (test 'type:bool matches true/false/1/0 case-insensitively' passes)
- `type: "url"` requires BOTH `new URL(v)` to not throw AND `protocol` to be `http:` or: pass (test 'type:url requires new URL() to parse AND protocol http:/https:' passes)
- `type: "string"` accepts any value, including empty: pass (test 'type:string accepts any value, including empty' passes)
- `enum: [...]` requires an exact match against one of the listed values: pass (test 'enum requires exact match against listed values' passes)
- A present-but-empty value (`KEY=`) satisfies `string`, fails `int`/`bool`/`url`/`enum`: pass (test 'present-but-empty value satisfies string, fails int/bool/url/enum' passes)
- Zero pairs + zero `required` keys in schema → zero findings (INV-06: this is the "ok": pass (test 'zero pairs + zero required keys -> zero findings (INV-06 ok branch)' passes)
- `int` at `01` (leading zero): valid: pass (test 'boundary: int leading zero 01 is valid' passes)
- `int` at `1.5`, `1e3`, `""`, `"5-"`, `"+5"`: all invalid: pass (test 'boundary: int invalid set 1.5/1e3/""/5-/+5 all invalid' passes)
- `bool` at `TRUE`, `False`, `1`, `0`: valid; at `yes`, `2`: invalid: pass (test 'boundary: bool TRUE/False/1/0 valid, yes/2 invalid' passes)


## Execution Log — 2026-08-17 (envlint/rules-engine-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/rules.mjs` exports `evaluate(pairs, problems, schema): Finding[]`: pass (src/rules.mjs exports evaluate(pairs, problems, schema); test 'src/rules.mjs exports evaluate(pairs, problems, schema)' passes)
- `node --test test/rules.test.mjs` passes: pass (node --test test/rules.test.mjs -> 15 pass, 0 fail)
- Each `ParseProblem` becomes one `Finding`: `key` = raw line text truncated to 30 chars,: pass (test 'ParseProblem becomes one Finding (E4 shape)' passes)
- A key present in the file but absent from the schema is never a finding (INV-01): pass (test 'key present in file but absent from schema is never a finding (INV-01)' passes)
- `required: true` + key absent from the (deduped) pairs → `Finding` with `line: 0`: pass (test 'required:true + key absent from deduped pairs -> Finding with line:0' passes)
- When a key is assigned more than once, only the LAST occurrence in file order is: pass (test 'duplicate key: only LAST occurrence in file order is evaluated (INV-02)' passes)
- `type: "int"` matches `/^-?\d+$/`: `01`/`-5` valid, `1.5`/`1e3`/`""` invalid: pass (test 'type:int matches /^-?\d+$/' passes)
- `type: "bool"` matches `true`/`false`/`1`/`0` case-insensitively: pass (test 'type:bool matches true/false/1/0 case-insensitively' passes)
- `type: "url"` requires BOTH `new URL(v)` to not throw AND `protocol` to be `http:` or: pass (test 'type:url requires new URL() to parse AND protocol http:/https:' passes)
- `type: "string"` accepts any value, including empty: pass (test 'type:string accepts any value, including empty' passes)
- `enum: [...]` requires an exact match against one of the listed values: pass (test 'enum requires exact match against listed values' passes)
- A present-but-empty value (`KEY=`) satisfies `string`, fails `int`/`bool`/`url`/`enum`: pass (test 'present-but-empty value satisfies string, fails int/bool/url/enum' passes)
- Zero pairs + zero `required` keys in schema → zero findings (INV-06: this is the "ok": pass (test 'zero pairs + zero required keys -> zero findings (INV-06 ok branch)' passes)
- `int` at `01` (leading zero): valid: pass (test 'boundary: int leading zero 01 is valid' passes)
- `int` at `1.5`, `1e3`, `""`, `"5-"`, `"+5"`: all invalid: pass (test 'boundary: int invalid set 1.5/1e3/""/5-/+5 all invalid' passes)
- `bool` at `TRUE`, `False`, `1`, `0`: valid; at `yes`, `2`: invalid: pass (test 'boundary: bool TRUE/False/1/0 valid, yes/2 invalid' passes)


## Execution Log — 2026-08-17 (envlint/rules-engine-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `src/rules.mjs` exports `evaluate(pairs, problems, schema): Finding[]`: pass (src/rules.mjs exports evaluate(pairs, problems, schema); test 'src/rules.mjs exports evaluate(pairs, problems, schema)' passes)
- `node --test test/rules.test.mjs` passes: pass (node --test test/rules.test.mjs -> 15 pass, 0 fail)
- Each `ParseProblem` becomes one `Finding`: `key` = raw line text truncated to 30 chars,: pass (test 'ParseProblem becomes one Finding (E4 shape)' passes)
- A key present in the file but absent from the schema is never a finding (INV-01): pass (test 'key present in file but absent from schema is never a finding (INV-01)' passes)
- `required: true` + key absent from the (deduped) pairs → `Finding` with `line: 0`: pass (test 'required:true + key absent from deduped pairs -> Finding with line:0' passes)
- When a key is assigned more than once, only the LAST occurrence in file order is: pass (test 'duplicate key: only LAST occurrence in file order is evaluated (INV-02)' passes)
- `type: "int"` matches `/^-?\d+$/`: `01`/`-5` valid, `1.5`/`1e3`/`""` invalid: pass (test 'type:int matches /^-?\d+$/' passes)
- `type: "bool"` matches `true`/`false`/`1`/`0` case-insensitively: pass (test 'type:bool matches true/false/1/0 case-insensitively' passes)
- `type: "url"` requires BOTH `new URL(v)` to not throw AND `protocol` to be `http:` or: pass (test 'type:url requires new URL() to parse AND protocol http:/https:' passes)
- `type: "string"` accepts any value, including empty: pass (test 'type:string accepts any value, including empty' passes)
- `enum: [...]` requires an exact match against one of the listed values: pass (test 'enum requires exact match against listed values' passes)
- A present-but-empty value (`KEY=`) satisfies `string`, fails `int`/`bool`/`url`/`enum`: pass (test 'present-but-empty value satisfies string, fails int/bool/url/enum' passes)
- Zero pairs + zero `required` keys in schema → zero findings (INV-06: this is the "ok": pass (test 'zero pairs + zero required keys -> zero findings (INV-06 ok branch)' passes)
- `int` at `01` (leading zero): valid: pass (test 'boundary: int leading zero 01 is valid' passes)
- `int` at `1.5`, `1e3`, `""`, `"5-"`, `"+5"`: all invalid: pass (test 'boundary: int invalid set 1.5/1e3/""/5-/+5 all invalid' passes)
- `bool` at `TRUE`, `False`, `1`, `0`: valid; at `yes`, `2`: invalid: pass (test 'boundary: bool TRUE/False/1/0 valid, yes/2 invalid' passes)
