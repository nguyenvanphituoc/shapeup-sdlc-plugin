# Which defect first — a rubric, and the queue it produces

**Question:** Of the defects open against 3.5.0, which must be fixed before anything else ships, and
in what order do the rest follow — decided by a stated rubric rather than by severity intuition?
**Scope:** every open entry in `shapeup/knowledge-base/harness-defects.md` after the 2026-09-19
cleanup, plus the findings the HarmonyOS soak measured and the tag that holds some of their fixes.
Excludes the two raw ideas (QA lens fan-out, a rebuilt trigger-eval layer): neither is a defect, and
neither competes for this queue.
**Sources:** this repo @ `78d3c6e` (3.5.0, read 2026-09-19); the register as updated the same day;
`.plan-runs/soak-harmony/NOTES.md` (soak 2026-09-15→17, two consecutive features on a marketplace
install — **gitignored**, so figures sourced there are dated measurements a reader of this plan
cannot re-check, and are labelled as such below). Mechanism claims were re-derived from the artifact
at `78d3c6e`: `hooks/sandbox-guard.mjs` executed against fixtures, `git cherry`/`git merge-base` for
the tag state, source reads for the rest. Baseline `npm test` **1635 checks**, green.
**Falsified once.** A reviewer briefed to refute this plan found two false claims about what the
stranded tag buys, one inverted severity, one false fact inherited from the soak notes, and a
structural flaw in the ranking. All five are corrected in place; §8 records what changed, because a
plan that quietly absorbs its own refutation teaches nothing.
**Confidence:** High on which defects exist and on each mechanism — all read in code, the
load-bearing ones executed, and the contested ones re-executed by a second reader. High on the tier
boundaries as now stated. Medium on ordering within a tier. Low on landing cost for anything marked
*bet*.
**Status:** Acted on 2026-09-20. **Nine of the defects ranked here are closed** — HD-010, HD-011,
HD-012, HD-015, HD-016, HD-017, HD-018, HD-019 and HD-020 — each pinned by a guard and each accepted
by an adversary that drove the behaviour rather than read the diff; see
`defect-sweep-execution.md` for the stage-by-stage record and the register for the guard that holds
each one. HD-014's doc half shipped and its code half did not. HD-013 and HD-021 (P3) and HD-022 (a
PO decision, with evidence now in `stranded-tag-evidence.md`) are untouched.

The ranking itself is left as it was argued. One of its premises did not survive execution and is
worth reading with that in mind: the `own_errors` coupling it describes turns on a function that does
not exist on `main` at all, so the question is contingent on the HD-022 port decision rather than
open today.

---

## 1. Why a rubric, and not a severity column

Severity guesses drift toward whatever was measured most recently. This repo has a value system
already written down; the rubric makes it explicit so the ranking can be argued with:

- **ADR-0001's tiers are a harm scale.** Damage to the consumer's repository outranks damage to the
  committed tier, which outranks damage to the gitignored run trace.
- **A confident wrong answer outranks silence, and silence outranks a loud failure.** The repo's
  most-repeated lesson. A mechanism that answers *wrongly* gets acted on; one that answers *nothing*
  at least gets investigated.
- **The operator acts on the doc, not on the code.** A shipped doc promising the opposite of the
  behaviour is its own defect, separable from the code and usually cheaper to fix. This turned out
  to be the load-bearing idea: it is what survives when a harm score is challenged.
- **GATE H's baseline rule applies here too.** Rank by what the defect costs against not having the
  harness at all, not by distance from the ideal harness.

## 2. The rubric

Five axes, 0–3. Two of them grade different surfaces and must not be confused: **Silence grades the
runtime artifact** (what the run itself reports while it happens); **Doc grades the shipped prose**
(what a reader is told beforehand). An item can score 3 on one and 0 on the other.

