# P4 Plan — the crossover curve, and the statistic that is currently overstated

- **Item:** the two things a serious reviewer will attack in F4's result — a headline resting on
  **one arbitrary cut point**, and a p-value quoted at the wrong unit of analysis.
- **Predecessor:** `docs/plan/benchmark-p3-f4-plan.md` (complete; branches A and C published).
- **Instrument:** `../sdd-harness-bench` — 151 rows, 78 scored, 104 transcripts. **$114.52 spent to
  date** across P1–P3.
- **Envelope: RESET.** A fresh **$150** is authorised for P4; the $114.52 already spent no longer
  constrains this plan. See "The reset" below for what that does and — more importantly — what it does not.
- **Status:** shaped, not started. Every number below labelled measured or projected.

---

## The reset — and what it must not change

A larger envelope is the most dangerous input this project has received. Every discipline that made
P3 work was a *response to scarcity*: the kill gates, the cheapest-arm-decides rule, the refusal to
buy precision about a tie. Money removes the forcing function, not the reason for it.

**Unchanged, and non-negotiable:**

1. **The gate order.** S1 still runs before S2, S2 before S3. The cheapest stage still decides
   whether the expensive one happens. In P3 that rule turned a $90 plan into a $56 one and produced
   a *better* result, because branch A closed a question for $3.54 instead of $35.
2. **Kill gates still kill.** A branch that says "stop and publish" still stops, even though the
   money to continue now exists. Having budget is not a reason to buy a result.
3. **Reps are never traded for features**, and features are never traded for reps in the other
   direction either. n=3 minimum, raised only where an *interval overlap* actually blocks a claim.
4. **No new harnesses.** The matrix is closed regardless of budget.

**What the reset genuinely buys — two things that were cut for cost, not for merit:**

- **Real compaction (S3).** The experiment that measures what these tools actually claim. It was
  deferred when only ~$35 remained, and named as a deferral rather than an omission. It is now reachable.
- **Sonnet confirmation of the crossing point (S4).** PROTOCOL §6 forbids a headline on Haiku
  alone, and P4's headline is a headline.

**The failure mode to watch:** P3's cap was derived from the wrong quantity **twice**, and each
error was caught by a cheap probe rather than by thinking harder. More budget makes it tempting to
skip the probe and run the matrix. Every stage below still opens with one.

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

**Two weeks, ~$95 of a fresh $150** — and the first $17 of it decides whether the remaining $78 is
spent at all. If a stage does not fit, the *sweep resolution* and the *confirmation breadth* get
cut — never the repetitions, never the arm-level power fix, never the honesty corrections.

The shape is deliberately the same as P3's: **the cheapest stage is the one that gates the
expensive ones.** Two of the four branches below stop the spend under $20, and both are publishable.

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

### S3 — real compaction (≈$55, and it opens with a $10 spike)

**This is the experiment that measures what these tools actually claim**, and the reason the
envelope was worth resetting. Every cut so far — 60s, 90s, 120s — is a wall-clock number chosen by
me. No real interruption looks like that. The interruption these tools are *designed* for is
**context compaction**, which fires when the window fills, far later and at a point nobody chooses.

It is also the axis where `shapeup-sdlc`'s two continuity hooks can finally fire. P3 established
mechanically that they **cannot** fire across a fresh-session handoff (`SessionStart:startup` vs a
`compact|resume` matcher). Under real compaction they are in scope for the first time.

**S3.0 — the spike, $10, one session, before anything else.** F4/R3 peaked at ~42k context tokens.
Compaction on Sonnet needs roughly 4–5× that. The spike answers three questions and nothing else:

1. Can a session be driven to real compaction at all, on a seed we can afford to build?
2. What does it cost per session when it happens?
3. **Does the event stream expose the boundary?** P3's spike found no compaction event in 30
   transcripts — only `/compact` in the init slash-command list. If there is still no boundary
   event, `PreCompact` firing is observable via `hooks_fired`, which is enough.

