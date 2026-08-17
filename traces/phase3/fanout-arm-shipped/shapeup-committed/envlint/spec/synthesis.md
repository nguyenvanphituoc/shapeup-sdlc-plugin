---
type: synthesis
feature: envlint
generated_at: 2026-08-17
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

# Synthesis: envlint

> **How to use this document:**
> Read the Health Dashboard first (30 seconds).
> Each indicator tells you which section to open next — skip green sections.
> 🟢 = no action needed · 🟡 = review recommended · 🔴 = must resolve before execution

---

## Health Dashboard

| Indicator | Status | Signal |
|-----------|--------|--------|
| Coverage | 🟢 | 1/1 UC covered by all 4 tasks; 0 orphan tasks (`harness verify spec` reports 0 red UC-ANCHOR findings) |
| Risk | 🟢 | The one genuine unknown (`url` type leniency) was resolved pre-scoping by spike-url-type-validation.md; remaining risks are low-likelihood spec-reading ambiguities, each pinned by an explicit INV/TS row or documented assumption |
| Dependency | 🟢 | 4 tasks, depth-3 critical path, zero external blockers, zero third-party/env-var dependencies |

### Execution Gate (Synthesis)

✅ PASS — Coverage 🟢 AND Risk 🟢

*Combine with Audit score gate: both must pass for autonomous `/execute-plan`.*

---

## S-01 — Traceability Matrix

Derived from: `use_case_refs` in each task frontmatter (LOCAL board,
`.shapeup/envlint/tasks/`) — the single link source.

### UC × Task Coverage

| Use Case | Actor | Covering Tasks | Status |
|----------|-------|----------------|--------|
| [[usecases/UC-01]] | Developer | 4 (TASK-001, TASK-002, TASK-003, TASK-004) | ✅ covered |

**Coverage gaps:** none.

### UC × Entity Participation

No `entities` are declared in domain-model.md — this is a stateless functional-core CLI with
value objects only (`EnvPair`, `ParseProblem`, `SchemaRule`, `Finding`, `LintReport`), none of
which are DDD entities with identity. Not applicable.

**Entity orphans:** none (no entities exist to orphan).

### Screen → UC Backing

| Screen | Backed By | Status |
|--------|-----------|--------|
| HumanReadableOutput | [[usecases/UC-01]] | ✅ |
| JsonOutput | [[usecases/UC-01]] | ✅ |
| ToolErrorOutput | [[usecases/UC-01]] | ✅ |

### Domain Event Flow

No domain events are declared — single-process synchronous CLI, no cross-context coordination.
Not applicable.

---

## S-02 — Risk Register

Derived from: `_index.md` rabbit holes + `integration.md` external deps. No
`api-feasibility.md` exists — no third-party/API mentions in the pitch (explicit no-go: no
network access), so the SPIKE-risk sub-section is not applicable.

### Rabbit Hole Register

| Risk | From | Likelihood | Mitigation | Status |
|------|------|-----------|------------|--------|
| `new URL()` WHATWG leniency vs. literal `url` rule wording | [[_index#Rabbit-Holes]] | medium | Pre-scoping spike confirmed: trust `new URL()`, gate only on protocol | ✅ mitigated |
| Naive `url` check drops the protocol gate | [[_index#Rabbit-Holes]] | medium | TS-TYPE-url-scheme-gate (explicit graded Test Surface row) | ✅ mitigated |
| E3 misread as absolute "never ok" | [[_index#Rabbit-Holes]] | low | INV-06 + TS-INV-06 fixture pin the correct reading | ✅ mitigated |
| `--json` findings ordering unpinned by EXPECTED.md | [[_index#Rabbit-Holes]] | low | Documented as an assumption (ux-behavior.md RULE-06), not silently decided in code | ✅ mitigated (flagged for PO confirmation, non-blocking) |

**Unmitigated risks:** none.

### External Dependency Risks

| Dependency | Declared In | Type | Unblock Condition |
|------------|------------|------|------------------|
| — | — | — | None — zero-dependency, zero-network CLI (see [[integration#Environment-Variables-Required]]) |

### Hammered Out (Cut)

| Cut | At | Reason | Traded for (if any) |
|-----|-----|-------|---------------------|
| — | — | Nothing cut this round — appetite (single build round, 14h estimated) has not overflowed | — |

---

## S-03 — Dependency Graph

Derived from: `depends_on` and `unlocks` in every task frontmatter + `estimated_hours` (per
`harness reduce board --slug envlint --write`).

### Critical Path

```
Critical path: 3 tasks · 11h · 79% of total estimated hours (14h)

TASK-001 [TASK]   src/parsing.mjs (Parsing engine)          3h  ← parallel (no dependency on 002)
TASK-002 [TASK]   src/rules.mjs (Rules engine)               4h  ← parallel (no dependency on 001)
TASK-003 [TASK]   bin/envlint.mjs (CLI composition root)    4h  ⏳ blocked by TASK-001, TASK-002
  └─ blocks ──► TASK-004
TASK-004 [TASK]   test/ (integration test suite)             3h  ⏳ blocked by TASK-003
```

### Parallel Opportunities

| Wave | Tasks | Total Hours | Can Parallelize |
|------|-------|-------------|-----------------|
| Wave 1 (no deps) | TASK-001, TASK-002 | 7h | ✅ yes — 2 agents, per the pitch's own "share nothing" constraint |
| Wave 2 (after 001+002) | TASK-003 | 4h | — single task |
| Wave 3 (after 003) | TASK-004 | 3h | — single task |

### Single Points of Failure

| Task | Blocks | Cascaded Hours at Risk |
|------|--------|----------------------|
| TASK-003 | TASK-004 | 3h |

No task blocks more than 2 downstream tasks — the graph is intentionally shallow, matching the
pitch's "small batch, single build round" appetite.
