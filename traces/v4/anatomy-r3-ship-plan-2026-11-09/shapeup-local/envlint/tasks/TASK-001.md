---
type: task
feature: envlint
id: TASK-001
title: "Implement the pure .env parser"
package: src
status: ready
priority: 1
depends_on: []
unlocks: [TASK-003]
use_case_refs: [UC-ParseEnvText]
entities: [EnvPair, ParseProblem, ParseResult]
repositories: []
linked_docs: ["shapeup/envlint/spec/usecases/UC-ParseEnvText.md", "shapeup/envlint/spec/domain-model.md"]
estimated_hours: 3
tags: [pure, parser]
---

# TASK-001: Implement the pure .env parser

## Context
Build `parse(text)` per [[usecases/UC-ParseEnvText#Steps]] and its own test file. Pure: no I/O, no import of the rules module.
Reference: [[domain-model#Value objects]] / [[usecases/UC-ParseEnvText#Test Surface]]

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `src/parse.mjs` exists and exports `parse(text)` returning `{pairs, problems}` (covers: REQ-16)
- [ ] `node --test test/parse.test.mjs` exits 0 and covers every UC-ParseEnvText Test Surface row
- [ ] `KEY=value` yields pair `{key:"KEY", value:"value", line:1}` (covers: REQ-10)
- [ ] a `# comment` line yields no pair and no problem (covers: REQ-11)
- [ ] a blank or whitespace-only line yields no pair and no problem (covers: REQ-12)
- [ ] `export KEY=value` yields pair `KEY=value` (covers: REQ-13)
- [ ] `K='a b'` and `K="a b"` yield value `a b` with quotes removed (covers: REQ-14)
- [ ] an unparseable line and an unterminated quote each yield a problem carrying the 1-based line number (covers: REQ-15)
- [ ] `src/parse.mjs` imports neither `src/rules.mjs` nor any `node:fs` module (covers: REQ-22)
- [ ] `parse("A=${B}")` keeps the literal value `${B}` (covers: REQ-24)

### 📭 Empty & Null States
- [ ] `parse("")` and comment-only text return `{pairs: [], problems: []}` (covers: REQ-6)
- [ ] `parse` never throws for any string input (covers: REQ-7)

## Non-Go (not in this task)
- Reading files, printing, exit codes (TASK-003)
- Schema checks (TASK-002)
