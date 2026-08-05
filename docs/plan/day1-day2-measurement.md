# Day 1 and Day 2, made measurable — the skill test layer against *Graph Engineering*

- **Item:** make the test work for each skill **measurable** on the terms the paper sets, for the
  first two rungs of its build path and no further.
- **Source under analysis:** `Karpathy-Graph-Engineering-Systems.pdf`, §VI.A (Day 1), §VI.B (Day 2),
  with §VII (evaluation), Table II (exit criteria), Table III (metrics by layer) and Table VI
  (production checklist) as the scoring instruments.
- **Scope decision:** rungs 1–2 only. Rungs 3–6 (planning, multi-agent, graph, swarm) are diagnosed
  in the companion `graph-engineering-roadmap.md` and are deliberately out of scope here.
- **Repo state at the time of writing:** `v1.5.0`, 13 skills, structural suite at 891 checks.
- **Status:** **historical build record — do not read for current numbers.** This documents why the
  instrument exists and how it was built. It is deliberately frozen at what was true when the
  instrument shipped, and its Day-1 figures have all since been superseded.

> ### Where to look instead
>
> | You want | Read |
> |---|---|
> | What has actually been measured, and what is left | **[`evals/DAY1-REPORT.md`](../../evals/DAY1-REPORT.md)** — derived from the baseline, never hand-written |
> | The plan to finish Day 1 | [`day1-tier1-plan.md`](day1-tier1-plan.md) |
> | Why the first `task-executor` number was wrong, and what replaced it | [`day1-phase1-finding.md`](day1-phase1-finding.md) |
>
> **The rule this repo now applies:** a plan holds *intent*, the report holds *results*. No document
> under `docs/plan/` restates a measured number, because a number with two homes has one that is
> wrong. The Day-2 register in §6 below is the one exception still maintained here, and it is the
> next thing to move.
>
> Two things in this document turned out to be defects in its own instrument — a binary oracle score
> and a "revision" step that re-sampled instead of revising. Both are fixed and mutation-tested; §7's
> follow-up table is kept as written, for the record, rather than edited to look prescient.

---

## 0. The finding in one paragraph

The companion roadmap scores this harness **"exceeds the paper"** at rungs 1 and 2, and for the
*product* — the build loop the harness runs over a user's code — that is correct. This document asks
a different question: are the harness's tests **of its own thirteen skills** measurable on the same
terms? They were not. Day 1 requires a stored draft, an evaluator with explicit criteria, a revision
step and a stopping rule, and exits on a **measured quality improvement**; there was no per-skill
quality score of any kind, so the exit criterion could not be evaluated, let alone met. Day 2
requires each tool to address a **measured failure** and exits when the tool **reduces a known error
class**; the harness has many well-typed, well-permissioned tools and no register anywhere linking a
single one of them to a named error class with a before and after rate. The gap was never
capability — it was that the *instrument* did not exist. This change builds it and proves it
discriminates without spending a token.

*(The coverage and pass counts that originally closed this paragraph have been removed: they were
true on the day they were written and are not now. Current figures are derived in
[`evals/DAY1-REPORT.md`](../../evals/DAY1-REPORT.md).)*

---

## 1. What the paper asks for, exactly

Two short sections carry the whole requirement, so they are quoted rather than paraphrased.

> **§VI.A — Day 1: Build Karpathy's Loop.** "Take one existing LLM call whose output can be
> evaluated. Add: stored first draft, evaluator with explicit criteria, revision step, stopping
> rule. Store every artifact."

> **§VI.B — Day 2: Add Tools.** "Add one tool that addresses a measured failure. Code execution, web
> search, database access, or file operations. Each tool requires typed schema, permissions, and
> result confirmation."

And Table II fixes what "done" means for each:

| Rung | Time | Exit criterion |
|---|---|---|
| Reflective loop | Day 1 | **Measured quality improvement** |
| Tool use | Day 2 | **Tool reduces known error class** |

Both exit criteria are numbers. That is the entire reason this document exists: everything else in
both rungs was already present in some form, and the numbers were not.

Three supporting constraints are load-bearing and are honoured below:

- **§VIII.A.1** — *"Can success be verified? If not, do not begin with autonomy."*
- **§IX.B** — *"A ratchet improves the metric it can see."* A metric is an attack surface.
- **Table III** — every layer's metric ships with its **common misreading**. For the workflow layer:
  *"more agents can increase activity without value."* For operations: *"average success hides
  catastrophic cases."*

