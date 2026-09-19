# Stage 2 measurement — hero-todo, 2026-09-19

The blocking gate of `requirements-reach-the-verdict.md`. **The gate's exit condition is met.**

```
date:            2026-09-18 (run) / 2026-09-19 (graded verdict)
plugin:          3.4.0 @ 090c4a0, branch plan/requirements-reach-the-verdict
                 (verified: git log 090c4a0..17f60be over skills/spec-evaluator, kernel/reduce,
                  kernel/compile.mjs, skills/tech-lead and hooks/ is empty — the craft that graded
                  is the craft that ran)
consumer:        proj-harmony-os-sample, branch soak/hero-todo-2, from main @ b1fd4cf
run_id:          hero-todo-20260918T190736Z-1f60c60c
models:          exec sonnet · eval opus · qa sonnet
gate answers:    ci preset, auto_level unattended
reached:         GATE L3. Round 1 graded on a re-dispatch under a PO waiver. L4 not reached.
verdict:         FAIL — 97 criteria, 9 PASS, 88 FAIL, 5 bugs (2 critical), 3 T0 artifacts re-hashed

class (a)  no acceptance criterion grades it     0 of 21  (board ACs)  ·  10 of 21  (graded spec)
class (b)  an AC exists, no PASS evidence cites it        18 of 21
class (c)  an AC PASSed but tests something else           2  (R11, R17)
class (d)  fine                                            0 of 21
none of the four cleanly                                   1  (R5)

board:                       19 tasks, 112 acceptance criteria
(covers: …) clauses on ACs:  0        — third consecutive measurement
scope contracts with covers: 0 of 18  — run A of the same pitch had 8 of 9
requirements.md registry:    does not exist
```

**Gate outcome: open Stages 3–6.** Class (c) is present, so Stage 7's trigger has fired — note it,
do not act on it until Stage 5 ships.

---

## Read this before the numbers

Three things make this measurement weaker than its precision suggests. All three were found by the
run itself and none is a reason to discard it.

**1. `[ui]` criteria failed by decision, not by measurement.** 43 of 97 criteria are `[ui]` and were
graded NO EVIDENCE ⇒ FAIL under a PO waiver (`proj-harmony-os-sample/shapeup/hero-todo/po-waiver-r1-ui-criteria.md`).
The verdict is a **floor**, not a statement about the product.

**2. The classification rests on `traces_to`, which the plan says is not a grading input — and the
plan's own authoritative join has no data.** §3 makes `covers:` the authoritative join (maintainer,
2026-09-18). There are **zero** `covers:` links anywhere in this consumer and no registry, so
`covers_closure.checked` is `false`. Class (c) is therefore **demonstrated in the mechanism and
unprovable on the plan's own join**, because that join has nothing to join on.

**3. The judge read this plan.** The evaluator's own disclosed assumption, verbatim:

