---
type: team-handoff
feature: FEATURE_SLUG
skill_version: "2.5"
teams: []
tags: [cross-context, coordination]
depends_on:
  - "[[_cross-context/context-map]]"
  - "[[_cross-context/event-choreography]]"
status: draft
---

# Team Handoff: FEATURE TITLE

> Explicit interface contracts between teams.
> Each row is a commitment: From Team delivers Artifact by Ready-When condition.

---

## Handoff Register

| From Team | To Team | Artifact | Ready When | Blocker Risk |
|-----------|---------|----------|-----------|-------------|
| [Team A] (API) | [Team B] (Mobile) | [[contracts/[repo].contract.md]] | [[usecases/UC-Name]] green | 🔴 blocks Mobile [[usecases/UC-Name]] |
| [Team B] (API) | [Team A] (API) | `EventName` schema | [[usecases/UC-Name]] green | 🟡 blocks integration test |
| [Team B] (Mobile) | QA | E2E test cases | [[usecases/UC-Name]] green | 🟡 blocks QA sprint entry |

<!-- Readiness is stated against a committed UC (or a scope_id), never a task id: this
     register is committed and shared across teams, and board ids are per-machine. -->

---

## Blocking Dependencies

<!--
  Key every row on a USE CASE or a scope_id, never a task id. This document is committed and
  crosses a team boundary; board ids live in the gitignored tier and each team's board numbers
  its own, so one board id names a different piece of work on every machine that reads this.
  spec-lint reds a board id anywhere in the committed tree (TIER-DIRECTION).
-->

```
[Team B] CANNOT start [UC-x] ([description])
  until [Team A] completes [UC-y] ([description])
  Mitigation: use contract stub from [[contracts/[repo].contract.md]]
  Ready now: [UC-z] (unblocked — no dependency)

[Team C] CANNOT start integration tests
  until [Team A] EventName schema is stable
  Mitigation: use ⚠️ SPECULATIVE contract — mark tests as xfail until confirmed
```

---

## Parallel Work Windows

```
Wave 1 — No cross-team dependencies (start immediately):
  [Team A]: [UC-a], [UC-b], [UC-c]
  [Team B]: [UC-d], [UC-e] (using contract stub)

Wave 2 — After Team A [UC-c] done:
  [Team B]: [UC-f] (replace stub with real contract)
  [Team C]: integration tests (real contract available)

Wave 3 — After Wave 2 complete:
  QA: E2E test suite
```

---

## Communication Protocol

| Trigger | Owner | Notify | Channel |
|---------|-------|--------|---------|
| Contract changes after stub distributed | [Team A] | [Team B], QA | [channel] |
| A wave-1 use case delayed > 1 day | [Team A] | [Team B] | [channel] |
| Schema breaking change detected | Any | All teams | [channel] |

---

## Definition of Done (Cross-Context)

Feature is complete when ALL of the following are true:
- [ ] Every migration STEP run and verified in staging
- [ ] All contracts have no remaining ⏳ TBD fields
- [ ] Event choreography happy path verified end-to-end
- [ ] All dead-letter scenarios have runbooks
- [ ] `synthesis.md` Health Dashboard — Coverage 🟢, Risk 🟢
