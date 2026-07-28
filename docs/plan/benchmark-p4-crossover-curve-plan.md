# P4 Plan — the crossover curve, and the statistic that is currently overstated

- **Item:** the two things a serious reviewer will attack in F4's result — a headline resting on
  **one arbitrary cut point**, and a p-value quoted at the wrong unit of analysis.
- **Predecessor:** `docs/plan/benchmark-p3-f4-plan.md` (complete; branches A and C published).
- **Instrument:** `../sdd-harness-bench` — 151 rows, 78 scored, 104 transcripts, **$114.52 spent**
  of the $60–150 envelope. Remaining: **~$35.**
- **Status:** shaped, not started. Every number below labelled measured or projected.

---

## 0. Where the instrument actually stands

Facts from `results/runs.jsonl`, not from the writeup:

| | |
|---|---|
| F4 spend | $55.79 across 108 sessions |
| Scored F4 handoff rows at the 60s cut | 32 (7 arms, 2 models) |
| Rows that wrote nothing and finished | **0 / 20** |
| Rows that wrote a file and finished | **6 / 12** |
| Cut points actually measured | **two** — 60s and 90s |
| Arms that ever wrote a file before the cut | **two** — `bare-intake`, `shapeup-sdlc` |

The instrument is now genuinely good: the oracle discriminates at three rungs, the cap is enforced
on the runner's own clock, run-evidence is mechanical and fires on competitors and on the author's
arm alike, and five rows were retracted by a check rather than by noticing. **What is weak is not
the measurement. It is the inference drawn from it.**

---

## 1. The diagnosis — two specific defects in the published claim

### K1 — the p-value is quoted at the wrong unit

| Unit of analysis | p (one-tailed, Fisher) |
|---|--:|
| By **row** (32 rows) | **0.001** |
| By **arm** (7 arms — the independent unit) | **0.048** |

The 32 rows are not independent draws. They cluster into seven arms, and **only two arms ever wrote
a file**. The effective comparison is *2 arms that wrote* against *5 arms that did not*, which lands
at p ≈ 0.05 — right on the boundary. The report currently presents `0 / 20` in a way that implies
the first number.

This is pseudoreplication, it is the single most likely thing to be caught in review, and it is
fixable with about $6 of runs.

### K2 — the headline rests on one cut point, and the other one contradicts it

| cut | `bare` gap closed |
|---|--:|
| 60s | **25%** [17–67] |
| 90s | **100%** [100–100] |

Choose 90s and the finding disappears entirely. The result as published is therefore *"at a cut
where the control has not yet written code, writing the requirement down helps"* — which is close to
definitional, because at that cut nothing else exists to survive.

**The interesting finding is one the current design cannot state: a budget-allocation trade-off.**
Given a fixed wall-clock, spending it on a spec beats spending it on code *if* you are interrupted
early, and loses *if* you are not — because code is itself externalised memory (that is exactly why
`bare` recovers 100% at 90s). Two points cannot show a trade-off. A curve can.

---

## 2. The pitch — shaped, whole cake

### Problem

F4 found a real effect and then described it in the weakest form the data supports: a single cut
point, a single-arm comparison, and a statistic computed at the wrong level.

### Appetite

**~$20 of the ~$35 left.** If it does not fit, the *sweep resolution* gets cut — never the
repetitions, never the arm-level power fix, never the honesty corrections.

### Solution — one curve, three new writer arms, one statistics fix

**Sweep the cut.** Six cut points × two arms × n=3, on Haiku, at F4/R3. This produces two
recovery-vs-cut curves whose **crossing point** is the finding:

```
gap
closed
100% │        ┌───────●───────●────────●   bare-intake
     │       ╱                              (writes at ~t=20s, then flat)
     │      ●
 50% │     ╱                    ╱────●
     │    ╱              ╱─────╱          bare
     │   ●───────●──────╱                  (nothing survives until code exists)
  0% └───┴───────┴──────┴──────┴──────┴──▶ cut
      30      45     60     75     90    120
           └──── the gap IS the value of writing first ────┘
```

Everything in that diagram already exists in the runner. `--phase handoff --cap-a <t>` is the whole
experiment; only the sweep loop and the reporting are new.

### The arms that fix the statistic

Three more **writer** variants, so the "wrote a file" group stops being two arms:

| arm | the one sentence |
|---|---|
| `bare-intake` *(exists)* | copy the requirement into a file |
| `bare-intake-brief` | write a **short summary** of what is being built into a file |
| `bare-intake-criteria` | write **a checklist of what must work** into a file |
| `bare-plan` | write **a plan of what to do next** into a file |

These are not four ways of saying the same thing — they vary **what** gets externalised (verbatim
requirement / prose summary / acceptance checklist / next-actions), which is the next question after
"write something". If the checklist arm beats the verbatim arm, that is a more useful finding than
anything F4 produced.

