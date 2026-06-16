# Framing Doc — Reference

> Source: rjs/shaping-skills (upstream). Loaded on demand by the shapeup skill.

---

## What This Does

Turns a raw conversation transcript into a structured framing document. Captures **the problem worth solving** and **why it was chosen** over alternatives.

**⚠️ GIGO Warning:** Formats and distills only. Does not evaluate whether the thinking is sound. Good conversation in → good document out. Bad in → bad out.

---

## When to Use

- You have a transcript of a real conversation about a problem or opportunity
- You need a shareable document to align the team on what you're solving
- Before starting shaping — to record the "why this, why now"

**This is a document skill for team contexts.** Not part of the solo shaping workflow.

---

## Phase F1 — Parse Transcript

```
Read the entire transcript before writing anything. Extract:
- Core problem or observation being discussed
- Any "why this, not that" reasoning stated
- Appetite or time constraint if mentioned
- Explicit no-gos or out-of-scope statements
- Unresolved questions or open threads

DO NOT invent reasoning not present in the transcript.
If something is unclear: write "[unclear from transcript]" — never guess.
```

---

## Phase F2 — Write Framing Document

Write `docs/shaping/[feature-slug]/frame.md`

```markdown
---
shaping: true
feature: [feature-slug]
doc_type: frame
status: draft
---

# [Feature Name] — Framing

## The Problem
[2–4 sentences: situation + complication + why it matters now]

## Why Now
[What changed that makes this worth doing now vs later]
[Omit if not discussed in transcript]

## Desired Outcome
[Success from the user's perspective — observable and specific]

## Why This Direction
[Alternatives considered + rationale for this choice]
[Omit if alternatives not discussed]

## Appetite
[Time budget if mentioned. Omit if not mentioned.]

## Non-Goals
[Things explicitly decided NOT to solve. Omit if not discussed.]

## Open Questions
[Unresolved threads from the conversation. Omit if none.]

---
*Generated from transcript. Review before distributing.*
```

---

## Phase F3 — Quality Check

```
- [ ] Every claim traces to something said in transcript (not inferred)
- [ ] No solution details in the Problem section
- [ ] Non-Goals present only if explicitly discussed
- [ ] Open Questions lists things unresolved, not new questions invented
- [ ] "[unclear from transcript]" used for ambiguous parts, not guesses
```
