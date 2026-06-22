---
name: coach
description: >
  Use this skill to turn raw Product Owner / Tech Lead feedback at the Ship Sign-off (L4 Gate)
  into structured, team-shared guidelines that future harness runs read back. Triggers on:
  "coach this feedback", "record this for next sprint", "update the knowledge base", "RLHF the
  harness", and Vietnamese "ghi lại cho sprint sau", "cập nhật knowledge base". tech-lead invokes
  it automatically at GATE L4 when the PO gives substantive feedback instead of a bare 'y'.
  The coach NEVER guesses which skill a rule belongs to — it runs a categorization GATE that asks
  the PO to assign each rule to one of the coachable skills (task-executor, ba-pitch-analyzer,
  qa-edge-hunter), then writes each rule into that skill's committed knowledge-base file so the
  whole team and every future run picks it up. NOT for grading work (spec-evaluator), fixing bugs
  (task-executor), or filing discovered tasks (the ledger).
---

# Coach Skill — RLHF for the harness

The `/coach` skill closes the learning loop. After a feature ships, the PO/TL drops raw,
unstructured feedback at the L4 Gate ("the executor keeps over-engineering DTOs", "the BA
under-scopes mobile"). The coach distills that into durable **guidelines** and files them where
the relevant worker will read them on its **next** run — so the lesson is learned once and applied
by the whole team forever, not re-explained every sprint.

Two properties make this useful and were missing before:

1. **Team-shared, not local.** Guidelines are written under `docs/shapeup-sdlc/knowledge-base/`,
   which is **committed** (the `.shapeup-sdlc/` run-trace root is gitignored — guidelines written
   there would never reach a teammate). A `git pull` is all a team member needs to inherit the
   harness's accumulated judgment.
2. **Read back, not write-only.** Each guideline is filed under the **one skill that will act on
   it**, in that skill's own file, so the consumer loads only its own rules. `task-executor`,
   `ba-pitch-analyzer`, and `qa-edge-hunter` each read their file at the top of their run.

```
PO feedback at L4 ─► /coach ─► [parse into candidate rules] ─► ⏸ GATE COACH-1 (categorize, ask — never assume)
                                                                          │
                          docs/shapeup-sdlc/knowledge-base/<skill>.md ◄───┘  (one file per coachable skill, committed)
                                                                          │
                  next run: task-executor / ba-pitch-analyzer / qa-edge-hunter reads its own file
```

---

## Coachable skills (the only valid categories)

A guideline is only useful if a worker reads it back. These three workers have a read-side hook;
they are the **complete** set of categories the gate may offer:

| Category | File | The worker reads it at | Good for |
|----------|------|------------------------|----------|
| `task-executor`     | `docs/shapeup-sdlc/knowledge-base/task-executor.md`     | Phase 1 (Context Load) | implementation discipline, code style, surgical-change habits, recurring over/under-engineering |
| `ba-pitch-analyzer` | `docs/shapeup-sdlc/knowledge-base/ba-pitch-analyzer.md` | Phase 1 (Ingest & Scan) | scoping, task decomposition, DDD/spec habits, missed test-surface patterns |
| `qa-edge-hunter`    | `docs/shapeup-sdlc/knowledge-base/qa-edge-hunter.md`    | Phase Q1 (Charter Map) | recurring edge classes, lenses that keep finding bugs, areas worth probing |

**Not coachable.** `spec-evaluator` is deliberately excluded — the harness has a **single-judge**
rule and the knowledge base is guidance, never an invariant; routing rules into the evaluator would
turn advice into a second grader. `orient`, `shapeup`, `tech-lead`, and `translator` have no
read-side hook, so a rule filed there would never be read. If feedback truly targets one of these,
say so plainly and stop — do **not** force-fit it into a coachable category.

---

## Instructions

### Step 1 — Parse the raw feedback into discrete candidate rules
Feedback is usually a blob covering several points. Split it into atomic, generalized candidate
rules — one actionable lesson each. Generalize the specific incident into a habit ("DTO had 9
fields nobody used" → "Prefer the minimum DTO that satisfies the AC; don't add speculative
fields"). Keep the originating why — a rule without its reason gets ignored or misapplied.

### Step 2 — ⏸ GATE COACH-1: Categorize (ASK, never assume)
This is the load-bearing gate. **Do not infer which skill a rule belongs to** — a
miscategorized rule lands in a file the wrong worker reads (or no worker reads). Present every
candidate rule and ask the PO to assign each one. Emit this block, then stop and wait:

```
⏸ GATE COACH-1 — Categorize feedback
For each candidate rule, which skill should act on it?
Valid: [task-executor] [ba-pitch-analyzer] [qa-edge-hunter] [skip — not coachable]

  R1. "<generalized rule>"   (why: <reason>)        → ?
  R2. "<generalized rule>"   (why: <reason>)        → ?
  ...

Reply with an assignment per rule, e.g. "R1→task-executor, R2→qa-edge-hunter, R3→skip".
A rule may map to more than one skill if it genuinely applies to both (e.g. "R1→task-executor, ba-pitch-analyzer").
```

Rules to honor at this gate:
- **No silent defaulting.** If the PO's reply is ambiguous or leaves a rule unassigned, ask once
  more for that rule specifically. Never pick a category on the PO's behalf.
- **`skip` is a first-class answer.** Feedback aimed at a non-coachable skill, or one-off context
  with no general lesson, is recorded as skipped in your summary and **not** written anywhere.
- **Respect the single-judge rule.** If the PO tries to assign a rule to `spec-evaluator`,
  surface that it isn't coachable (guidance ≠ invariant) and offer the nearest real target
  (usually `ba-pitch-analyzer`, which owns the spec/test-surface) or `skip`.

### Step 3 — Merge each assigned rule into its skill's knowledge-base file
For each `<skill>` that received at least one rule:
1. Ensure `docs/shapeup-sdlc/knowledge-base/<skill>.md` exists (create from the template below if
   not — the directory is committed, so the file ships to the team on the next commit).
2. Read the existing file. Merge the new rule(s):
   - **Consolidate** overlapping rules into one stronger statement.
   - **Deduplicate** — if the lesson is already captured, reinforce/sharpen it rather than adding a
     near-duplicate. Bump nothing silently; note the merge in your summary.
   - **Generalize** a specific incident into a reusable guideline.
3. Assign each new rule a stable id `KB-<SKILL-INITIALS>-NNN` (e.g. `KB-TE-001`, `KB-BA-004`,
   `KB-QA-002`) and stamp it with the originating feature slug + date so a future reader can trace
   it back.
4. Rewrite the file. Keep it tight — the consumer loads it every run, so prune stale or
   contradicted rules rather than letting it grow unboundedly.

### Step 4 — Report back
Summarize: which rules went to which file (with ids), which were consolidated into existing rules,
and which were skipped (and why). Remind the PO that these are **guidelines** the named workers read
on their next run — they steer `task-executor`, `ba-pitch-analyzer`, and `qa-edge-hunter`, but they
are **not invariants** and the `spec-evaluator` verdict is unaffected (single-judge rule). Note that
the files are committed, so a teammate inherits them on `git pull`.

---

## Knowledge-base file template

When creating `docs/shapeup-sdlc/knowledge-base/<skill>.md` for the first time:

```markdown
# Knowledge Base — <skill>

> Team-shared guidelines distilled from PO/TL feedback at the Ship Gate (L4) by `/coach`.
> Read by `<skill>` at the top of its run. **Guidelines, not invariants** — they steer the
> worker; they never override a spec or change the spec-evaluator verdict (single-judge rule).
> Committed on purpose: a teammate inherits these on `git pull`.

## Guidelines
- **KB-<XX>-001** — <generalized rule>. _(why: <reason>)_  ·  from `<feature-slug>` (<date>)
- **KB-<XX>-002** — <generalized rule>. _(why: <reason>)_  ·  from `<feature-slug>` (<date>)
```

---

## Hard Rules
| Rule | Rationale |
|------|-----------|
| Never assume a category — GATE COACH-1 asks the PO for every rule | A miscategorized rule reaches the wrong reader or none; the PO's intent is authoritative |
| Only `task-executor`, `ba-pitch-analyzer`, `qa-edge-hunter` are valid categories | They are the only workers with a read-side hook; a rule elsewhere is never read |
| `spec-evaluator` is never a category | Single-judge rule: the KB is guidance, not an invariant — routing rules into the judge creates a second grader |
| Write only under `docs/shapeup-sdlc/knowledge-base/` (committed) | The `.shapeup-sdlc/` run-trace is gitignored; guidelines there never reach the team |
| Guidelines, not invariants | The consumer weighs them; they don't gate, score, or override the spec |
| Keep each file tight — prune as you merge | Consumers load it every run; unbounded growth becomes token cost and noise |
