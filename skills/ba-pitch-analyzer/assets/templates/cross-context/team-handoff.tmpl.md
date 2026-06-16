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
| [Team A] (API) | [Team B] (Mobile) | [[contracts/[repo].contract.md]] | TASK-00N done | 🔴 blocks Mobile TASK-00N |
| [Team B] (API) | [Team A] (API) | `EventName` schema | TASK-00N done | 🟡 blocks integration test |
| [Team B] (Mobile) | QA | E2E test cases | TASK-00N done | 🟡 blocks QA sprint entry |

---

## Blocking Dependencies

```
[Team B] CANNOT start TASK-00N ([description])
  until [Team A] completes TASK-00N ([description])
  Mitigation: use contract stub from [[contracts/[repo].contract.md]]
  Stub ready: TASK-00N (unblocked — no dependency)

[Team C] CANNOT start integration tests
  until [Team A] EventName schema is stable
  Mitigation: use ⚠️ SPECULATIVE contract — mark tests as xfail until confirmed
```

---

## Parallel Work Windows

```
Wave 1 — No cross-team dependencies (start immediately):
  [Team A]: TASK-001, TASK-002, TASK-003
  [Team B]: TASK-004, TASK-005 (using contract stub)

Wave 2 — After Team A TASK-003 done:
  [Team B]: TASK-006 (replace stub with real contract)
  [Team C]: TASK-007 (integration tests — real contract available)

Wave 3 — After Wave 2 complete:
  QA: E2E test suite
```

---

## Communication Protocol

| Trigger | Owner | Notify | Channel |
|---------|-------|--------|---------|
| Contract changes after stub distributed | [Team A] | [Team B], QA | [channel] |
| TASK-00N delayed > 1 day | [Team A] | [Team B] | [channel] |
| Schema breaking change detected | Any | All teams | [channel] |

---

## Definition of Done (Cross-Context)

Feature is complete when ALL of the following are true:
- [ ] All TASK-MNN migrations run and verified in staging
- [ ] All contracts have no remaining ⏳ TBD fields
- [ ] Event choreography happy path verified end-to-end
- [ ] All dead-letter scenarios have runbooks
- [ ] `synthesis.md` Health Dashboard — Coverage 🟢, Risk 🟢