**Gate S3.0 — hard.** If a session cannot be driven to compaction for under ~$15, **stop and
publish the negative**: *"real compaction could not be triggered within budget; the handoff proxy
is what this benchmark can measure."* That is an honest limit, and it costs $10 to establish
instead of $55 to discover halfway through a matrix.

**S3.1 — the cell**, only if the spike lands: F5 seed sized from the spike's measured token
pressure, `{bare, bare-intake, shapeup-sdlc}` × n=3, oracle before and after the compaction
boundary. ~$45.

The `shapeup-sdlc` arm carries a specific pre-registered question here: **do
`compact-snapshot.mjs` and `session-rehydrate.mjs` fire, and does firing change the outcome?**
`hooks_fired` already records the first half on every row. This is the first design in which that
arm's continuity machinery is actually under test — and per §6 Q8, if it wins, the cost leads.

### S4 — Sonnet confirmation of the crossing point (≈$25)

PROTOCOL §6: no headline on Haiku alone, and P4's headline is a headline. The **single** cut nearest
the crossing found in S1, `{bare, bare-intake}` × n=3, Sonnet 5. Not the whole sweep — the sweep is
a shape-finding instrument and its shape is not the claim; the crossing is.

**Gate S4:** if the crossing does not reproduce, the published claim becomes *"the trade-off is
located on Haiku and does not reproduce on Sonnet"* — which is a finding about where the boundary
sits relative to model capability, published as one. P3 already produced exactly this shape of
split result and it was more informative than a clean win would have been.

### S5 — publication ($0)

Amend `report/` (both formats), `FINDINGS.md` gains F-16, `PROTOCOL.md` gains the sweep amendment,
README's headline is restated at the strength the data supports. **The arm-level p goes in the
results table itself**, not in a footnote.

---

## 4. Cost model

| Stage | Sessions | Model | Projected | Cumulative | Gate that can stop here |
|---|--:|---|--:|--:|---|
| S0 instrument | 0 | — | $0 | $0 | tests green; **arm-level fix ships here regardless** |
| S1 curve | 72 | Haiku | ~$11 | $11 | **no separation ⇒ retract F4's headline, publish, stop** |
| S2 arm power | 18 | Haiku | ~$6 | $17 | — |
| S3.0 compaction spike | 1 | Sonnet | ~$10 | $27 | **cannot trigger ⇒ publish the limit, stop** |
| S3.1 compaction cell | 18 | Sonnet | ~$45 | $72 | — |
| S4 Sonnet crossing | 6 | Sonnet | ~$25 | **~$97** | no reproduction ⇒ publish as such |
| S5 publication | 0 | — | $0 | ~$97 | — |

**Fresh envelope $150. Worst case ~$97, leaving ~$53 of headroom** — deliberately wide, because P3
derived its cap from the wrong quantity **twice** and each correction cost a re-run. Slack is not
unspent budget; it is the price of the instrument being wrong again, which it will be.

**Most likely case is far less than $97.** Two gates stop under $27, and both outcomes are
publishable — one of them a retraction of this project's own headline.

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
| **E — compaction untriggerable** | S3.0 spike fails under ~$15 | *"Real compaction could not be reached within budget; every interruption in this benchmark is a proxy, and here is the proxy's shape."* An honest limit, bought for $10. |
| **F — the hooks finally fire** | S3.1 runs and `hooks_fired` shows `PreCompact` / rehydrate | The first measurement of `shapeup-sdlc`'s continuity machinery doing anything. **If it wins, the cost leads in the same paragraph** (§6 Q8 clause 5). |
| **G — the hooks fire and change nothing** | S3.1 runs, hooks fire, recovery unchanged vs `bare-intake` | *"The rehydrate reflex is real, fires correctly, and is worth nothing against one sentence."* The most specific negative result this project could produce about its own tool. |

### Registered prediction, before run 1

**The curves cross between 60s and 90s.** `bare-intake` is flat and high from roughly 30s onward;
`bare` rises steeply between 60s and 90s and matches it thereafter.

**The four writer arms will not differ from each other** — branch D, the outcome least flattering to
my own tool.

