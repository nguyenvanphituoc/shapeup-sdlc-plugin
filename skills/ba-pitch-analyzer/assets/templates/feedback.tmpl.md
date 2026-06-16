---
type: feedback
feature: FEATURE_SLUG
sprint_date: YYYY-MM-DD
po_spec_accuracy: ~        # Fill after sprint: 1-5
dev_execution_accuracy: ~  # Fill after sprint: 1-5
---

# Post-Sprint Feedback: FEATURE TITLE

> Fill this document during sprint retro.
> Scores feed into `.claude/metrics.md` and drive SKILL improvements.

---

## Scores

| Dimension | Score (1–5) | Meaning |
|-----------|-------------|---------|
| PO Spec Accuracy | ~ | Did generated docs reflect what PO intended? |
| Dev Execution Accuracy | ~ | Did tasks lead to correct implementation? |

**Score guide:**
- 5 — Perfect, no corrections needed
- 4 — Minor gaps, handled without blocking
- 3 — Moderate gaps, caused 1–2 clarification rounds
- 2 — Significant misalignment, rework required
- 1 — Spec was wrong, had to re-generate from scratch

---

## PO Notes

*Fill after reviewing delivered implementation against original pitch intent.*

**What the spec got right:**
- ...

**What was missing or wrong:**
- ...

**Did the appetite hold?**
Estimated: N weeks/days | Actual: N weeks/days

---

## Dev Notes

*Fill during retro — be specific about which tasks caused friction.*

**Tasks that needed clarification mid-sprint:**

| Task | What was unclear | What was needed |
|------|-----------------|-----------------|
| [[tasks/TASK-NNN]] | [description] | [what would have helped] |

**Tasks that were well-specified:**
- [[tasks/TASK-NNN]] — [why it worked well]

**Domain model accuracy:**
- [ ] Aggregate design matched reality
- [ ] Invariants were correct
- [ ] Repository interfaces were usable as-is

---

## Improvement Signals

*The most important section — drives SKILL v.next.*
*Flag which reference file or template needs updating.*

| Signal | Affects | Action |
|--------|---------|--------|
| [what was missing] | `references/[file].md` | [what to add/change] |
| [what was wrong] | `assets/templates/[file].tmpl.md` | [what to fix] |

---

## Update metrics.md

After filling this doc, update `.claude/metrics.md` with PO and Dev scores:

```bash
# The row for this feature should already exist from SKILL generation
# Just fill in the PO* and Dev* columns
```
