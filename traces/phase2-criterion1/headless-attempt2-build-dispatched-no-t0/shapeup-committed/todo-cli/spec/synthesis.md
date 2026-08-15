---
type: synthesis
feature: todo-cli
generated_at: 2026-08-15
skill_version: "4.0"
coverage_status: 🟢
risk_status: 🟢
dependency_status: 🟢
depends_on:
  - "[[domain-model]]"
  - "[[ux-behavior]]"
  - "[[usecases/_index]]"
  - "[[scope-summary]]"
---

# Synthesis: `todo` CLI

> **How to use this document:**
> Read the Health Dashboard first (30 seconds).
> Each indicator tells you which section to open next — skip green sections.
> 🟢 = no action needed · 🟡 = review recommended · 🔴 = must resolve before execution

---

## Health Dashboard

| Indicator | Status | Signal |
|-----------|--------|--------|
| Coverage | 🟢 | All 4 UCs covered by ≥5 tasks each; no entity orphans; no unbacked screens |
| Risk | 🟢 | Single risk area (persistence) was spiked and resolved at the crest; no unmitigated rabbit holes |
| Dependency | 🟢 | No asymmetric edges (`unlocks_stale: []` after `harness reduce board --write`); no appetite overflow (15.5h vs 16h budget) |

### Execution Gate (Synthesis)

✅ PASS — Coverage 🟢 AND Risk 🟢

*Combine with Audit score gate: both must pass for autonomous execution.*

---

## S-01 — Traceability Matrix

Derived from: `use_case_refs` in each task frontmatter, inverted over the LOCAL board
(`.shapeup/todo-cli/tasks/`) at generation time (`harness reduce board`).

### UC × Task Coverage

| Use Case | Actor | Covering Tasks | Status |
|----------|-------|----------------|--------|
| [[usecases/UC-AddTodo]] | Developer | 6 | ✅ covered |
| [[usecases/UC-ListTodos]] | Developer | 5 | ✅ covered |
| [[usecases/UC-CompleteTodo]] | Developer | 6 | ✅ covered |
| [[usecases/UC-RemoveTodo]] | Developer | 6 | ✅ covered |

**Coverage gaps:** none.

### UC × Entity Participation

| Use Case | Entity | Role |
|----------|--------|------|
| [[usecases/UC-AddTodo]] | `TodoList` | actor |
| [[usecases/UC-AddTodo]] | `TodoItem` | actor |
| [[usecases/UC-ListTodos]] | `TodoList` | target |
| [[usecases/UC-ListTodos]] | `TodoItem` | target |
| [[usecases/UC-CompleteTodo]] | `TodoList` | actor |
| [[usecases/UC-CompleteTodo]] | `TodoItem` | actor |
| [[usecases/UC-RemoveTodo]] | `TodoList` | actor |
| [[usecases/UC-RemoveTodo]] | `TodoItem` | actor |

**Entity orphans:** none — `TodoList` (aggregate root) and `TodoItem` are each referenced by
all four use cases.

### Screen → UC Backing

<!-- "Screen" = CLI subcommand per [[ux-behavior]]'s non-UI framing -->

| Screen (command) | Backed By | Status |
|--------|-----------|--------|
| add | [[usecases/UC-AddTodo]] | ✅ |
| list | [[usecases/UC-ListTodos]] | ✅ |
| done | [[usecases/UC-CompleteTodo]] | ✅ |
| rm | [[usecases/UC-RemoveTodo]] | ✅ |

### Domain Event Flow

