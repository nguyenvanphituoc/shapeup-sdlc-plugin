---
type: scope-summary
feature: FEATURE_SLUG
generated_at: YYYY-MM-DD
total_tasks: 0
total_estimated_hours: 0
packages_touched: []
critical_path_length: 0
critical_path_tasks: []
external_blockers: []
audit_score: 0
---

# Feature Scope Summary: FEATURE TITLE

> Generated from task graph. Use this document in sprint planning.
> Audit score below 90 means spec needs human review before execution.

---

## At a Glance

| | |
|---|---|
| Total tasks | N |
| Estimated effort | Nh (~N days) |
| Packages touched | N |
| Critical path depth | N tasks |
| External blockers | N items before sprint can start |
| Spec audit score | N/100 [✅/⚠️/🚫] |

---

## Critical Path

The longest sequential chain — minimum time to complete if parallelized optimally.

**Critical path estimate:** Nh total, N steps
*(All other work can happen in parallel alongside this chain)*

<!-- Record the DERIVED numbers only — total hours and step count, both from
     `harness reduce board`. The chain's task ids belong to the LOCAL board
     (.shapeup/<slug>/tasks/), which is gitignored and renumbers per machine; this
     document is committed, so an id written here dangles on every other clone
     (spec-lint TIER-DIRECTION). Read the id-level chain off the board itself. -->

---

## Package Distribution

| Package | Tasks | Est. Hours | % of effort |
|---------|-------|------------|-------------|
| packages/shared | N | Nh | N% |
| apps/api | N | Nh | N% |
| apps/web | N | Nh | N% |
| **Total** | **N** | **Nh** | 100% |

---

## Parallel Opportunities

How much of the board can run simultaneously — **counts and use cases, never task ids.** This file
is COMMITTED; the board is not, and its ids renumber per machine (spec-lint TIER-DIRECTION).

| Group | Use cases | Tasks | Can start after |
|-------|-----------|-------|-----------------|
| Group A | UC-x, UC-y | N | nothing — no dependency |
| Group B | UC-z | N | Group A |

The per-scope release order is `scope-board.md`'s, keyed on `scope_id`. Cite it rather than
restating it here.

---

## External Blockers

Items that must be resolved BEFORE sprint starts:

**Environment Variables**
- [ ] `VAR_NAME` — [what it's for, where to get it]

**Third-party Setup**
- [ ] [Service] sandbox account — [how to obtain]

**Internal Dependencies**
- [ ] [Other team/service] must deploy [X] first — see [[integration#section]]

---

## Risks (from Pitch)

Carried from [[_index#Rabbit-Holes]]:

| Risk | Impact | Mitigation | Related UC |
|------|--------|------------|-----------|
| [risk] | high/med/low | [mitigation] | [[usecases/UC-Name]] |

---

## Execution Recommendation

<!-- Filled from harness verify spec output -->

**Audit Score: N/100**

```
[✅ Ready for autonomous execution — run /execute-plan tasks/_index.md]
[⚠️ Review recommended — PO + Dev 15-min walkthrough before /execute-plan]
[🚫 Blocked — fix critical issues in Audit Report first]
```
