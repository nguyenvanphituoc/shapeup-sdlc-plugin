# Kickoff Doc — Reference

> Source: rjs/shaping-skills (upstream). Loaded on demand by the shapeup skill.

---

## What This Does

Turns a shaped project kickoff transcript into a **builder reference document**. Captures what was shaped, what was agreed, and what the builder needs before starting.

**⚠️ GIGO Warning:** Same as framing-doc — formats and distills, doesn't evaluate.

---

## When to Use

- You have a transcript of a kickoff/handoff meeting for a shaped project
- You need a document the builder can reference during implementation
- The shape already exists and decisions have been made

**This is a document skill for team contexts.** Not part of the solo shaping workflow.

---

## Phase K1 — Parse Transcript

```
Read entire transcript before writing. Extract:
- The shaped solution: what parts/mechanisms were agreed
- Scope boundaries: what's in, what's explicitly out
- Known rabbit holes flagged
- Decisions already made (builder should not re-open these)
- Open questions for the builder to resolve
- Constraints: timeline, integration dependencies, platform limits
```

---

## Phase K2 — Write Kickoff Document

Write `docs/shapeup-sdlc/[feature-slug]/shaping/kickoff.md`

```markdown
---
shaping: true
feature: [feature-slug]
doc_type: kickoff
status: active
---

# [Feature Name] — Kickoff Reference

## What We're Building
[1–2 sentences: the core mechanism from the user's perspective]

## The Shape
A1: [part name] — [one sentence description]
A2: ...

## In Scope
[Explicit boundaries of this cycle's work]

## Out of Scope
[Things deferred — not "never", just "not this cycle"]

## Known Rabbit Holes
[Areas flagged as risky. Include the specific risk if mentioned.]

## Decisions Already Made
[Things the builder should NOT re-open during implementation.
 If something seems wrong: raise it before building, not after.]

## Open Questions for the Builder
[Things left for builder to resolve during implementation]

## Constraints
[Timeline, integration dependencies, platform limits]
[Omit if not mentioned in transcript]

---
*Generated from kickoff transcript. Reference, not specification.*
*For wiring detail: [[breadboard.md]]*
```

---

## Phase K3 — Quality Check

```
- [ ] "Decisions Already Made" contains ONLY things explicitly agreed — no assumptions
- [ ] "Open Questions" are builder-resolvable, not business strategy questions
- [ ] Shape parts are at mechanism level, not implementation detail
- [ ] No technology choices in shape unless explicitly agreed in transcript
- [ ] Wikilink to breadboard.md included if it exists
```
