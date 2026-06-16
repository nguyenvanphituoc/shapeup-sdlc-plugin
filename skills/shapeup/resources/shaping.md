# Shaping — Reference

> Source: rjs/shaping-skills (upstream) + local v1.x extensions. Loaded on demand by the shapeup skill.

---

## What Shaping Does

Shaping separates **what you need** (requirements) from **how you might build it** (shape). It ends when every requirement maps to a shape part. Unknowns are flagged for spikes.

**Stop here — do not slice yet.** Slicing is the final phase of breadboarding.

---

## When to Use Shaping

- You have an idea but haven't separated problem from solution
- You want to explore multiple solution options before committing
- Any "should we build X or Y?" decision

---

## Phase S1 — Problem Frame + Appetite

```
1. Ask: "Describe the problem from the user's perspective. What's broken or missing?"
2. Capture:
   - Situation: what triggers the need
   - Complication: what's wrong or missing right now
   - Desired outcome: what success looks like for the user
   - Anti-goals: what we're explicitly NOT solving
3. Collect appetite (time budget):
   Ask: "How long is the right amount of time to spend on this? (e.g. ~1 week, ~2 weeks)"
   Appetite is the scope anchor — it decides what's in vs. out when tradeoffs arise.
   If the user gives no bound: prompt once, then proceed with "appetite: TBD (uncapped)".
   Warning: an uncapped appetite tends to produce shapes that are too large.
4. Write a one-paragraph problem statement.
   Rule: no solution language — observable symptoms only.
5. Ask: "Is this the right problem, or is there a more fundamental one?"
```

Output: Internal only. Do NOT write files yet.

---

## Phase S2 — Requirements (R)

```
1. Derive requirements as observable outcomes from the problem frame.
   Format: R[N]: [observable condition that must be true when feature is done]
   Example: R0: User sees empty dashboard with guided setup when no data exists
2. Number them R0..RN
3. Flag any R that blurs into solution territory — note it, keep it for discussion
```

**Good requirements are:**
- Observable from the outside (a QA person could verify them)
- Technology-agnostic (no tables, components, API names)
- Non-redundant (each R covers exactly one observable thing)

Output: Internal R-list only.

---

## Phase S2.5 — Rabbit Holes + No-goes

Before selecting a shape, surface the known traps.

```
1. Ask: "Are there any approaches that look obvious but would derail the build?
         Any known rabbit holes — things that could eat weeks of implementation time?"
2. Also capture explicit no-goes: things the user has already decided NOT to build.
3. Record both lists. They constrain shape selection in S3:
   - A shape that passes through a rabbit hole needs extra justification or a spike.
   - No-goes block shape parts silently assumed — call them out.
```

**Why this matters:** Rabbit holes are the most common reason a well-shaped feature blows
its appetite. Naming them before shape selection keeps S3 honest.

Skip if: input has already listed no-goes and confirmed no known traps.

---

## Phase S3 — Solution Shape (A)

```
1. Generate 2–3 possible shapes — named sets of parts/mechanisms.
   Format: A[N]: [part name] — [one sentence: what it does for the user]
   Rule: parts are higher-level than affordances.
         "a settings page with webhook URL" not "a <CopyButton> component"
2. For each shape, note:
   - What requirements it covers
   - What it leaves unresolved
   - Complexity signal: simple / moderate / complex
3. Ask: "Which shape resonates? Any better option?"
4. Select one shape. Record selection rationale.
```

**Fat marker rule:** If describing a part takes more than one sentence, it's too detailed for shaping — save it for breadboarding.

---

## Phase S4 — Fit Check

```
For each requirement R[N]:
  Map to shape part(s) A[N] that satisfy it.
  Mark: ✅ covered | ⚠️ partially covered | ❌ not covered

If any R is ❌ not covered:
  - Either extend shape with a new part (preferred)
  - Or reclassify as non-goal (with user agreement)
  → Do NOT proceed to breadboarding with uncovered requirements.

If any R is ⚠️ partially:
  - Document what remains unresolved
  - Flag whether a spike is needed before breadboarding
```

**Output table:**
```
| R#  | Requirement                           | Covered by | Status |
|-----|---------------------------------------|------------|--------|
| R0  | Empty dashboard shows guided setup    | A4         | ✅     |
| R2  | Auto-generated secret per account     | A1         | ✅     |
| R5  | One-click backfill from UI            | A3, A4     | ✅     |
```

---

## Output File: shaping.md

Write `docs/shaping/[feature-slug]/shaping.md`

```markdown
---
shaping: true
feature: [feature-slug]
status: shaped
appetite: [~1 week | ~2 weeks | ~6 weeks | TBD (uncapped)]
---

# [Feature Name] — Shaping

## Problem Frame
[one paragraph, no solution language]

## Appetite
[time budget + rationale: "~1 week — small improvement, already understand the surface"]

## Requirements
R0: ...
R1: ...

## Rabbit Holes
[Known traps that could eat the budget — be specific about what makes them dangerous]
- RH1: [name] — [why it's a rabbit hole]
(Omit section if none identified — don't invent them)

## No-goes
[Things explicitly outside this feature's scope]
- [item] — [brief reason]
(Omit section if none stated by user)

## Selected Shape — [Name]
Rationale: [why this over alternatives; how it fits within the appetite]

### Parts
A1: ...
A2: ...

## Fit Check
| R# | Requirement | Covered by | Status |
|----|-------------|------------|--------|

## Unknowns → Spike Needed?
- [ ] [unknown 1] → spike-[slug].md
```

**Note:** This file is a kicked-off pitch. `/ba-pitch-analyzer` and `/tech-lead` consume it as-is — the appetite, rabbit holes, and no-goes inform scope decisions downstream.

---

## Common Mistakes

| Mistake | Why it matters |
|---|---|
| Skipping appetite collection | Without a time budget, every option seems equally valid — the shape has no natural stopping point |
| Putting slicing inside shaping | Slicing is breadboarding's final phase, not shaping's |
| Solution language in requirements | "User sees a modal" is not a requirement — it's a shape |
| Fat marker parts (multi-sentence) | Details belong in breadboarding, not shaping |
| Skipping fit check | Uncovered requirements lead to missing features in implementation |
| No rabbit holes section | Known traps go undocumented and derail the build once implementation starts |