| axis | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Harm tier** | the gitignored run trace only | the run's verdict or decision quality | the committed tier | the consumer's repository, working tree, or the assistant's ability to work in it |
| **Silence** (runtime) | fails loudly, where it fails | fails loudly later, elsewhere | reports nothing | **reports a confident wrong answer** |
| **Doc** (shipped prose) | undocumented | docs silent, behaviour implied | a doc describes the intended behaviour | **a shipped doc promises the opposite**, or names a remedy that does not work |
| **Reach** | a rare opt-in path | one stack or one cut shape | most runs | every run |
| **Landing** (inverted) | outside this plugin | a bet with two defensible answers | contained change + guard | one line, or already written |

**Tier mapping, stated — this is what the first draft left implicit and got wrong.** The total does
not choose the tier; two rules and the total do, in this order:

1. **Doc 3 → the doc correction ships in the current sweep**, whatever the code fix costs. A wrong
   remedy costs the operator more than no remedy: they run it, it exits 0, and they look elsewhere.
2. **Landing 3 → schedule it now if it is not a bet.** A one-line fix behind a design question is
   the cheapest thing a queue can lose track of.
3. Otherwise order by total, and break ties with Landing.

There is no "consumer harm" trump. The first draft had one; it fired on exactly one item, that
item's score was the contested one, and a rule with a single judgement-call trigger is a ranking
wearing a rule's clothes.

## 3. Scores

| # | defect | Harm | Sil. | Doc | Reach | Land | total | tier |
|---|---|---|---|---|---|---|---|---|
| 1 | `AGENTS.md:72` says a finished run fences nothing; an escalated close still fences | 2 | 2 | **3** | 2 | 2 | 11 | **P0** (doc rule) |
| 2 | `budgets.wallClockS` is named in RunArgs, routed to by `gates.md`, and read by nothing | 1 | **3** | **3** | 1 | **3** | 11 | **P0** (doc rule) |
| 3 | The staged pitch is writable by every build leg | 1 | 2 | 1 | 2 | **3** | 9 | **P0** (landing rule) |
| 4 | An abort at L3 leaves a trace reading as still running | 1 | **3** | 1 | 2 | **3** | 10 | **P1** |
| 5 | Ownership ignores `shared_substrate`; bugs go to every scope | 2 | **3** | 2 | 2 | 1 | 10 | **P1** |
| 6 | L0, L4 and COACH-1 are never resolved; no gate data in the export | 1 | 2 | **3** | **3** | 2 | 11 | **P1** |
| 7 | `run-args.json` has no writer | 1 | **3** | 2 | **3** | 2 | 11 | **P1** |
| 8 | A run that never reaches EVAL reports zero rounds | 1 | **3** | 1 | 2 | 2 | 9 | **P2** |
| 9 | A worker's ESCALATE reaches nothing | 2 | 2 | 2 | 1 | 1 | 8 | **P2** |
| 10 | A locationless diagnostic loses its location | 1 | 2 | 0 | 1 | 2 | 6 | **P2**\* |
| 11 | The WorkOrder names no result path | 1 | 1 | 1 | **3** | 2 | 8 | **P3** |
| — | Workspace trust · the auto-mode classifier | 2 | 1 | 2 | 2 | **0** | — | **P1, docs only** |
| — | A per-scope "it compiles" fixture proves nothing | 1 | 2 | 1 | 1 | 1 | 6 | **P3** (knowledge base) |

\* **#10's severity is conditional, and the condition is the opposite of the first draft's.** The
welded-ratchet harm needs an `own_errors` axis; main's `score()` has none (`kernel/verify/t0.mjs:186`).
At HEAD this costs the next attempt its evidence. It becomes a weld only **if `a5ce8af` is ported** —
so porting that commit without extending the digester is what would create the defect.

Not scorable on these axes, because they are not changes:

- **The stranded tag** (`archive/lesson-loop-g0-k`, 22 commits, all `+`). Checked per entry rather
  than assumed: it closes #4 outright, half of #6 (the tables, not the missing rows), half of #10 —
  and it makes **#8 worse**, because the branch's `harvest.mjs` calls the same defective
  `roundsUsed()`, adding a second consumer. One entry closed, two halves, one regression.
- **The consumer soak.** The only instrument that sees the two classes this checkout cannot reach.

## 4. The queue

### P0 — ships first, and none of it is blocked on anything

