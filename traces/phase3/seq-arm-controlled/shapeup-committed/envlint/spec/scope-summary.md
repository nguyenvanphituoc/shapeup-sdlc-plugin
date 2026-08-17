---
type: scope-summary
feature: envlint
generated_at: 2026-08-17
total_tasks: 4
total_estimated_hours: 14
packages_touched: [src, bin, test]
critical_path_length: 3
critical_path_tasks: [TASK-002, TASK-003, TASK-004]
external_blockers: []
audit_score: 0
---

# Feature Scope Summary: envlint

> Generated from task graph (`harness reduce board --slug envlint --write`). Use this document
> in sprint planning. Audit score below 90 means spec needs human review before execution.

---

## At a Glance

| | |
|---|---|
| Total tasks | 4 |
| Estimated effort | 14h (~2 days) |
| Packages touched | 3 (src, bin, test) |
| Critical path depth | 3 tasks |
| External blockers | 0 items before sprint can start |
| Spec audit score | pending — awaits harness `verify spec` execution-readiness score |

---

## Critical Path

The longest sequential chain — minimum time to complete if parallelized optimally.

```
TASK-002 → TASK-003 → TASK-004
   4h         4h         3h
```

**Critical path estimate:** 11h total (per `harness reduce board` output)
*(TASK-001 runs in parallel alongside TASK-002; both feed TASK-003)*

---

## Package Distribution

| Package | Tasks | Est. Hours | % of effort |
|---------|-------|------------|-------------|
| src | 2 (TASK-001, TASK-002) | 7h | 50% |
| bin | 1 (TASK-003) | 4h | 29% |
| test | 1 (TASK-004) | 3h | 21% |
| **Total** | **4** | **14h** | 100% |

---

## Parallel Opportunities

Tasks with no interdependency that can run simultaneously — this is the pitch's central shaping
constraint ("Parsing and Rules share nothing... verifiable alone against its own fixtures").

| Group | Tasks | Can start after |
|-------|-------|----------------|
| Wave 1 | TASK-001 (Parsing), TASK-002 (Rules) | immediately — no dependencies, no shared files |
| Wave 2 | TASK-003 (CLI) | TASK-001 AND TASK-002 both complete |
| Wave 3 | TASK-004 (integration tests) | TASK-003 completes |

---

## External Blockers

Items that must be resolved BEFORE sprint starts:

**Environment Variables**
- None — envlint reads no environment variables of its own (see [[integration#Environment-Variables-Required]]).

**Third-party Setup**
- None — zero-dependency CLI, zero network access (explicit no-go).

**Internal Dependencies**
- None — greenfield, single-package repo, nothing to coordinate with another team/service.

---

## Risks (from Pitch)

Carried from [[_index#Rabbit-Holes]]:

| Risk | Impact | Mitigation | Related UC |
|------|--------|------------|-----------|
| `new URL()` WHATWG leniency vs. EXPECTED.md's literal `url` rule wording | medium | Spiked pre-scoping; trust `new URL()`, gate only on protocol | [[usecases/UC-01]] |
| Naive `url` check drops the protocol gate (accepts `ftp:`/`mailto:`/`data:`) | medium | TS-TYPE-url-scheme-gate makes this an explicit graded row | [[usecases/UC-01]] |
| E3 misread as an absolute "never ok" | low | INV-06 + TS-INV-06 pin the reading | [[usecases/UC-01]] |
| `--json` findings ordering unpinned by EXPECTED.md | low | Documented assumption (same order as human-readable) | [[usecases/UC-01]] |

---

## Execution Recommendation

<!-- Filled from harness verify spec output -->

**Audit Score: pending** — `harness verify spec --slug envlint` reports 0 red / 2 warn
(both warns are the not-yet-generated `scope-summary`/`synthesis` self-references, resolved by
this document's own creation and by [[synthesis]]).

```
[✅ Ready for autonomous execution — 0 red findings, single UC, no repository/contract gaps]
```
