# P3 Plan — F4, the crossover hunt

- **Item:** the next thing named by the benchmark itself — `report/sdd-harness-benchmark.md` §08:
  *"the next feature should be bigger rather than the next matrix deeper."*
- **Predecessor:** `docs/plan/benchmark-p2-1-plan.md` (Phase A/B complete, Gate A met).
- **Instrument:** `../sdd-harness-bench` — 43 rows, 30 scored, **$58.73 spent** of the $60–150
  envelope. Remaining: **~$90**.
- **Status:** shaped, not started. Nothing here is measured; every number below is a projection
  labelled as one.

---

## 0. Where the instrument actually stands

Facts, from `results/runs.jsonl` rather than from the writeup:

| | |
|---|---|
| Scored runs | 30 across 3 features, 6 arms, 2 models |
| Cells at 100% acceptance | **every one**, except the five v1.3 Haiku narration runs |
| Escaped defects ever observed | **0** — outside the one collapsed cell |
| Ceremony ratio (cheapest harness ÷ control) | 5.4× (F1) → 4.5× (F3) → 2.9× (F2) |
| Reps | n=1 on almost every cell; PROTOCOL §7 asks for n=3 |
| Corrections published | 9, of which 4 share one shape: crediting a mechanism without checking it was in the build |

The instrument is in good shape. The oracle discriminates and self-tests, the diagnostics
self-test, the anti-fabrication rules have each already earned their keep, and the archive is
version-stamped. **What has failed is not the measurement. It is the stimulus.**

---

## 1. The diagnosis — why more runs buy nothing

The headline metric this benchmark was built for — *escaped defects* — **has never once fired.**
Thirty runs, five harnesses, three features, zero. A metric that never fires is not measuring a
tie; it is measuring nothing, and each additional run buys another decimal place on the nothing.

The reason is not that the harnesses are useless. It is narrower and worth stating precisely:

> **SDD's claimed mechanism is externalised memory and enforced traceability. Both only pay when
> memory fails. This benchmark has never once created the condition under which memory fails —
> so it has never tested the mechanism it exists to benchmark.**

Every run to date fits in one session, one context window, one agent that read the requirement
and then satisfied it minutes later while still holding it. In that regime a written spec is a
transcription of something already in working memory, and transcription is pure cost. The measured
3–10× tax is exactly what theory predicts, and running a fourth feature of the same shape will
reproduce it a fourth time.

So "bigger" is right, and "bigger" is not the same as "more code". F2 already went from a 49-line
greenfield prompt to a 6-file seed with five seams, and the ratio moved 5.4 → 2.9 without the
quality axis budging a single criterion. **Volume alone moves the price and not the verdict.**

The two conditions that would make memory fail:

- **K1 — dispersion.** More requirements than an agent will re-check without being made to,
  spread over more surface than it will re-read. Failure mode: a criterion is *forgotten*, not
  misunderstood.
- **K2 — discontinuity.** The agent that finishes the work is not the agent that read the spec.
  Failure mode: whatever was not written down is gone.

K2 is the one nobody has published, it is the condition every one of these tools names in its own
README, and it is the only design in which the no-harness control can lose *by construction*
rather than by accident.

---

## 2. The pitch — shaped, whole cake

### Problem

The benchmark saturated. It can price ceremony and cannot rank quality, because it has only ever
run in the regime where ceremony has nothing to do.

### Appetite

**One week, ~$90** — the balance of the P2-1 envelope. If it does not fit, the *arms* get cut by
a pre-declared rule, never the repetitions and never the honesty checks.

### Solution — one feature, two knobs, one new metric

**F4 — "the handoff feature."** A single feature (K1: bigger and more dispersed than F2) run in
two configurations (K2):

