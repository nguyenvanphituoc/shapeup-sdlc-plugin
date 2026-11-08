---
type: task
feature: envlint
id: TASK-001
title: "Implement the pure .env parser"
package: src
status: done
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-01]
entities: [ParseResult]
repositories: []
linked_docs: [domain-model, usecases/UC-01-parse-env-text]
estimated_hours: 3
tags: [FEAT, parsing]
files: [src/parse.mjs, test/parse.test.mjs]
---

# TASK-001: Implement the pure .env parser

## Context
Implements C1 exactly as written. Reference: [[domain-model#C1 — `ParseResult` (Parsing → Rules, via the CLI)]] / [[usecases/UC-01-parse-env-text#Steps]].
Zero dependencies; Node 24 ESM; `node:test` for tests.

## Acceptance Criteria

### ✅ Baseline
- [ ] `src/parse.mjs` exports `parseEnv(text)` returning `{pairs, problems}` per C1 (covers: REQ-16)
- [ ] `src/parse.mjs` contains no `import` statement and performs no I/O (covers: REQ-16, REQ-22)
- [ ] `node --test test/parse.test.mjs` exits 0, importing only `src/parse.mjs` and `node:` builtins (covers: REQ-23)

### 🧪 BDD Scenarios
- [ ] `KEY=value` yields `{key:"KEY", value:"value", line:1}` (covers: REQ-10)
- [ ] Full-line `#` comments and whitespace-only lines yield no pair and no problem (covers: REQ-11, REQ-12)
- [ ] `export KEY=value` yields key `KEY` (covers: REQ-13)
- [ ] `A="x y"` and `B='x y'` yield the inner text `x y`; `A="abc` yields problem `unterminated quote` (covers: REQ-14)
- [ ] A line with no `=` on line 2 yields `{line:2, message:"missing '='"}`; `1BAD=x` yields `invalid key` (covers: REQ-15)
- [ ] `A=${HOME}` yields the literal value `${HOME}` (covers: REQ-26)

### 🔢 Boundary Values
- [ ] Empty string, BOM-prefixed text and CRLF text parse without throwing, with correct 1-based lines (covers: REQ-15)
