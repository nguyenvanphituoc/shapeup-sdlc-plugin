---
schema_version: 1
doc_type: task
feature: envlint
id: TASK-001
title: Implement lib/parse.mjs
use_case_refs: [UC-01-parse-env-file]
depends_on: []
unlocks: [TASK-003]
estimated_hours: 3
status: done
completed_at: 2026-08-17
---

# TASK-001 — Implement `lib/parse.mjs`

Implement `parseEnv(text)` exactly per [[../contracts/parse-contract|parse-contract]] and
[[../usecases/UC-01-parse-env-file|UC-01]]. Pure function, no I/O, no imports from
`lib/rules.mjs` or `bin/envlint.mjs`.

## Acceptance Criteria
- [x] `node --test test/parse.test.mjs` passes.
- [x] `# comment` / blank lines produce no `pairs` and no `problems` entry.
- [x] `export KEY=value` parses identically to `KEY=value`.
- [x] `KEY="value"` and `KEY='value'` strip matching-pair quotes only; `KEY="value`
      (unterminated) keeps the leading quote.
- [x] Whitespace around `KEY` and value is trimmed.
- [x] Duplicate key: last assignment wins; earlier assignment produces no `problems` entry.
- [x] A line that is not blank/comment/`KEY=VALUE` is added to `problems` with correct 1-based
      `line` and `rawText`; never throws.
- [x] Zero-assignment input (empty or comments/blanks only) → `{ pairs: empty Map, problems: [] }`.
- [x] `lib/parse.mjs` has zero imports of `lib/rules.mjs` (substrate disjointness).

## 📭 Empty & Null States
- Empty string input → `{ pairs: new Map(), problems: [] }`.
- File with only comments/blank lines → same as empty.
- A value that is the empty string after quote-stripping (`KEY=""`) → `pairs.get("KEY").value === ""`.

## Test Surface covered
TS-UC01-01 … TS-UC01-10 (full — see [[../usecases/UC-01-parse-env-file|UC-01]] Test Surface).


## Execution Log — 2026-08-17 (envlint/env-parsing-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node --test test/parse.test.mjs` passes.: pass (node --test test/parse.test.mjs → 11/11 pass, 0 fail)
- `# comment` / blank lines produce no `pairs` and no `problems` entry.: pass (TS-UC01-01 passes)
- `export KEY=value` parses identically to `KEY=value`.: pass (TS-UC01-02 passes)
- `KEY="value"` and `KEY='value'` strip matching-pair quotes only; `KEY="value`: pass (TS-UC01-03, TS-UC01-04, TS-UC01-05 pass)
- Whitespace around `KEY` and value is trimmed.: pass (TS-UC01-06 passes)
- Duplicate key: last assignment wins; earlier assignment produces no `problems` entry.: pass (TS-UC01-07 passes)
- A line that is not blank/comment/`KEY=VALUE` is added to `problems` with correct 1-based: pass (TS-UC01-08 passes)
- Zero-assignment input (empty or comments/blanks only) → `{ pairs: empty Map, problems: [] }`.: pass (TS-UC01-09 passes)
- `lib/parse.mjs` has zero imports of `lib/rules.mjs` (substrate disjointness).: pass (grep for 'rules.mjs' in lib/parse.mjs → no matches; file has zero imports)