- **F4-solo** — one session, same as F1–F3. Establishes the difficulty rung and the price.
- **F4-handoff** — session A is cut at a uniform wall-clock cap before any arm can finish; a
  **fresh session B**, with no conversation memory, is started in the same workspace and told, in
  one byte-identical sentence, to finish the work. The oracle runs twice: **at the cut** and
  **after handoff**.

The new metric falls straight out of running the oracle twice:

```
recovery = acceptance_after_handoff − acceptance_at_cut
```

Criteria gained by the second agent, per dollar it spent. That is the quantity SDD sells, stated
as a number, measured deterministically, for every arm equally — and, as far as I can find,
unpublished anywhere.

### Breadboard

```
seed tree (K1-sized)  ─┐
PROMPT.md (identical) ─┼─▶ session A ──(uniform cap)──▶ oracle #1  ──▶ acceptance_at_cut
                       │        │
                       │        └── workspace: code + whatever each arm chose to leave behind
                       │                    │
HANDOFF.md (identical) ─────────────────────┴─▶ session B (fresh) ─▶ oracle #2 ─▶ acceptance_after
                                                                              └─▶ recovery, Δ$
```

Nothing in the diagram is new except the second arrow. Oracle, adapters, workspace isolation,
transcript archive and diagnostics are unchanged — which is the point: the cheapest experiment
that reaches the untested axis reuses the whole instrument and adds one loop.

### The arm that decides the whole thing

A sixth arm, **`bare-notes`**: the control, plus **one sentence** telling it to leave notes for
whoever continues. No harness, no ceremony, no gates — just externalised memory at its cheapest
possible price.

It is there because it is the honest steelman, and because its result is decisive either way:

- If `bare-notes` recovers as well as the harnesses → the benchmark's finding becomes
  *"externalised memory is worth roughly one sentence of prompt; the remaining 3–10× buys
  nothing"*. That is a stronger and far more interesting result than the current one, and it is
  bad news for the author's own tool.
- If the harnesses beat it → the crossover is real, located, and priced, and the benchmark has
  found the first thing ceremony demonstrably buys.

There is no outcome in which running this arm is wasted, which is the test for whether an arm
belongs.

### No-gos (explicit, so scope cannot drift)

1. No new harnesses. Six arms: `bare`, `bare-notes`, `shapeup-sdlc`, `spec-kit`, `openspec`,
   `cc-sdd`. (`shapeup-sdlc-auto` is dropped — PROTOCOL §9, 2026-07-27 records that it converged
   with `shapeup-sdlc` once the lane became a mechanism.)
2. No model judge, anywhere, ever.
3. No more than two sessions. Multi-day continuity stays outside the design and stays declared as
   outside it.
4. No per-arm prompt tuning. `PROMPT.md` and `HANDOFF.md` are byte-identical; only the harness
   invocation wrapper differs, as today.
5. No re-running F1–F3 for n=3. They are a documented tie; precision about a tie is not a purchase.
6. No Opus as MUT.
7. No new scoring inputs. Acceptance stays the deterministic oracle's alone.

### Rabbit holes, and the pin in each

| Rabbit hole | Pin |
|---|---|
| Difficulty inflation that measures token throughput instead of method | Criteria stay deterministic process probes. K1 grows by **requirement dispersion**, not by asking for 3,000 lines of code. Cap: seed ≤ ~15 files, contract ≤ ~30 criteria. |
| The session-A cap biases whichever arm spends turns on ceremony | The cap is **wall-clock, uniform, pre-registered, and not a scored point**. What each arm reached at the cut is published as a covariate, not as a verdict. The bias runs *toward* the light arms, which is the safe direction for an author-run benchmark. |
| The handoff prompt smuggles requirements back in | `HANDOFF.md` contains no requirement text. Target: one sentence. It is committed before run 1 and published. |
| Session A finishes for the fast arms, making the handoff vacuous | The rung is chosen in Stage 1 *from measured control runs* so that no arm can finish inside the cap. This is what the cheap calibration ladder is for. |
| Compaction detection may not exist in the event stream | Do not block on it. Spike it in S0; if the stream carries no boundary event, record turn/token pressure as a proxy and say so. Compaction is a covariate here, never a gate. |
| The author's tool is favoured for the first time | §6 — the prediction is registered before the run, the run-evidence rule is generalised to every arm before the run, and `bare-notes` exists specifically to try to beat it. |