**1. `AGENTS.md:72`.** Say the fence outlives a close while orders remain unanswered, and name
`init run --force` as the release. One paragraph. It is the only thing standing between an operator
and an assistant that cannot edit their project, and it does not wait on the code bet below.

**2. `wallClockS` — the doc half now, the code half with it if it is a deletion.**
`references/gates.md:115-128` routes `--wall-clock-budget` into `budgets.wallClockS` and calls
`run-args.json` "the only artifact that records what a run was configured with" — so the block that
exists to prevent inert switches contains one. Either read the field or delete the name from RunArgs
and the table; both are small, and the doc must stop routing the operator into a dead field either
way.

**3. The staged pitch.** `...FROZEN_INTAKE` in the `execute`/`fix`/`spike` case of `substrateFor`,
or the hook-level variant where no operation has to declare it. One line; denies no write a
legitimate worker makes. Note its Harm is **1**, not 2: `.shapeup/<slug>/intake.md` is the gitignored
tier. It is first because of Landing 3, not because of harm — the first draft justified it by
borrowing the argument for #1, and that was wrong.

### P1 — the same sweep, before the next tag

**4. The abort trace.** Ported if the tag decision allows, written if not. Carries harvest, graph and
export with it. **Not** a fix for #8 — see the footnote there.
**5. Ownership and shared substrate.** The bet: elect from `allowed ∪ shared` with exclusive writers
preferred, versus lint at L1b when a wiring file is in no scope's `allowed`. **Rank this with #10,
not apart from it** — the soak's own synthesis is that one file was invisible to the census and to
the ratchet at once, and electing from `allowed ∪ shared` without widening `ownErrors()` leaves half
the invisibility, while widening `ownErrors()` breaks its deliberate symmetry with `restore()`. That
trade is the real bet and it spans both items.
**6. The unresolved gates.** L4 is Ship Sign-off: the run holds no record of the decision that
shipped it, while `AGENTS.md:12` makes exactly that the point. The export half (a `gate` and a
`build_gate` table) is portable; the rows are not, so port and call-site land together or the table
ships empty.
**7. `run-args.json`'s missing writer** — the mechanism under #2, and the reason it is a confident
wrong answer rather than a dropped argument.
**— Trust and the classifier.** No code is possible; a paragraph naming both layers and the manual
BUILD fallback is owed. Neither *workspace trust* nor *auto-mode classifier* appears in README or
AGENTS.md today.

### P2 — queue, in this order

**8. `rounds_used`** (derive from the highest round carrying a build order, T0 verdict or build-gate
artifact; keep "judged rounds" as its own field) · **9. ESCALATE's channel** — the one real design
question in this tier: ledger row, census entry, or a field on the next order? Answer it once ·
**10. the digester**, sequenced *with* `a5ce8af` if that is ported, and before it, never after.

### P3 — not this cycle

**11. The WorkOrder result path** — port-purity debt with a working workaround in every lane.
**— The per-scope build fixture** — a knowledge-base craft rule, not a mechanism change.

### The tag decision — after P0, not before it

It is a Betting Table call needing a human, it gates one and a half items, and §6 shows P0 does not
depend on it. Putting it at position zero, as the first draft did, buys nothing and delays the two
free wins. Decide it once P0 has shipped, with this plan's per-entry accounting in hand.

## 5. How each P0/P1 item gets evaluated

A reproduction that executes, an acceptance check that fails today, a guard that fires on reversion.
Nothing is accepted on a reading.

