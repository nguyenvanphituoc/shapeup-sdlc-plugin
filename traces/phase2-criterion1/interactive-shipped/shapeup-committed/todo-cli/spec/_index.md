---
type: pitch
feature: todo-cli
appetite: "1 day (small batch, single build round)"
status: ready
bounded_context: todo
entities: [TodoItem, TodoList]
tags: [cli, stdlib-only, sandboxable]
skill_version: "4.0"
audit_rules_version: "4.0"
---

# Pitch: `todo` CLI

## Problem
Developers keep todos in their head and lose them. They need a zero-config, zero-dependency
command-line tool that stores items durably and never crashes on a typo — a CLI that traces
its own edges (empty list, bad index, a corrupted store file) instead of leaking a Python
traceback at the first mistake.

## Appetite
**1 day — a single build round.** Small batch. If scope grows beyond `add`/`list`/`done`/`rm`
plus the named edge cases, cut features, do not extend the round.

## Boundaries

### In Scope
- `todo add <text>` — append a new item.
- `todo list` — print all items, 1-based numbering, `[ ]`/`[x]` done marker.
- `todo done <n>` — mark item `<n>` done.
- `todo rm <n>` — remove item `<n>`.
- Store path resolution: `$TODO_STORE` when set (verbatim), else `~/.todo.json`.
- Sane behavior at the edges: empty list, bad `<n>` (out-of-range or non-integer), a
  corrupted store file (invalid JSON, or valid JSON whose root is not a list).

### Non-Go
- No sync, no server, no accounts.
- No TUI / colors / interactive prompts — output must stay assertable (plain text, no ANSI).
- No XDG base-directory resolution — one dotfile (`~/.todo.json`), PO-declined at GATE L1a.
- No packaging / install step, no third-party dependencies (Python 3 stdlib only).

## Solution Elements

### Breadboarding
```
$TODO_STORE set? ──yes──► load(that path)
       │no
       ▼
  load(~/.todo.json)
       │
       ▼
  [bin/todo dispatch] ──add────► append item ──save()──► confirm "added #n: text"
       │
       ├──list───► print numbered items (or "(no items)")
       │
       ├──done <n>──► valid n? ──yes──► mark done ──save()──► confirm "done #n: text"
       │                  │no
       │                  ▼
       │            error, exit 1, no write
       │
       └──rm <n>────► valid n? ──yes──► remove item ──save()──► confirm "removed #n: text"
                          │no
                          ▼
                    error, exit 1, no write

  load() hits invalid JSON or non-list root ──► error, exit 1, no traceback (all commands)
```

### Key Interactions
1. Every command resolves the store path first (`$TODO_STORE` else default), then loads.
2. A corrupted store fails every command identically — one error path, one message format.
3. `add`/`done`/`rm` mutate in memory, then persist via one atomic `save()` — a crash mid-save
   can never leave the store worse than before the invocation started.
4. `done`/`rm` share 1-based index validation: non-integer or out-of-range `<n>` is rejected
   before any mutation is attempted.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Corrupted-store handling only covers invalid JSON, misses hand-edited valid-JSON-wrong-shape files | med | Spiked — `isinstance(data, list)` guard folds both into one error path (PO decision #3) |
| `done`/`rm` index semantics (1-based vs 0-based) left implicit, causes off-by-one bugs | med | PO decision #1 at GATE L1a: 1-based, exact error text/exit code specified |
| Default store path invents an untested location | low | Spiked and confirmed: `~/.todo.json` via `os.path.expanduser`, PO decision #2 |
| A crash mid-save corrupts the store worse than before | low | Spiked — `tempfile.mkstemp` + `os.replace` gives atomic writes on POSIX |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ✅ ready |
| [[ux-behavior]] | UX Spec | ✅ ready |
| [[usecases/_index]] | Use Cases | ✅ ready |
| [[contracts/_index]] | Contract Registry | ✅ ready |
| [[integration]] | Integration Map | ✅ ready |
| [[scope-summary]] | Scope Summary | ✅ ready |
| [[synthesis]] | Health Dashboard + Traceability + Risk + Dependency | ✅ ready |
| [[feedback]] | Post-Sprint Feedback | ⬜ pending |

---

## Audit Report

*Generated from `harness verify spec` output — do not edit manually.*
*skill_version: 4.0 | audit_rules_version: 4.0*

### Score Summary

| Layer | Weight | Raw Score | Weighted |
|-------|--------|-----------|---------|
| L0 Input Quality | 10% | —/100 | — |
| L1 Generation Complete | 20% | —/100 | — |
| L2 Document Quality | 30% | —/100 | — |
| L3 Execution Readiness | 40% | —/100 | — |
| **TOTAL** | | | **—/100** |

### Execution Gate
✅ **PASS** — `harness verify spec --slug todo-cli`: 7 tasks, 0 scopes (not yet mapped —
scope-architect runs at MAP SCOPES), 0 red findings, 0 warn findings.

### Issues Found
None.