---

## 3. F4 — the design in detail

### K1: dispersion, not volume

The seed is a small but real service (~12 files, ~400 lines) with an existing test surface. The
prompt asks for **one coherent feature with ~8 seams**, of which:

- 2 are **cross-cutting invariants** — a rule that must hold in several places at once (the exact
  claim a traceability spine makes, and the first criterion class that can plausibly be *forgotten*
  rather than *misunderstood*);
- 2 live **inside existing files** (the F2 trick that everyone still found — kept as a control on
  the difficulty ladder, so a rung that stops discriminating is visible);
- 1 is a **migration** of pre-existing records;
- 1 is a **regression surface** that must keep working;
- 2 are ordinary new-surface seams.

Contract: ~24–30 criteria, all process probes, mixed `major` / `edge`, written **before any run of
F4**, never copied into a workspace, with `reference/correct` (must pass everything) and
`reference/defective` (must fail the planted set) committed alongside — the existing rule, unchanged.

### K2: the handoff

| Parameter | Value | Why declared |
|---|---|---|
| session A cap | uniform per rung, set in S1 so **no arm finishes** | a cap that some arms clear is a different experiment per arm |
| what is under test on the `shapeup-sdlc` arm | `hooks/compact-snapshot.mjs` (PreCompact) + `hooks/session-rehydrate.mjs` (SessionStart `compact\|resume`) | these two hooks exist for exactly this axis and **have never been measured by anything**. F4-handoff is their first test, and their presence is why this arm is expected to win — which is why Q8 exists |
| session B | fresh `claude -p`, **not** `--resume` | resuming restores conversation memory and destroys the axis |
| session B cap | same as A | symmetry; recorded per row |
| oracle runs | twice — at the cut, after handoff | `recovery` is the difference; both are published |
| workspace | identical between A and B | the workspace *is* the hand-off channel |

`--resume` is the one command that would silently invalidate every row in this stage. It gets an
explicit assertion in the runner, not a comment.

### Rows carry, in addition to today's fields

`phase` (`solo` | `A` | `B`) · `rung` · `acceptance_at_cut` · `recovery` · `cost_A` / `cost_B` ·
`handover_bytes` (bytes of non-code artifact left in the workspace at the cut — the physical size
of what was externalised, for every arm equally, `bare` included) · `compaction_signals`.

`handover_bytes` is the honest cross-arm measure of "how much writing did this cost", and it is
the denominator for the only efficiency claim worth making: **criteria recovered per KB written.**

---

## 4. The ultra plan — staged, gated, cheapest-first

The build order is the whole cake, thin: the *entire* pipeline produces a real published number at
the smallest rung before the expensive rung is built. Nothing is built for a stage that a gate may
never open.

### S0 — instrument (≈0 spend, ~1 day)

| # | Work | Why it is in S0 and not later |
|---|---|---|
| 0.1 | PROTOCOL §9 amendment (Appendix A), committed **before run 1** | pre-registration is the credibility mechanism, and it is worthless applied afterwards |
| 0.2 | Two-phase runner: `--phase solo\|handoff`, oracle at the cut, `--resume` assertion | one loop; the only genuinely new code |
| 0.3 | **Generalise the run-evidence rule to every arm** — no state dir ⇒ `harness_unreachable`, unscored; `bare`/`bare-notes` declared exempt in the protocol | today this rule was applied post-hoc, and only to the arm that happened to have a receipt. That is not even-handed, and F4 is the run where it matters |
| 0.4 | `bare-notes` adapter (~30 lines) | |
| 0.5 | Compaction-signal spike: does the stream emit a boundary event? | 30 minutes, decides whether a covariate exists or a proxy is needed |
| 0.6 | F4 seed + `PROMPT.md` + `HANDOFF.md` + `contract.json` + both references + oracle self-test green | contract before code, unchanged rule |
| 0.7 | Aggregator: `recovery`, `acceptance_at_cut`, grouping key gains `phase` and `rung` | the third pooling bug was the same bug twice; the key is now the thing to get right first |