> `traces_to` ids are derived from `shapeup/hero-todo/shaping/shaping.md` `R<n>` → `REQ-<n>` (1:1,
> the maintainer decision recorded in the plugin's `docs/design/plans/requirements-reach-the-verdict.md`)

It could read that because the soak granted `Read(//<plugin>/**)` so the nested session could load
the plugin at all. No grade is affected — `traces_to` is not a grading input — but **the `traces_to`
population this classification is built on is partly an artifact of the judge having read the
measurement's own plan.** A consumer without that grant would not produce it. Any future run that
wants an uncontaminated `traces_to` has to withhold the plan from the judge's reachable tree.

---

## The finding the gate did not ask for

**All 21 requirements have an acceptance criterion on the board. Only 11 reach any criterion the
judge grades. Not one passing criterion tests a behavioural requirement.**

| | |
|---|---|
| requirements with ≥1 criterion in the verdict | **11 of 21** |
| reaching **no** criterion at all | **10** — R6, R10, R12, R13, R14, R15, R16, R18, R19, R20 |
| requirements with ≥1 **PASS** criterion | **3** — R5, R11, R17 |
| what those 9 PASSes are | 8 `Non-Go` rows and 1 `SC-LAYER` row, every one a static source scan |

Confirmed two ways: no `traces_to` names the ten, and a keyword sweep of all 97 criterion names finds
nothing on font scale, touch target, a11y label, settings, gallery, dark mode, catalog primitives,
traceability doc or dirty-form discard.

This is the mechanism §0 argues about, measured on a verdict instead of inferred from an absence:
**the requirement edge is produced on the board and severed before the judge.**

### Why a board-only AC can never clear class (c)

R12, R13 and R14 were the three class-(c) candidates from reading the board. All three have **zero**
criteria in the verdict, and they cannot be resolved by any verdict while things stand:

- Their only ACs live on the board (`TASK-014`, `TASK-012`). `spec-evaluator` grades the **committed
  spec**; `payload.tasks[]` is documented as "traceability ONLY (never a grading source)", and this
  order carried no `tasks` at all.
- Class (c) requires a PASS, so a board-only AC can never produce one.
- **The asymmetry is real and visible in this run:** the judge *did* reach four board ACs — through
  `refuted[]`, un-ticking the `assembleHap`/`test` boxes on TASK-001/002/004/007. **A board-only AC
  can produce a FAIL signal and never a PASS signal.**

Resolving R12/R13/R14 needs the AC to reach the committed spec. That is Stage 3/4 work, not a re-run.

## Class (c), resolved for the first time — R11 and R17

Both are the same shape: a **Non-Go boundary row passing under a requirement's id** while the
requirement's own behaviour is ungraded.

| R | the requirement | the criterion that PASSed | why it is off-target |
|---|---|---|---|
| **R11** | switching language changes every visible string without restart | *"Non-Go — no third language, no RTL qualifier"*, evidence: resource qualifiers are `base`/`dark`/`vi_VN` only | tests the **absence of a third language**, not a live switch |
| **R17** | the build fails on the nine rules L1–L9 and reports L10, L11 | *"Non-Go — no import-table enforcement beyond the eleven UI-layer rules"*, evidence: `rule-table.ts` declares exactly L1–L11 | tests that **no twelfth rule exists**, not that the build fails on the nine |

R17 is the sharper of the two: the evaluator's deviation [5] adds that R17 has no committed criterion
at all, and that L10 **actually misfires** (`app/build-src/enforce/scan.ts:223`, the prefix omits
`ets/`) — a real defect, ungraded, because nothing owns R17.

This is precisely what Stage 7 exists for, and it is why its trigger has now fired: a criterion can
pass under a requirement's id while testing the requirement's negative space.

## R5 — the class the scheme has no bucket for

Two PASSes cite R5 — *"no persistence"* and *"no network"* — and both are **on-target**; that is
literally R5's text. But R5 also says "seeded with a few sample todos on cold start, reset on every
cold start", and that half has no PASS (two FAILs cite it).

Not (b), because a PASS cites it. Not (c), because the PASS is on-target. Not (d), because half of it
is unverified. **The four classes assume a requirement is graded as a unit; this one is graded in
parts.** Worth a fifth class, or an explicit rule that a compound requirement is split before it is
classified — which is what Stage 3.5's atomic-splitting rule already asks of `coverage`.

## `traces_to` — E15 confirmed on live data

The plan's E15 says the verdict projection drops `traces_to` and carries no `run_id`
(`kernel/reduce/ingest.mjs:300-304`). Measured, not read:

| | |
|---|---|
| `CriterionVerdict` rows carrying `traces_to` in the WorkResult | **85 of 97** |
| rows carrying it in `.verdicts-evaluate-r1.jsonl` after ingest | **0 of 97** |
| the ledger's actual key set | `run, dimension, criterion, verdict, confidence, reprobed, evidence, at` |
| `run_id` in the ledger | **absent**, all 97 rows |

The ids are well-formed against `^REQ-[0-9]+$` and **resolve against nothing**, because no registry
exists.

## Why the verdict is a floor, in numbers

Of the 88 FAILs, **83 are literally "NO EVIDENCE"** — 43 waived `[ui]` plus 40 non-`[ui]` with no
runnable probe. 4 are test rows whose assertions exist while the suite runs zero tests. **Exactly one
is a measured defect finding** (BUG-5, a spec inconsistency: `domain-model.md:68` omits
`LIST_LOAD_FAILED`).

Two causes, both recorded by the evaluator as critical bugs:

- **BUG-1** — `startup_config.json:9` declares `"runOnThread": "main"`, which must be
  `mainThread|taskPool`. `hvigorw assembleHap` and `hvigorw test` both exit 255 at
  `:entry:default@ProcessStartupConfig`, twice each, before anything compiles. **The three cited T0
  artifacts are green and were recorded 19:44–19:47Z; they attest a tree that no longer builds** —
  the evaluator said so in its deviation [2].
- **BUG-2** — six of eighteen scopes were never dispatched (`overlay-host`, `settings-screen`,
  `todolist-screen`, `tododetail-screen`, `todoedit-screen`, `gallery-screen`), because every
  `required_states` table cell in their contracts parsed as a string where the schema requires an
  array and `compile` refused the orders. The evaluator named all six and wrote "not covered by the
  PO waiver". Fixed at the gate in the plugin under test by `9a8641e`, which reds exactly those six
  at L1b — after this run.

So this is a verdict over a round that built two thirds of its scopes against a tree that does not
compile. It answers the plan's question; it says nothing good or bad about the product.

## What it took to get here

Three full runs and one re-dispatch, and **every run died of a different harness defect, none of them
about requirements**:

| attempt | how it ended |
|---|---|
| `…125240Z-c45a5c60` | killed at 600 s mid-ANALYZE by headless print mode |
| `…130708Z-baa7c551` | aborted at WIRE — the unattended lane produces no `project-profile.md` and nothing warns at L0; then GATE H inner breaker; then EVAL refused, 4 of 9 scopes never dispatched |
| `…190736Z-1f60c60c` | EVAL escalated — no `run_cmd`, and 6 of 18 scopes never dispatched |
| re-dispatch | **graded**, under the PO waiver |

That pattern is itself a result: on this project the harness could not complete a feature unaided,
and each fix revealed the next layer. Six defects were filed to
`shapeup/knowledge-base/harness-defects.md` along the way, three of them fixed in the plugin
(`f9310f2`, `7f9db51`+`1931a7d`, `9a8641e`).

## Evidence

`proj-harmony-os-sample/.soak-evidence/hero-todo/<run_id>/`, one directory per run_id, additive,
nothing overwritten — including `escalated-r1/` (the pre-existing escalated order and result,
preserved before the re-dispatch) and `redispatch-r1/` (the graded order and result, the 76 KB EVAL
report, the verdict ledger, eight probe evidence files, and the full nested-session transcript).
The two earlier runs are retained beside it.