---

## 2. Where the harness actually stood

Measured against those two rungs, at the level of *testing the skills themselves*:

| Tier | What existed | Day-1/Day-2 status |
|---|---|---|
| **T0 structural** | `tests/structural.mjs`, 803 deterministic checks across 17 modules | Well-formedness, not quality. Proves a rubric *exists*; cannot express whether output got better. |
| **T1 trigger evals** | 13 datasets, 149 cases, measured 2026-07-26 on Haiku 4.5 | Measures **activation**, not quality. FPR = 0 is a clean result; TPR is diagnostic only (38 of 74 positives are deictic). Neither is a Day-1 quality delta. |
| **T2 functional fixtures** | **1 of 13 skills** — `examples/eval-planted-bug/`; deterministic half in CI, LLM half never wired | The closest thing to a Day-1 evaluator, but it grades one build pass/fail. No draft, no revision, no stopping rule, no delta. |
| CI `eval-gate` | Honest placeholder, exits 0 | Nothing. |

So: **Day 1 had an evaluator for one skill and none of the loop around it. Day 2 had every tool the
paper asks for and none of the accounting the paper asks for.**

That second sentence is the more interesting one, and it is worth being precise about why it is not
pedantry. Audit **F-16** found 26 enforcement points sitting inert behind 610 green structural
checks. A guard that never fires and a guard that was never written are the same guard from the
outside. The paper's third Day-2 requirement — **result confirmation** — is exactly the discipline
that would have caught it, and it was the one requirement nothing in the repo recorded.

---

## 3. What was built

```
evals/schemas/day1-rubric.schema.json        typed rubric: criteria, weights, two-headed detectors
evals/schemas/day1-loop-run.schema.json      typed run record: versions, reviews, stop, delta
evals/schemas/day2-failure-class.schema.json typed register entry
tools/skill-loop.mjs                         the loop: inventory | --selftest | --measure
                                             (later: --report, and the row/workspace heads)
evals/failure-classes.json                   the Day-2 register — 8 classes
evals/baselines/skill-loop.baseline.json     Day-1 baseline (shipped `unmeasured`)
skills/spec-evaluator/evals/day1-rubric.json         pilot rubric, 11 criteria
skills/spec-evaluator/evals/fixtures/v1-weak-lenient.md      synthetic reference draft
skills/spec-evaluator/evals/fixtures/v2-strong-skeptical.md  synthetic reference draft
tests/structural/48-day1-day2.mjs            CI enforcement — 88 checks (803 → 891)
```

`tools/skill-loop.mjs` implements the paper's `reflective_task` with the artifacts written to disk
instead of held in a list. Its three modes exist to keep one distinction impossible to blur:

| Mode | Auth | Spend | What it measures |
|---|---|---|---|
| *(default)* inventory | no | none | **coverage** — which skills carry a rubric. Not a quality number. |
| `--selftest` | no | none | **the instrument** — does the rubric separate known-bad from known-good? Not a quality number. |
| `--measure` | yes | yes | **the skill** — the only mode that produces a quality number. |

Every run record carries `mode`, and every stored version carries `source`
(`reference-weak` / `reference-strong` / `model`), so a synthetic score cannot be quoted as a
measured one by being copied out of context. That is the F1 lesson applied one layer up.

### The pilot: `/spec-evaluator`

Chosen because it is the one skill with pre-existing committed evidence — the planted-bug
anti-leniency fixture and the verdict ledger. **No criterion in the rubric was invented**: all
eleven trace to a line already committed in `examples/eval-planted-bug/evals.json`, and each carries
a `traces_to` naming it. The rubric makes those assertions *scoreable*; it does not add opinions.

---

## 4. The honesty problem this design had to solve

Measuring quality needs a model. The instruction for this work was to build without spending, and
the project's own F1 rule forbids writing a number no run produced. Those two constraints together
would normally mean shipping an untested instrument and hoping.

The way out is the move the repo already makes for its oracles (structural §9–§11) and its
anti-leniency fixture (§13): **prove the grader discriminates, using inputs whose correct grade is
known in advance.** Two reference drafts are hand-authored — one reproducing the documented lenient
failure mode, one showing the skeptical posture — and CI asserts the rubric separates them.

