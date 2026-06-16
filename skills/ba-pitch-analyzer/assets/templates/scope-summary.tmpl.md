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

```
TASK-NNN → TASK-NNN → TASK-NNN → TASK-NNN
  Nh          Nh          Nh          Nh
```

**Critical path estimate:** Nh total
*(All other work can happen in parallel alongside this chain)*

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

Tasks with no interdependency that can run simultaneously:

| Group | Tasks | Can start after |
|-------|-------|----------------|
| Group A | TASK-NNN, TASK-NNN | TASK-NNN completes |
| Group B | TASK-NNN | TASK-NNN completes |

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

| Risk | Impact | Mitigation | Related Task |
|------|--------|------------|-------------|
| [risk] | high/med/low | [mitigation] | [[tasks/TASK-NNN]] |

---

## Execution Recommendation

<!-- Filled by Phase 7a audit result -->

**Audit Score: N/100**

```
[✅ Ready for autonomous execution — run /execute-plan tasks/_index.md]
[⚠️ Review recommended — PO + Dev 15-min walkthrough before /execute-plan]
[🚫 Blocked — fix critical issues in Audit Report first]
```
