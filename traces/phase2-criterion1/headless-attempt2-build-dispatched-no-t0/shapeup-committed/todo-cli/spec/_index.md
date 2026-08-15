---
type: pitch
feature: todo-cli
appetite: "1 build round (small batch)"
status: draft
bounded_context: todo
entities: [TodoList, TodoItem]
tags: [cli, non-ui]
skill_version: "4.0"
audit_rules_version: "2.9"
---

# Pitch: `todo` CLI

## Problem
Developers keep todos in their head and lose them. This feature exercises the harness on a
**non-UI** deliverable end-to-end: a zero-config CLI, `todo`, that persists items to a local
JSON file.

## Appetite
**Small batch — a single build round.** If scope grows beyond this, cut features (e.g. drop
`rm`'s boundary polish), do not extend the round.

## Boundaries

### In Scope
- `todo add <text>` — append a new pending item
- `todo list` — print all items with display index + done state, sane on empty list
- `todo done <n>` — mark item `<n>` done, reject bad index without crashing
- `todo rm <n>` — remove item `<n>`, same index-safety requirement
- Local JSON store (`./.todo.json`) that survives a corrupted or missing store file

### Non-Go
- No sync, no server, no accounts.
- No TUI / colors / interactive prompts (keep output assertable).

### Pinned decisions (were open in orient artifacts — resolved here so task ACs are testable)
- **Store location:** `./.todo.json`, cwd-relative — deterministic to test (no `HOME` mocking
  needed), matches "zero-config" without implying global cross-project state. See
  `.shapeup/todo-cli/orient/code-surface.md` "Uncertain / needs `ba` decision".
- **Index semantics for `done`/`rm`:** `<n>` is a **1-based positional display index** into the
  current `list` ordering, recomputed fresh each invocation — not a stable id. An internal
  `TodoItemId` still exists and is never reused (survives `rm`), so the store format has a
  stable handle available if a future cycle needs non-positional addressing. See
  `.shapeup/todo-cli/orient/hill-signal.md` "Commands" section for the open unknown this
  resolves.

## Solution Elements

### Breadboarding
```
$ todo add "Buy milk"      ──writes──► ./.todo.json
$ todo list                ◄──reads──  ./.todo.json ──► stdout: "[1] [ ] Buy milk"
$ todo done 1               ──r/w───►  ./.todo.json
$ todo list                ◄──reads──  ./.todo.json ──► stdout: "[1] [x] Buy milk"
$ todo rm 1                 ──r/w───►  ./.todo.json
$ todo list                ◄──reads──  ./.todo.json ──► stdout: "no todos yet"
```

### Key Interactions
1. `add` appends; `list` renders (or shows a sane empty message); `done`/`rm` mutate by
   1-based positional index with strict bounds checking.
2. Every command behaves sanely on a missing store file (treated as empty) and a corrupted
   store file (rejected with a clear message, never a stack trace) — the pitch's explicit
   "behave sanely at the edges" requirement.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Corrupted/missing store file crashes the CLI | low (spiked) | `.shapeup/todo-cli/orient/spike-persistence.md` confirms `try/catch` + `ENOENT` distinction with Node core `fs` only — see `[[contracts/todo-store.contract]]` |
| Torn/half-written store file on process kill mid-write | low (spiked) | temp-file + `fs.renameSync` write pattern, confirmed atomic on darwin/linux — see `[[contracts/todo-store.contract]]` |
| Positional index semantics confuse users after a `rm` shifts numbering | low | pinned + documented in `[[ux-behavior#Command-rm-n]]` RULE-08; `list` is always the source of truth for current numbering |
| Concurrent `todo` processes racing to write | accepted, out of scope | no-gos exclude server/sync; last-writer-wins is acceptable for a single-user local CLI |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ⬜ draft |
| [[ux-behavior]] | UX Spec (CLI command behavior) | ⬜ draft |
| [[usecases/_index]] | Use Cases | ⬜ draft |
| [[contracts/_index]] | Contract Registry | ⬜ draft |
| [[integration]] | Integration Map | ⬜ draft |
| [[scope-summary]] | Scope Summary | ⬜ draft |
| [[synthesis]] | Health Dashboard + Traceability + Risk + Dependency | ⬜ draft |
| [[feedback]] | Post-Sprint Feedback | ⬜ pending |

---

## Audit Report

*Generated from harness verify spec output — do not edit manually.*
*skill_version: 4.0 | audit_rules_version: 2.9*

### Score Summary

| Layer | Weight | Raw Score | Weighted |
|-------|--------|-----------|---------|
| L0 Input Quality | 10% | —/100 | — |
| L1 Generation Complete | 20% | —/100 | — |
| L2 Document Quality | 30% | —/100 | — |
| L3 Execution Readiness | 40% | —/100 | — |
| **TOTAL** | | | **—/100** |

### Execution Gate
⬜ *Pending audit*

### Issues Found
⬜ *Pending audit*