| item | reproduce | accepts when | guard |
|---|---|---|---|
| 1 doc | — | `AGENTS.md` states the post-close behaviour and names the release | doc-drift check ties the sentence to `liveOrders()`'s actual inputs |
| 2 wallClockS | launch with `budgets.wallClockS` set | the budget check reads it, **or** the field is gone from RunArgs *and* `gates.md`'s table | structural: the RunArgs contract, the reader and the gates table agree — pin the drift, not the value |
| 3 staged pitch | a run trace with one live `execute` order; drive `sandbox-guard.mjs` with `SHAPEUP_DECISIONS_PATH` redirected | `intake.md` and `breadboard.md` DENY; the scope's own substrate still PERMITs | structural, both directions — a permit-only assertion cannot tell a fence from a fail-open |
| 4 abort trace | force an abort at L3 in a fixture run | the ledger carries a terminal status and the cause, under the run's own tier | structural: every terminal return reaches the close-out |
| 5 ownership | a contract declaring a path only in `shared_substrate`; `probe owner --path` | the path reports a writer; `electOwner` returns it | structural: the JSON and the rendered table agree on one contract |
| 6 gates | a fixture run crossing L4 | a gate row exists for the decision that shipped it, and survives the export | structural: `GATE_IDS` versus the set of ids any call site can emit |
| 7 run-args | open a run | the artifact exists with a kernel writer behind it | structural: the readers' expected keys are produced by the writer |

Two standing rules from `CLAUDE.md`: run `npm test` and `npm run demo` *before* editing, and never
make a red check green by weakening it. One from this session: a hook executed against a fixture must
redirect `SHAPEUP_DECISIONS_PATH`, or the measurement contaminates the ledger it measures.

## 6. Sequencing

```
  AGENTS.md:72 ──────────→ independent, ships first
  #2 doc half ───────────→ independent
  #3 one line ───────────→ independent; lands before #5 (both touch compile.mjs)
        │
        └─→ tag decision ─┬─→ port close-out ──→ #4 done; #8 gains a second consumer, fix it first
                          ├─→ port gate tables → half of #6; rows still to write
                          ├─→ port a5ce8af ────→ REQUIRES #10 first, or it creates the weld
                          └─→ (abandon) ───────→ #4 #6 #10 stay as written work
  #1 code bet ───────────→ AFTER #4: "consult the closing status" is inert today, because nothing
                           writes a closing status on an abort and nothing ever stamps closed_at.
                           The second option — probe resume retiring an abandoned dispatch — has no
                           such dependency and is the only one executable now.
  #5 + #10 ──────────────→ one bet, two items
```

One acceptance wording to settle before #4: `RUN_STATUSES` is
`[orienting, mapping, building, evaluating, shipped, escalated]` — there is no terminal value for an
abort that is not an escalation. Either the fix adds one (a schema and enum change, not a port) or
the acceptance criterion says "escalated" and means it.

Then the soak: a persistent consumer project installed from the marketplace, two consecutive
features, `.shapeup/` not cleaned between them. Both recent attempts stopped before the judge, so
EVAL, QA, GATE H's census and the close-out path have never run end to end on a consumer install.

## 7. What this plan does not settle

Ordering inside P1 and P2 rests on weights nobody has validated against outcomes. The tiers are
defensible; the neighbours within a tier are judgement, and the only evidence that would reorder them
is a run that fails because of one of them.

**One open question this plan must not be read as answering.** The register asks whether the soak can
be made mechanical — a fixture project kept across suite runs, or a CI job installing the packed
tarball into a scratch project. §4 schedules the soak as a manual gate. That is a deferral, not an
answer, and the mechanisation option is unscored here on purpose: it is a Betting Table question
about this repo's own verification, not a defect in the product.

## 8. What the falsification pass changed

Recorded because the corrections point at a habit, not at five unrelated slips. Four of the five were
the same shape: **a claim inherited from a measurement and not re-derived at HEAD.**

- *"The tag converts six items from implement to port"* — false; one and a half, and one regression.
- *"`9da0f14` resolves the digester item"* — false; it introduces the regex that requires the line
  number.
- *"#10 moves to P1 if a non-Node stack is a target"* — inverted; #10's harm requires a commit that
  is not on main.
- *"`probe resume --set-status escalated` stamps `closed_at`"* — false, inherited from the soak
  notes and through them into the register; nothing stamps it, which rules out the obvious fix for #1.
- *"A project they cannot edit"* — overstated; the fence covers `Edit`/`Write`/`MultiEdit`, so
  `Bash`, `git` and editors still write.
- The ranking's tier boundaries were unstated and non-monotone — five items tied at 10 across three
  tiers. The tier rules in §2 replace them, and two items moved as a result.