**Under real compaction I predict branch G**: the hooks fire, and recovery is indistinguishable from
`bare-intake`'s. My reasoning is that P3 already showed the active ingredient is *an artifact on
disk*, and the rehydrate hook injects a pointer to artifacts that a competent agent finds anyway.
If that is wrong — if the pointer measurably beats the file — it is the strongest result this tool
has ever had, and it needs to be registered in advance to count as one.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| The sweep confirms F4 and looks like self-justification | Branch B is pre-declared as a retraction and costs $11 to reach. The prediction is registered, including branch D. |
| n=3 is too thin for six points | The claim is interval-overlap between two arms at each cut, not a fitted curve. Where intervals overlap, the aggregator already refuses to order them. |
| Variance swamps the signal (F4 saw 17–67% within one cell) | Six cut points at n=3 is 18 rows per arm — more data on this axis than F4 had in total. If variance still swamps it, that is branch B. |
| Budget overruns as in F4 | ~$53 of deliberate headroom, and the cap-enforcement check now fails loudly instead of silently granting extra time. |
| **The reset budget dissolves the discipline that made P3 work** | The reset section, binding: gate order unchanged, kill gates still kill, cheapest stage still decides. Every stage opens with a probe. The $17 of S1+S2 gates the $78 above it, exactly as $3.54 gated $35 in P3. |
| **F5 becomes a project** | The seed is sized *from the spike's measured token pressure*, not from a guess. Hard caps: one feature, one rung, three arms, n=3. If the spike says compaction needs a seed we cannot build, that is branch E and it costs $10. |
| Compaction fires at a different point for each arm, so "the cut" is not uniform | That is the honest nature of the axis and the reason it is worth measuring: unlike a wall-clock cap, **nobody chooses it**. The oracle runs at the boundary each arm actually hits, and the boundary position is published per row as a covariate. |
| The author's own hooks are finally in scope, on an axis that favours them | Prediction G registered above, before any run. `hooks_fired` is recorded mechanically. Q8's five clauses apply unchanged. |

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
> 4. **A real-compaction stage (F5) is added**, gated behind a $10 spike that must first show
>    compaction can be triggered at all and at what price. Every interruption measured so far is a
>    wall-clock number chosen by the author; compaction is the interruption these tools are designed
>    for, and it is the first axis on which `shapeup-sdlc`'s `PreCompact` and `SessionStart`
>    continuity hooks can fire. P3 established mechanically that they cannot fire across a
>    fresh-session handoff.
> 5. **The envelope is reset to a fresh $150.** The gate order, the kill gates and the
>    cheapest-stage-decides rule are unchanged and explicitly binding — a larger budget changes what
>    is reachable *after* a gate, never whether the gate is honoured.
> 6. **Registered predictions:** the curves cross between 60s and 90s; the four writer arms do not
>    differ from each other; and under real compaction the hooks fire and recovery is
>    indistinguishable from a one-sentence control.
> 7. **A null result retracts F4's headline** and is published as such.
> *Prior results invalidated:* none. The 60s and 90s cells stand as measured and are added to.

---

## 8. Open calls

- **Whether the arm-level correction ships on its own, immediately.** Adding "arm-level p = 0.048,
  two arms" to the results table costs **$0** and is the one thing here that is strictly a
  *correction* rather than an improvement. It should arguably ship today, independent of whether
  any of S1–S4 runs. Everything after it buys a *better finding*, not a fix.
- **~~Whether the envelope reopens.~~ Resolved: reset to $150.** The open question that replaces it
  is sharper — **does S3 (real compaction) run before or after S4 (Sonnet confirmation)?** As
  ordered above, S3 comes first because it is the more interesting experiment; but S4 is what makes
  the *existing* headline quotable, and it is half the price. Running S4 first is the conservative
  choice and I would not argue against it.
- **Whether F5's seed is worth building at all** is decided by a $10 spike, not by this document.
  That is the one thing P3 taught that most needs carrying forward: both of its cap errors came from
  reasoning about a quantity instead of measuring it.