Stated precisely, because the distinction is the whole integrity of the layer:

| The selftest **does** establish | The selftest **does not** establish |
|---|---|
| The rubric separates a known-bad draft from a known-good one | Anything at all about `/spec-evaluator`'s real output |
| The scorer reads the draft (tamper control below) | That the skill improves across revision rounds |
| The loop stores artifacts, applies its stopping rule, and computes a delta | That the delta on real output would be positive |

The drafts are engineered endpoints, so the separation is wide by construction (0 → 1.0). **That
number is a property of the fixtures, not of the skill, and is labelled as such in the baseline, in
the run record, and here.** The real number requires `--measure`; until one runs, the baseline
stays `unmeasured` with `results: null`, and CI fails on any other combination.

### The tamper control

A grader that returns the same score for mutilated input is measuring nothing — and would report "no
regression" forever, which is F-16's failure mode wearing a different hat. So §48(d) deletes the
verdict line from the strong draft and asserts the score **falls** (1.0 → 0.786), and asserts an
empty draft scores at or below the weak floor.

That second check earned its place immediately. The first implementation scored both criterion
polarities as positive credit, and an **empty draft scored 0.417** — saying nothing violates no
prohibition. That is Table III's "average success hides catastrophic cases" reproduced in ten lines
of code. The fix was to the scoring semantics, not the threshold:

```
base    = satisfied `must` weight    / total `must` weight
penalty = violated  `must_not` weight / total `must_not` weight
score   = max(0, base − penalty)
```

`must_not` criteria now only ever subtract. Empty scores 0, the lenient draft scores 0, the
skeptical draft scores 1.0.

---

## 5. The known limitation, stated before anyone finds it

The deterministic detector is a **regex over the draft**. Its generality varies by criterion, and
pretending otherwise would be the same species of error as the trigger-eval proxy artifact:

- **Anchor-shaped detectors generalize.** `TS-04 … FAIL`, a `file:line`, an un-ticked `- [ ] AC4`,
  `Overall verdict: FAIL` — the skill's own output contract defines these tokens, so a real
  transcript hits them for the same reason the fixture does.
- **Phrase-shaped detectors do not.** `no-green-suite-justification` and `no-tick-trust` match a
  particular way of writing a lenient inference. A model that reaches the same bad conclusion in
  different words scores as clean. These two are brittle against paraphrase and should be read as
  the weakest criteria in the rubric.

This is why every criterion also carries an `assertion` — the question a model judge would be asked.
The rubric is **two-headed by design**: the deterministic head is what runs free in CI, the model
head is the general grader, and both read the same criteria. Building the second head is the first
follow-up in §7, and it is what the paper's §VI.G evaluation plane means by running "deterministic
checks, model evaluators, and human review" rather than picking one.

---

## 6. What the Day-2 register actually reports

Eight classes, each traced to an artifact already committed in this repo. The register's value is
not that it lists tools — the tools were never in doubt — but that it makes the accounting visible:

| ID | Error class | Tool | Baseline | Current | Exit criterion met? |
|---|---|---|---|---|---|
| FC-01 | Narrated run — orchestrator ships nothing, reads clean | `hooks/gate-intake.mjs` | **measured** 3/3, Haiku 4.5 | unmeasured | ✗ |
| FC-02 | Silently inert enforcement (F-16) | `bin/init.mjs` permission grant | **measured** 26 points | unmeasured | ✗ |
| FC-03 | Lenient judge passes a live AC violation | `oracles/process-oracle.mjs` | unmeasured | unmeasured | ✗ |
| FC-04 | Fabricated evidence in a baseline (F1) | baseline honesty invariant | **measured** 1 | **measured** 0 | ✓ *(structural)* |
| FC-05 | Sibling-stealing skill description | `tools/trigger-eval.mjs` | withdrawn | **measured** FPR 0.0, n=75 | ✗ |
| FC-06 | Malformed work order reaches a worker | `validate-envelope.mjs` | unmeasured | unmeasured | ✗ |
| FC-07 | Cross-scope write corruption | `hooks/sandbox-guard.mjs` | unmeasured | unmeasured | ✗ |
| FC-08 | Unstable judge — PASS→FAIL flip | `verdict-ledger.mjs` | unmeasured | unmeasured | ✗ |