**Gate S0:** `npm test` green (oracle + diagnostics + the two new metric cases), `--dry-run` clean
on all six arms, defective reference fails exactly the planted criteria. No paid run before this.

### S1 — the calibration ladder (≈$7, cheap by construction)

The control is simultaneously the cheapest arm (**$0.20–0.66/run measured**) and the arm whose
failure *defines* discrimination. So the difficulty is calibrated on the control alone:

- 3 rungs of F4 (`R1` ≈ 1.5× F2, `R2` ≈ 2.5×, `R3` ≈ 4×) × `bare` × **n=2** on **Haiku 4.5**
  → ~$3;
- the selected rung × `bare` × n=2 on **Sonnet 5** → ~$4.

Two numbers come out: where control acceptance leaves 100%, and how long a full control run takes
— which sets the session-A cap.

**Haiku is the search row and Sonnet is the headline row.** This is not a cost dodge and PROTOCOL
§6 still binds: no headline claim is made on Haiku alone. It is chosen because a weaker model sits
closer to the capability boundary, and the *only* non-saturated cell in the entire dataset to date
is a Haiku cell. Discrimination lives near the boundary; the boundary is cheaper to run.

**Gate S1 (kill gate).** If control acceptance is still 100% at R3:
> Publish *"no crossover found up to 4× F2 on single-session features"* — a real, quotable,
> negative result — **and go straight to S2**, because K2 is then the only remaining live
> hypothesis and further volume is confirmed waste. Total sunk: $7.

### S2 — handoff pilot (≈$12)

Selected rung, handoff configuration, Haiku, **n=2**, three arms: `bare`, `bare-notes`,
`shapeup-sdlc`. Twelve sessions (six A, six B).

**Gate S2 (the decision gate).** Compare `recovery`:

| Observation | Decision |
|---|---|
| `bare` recovery ≥ harness recovery | **Stop.** Publish the null: the handoff axis does not discriminate either. ~$19 total. This is the cheapest possible route to the most important negative result the project could produce. |
| `bare-notes` ≈ harness recovery, both > `bare` | **Stop the matrix, publish the finding**: externalised memory is worth one sentence. Optionally add `spec-kit` + `openspec` at n=2 (~$5) to check it holds across tools. |
| harness recovery > `bare-notes` > `bare` | **Proceed to S3.** The crossover is real and this is the first cell in the project's history worth n=3. |

### S3 — the discriminating matrix (≈$35, Haiku)

Only if S2's third branch fires. Six arms × **n=3** × handoff, Haiku. Measured Haiku harness runs
are $0.22–2.30; at F4 size project $1–4 → ~$27–40.

If the budget will not cover it, the pre-declared cut is: **drop to n=3 on `bare`, `bare-notes`
and the two harnesses with the widest measured gap, and record the omission explicitly.** Never
reduce reps; never drop a cell silently (§8.3).

### S4 — Sonnet confirmation of the one cell (≈$33)

The single discriminating configuration, Sonnet 5, `bare` + `bare-notes` + the strongest harness,
n=3. This is the only row a headline may be built on, and it is bought *last*, after the cheap
rows have proven there is something to confirm.

**Gate S4:** if the effect does not reproduce on Sonnet, the published claim is
*"discriminates on Haiku, does not reproduce on Sonnet"* — which is a finding about where the
crossover sits relative to model capability, and is published as one rather than buried.

### S5 — publication ($0, ~1 day)