| Event | Emitted By UC | Consumer (integration.md) | Status |
|-------|--------------|--------------------------|--------|
| `TodoItemAdded` | [[usecases/UC-AddTodo]] | [[integration#Event-Coordination]] — none (single-process CLI) | ⚠️ dead-end (by design) |
| `TodoItemCompleted` | [[usecases/UC-CompleteTodo]] | [[integration#Event-Coordination]] — none | ⚠️ dead-end (by design) |
| `TodoItemRemoved` | [[usecases/UC-RemoveTodo]] | [[integration#Event-Coordination]] — none | ⚠️ dead-end (by design) |

These three events are recorded for domain-model traceability only. "Dead-end" here is
expected, not a gap: a single-process CLI with no event bus has no consumer to wire — the
no-gos (no sync, no server) rule out ever needing one.

---

## S-02 — Risk Register

Derived from: `_index.md` rabbit holes + `integration.md` (no `api-feasibility.md` exists —
no third-party API in this pitch).

### SPIKE Risks

Not applicable — `api-feasibility.md` was not generated (no third-party/API/SDK/webhook
mentioned in the pitch). The one risky area (local persistence) was investigated via
`.shapeup/todo-cli/orient/spike-persistence.md` instead (an orient-phase spike, not a
Phase-1b feasibility SPIKE) and is fully resolved — see Rabbit Hole Register below.

### Rabbit Hole Register

| Risk | From | Likelihood | Mitigation | Status |
|------|------|-----------|------------|--------|
| Corrupted/missing store file crashes the CLI | [[_index#Rabbit-Holes]] | low (spiked) | `try/catch` + `ENOENT` distinction, Node core `fs` only — [[contracts/todo-store.contract]] | ✅ mitigated |
| Torn/half-written store file on process kill mid-write | [[_index#Rabbit-Holes]] | low (spiked) | temp-file + `fs.renameSync`, atomic on darwin/linux — [[contracts/todo-store.contract]] | ✅ mitigated |
| Positional index semantics confuse users after `rm` shifts numbering | [[_index#Rabbit-Holes]] | low | pinned decision + RULE-08 in [[ux-behavior]] | ✅ mitigated |
| Concurrent `todo` processes racing to write | [[_index#Rabbit-Holes]] | accepted | out of scope — no-gos exclude server/sync | ✅ accepted (not a gap) |

**Unmitigated risks:** none.

### External Dependency Risks

None — no env vars, no third-party accounts, no internal team dependency (see
[[integration#Environment-Variables-Required]]).

### Hammered Out (Cut)

| Cut | At | Reason | Traded for (if any) |
|-----|-----|-------|---------------------|
| — | — | no cuts made — 15.5h estimate fits the 16h appetite budget with no overflow | — |

*A Cut is a healthy shaping signal, not debt. None was needed this round.*

---

## S-03 — Dependency Graph

Derived from: `depends_on`/`unlocks` in every task frontmatter (recomputed via
`harness reduce board --write`) + `estimated_hours`.

### Critical Path

```
Critical path: 6 tasks · 12h · 77% of total estimated hours (15.5h)

TASK-001 [CHORE] project-scaffolding                              1h
  └─ unlocks ──► TASK-002, TASK-003
TASK-002 [TASK]  domain-types                                     1.5h
  └─ unlocks ──► TASK-003
TASK-003 [FEAT]  store-persistence                                 3h
  └─ unlocks ──► TASK-004, TASK-005, TASK-006, TASK-007
TASK-004 [FEAT]  add-command             ← parallel with 005/006/007  1h
TASK-005 [FEAT]  list-command            ← parallel with 004/006/007  1h
TASK-006 [FEAT]  done-command            ← parallel with 004/005/007  1.5h
TASK-007 [FEAT]  rm-command              ← parallel with 004/005/006  1.5h
  └─ (004,005,006,007) unlock ──► TASK-008
TASK-008 [FEAT]  cli-dispatcher                                    2h
  └─ unlocks ──► TASK-009
TASK-009 [TEST]  integration-test                                  3h
```

### Parallel Opportunities

| Wave | Tasks | Total Hours | Can Parallelize |
|------|-------|-------------|-----------------|
| Wave 1 (no deps) | TASK-001 | 1h | — single task |
| Wave 2 (after 001) | TASK-002 | 1.5h | — single task |
| Wave 3 (after 001, 002) | TASK-003 | 3h | — single task |
| Wave 4 (after 003) | TASK-004, TASK-005, TASK-006, TASK-007 | 5h | ✅ yes — 4 agents |
| Wave 5 (after 004–007) | TASK-008 | 2h | — single task |
| Wave 6 (after 008) | TASK-009 | 3h | — single task |

### Single Points of Failure

| Task | Blocks | Cascaded Hours at Risk |
|------|--------|----------------------|
| TASK-003 | TASK-004, TASK-005, TASK-006, TASK-007 (→ TASK-008 → TASK-009) | 12.5h |
| TASK-008 | TASK-009 | 3h |
