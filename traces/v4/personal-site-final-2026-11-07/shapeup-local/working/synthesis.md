---
type: synthesis
feature: personal-site
---

# Synthesis — personal-site

## Traceability (REQ → task)
All 18 requirements in the registry are cited by at least one board AC `(covers: …)`: REQ-1..14 and REQ-18
by TASK-001, REQ-15..17 by TASK-002, and the Test Surface suite (TASK-003) re-covers the edge clauses.

## Spec gaps raised, not filled (from orient discovered-seed)
The pitch is silent on these; no Test Surface row or AC was invented for them. The run is unattended, so
they go to the stop census as candidates rather than to the PO now.
- D1 non-object JSON / blank or non-string `name`
- D2/D3 absent optional fields (`tagline`, `about`, `contact`, `projects`, empty-string `url`)
- D4 multi-line parser messages (implementation note: collapse to one line — already required by REQ-15)
- D5 unsafe URL schemes (`javascript:`) in `url`

## Risk register
| Risk | Mitigation |
|---|---|
| attribute escaping missed | single escape helper, TS-INV-03 |
| partial write on failure | validate before mkdir, TS-INV-02 |

## Appetite
4h estimated over 3 tasks on one critical path; within a single round.