Amend `report/`, FINDINGS gains F-14, README's status line changes, all transcripts committed.
The four outcome branches are pre-written in §7 so that whichever fires, the writeup is not a
post-hoc rationalisation.

---

## 5. The cost model

Projections from measured per-run costs, labelled as projections.

| Stage | Runs (sessions) | Model | Projected | Cumulative | Gate that can stop here |
|---|--:|---|--:|--:|---|
| S0 instrument | 0 | — | $0 | $0 | tests green |
| S1 ladder | 8 | Haiku ×6, Sonnet ×2 | ~$7 | $7 | no crossover ⇒ publish, skip to S2 |
| S2 handoff pilot | 12 | Haiku | ~$12 | $19 | **null ⇒ stop and publish** |
| S3 matrix | 36 | Haiku | ~$35 | $54 | budget ⇒ pre-declared arm cut |
| S4 Sonnet confirm | 18 | Sonnet | ~$33 | **~$87** | no reproduction ⇒ publish as such |
| S5 publication | 0 | — | $0 | ~$87 | — |

**Envelope: ~$90 remaining. Worst case ~$87. Most likely case is far less**, because two of the
four gates stop the spend at $19 and both are outcomes worth publishing.

The structural property that makes this affordable is worth naming, because it generalises: **the
arm that decides whether to spend is the cheapest arm in the matrix.** Eight control runs cost
less than two harness runs and answer the only question that gates the other $80.

### Operational notes that cost money if ignored

- Runs are **serial and overnight**. The dataset already contains rows reclassified `interrupted`
  because a rate-limit window with overage disabled throttled a session to 52 events in 1645s and
  then tripped the wall-clock cap. That failure mode charges for the run and yields nothing.
- **F4 needs a declared cap** — projected 3600s solo, 1800s per handoff phase — amended into
  PROTOCOL §9 before run 1, uniform within the feature (the existing rule).
- **`--max-turns` has never bound, and the two turn counters must not be conflated.** The cap is
  200 *session* turns; the highest ever recorded is 101 (`f3-wiring`, `shapeup-sdlc-auto`, $5.85).
  The 300-odd figures quoted for that cell are `assistant_turns` from the transcript, which include
  sub-agent turns and are ~3× higher on fan-out arms (308 vs 101 on the same row). F4 is larger, so
  the cap needs headroom and per-row recording — but a plan that "raises the limit F3 hit" would be
  raising the wrong number, and conflating a per-segment count with a whole-run count is precisely
  the §05.6 bug wearing a different hat.

---

## 6. Quality invariants

These are the "ensure quality" half, and each maps to a specific failure this project has already
published a correction for.

| # | Invariant | The correction it descends from |
|---|---|---|
| Q1 | PROTOCOL §9 amendment, **including the stated prediction**, committed before run 1 | pre-registration; a registered prior is what makes a null result a result instead of a disappointment |
| Q2 | Contract + both references committed before any F4 run; oracle self-test must discriminate | §04 rules, unchanged |
| Q3 | **Run-evidence is a pre-registered precondition for every arm**, not a post-hoc rule for one | §05.5 / F-10 — two runs scored 14/14 and 9/9 with the harness never reachable |
| Q4 | Every row carries model + **build from the packaged manifest** + phase + rung + cap | three pooling bugs, each from an incomplete grouping key |
| Q5 | Oracle at the cut as well as after; `recovery` computed, never eyeballed | derived figures must be computed — the ceremony-ratio rule, extended |
| Q6 | Kill gates are pre-declared, and each has a written publishable outcome | stops the sunk-cost pull toward chasing an effect |
| Q7 | Every transcript retained under the version-tagged name; `runs.jsonl` stays what the runner observed, derivations stay sidecars | the naming collision that overwrote the pilot's evidence |

### Q8 — the conflict clause, escalated