**One of eight can claim Day 2's exit criterion, and it claims it on a structural basis rather than
a sampled one** — the fabricated-baseline class is now impossible by construction, not merely rarer,
so `reduction_basis: "structural"` is recorded and the schema requires that field whenever `reduces`
is non-null. Everything else reports `reduces: null`, enforced by §48(f): a reduction claimed from
two unmeasured rates is the F1 fabrication in Day-2 clothing, and CI fails on it.

Three observations worth carrying forward:

1. **Every tool passes the paper's three requirements** — typed schema, permissions, result
   confirmation — and §48(f) checks each separately, because they fail separately. FC-02's typed
   schema is legitimately `null` (a permission grant takes no structured input), and the schema
   requires that to be written as an explicit `null` rather than an omission.
2. **Five of eight classes have `discovered_by.kind` weaker than `measured`.** Two are audit
   findings, one is observed-but-unquantified, and three are `hypothesized` — reasoned from the
   architecture, never actually seen in a run. Day 2 says "a measured failure". A `hypothesized`
   class is a guess about what would go wrong, and it is labelled as one rather than dressed up.
3. **The asymmetry is the real finding.** Baselines exist where a failure was painful enough to
   measure; current rates exist almost nowhere. The harness measures its failures and not its fixes.

---

## 7. Follow-ups, in the order they pay

Sequenced by cost, and each with a falsifiable exit criterion. **Kept exactly as first written** —
D1 and D3 have since run and D3's "3 of 13" turned out to be the wrong shape of target, but editing a
forecast after the fact to match the outcome destroys the only record of how good the forecast was.
Live status is in [`evals/DAY1-REPORT.md`](../../evals/DAY1-REPORT.md); the plan that replaced this
table is [`day1-tier1-plan.md`](day1-tier1-plan.md).

| # | Work | Cost | Exit criterion |
|---|---|---|---|
| **D1** | Run `--measure` on the `spec-evaluator` pilot (`--repeat 3`, the default — one loop is one draw, not a measurement of the process) | ~$1–3, Haiku 4.5 | A real `v1 → vN` delta exists with its spread. Day 1's exit criterion is met for one skill, or is honestly reported as unmet. |
| **D2** | Add the model-judge head over the existing `assertion` fields | ~$2–5 | The two heads agree on the reference drafts; the judge catches a paraphrased lenient inference the regex misses (§5). |
| **D3** | Rubrics for the two remaining Tier-2 targets named in `tests/README.md` — `task-executor`, `ba-pitch-analyzer` | build free, measure ~$5 | 3 of 13 instrumented; each rubric passes the same discrimination + tamper controls. |
| **D4** | Measure a `current` rate for one Day-2 class with a measured baseline (FC-01 is the candidate — its baseline is 3/3 and its harness exists) | ~$10, n≥3 | One class flips `reduces` to a **sampled** true. That is the first time this repo will have demonstrated a tool reduces the error class it was built for. |
| **D5** | Promote `eval-gate` from placeholder to a real CI job | free for selftest | `--selftest` runs on every PR; `--measure` runs behind an auth-gated manual trigger. |

D4 is the one that matters most and it is listed fourth, which is deliberate: it is the only item
that converts the register from bookkeeping into evidence, and it cannot run until D1–D3 have proven
the instrument on something cheaper.

---

## 8. Scoring the two rungs, honestly

| Rung | Paper's exit criterion | Before | After this change |
|---|---|---|---|
| **Day 1 — loop** | measured quality improvement | No per-skill quality metric existed; the criterion could not be evaluated | Instrument built; discrimination + tamper controls green in CI. Criterion **evaluable**, which it had not been. Coverage and pass counts: [`evals/DAY1-REPORT.md`](../../evals/DAY1-REPORT.md). |
| **Day 2 — tools** | tool reduces known error class | Tools existed; no class, no rates, no link | Register built, 8 classes, all three tool requirements enforced per-class. See §6 for which classes claim the criterion. |

The change that mattered was not passing either rung. It was that **both became scoreable**, and the
gap became a number in a committed file rather than an absence. The paper's §VIII.B is the standard:

> "When the budget is exhausted, return the best current artifact, completed work, unresolved
> issues, and a reason for stopping. **Do not hide partial failure behind a fluent final answer.**"

The partial failure was the headline of this document on purpose, and still is — it has simply moved
to where it can stay true without anyone remembering to edit it.
