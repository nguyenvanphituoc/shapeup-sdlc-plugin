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
  qa-edge-hunter) or to flag it as a harness defect (broken gate/hook/skill contract → filed to
  the committed defect register as a raw idea for the Betting Table, never as worker steering),
  then writes each rule into that skill's committed knowledge-base file so the whole team and
  every future run picks it up. NOT for grading work (spec-evaluator), fixing bugs
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
                          docs/shapeup-sdlc/knowledge-base/<skill>.md ◄───┤  (one file per coachable skill, committed)
                                                                          │
                  next run: task-executor / ba-pitch-analyzer / qa-edge-hunter reads its own file
                                                                          │
              docs/shapeup-sdlc/knowledge-base/harness-defects.md ◄───────┘  (mechanism at fault →
                  drafted raw idea for the Betting Table — read by no worker, committed)
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
say so plainly — do **not** force-fit it into a coachable category.

**Harness defect ≠ worker steering.** When the feedback's root cause is the *mechanism itself* —
a hook that fail-opens, a gate that reads the wrong file, two skill contracts that contradict
each other — no amount of steering a worker fixes it, and filing it as a KB rule misdiagnoses a
defect as a habit (island-escape's KB-BA-002 filed an orchestration/hook defect as BA guidance,
on a premise the skill contracts contradict). That is what the `harness-defect` category below is
for: the coach records it in the committed defect register as a drafted **raw idea** for the
Betting Table — the debt-free path ("remaining findings + new feedback → new raw idea") — and it
never lands in any worker's KB.

---

## Envelope contract — the domain layer

Orchestrated, this skill is dispatched like every worker: a **WorkOrder** in (`--order <path>`,
operation `coach`), a **WorkResult** out. Standalone, the raw feedback is passed directly; it
maps onto the one payload field registered for this worker in the central domain registry
(`skills/tech-lead/schemas/domain.schema.json`, `x-payload-by-worker`):

| Payload field | Standalone form | Meaning |
|---|---|---|
| `payload.feedback` | positional text | The PO's raw L4 feedback to distill and categorize at GATE COACH-1 |

The WorkResult may carry only `files_touched`, `artifacts`, `assumptions`, `deviations`
(`x-result-by-worker`): the knowledge-base files written under
`docs/shapeup-sdlc/knowledge-base/` return as `files_touched`/`artifacts` — the coach itself is
not coachable and never returns discoveries, verdicts, or task results.

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
Valid: [task-executor] [ba-pitch-analyzer] [qa-edge-hunter]
       [harness-defect — mechanism at fault, file as raw idea] [skip — not coachable]

  R1. "<generalized rule>"   (why: <reason>)        → ?
  R2. "<generalized rule>"   (why: <reason>)        → ?
  ...

Reply with an assignment per rule, e.g. "R1→task-executor, R2→harness-defect, R3→skip".
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
- **Recommend `harness-defect` when the mechanism is at fault.** If a candidate rule's "why"
  blames a gate, hook, script, or a contradiction between skill contracts (rather than a
  worker's judgment), say so and recommend `harness-defect` — but the PO still decides. The
  telltale: the rule asks a worker to compensate for something the harness was supposed to
  enforce ("cross-check X because the bookkeeping step gets skipped").

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
   contradicted rules rather than letting it grow unboundedly. A rule whose premise the current
   skill contracts contradict is a `harness-defect` in disguise — move it to the register
   (Step 3b) and note the reclassification, don't keep re-teaching a misdiagnosis.

### Step 3b — File `harness-defect` rules to the defect register (raw ideas, not steering)

For each rule the PO assigned `harness-defect`, append an entry to
`docs/shapeup-sdlc/knowledge-base/harness-defects.md` (create from the template below if
missing). This file is **committed but read by no worker** — it is the PO's backlog of drafted
raw ideas for the Betting Table, not guidance. Each entry gets a stable id `HD-NNN`, the
observed symptom, the suspected mechanism at fault, and a one-paragraph raw-idea draft the PO
can carry straight into Shaping. A report-only mention would evaporate (the write-only failure
this skill exists to prevent); a worker-KB entry would steer the wrong actor — the register is
the one spot that is both durable and inert.

```markdown
# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Defects
- **HD-001** — <symptom observed at ship>. Suspected mechanism: <gate/hook/skill contract>.
  Raw idea: <one-paragraph pitch seed>. · from `<feature-slug>` (<date>)
```

### Step 4 — Report back
Summarize: which rules went to which file (with ids), which were consolidated into existing rules,
which were filed as harness defects (HD ids — remind the PO these await a Betting Table decision,
nothing acts on them automatically), and which were skipped (and why). Remind the PO that these are **guidelines** the named workers read
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
| Only `task-executor`, `ba-pitch-analyzer`, `qa-edge-hunter` are valid worker categories | They are the only workers with a read-side hook; a rule elsewhere is never read |
| A mechanism-at-fault rule goes to the defect register (`harness-defect`), never a worker KB | Steering a worker to compensate for a broken gate/hook misdiagnoses a defect as a habit and hides it from the Betting Table |
| `spec-evaluator` is never a category | Single-judge rule: the KB is guidance, not an invariant — routing rules into the judge creates a second grader |
| Write only under `docs/shapeup-sdlc/knowledge-base/` (committed) | The `.shapeup-sdlc/` run-trace is gitignored; guidelines there never reach the team |
| Guidelines, not invariants | The consumer weighs them; they don't gate, score, or override the spec |
| Keep each file tight — prune as you merge | Consumers load it every run; unbounded growth becomes token cost and noise |