### No-gos (explicit, so scope cannot drift)

1. **No new harnesses.** The harness matrix is closed. New arms are controls only.
2. **No model judge, anywhere, ever.**
3. **No re-running F1–F3.** Documented ties.
4. **No new feature.** F4/R3 and its committed contract are reused unchanged.
5. **No touching the 60s and 90s rows.** They are published; the sweep adds points, it does not
   replace them.
6. **No Sonnet in the sweep.** The sweep is a shape-finding instrument and Sonnet costs 3–5×.
   Confirmation of the *crossing point only* is a separate, later decision.

### Rabbit holes, and the pin in each

| Rabbit hole | Pin |
|---|---|
| The sweep becomes a fishing expedition | Six pre-declared cut points, committed before run 1. No adding points after seeing the curve. |
| `bare-intake` has its own threshold below which it writes nothing, confounding the low end | That is a **finding, not a confound** — it is the cost of the mechanism, and `handover_bytes` already measures it per row. Report the write-rate per cut point beside the recovery. |
| "Area between curves" invites a fabricated summary statistic | Report the curves and the **crossing interval** only. No integral, no fitted model. n=3 does not support a fit. |
| The new arms are four flavours of prompt engineering | Each is one sentence, committed before run 1, and differs only in *what* is written. If all four behave identically, that is the result: the content does not matter, only that something exists. |
| Budget runs out mid-sweep | Cut points are run **outermost-first** (30, 120, 60, 90, 45, 75), so a truncated sweep still spans the range instead of clustering. |

---

## 3. The staged plan — gated, cheapest-first

### S0 — instrument (≈$0, half a day)

| # | Work |
|---|---|
| 0.1 | PROTOCOL amendment + registered prediction, committed **before run 1** |
| 0.2 | Three new control adapters (~30 lines each), declared `stateRoots: []` |
| 0.3 | **Aggregator reports both row-level and arm-level n**, and prints the arm-level count beside every pooled claim. This is the K1 fix and it ships whether or not any run happens |
| 0.4 | Sweep runner: a thin loop over pre-declared caps; no new session logic |
| 0.5 | `npm test` green, `--dry-run` clean on all ten arms |

**Gate S0:** tests green, dry-run clean. No paid run before this.

### S1 — the curve (≈$11)

Six cuts {30, 45, 60, 75, 90, 120} × {`bare`, `bare-intake`} × n=3 × Haiku × F4/R3.
36 handoff pairs = 72 sessions. Measured per-pair cost at 60s: `bare` $0.230, `bare-intake` $0.346.
Higher cuts cost more in session A and less in B; projected **$11 ± 3**.

**Gate S1 — the shape decides everything:**

| Observation | Decision |
|---|---|
| Curves cross in a well-separated interval | **Proceed to S2.** The trade-off is real and located; this is the publishable finding. |
| Curves never separate at any cut | **Stop.** Publish *"the 60s result does not survive a cut-point sweep"* — a retraction of this project's own headline, which is the most valuable thing it could publish. ~$11 total. |
| `bare-intake` never writes below some cut | Report its write-rate curve as the cost of the mechanism, and continue. |

### S2 — arm-level power (≈$6)

Three new writer arms × n=3 × Haiku, **at the single cut nearest the crossing point** found in S1.
9 handoff pairs = 18 sessions at ~$0.35 → **$6**.

Takes the "wrote a file" group from **2 arms to 5** and the arm-level p from 0.048 to ≤0.01 if the
effect holds. **This is the stage that makes the F4 claim defensible**, and it is the cheapest one.

### S3 — publication ($0)

Amend `report/` (both formats), `FINDINGS.md` gains F-16, `PROTOCOL.md` gains the sweep amendment,
README's headline is restated at the strength the data supports. **The arm-level p goes in the
results table itself**, not in a footnote.

### Explicitly deferred to a later envelope

**Real compaction.** The 60s cut resembles no real interruption; compaction fires when context
fills, far later. Testing it needs a feature large enough to actually trigger it — a new seed, a new
contract, and probably $40+. It is the right next experiment and it does not fit in $35. Naming it
here so it is a decision rather than an omission.

---

## 4. Cost model

| Stage | Sessions | Projected | Cumulative | Gate that can stop here |
|---|--:|--:|--:|---|
| S0 instrument | 0 | $0 | $0 | tests green |
| S1 curve | 72 | ~$11 | $11 | **no separation ⇒ retract and publish** |
| S2 arm power | 18 | ~$6 | $17 | — |
| S3 publication | 0 | $0 | **~$17** | — |

**~$35 remaining. Worst case ~$17, leaving ~$18 of headroom** — deliberately, because F4 overran
its own cap-calibration twice and the honest lesson is to leave slack for the instrument being
wrong again.

---

## 5. Quality invariants

