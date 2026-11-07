---
type: task
feature: envlint
id: TASK-001
title: "Implement the pure .env parse module"
lens: lite
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-ParseEnv]
scope_id: ""
entities: [EnvFile]
repositories: []
linked_docs: ["[[usecases/UC-ParseEnv]]", "[[domain-model#Value Objects]]", "[[domain-model#Planning decisions]]"]
estimated_hours: 3
tags: [parsing, pure]
completed_at: 2026-11-07
---

# TASK-001: Implement the pure .env parse module

## Context
Build `parse(text)` per [[usecases/UC-ParseEnv#Steps]], returning the EnvPair / ParseProblem shapes in
[[domain-model#Value Objects]] and following planning decisions PD-1 to PD-6.
Reference: [[usecases/UC-ParseEnv]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `src/parse.mjs` exports `parse(text)` returning `{ pairs, problems }`; `node --test test/parse.test.mjs` passes with at least one test (covers: REQ-16)
- [x] `src/parse.mjs` imports neither `node:fs` nor `src/rules.mjs` (TS-INV-01) (covers: REQ-22)
- [x] `KEY=value`, `# comment` lines and blank lines: pairs for assignments only, comments and blanks skipped (TS-REQ-text-forms) (covers: REQ-10)
- [x] `# comment` lines produce no pair and no problem (covers: REQ-11)
- [x] blank and whitespace-only lines produce no pair and no problem (covers: REQ-12)
- [x] `export KEY=value` yields pair `{key:"KEY", value:"value"}` (covers: REQ-13)
- [x] `'single'` and `"double"` quoted values come back with the quotes stripped; an unclosed quote is a problem (TS-ERR-PARSE_UNCLOSED_QUOTE) (covers: REQ-14)
- [x] a line with no `=` or an invalid key is a problem carrying its 1-based line, and every pair carries its 1-based `line` (TS-ERR-PARSE_NO_EQUALS, TS-ERR-PARSE_BAD_KEY) (covers: REQ-15)
- [x] `parse` never throws on malformed input, including `""`, `"=x"`, `"A"` (TS-INV-02) (covers: REQ-7)
- [x] `parse("A=${B}")` returns the literal value `${B}` (TS-NOGO-01) (covers: REQ-24)

### 🔢 Boundary Values
- [x] empty string → `{pairs: [], problems: []}` (covers: REQ-6)
- [x] CRLF text parses identically to LF text (no `\r` in values)

## Implementation Notes
Split on `/\r?\n/`. Only a first-non-blank `#` starts a comment (PD-5). Duplicates are kept (PD-6).

## Non-Go (not in this task)
- Schema rules — UC-CheckRules
- File reading and printing — UC-LintEnvFile


## Execution Log — 2026-11-07 (envlint/parsing-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `src/parse.mjs` exports `parse(text)` returning `{ pairs, problems }`; `node --test test/parse.test.mjs` passes with at least one test (covers: REQ-16): pass (node --test test/parse.test.mjs -> 16/16 pass; test 'parse returns { pairs, problems }'; harness verify t0 r1 a1 -> overall green, fixtures 1/1)
- `src/parse.mjs` imports neither `node:fs` nor `src/rules.mjs` (TS-INV-01) (covers: REQ-22): pass (src/parse.mjs has zero import statements; test 'TS-INV-01' scans its import lines for fs/rules and asserts parse(text) deep-equals a second call -> pass)
- `KEY=value`, `# comment` lines and blank lines: pairs for assignments only, comments and blanks skipped (TS-REQ-text-forms) (covers: REQ-10): pass (test 'TS-REQ-text-forms': KEY=value, # comment, blank, whitespace-only, export K=v, 'single', "double" over CRLF -> 4 pairs at lines 1/5/6/7, problems [] -> pass)
- `# comment` lines produce no pair and no problem (covers: REQ-11): pass (test 'comment lines produce no pair and no problem' (incl. indented #) -> {pairs:[],problems:[]} -> pass)
- blank and whitespace-only lines produce no pair and no problem (covers: REQ-12): pass (test 'blank and whitespace-only lines ...' on "\n   \n\t\n" -> {pairs:[],problems:[]} -> pass)
- `export KEY=value` yields pair `{key:"KEY", value:"value"}` (covers: REQ-13): pass (test 'export KEY=value yields ...' -> pairs[0].key KEY, pairs[0].value value, no problems -> pass)
- `'single'` and `"double"` quoted values come back with the quotes stripped; an unclosed quote is a problem (TS-ERR-PARSE_UNCLOSED_QUOTE) (covers: REQ-14): pass (test 'TS-REQ-text-forms' asserts S=single, D=double stripped; test 'TS-ERR-PARSE_UNCLOSED_QUOTE': A="open, A='open, mismatched quotes, lone quote -> one problem at line 1, no pair -> pass)
- a line with no `=` or an invalid key is a problem carrying its 1-based line, and every pair carries its 1-based `line` (TS-ERR-PARSE_NO_EQUALS, TS-ERR-PARSE_BAD_KEY) (covers: REQ-15): pass (tests 'TS-ERR-PARSE_NO_EQUALS' (A=1\nGARBAGE\n -> problems at [2], pairs [A]), 'TS-ERR-PARSE_BAD_KEY' (1BAD=x -> problem line 1, no pairs), 'every pair carries its 1-based line' (lines [2,4]) -> pass)
- `parse` never throws on malformed input, including `""`, `"=x"`, `"A"` (TS-INV-02) (covers: REQ-7): pass (test 'TS-INV-02': "", "=x", "A", "\u0000", "export", "export =", "  =  ", lone quote, multi-line -> no throw, every problem line an integer >= 1; =x and A -> problem at line 1 -> pass)
- `parse("A=${B}")` returns the literal value `${B}` (TS-NOGO-01) (covers: REQ-24): pass (test 'TS-NOGO-01': parse("A=${B}").pairs deep-equals [{key:"A",value:"${B}",line:1}] -> pass)
- empty string → `{pairs: [], problems: []}` (covers: REQ-6): pass (test 'empty string -> {pairs: [], problems: []}': parse("") deep-equals {pairs:[],problems:[]} -> pass)
- CRLF text parses identically to LF text (no `\r` in values): pass (test 'CRLF text parses identically to LF text': parse(crlf) deep-equals parse(lf) and no pair value contains \r -> pass)
