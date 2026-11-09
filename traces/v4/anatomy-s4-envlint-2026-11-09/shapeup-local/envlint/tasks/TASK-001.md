---
type: task
feature: envlint
id: TASK-001
title: "Implement the pure parseEnv module"
package: "."
status: ready
priority: 1
depends_on: []
unlocks: [TASK-003, TASK-004]
use_case_refs: [UC-ParseEnvText]
scope_id: ""
entities: [EnvPair, ParseProblem]
repositories: []
linked_docs: ["[[usecases/UC-ParseEnvText]]", "[[domain-model]]"]
files: [src/parse.mjs, test/parse.test.mjs]
estimated_hours: 2
tags: [pure]
---

# TASK-001: Implement the pure parseEnv module

## Context
Implements [[usecases/UC-ParseEnvText#Steps]] exactly, with the pair shape fixed in [[domain-model#Value Objects]] (SD-1) and the quoting rule SD-7 from [[_index]].
No existing code; plain Node ESM, no dependencies.

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/parse.mjs` exists and exports `parseEnv(text)` returning `{pairs, problems}`; it contains no `import` statement (covers: REQ-16, REQ-22)
- [ ] `test/parse.test.mjs` exists and `node --test test/parse.test.mjs` exits 0, run alone with no other module present (covers: REQ-23)
- [ ] `KEY=value` lines become `{key, value, line}` pairs with 1-based lines (covers: REQ-10)
- [ ] `#` comment lines and inline ` # …` after an unquoted value are dropped (covers: REQ-11)
- [ ] blank and whitespace-only lines are skipped and still counted for line numbers (covers: REQ-12)
- [ ] `export KEY=value` yields the pair `KEY`/`value` (covers: REQ-13)
- [ ] `'…'` and `"…"` values are unquoted verbatim, `#` inside quotes kept (covers: REQ-14)
- [ ] every row of the UC-ParseEnvText Test Surface (TS-INV-01..03, TS-ERR-*, TS-REQ-forms/dup/crlf) is a named test case in `test/parse.test.mjs` and passes (covers: REQ-15, REQ-7, REQ-26)

### 🔢 Boundary Values
- [ ] empty string input → `{pairs: [], problems: []}` (covers: REQ-6)
- [ ] `F=` → pair with value `""`, no problem

## Non-Go (not in this task)
- Rules, schema handling, CLI, file I/O.