F4-handoff is **the first design in this benchmark that favours the author's own tool.** Every
prior design was one the author's arm was expected to lose, and losing publicly is what bought the
project its credibility. That credit is now spendable in exactly one direction, and it must not be.

Binding, before run 1:

1. **The prediction is registered in advance** — literally: *shapeup-sdlc's recovery exceeds
   `bare`'s; whether it exceeds `bare-notes`'s is genuinely unknown, and `bare-notes` is expected
   to capture most of the gap.* If the result matches a prediction nobody wrote down, it is a story.
2. **`bare-notes` exists to beat the author's arm** and is reported in the same table, never a
   footnote.
3. **Q3 is generalised before the run, not after it.**
4. **A harness that wins must show its artifacts**, same rule as the one that lost.
5. If `shapeup-sdlc` wins, the write-up leads with the **cost of the win**, in the same paragraph —
   the F-11 rule: "the collapse is fixed" and "the ceremony is worth paying" are different claims.

---

## 7. The four outcomes, written before the runs

| Branch | Headline | Where it goes |
|---|---|---|
| **A — saturation again** | *"No crossover up to 4× F2. Single-session SDD ceremony costs 3–10× and buys nothing measurable, across four features."* | strengthens the published result; costs $7 |
| **B — handoff null** | *"Even across a session boundary, the no-harness control recovers as well as any harness."* | the strongest negative result available to this project; costs $19 |
| **C — one sentence wins** | *"Externalised memory is worth about one sentence of prompt. The other 3–10× is not."* | the most useful outcome for readers, and the most damaging to the author's own tool |
| **D — crossover found** | *"Here is the first condition under which SDD ceremony pays, and here is what it costs."* | the result the project was built to find — published with its price in the same breath |

Every branch is publishable. That is the test of whether an experiment was worth designing, and
it is the reason the gates can be honoured instead of argued with at 2am.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| F4 turns into a project | Hard caps: ≤15 seed files, ≤30 criteria, ≤2 sessions, 6 arms. Rung R3 is the ceiling; there is no R4. |
| The cut point is arbitrary and someone says so | It is derived from measured control runs (S1), uniform, published, and explicitly not a scored point. Its arbitrariness is bounded and stated rather than hidden. |
| Handoff favours verbose arms that write a lot | That is the hypothesis, not a bug — and `handover_bytes` prices it. Criteria recovered per KB is the metric that stops "wrote more" from reading as "did better". |
| Rate-limit throttling burns budget | Serial, overnight, overage enabled; the `interrupted` reclassification already exists and must stay on. |
| The result flatters the author | §6 Q8, four clauses, all pre-run. Plus `bare-notes`, which is there to make the flattering outcome hard to reach. |
| Publication slips behind the research | S5 is $0 and one day. The existing pilot is already publishable; F4 is a **follow-up post**, and P2-1's rule stands — the benchmark does not block the launch beat. |

---

## Appendix A — PROTOCOL §9 amendment, to commit before run 1