| # | Invariant | The failure it descends from |
|---|---|---|
| Q1 | Cut points and arm sentences committed **before run 1** | pre-registration; the sweep is exactly the kind of thing that invites post-hoc point selection |
| Q2 | **Arm-level n reported beside every pooled claim** | K1 — the current report implies p=0.001 where the defensible figure is 0.048 |
| Q3 | The 60s and 90s rows are **added to, never replaced** | Q7 — the measured record is not edited to fit a nicer curve |
| Q4 | Write-rate reported per cut point, per arm | a mechanism that fires 3/8 times is not the same as one that fires always, and F4 already found that on Sonnet |
| Q5 | No fitted curve, no integral, no interpolated crossing point | n=3 supports "these two intervals do not overlap", nothing more |
| Q6 | Every row still carries model + build + phase + rung + **cap** | four pooling bugs, each one missing term in that key |
| Q7 | **A null result here retracts a published headline, and that is the expected outcome to plan for** | the sunk-cost pull is toward defending F4, and F4 is this author's own result |

---

## 6. The outcomes, written before the runs

| Branch | Fires when | Headline |
|---|---|---|
| **A — trade-off located** | curves separate below a cut and converge above it | *"Writing the requirement down first buys recovery only when you are interrupted before the code exists. Here is where that boundary is."* The finding F4 should have made. |
| **B — no separation** | curves overlap at every cut | *"F4's headline does not survive a cut-point sweep."* A retraction of this project's own result, costing $11. The most credible thing it could publish. |
| **C — content matters** | the four writer arms differ from each other | *"It is not enough to write something — writing X beats writing Y."* Strictly more useful than F4. |
| **D — content is irrelevant** | all four writer arms behave identically | *"Any artifact works. The specific discipline SDD sells is not the active ingredient."* Most damaging to every tool under test, including the author's. |

### Registered prediction, before run 1

**The curves cross between 60s and 90s.** `bare-intake` is flat and high from roughly 30s onward;
`bare` rises steeply between 60s and 90s and matches it thereafter. **The four writer arms will not
differ from each other** — I expect branch D, which is the outcome least flattering to my own tool.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| The sweep confirms F4 and looks like self-justification | Branch B is pre-declared as a retraction and costs $11 to reach. The prediction is registered, including branch D. |
| n=3 is too thin for six points | The claim is interval-overlap between two arms at each cut, not a fitted curve. Where intervals overlap, the aggregator already refuses to order them. |
| Variance swamps the signal (F4 saw 17–67% within one cell) | Six cut points at n=3 is 18 rows per arm — more data on this axis than F4 had in total. If variance still swamps it, that is branch B. |
| Budget overruns as in F4 | $18 of deliberate headroom, and the cap-enforcement check now fails loudly instead of silently granting extra time. |

---

## Appendix A — PROTOCOL §9 amendment, to commit before run 1

> **2026-07-2X — added a cut-point sweep, three writer controls, and arm-level reporting.**
> *Reason (F4 data, before any P4 run):* F4's published result rests on a single cut point, and its
> supporting statistic is computed per row when rows cluster by arm. At the row level the effect is
> p≈0.001; at the arm level — the independent unit, where only **two** arms ever wrote a file —
> it is **p≈0.048**. Separately, `bare` closes 25% of its gap at a 60s cut and **100%** at a 90s
> cut, so the headline is a property of the cut point as much as of the mechanism.
> 1. **A cut-point sweep** is added: {30, 45, 60, 75, 90, 120}s × {`bare`, `bare-intake`} × n=3,
>    Haiku, F4/R3 unchanged. Points are pre-declared; none may be added after the curve is seen.
> 2. **Three writer controls** are added — `bare-intake-brief`, `bare-intake-criteria`,
>    `bare-plan` — differing only in *what* is externalised. They exist to take the "wrote a file"
>    group from two arms to five and to test whether content matters at all.
> 3. **The aggregator reports arm-level n beside every pooled claim.** A row-level p on clustered
>    rows overstates power, and this project has already published one figure with no referent.
> 4. **Registered prediction:** the curves cross between 60s and 90s; the four writer arms do not
>    differ from each other.
> 5. **A null result retracts F4's headline** and is published as such.
> *Prior results invalidated:* none. The 60s and 90s cells stand as measured and are added to.

---

## 8. Open calls

- **Whether to spend $17 confirming a result already published, or $0 and publish the caveat.**
  Adding "arm-level p = 0.048, two arms" to the results table is free and honest, and it may be
  enough. The sweep buys a *better finding*, not a correction — the correction is free.
- **Whether real compaction jumps the queue.** It is the experiment that would make this benchmark
  measure what these tools actually claim. It does not fit in $35, and pretending otherwise is how
  the F4 cap got set from the wrong quantity twice.
- **Whether the envelope reopens.** $114.52 of $150 is spent. Everything above fits; nothing beyond
  it does.
