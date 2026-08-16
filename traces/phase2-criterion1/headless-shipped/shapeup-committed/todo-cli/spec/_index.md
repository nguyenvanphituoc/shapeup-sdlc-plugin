---
type: pitch
feature: todo-cli
appetite: "1-2 days (small batch, single build round)"
status: draft
bounded_context: todo-list
entities: [TodoItem]
tags: [cli, non-ui]
skill_version: "2.5"
audit_rules_version: "2.5"
---

# Pitch: `todo` CLI

## Problem
Developers keep todos in their head and lose them. They need a zero-config command-line tool
to capture, review, complete, and remove short-lived tasks without leaving the terminal or
standing up any infrastructure.

## Appetite
**1-2 days (small batch, single build round)** — if scope grows beyond this, cut features
(e.g. drop `rm`, drop pretty formatting), do not extend the timeline.

## Boundaries

### In Scope
- `todo add <text>` — append a new item to the store.
- `todo list` — print all items, open and done, 1-based numbered.
- `todo done <n>` — mark item `n` (from the most recent `list` numbering) as done.
- `todo rm <n>` — remove item `n` from the store.
- A local JSON store file, read/written on every invocation (no daemon, no in-memory server).
- Sane behavior at the edges: empty list, missing store file, corrupted store file, bad/missing
  index argument.

### Non-Go
- No sync, no server, no accounts (pitch no-go).
- No TUI / colors / interactive prompts — output must be plain, assertable text (pitch no-go).
- No persistent stable item IDs beyond list position — no rename/edit command.
- No config file / flags for customizing store location in this cycle.

## Solution Elements

### Breadboarding
```
[shell: todo <cmd> <args>] ──argv──► [bin/todo.js dispatcher]
                                          │
                     ┌────────────────────┼────────────────────┬─────────────────┐
                     ▼                    ▼                    ▼                 ▼
                 [add UC]             [list UC]           [done UC]          [rm UC]
                     │                    │                    │                 │
                     └────────────────────┴────────────────────┴─────────────────┘
                                          │
                                          ▼
                              [TodoRepository: read/write JSON file]
                                          │
                                          ▼
                                 [~/.todo.json on disk]
```

### Key Interactions
1. First run with no store file → `todo list` prints "No todos yet." (not an error).
2. `todo add "buy milk"` → appends, prints confirmation with the new item's 1-based position.
3. `todo list` → prints every item `N) [ ] text` or `N) [x] text`, 1-based, in store order.
4. `todo done 2` / `todo rm 2` → validates `2` is an integer within `[1, length]`; on success,
   mutates the store and prints confirmation; on a bad index, prints a clear error to stderr and
   exits non-zero without touching the store.
5. A corrupted store file (invalid JSON) → every command fails fast with a clear stderr message
   and non-zero exit; the corrupted file is never silently overwritten.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Unguarded `JSON.parse` crashes the process with a raw stack trace on a corrupted store | high (confirmed by spike) | Store-read function wraps `JSON.parse` in try/catch, returns a typed error; every command handles it uniformly |
| `parseInt`/bare `Number()` coercion silently accepts bad index input (`'3abc'` → 3, `''` → 0) | high (confirmed by spike) | Index-argument parser rejects non-integer, empty, and out-of-range input via explicit checks, never trusts coercion at face value |
| Store file location left ambiguous, causing "which list am I editing" confusion across cwd | medium | Pinned explicitly in [[domain-model#Repository Interfaces]]: `~/.todo.json`, not cwd-relative |
| Missing store file (first run) mishandled as a corruption error | medium (confirmed by spike) | `ENOENT` and `SyntaxError` are handled as two distinct, separately-tested branches |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ⬜ draft |
| [[ux-behavior]] | CLI Behavior Spec | ⬜ draft |
| [[usecases/_index]] | Use Cases | ⬜ draft |
| [[contracts/todo-repository.contract]] | Repository Contract | ⬜ draft |
| [[integration]] | Integration Map | ⬜ draft |
| [[scope-summary]] | Scope Summary | ⬜ draft |
| [[synthesis]] | Health Dashboard + Traceability + Risk + Dependency | ⬜ draft |
| [[feedback]] | Post-Sprint Feedback | ⬜ pending |

---

## Audit Report

*Generated from harness verify spec output — do not edit manually.*
*skill_version: 2.5 | audit_rules_version: 2.5*

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