> **2026-07-2X — added F4, a second configuration axis, and a sixth arm.**
> *Reason (pilot data, before any F4 run):* across three features and 30 scored runs, every arm
> that finished scored 100% and the escaped-defect metric never fired once. The ceremony ratio
> narrowed with feature size (5.4× → 2.9×) while the quality axis did not move at all, which says
> volume prices the method and does not test it. Both mechanisms these tools claim — externalised
> memory and enforced traceability — pay only when memory fails, and no run in this benchmark has
> ever created that condition.
> 1. **F4** is added: a ~12-file seed, ~8 seams including two cross-cutting invariants, ~24–30
>    deterministic criteria. Its difficulty rung is calibrated on the `bare` control alone, before
>    any harness spend.
> 2. **A second configuration axis, `handoff`,** is added: session A is cut at a uniform
>    pre-registered wall-clock cap, and a **fresh session** (never `--resume`) is started in the
>    same workspace with a byte-identical one-sentence continuation prompt. The oracle runs at the
>    cut and after handoff; `recovery` is their difference. The cut is not a scored point.
> 3. **A sixth arm, `bare-notes`,** is added: the control plus one sentence instructing it to leave
>    notes for whoever continues. It is the cheapest possible externalised memory and the steelman
>    against which every harness's recovery is measured.
> 4. **`shapeup-sdlc-auto` is retired** — the 2026-07-27 amendment records its convergence with
>    `shapeup-sdlc` once the lane became a mechanism rather than prose.
> 5. **The run-evidence precondition (§8) is generalised to every arm**: a row whose workspace
>    contains none of that arm's own state artifacts is `harness_unreachable` and unscored. It was
>    previously applied post-hoc and only to the arm that happened to carry a receipt. `bare` and
>    `bare-notes` are declared exempt, having no state tree by definition.
> 6. **Registered prediction**, so that a null is a result and not a disappointment:
>    `shapeup-sdlc` recovery > `bare` recovery; `bare-notes` is expected to capture most of that
>    gap; whether any harness beats `bare-notes` is genuinely unknown and is the question F4 exists
>    to answer.
> 7. **Caps for F4:** 3600s solo / 1800s per handoff phase, `--max-turns` raised from 200 and
>    recorded per row. Uniform within the feature, per the existing rule.
> *Prior results invalidated:* none. F1–F3 rows stand as measured under the caps in force at the
> time, and remain n=1 pilot rows that rank nothing between harnesses.

---

## 9. Decisions taken, and the two worth overriding

Taken by default, stated so they can be reversed:

1. **Haiku is the search row, Sonnet the confirmation row.** Cheaper *and* nearer the capability
   boundary where discrimination lives. No headline is claimed on Haiku alone.
2. **`shapeup-sdlc-auto` retired** — its own protocol amendment says it converged.
3. **F4 replaces "bigger F2" with "handoff".** Volume is the knob already shown not to move the
   quality axis; discontinuity is the untested one.
4. **Publication of the existing pilot is not blocked by F4.** S5 is a follow-up post.
5. **The product tickets in §10 are sequenced behind this plan, except P1** — which is a live
   defect and the only one of the six still open alongside P2.

The calls worth making explicitly are in §12.

---

## 10. Product items this plan does **not** cover

This is a benchmark plan. The report also indicts the product, and those are separate tickets —
listed here so the split is deliberate rather than an omission. Each is checked against the build
rather than against the report, because four of this project's nine published corrections were
*crediting a mechanism without checking it was in the build*.

| # | Item | Build status | The measured reason it ranks where it does |
|---|---|---|---|
| P1 | **Permission asymmetry** — the harness's scripts live outside the workspace and need an execute grant | **open** | 26 denials, six invocation shapes, prefix allow-rule ineffective (§05.4/05.5). The only unfixed defect the report names. |
| P2 | **A `none` lane** — `fit-check.mjs` returns `tiny \| full`; the data says it should be able to return "do not run the harness" | **open** | `bare` won every cell of every feature. `tiny-lane.md` already concedes the principle: *"pretending otherwise teaches users to bypass the harness entirely."* |
| P3 | Lane routing beyond P2 | **shipped** (`fit-check.mjs`, `decideLane`, files ≤10 / ≤1500 chars / ≤2 deliverables) | measured at **18%**, not 90% (F-13: $5.85 → $4.83, against a $0.285 control). A solved, small-yield problem — not where the next engineering hour goes. |
| P4 | Wall-clock breaker | **shipped** (`budget-check.mjs` + `hooks/gate-deadline.mjs`) | fired; mistuned, routes to GATE H rather than killing the run. |
| P5 | Schema-validated gate sign-off, no prose consent | **shipped** (`gate-answers.mjs` + schema, `validate-envelope.mjs`) | works; fixed a real stall. |
| P6 | Zero-work detection | **shipped** (`hooks/gate-zerowork.mjs` at Stop + `init-run.mjs` receipt) | untested live — nothing narrated after the fix, so it never had to fire. |

