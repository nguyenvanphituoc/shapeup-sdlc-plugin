# Spike — Reference

> Loaded on demand by the shapeup skill.

---

## What a Spike Is

A spike is a **time-boxed investigation** — not a prototype, not a full implementation. It answers a specific question so the breadboard can be grounded in fact.

**When to use:** After fit check, when any shape part depends on an assumption that hasn't been verified (library capability, API behavior, performance characteristic).

**When NOT to use:** When the unknown is trivial to verify with a quick search. Only spike things that could change the shape if the answer is "no."

---

## Spike Process

```
1. State the question precisely:
   "Can we use Python's built-in zoneinfo for DST-aware timezone math,
    or do we need a network API like Google Timezone?"

2. Define the acceptance condition:
   Yes: [what shape part looks like if confirmed]
   No: [what changes to the shape]

3. Conduct the investigation:
   - Check official docs, not community posts
   - Write minimal proof-of-concept code if needed
   - Document what you found and the source

4. Record the decision:
   - What was confirmed
   - Which shape part this affects
   - Any constraints or caveats discovered
```

---

## Output File: spike-[part].md

```markdown
---
shaping: true
feature: [feature-slug]
doc_type: spike
part: A[N]
status: resolved | open
---

# Spike: [Question]

## Question
[precise question this spike answers]

## Acceptance Condition
Yes: [what shape part looks like if confirmed]
No: [what changes to the shape]

## Investigation
[what was found, with sources]

## Decision
[yes/no + one sentence impact on shape]

## Constraints Discovered
[any caveats the breadboard must account for]
```

---

## SPIKE-UNRESOLVED Fallback

If a spike cannot be resolved (external dependency, blocked, time-boxed):

```
SPIKE-UNRESOLVED: [part name]
- Question: [precise question]
- Blocker: [why unresolvable now]
- Risk: [how this could affect the breadboard]
- Assumption for now: [what we're proceeding with]
- Revisit when: [condition that unblocks this]
```

Proceed with the assumption clearly documented. Revisit before implementation of that specific part.