### P1 — the fix that looks obvious is the wrong one

Relocating the scripts into the project's `.shapeup-sdlc/` (the way the other three harnesses
install) would end the denials and **break the organising thesis**: scripts inside the workspace are
writable by the agent they police. An agent that can edit `gate-zerowork.mjs` can disable its own
guard, and "every invariant that matters lives in the runtime" degrades to "lives somewhere the
subject can reach." Version drift per project is the second cost.

The route that does not pay either price is already visible in `hooks/hooks.json`: **hooks execute
from `${CLAUDE_PLUGIN_ROOT}` and need no grant at all.** Every one of the 26 denials was
*agent-invoked Bash* — `init-run.mjs`, `gate-answers.mjs`, `budget-check.mjs`. Moving those onto the
hook/command surface removes the permission path without making a guard editable by its subject.

### Two proposals from the same review that the data forecloses

- **A narration-ratio circuit breaker.** Foreclosed by §04: `shapeup-auto` has the *highest*
  narration ratio in the matrix (0.25–0.41) and scores 14/14, overlapping the collapsed runs'
  0.31–0.38. The signature is narration **with zero writes**, which is why the classifier keys on
  writes first. And `narration_ratio` is an *instrument* metric — moving it into the harness means
  the harness reading its own transcript, at the wrong layer.
- **Zero-work checks at gate L2/L3.** The measured failure never reached L0 — four turns,
  37.5 seconds, zero writes. A gate predicate cannot observe a run that never started; that is
  §04's *"the emptier the failure, the less of it there is to detect."* Stop-hook plus receipt is
  the correct layer and is what shipped (P6).

---

## 11. On "make the benchmark bigger" — why 12 files and not 50

A parallel review proposed the same axis (multi-session) with a different size: **>50 files,
multi-week**. Same conclusion, different theory of the active ingredient, and the difference is
the whole budget.

**Discontinuity is the ingredient. Size is an expensive proxy for it.** Two sessions over a 12-file
seed is the minimum sufficient condition for memory to fail, and it reuses the entire existing
instrument — one new loop in the runner. A >50-file multi-session matrix over six arms at n=3 is
several hundred dollars *plus* a new instrument (session chaining, workspace persistence, compaction
handling), against ~$90 remaining. If the effect is real, it is visible at 12 files; if it is only
visible at 50, that is a finding S3 can motivate spending on later.

The larger design also has no `bare-notes` arm and no kill gates, which are not decorations:

- Without `bare-notes`, *"harness beats bare across sessions"* cannot distinguish the ceremony from
  **writing anything down at all** — the single most likely explanation, and the cheapest.
- Without gates, every branch runs to completion. Two of this plan's four publishable outcomes cost
  $19.

And the one that decides publishability: moving the benchmark onto the axis where the author's own
tool is expected to win, **without adding a fairness mechanism**, spends thirty runs of
loss-publishing credibility in a single direction. §6 Q8 is the price of making that move at all.

---

## 12. Open calls

- **Appetite.** ~$87 worst case leaves nothing in the P2-1 envelope. Halving it — stop after S2,
  publish branch B or C — is a legitimate and cheap choice, and two of the four outcomes are
  reachable for $19.
- **Whether the pilot publishes first.** The current report is publishable today and its value
  decays; F4 is 3–7 days of runs. Sequencing publication ahead of F4 costs nothing and de-risks
  the launch beat.
- **Whether P1 (permission) and P2 (`none` lane) jump the queue.** Both are open, both are cheap,
  and P2 is the rare product change that the benchmark's own losing result argues *for*. Neither
  blocks F4; F4 does not block them. If they ship first, the F4 `shapeup-sdlc` arm must record
  which build it ran — the version-in-the-grouping-key rule, which this project has now got wrong
  three times.
