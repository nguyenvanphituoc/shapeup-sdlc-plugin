<!-- Exported 2026-07-27 from claude.ai artifact 8450e8f0-8afc-46ea-8176-bc776792069e -->
<!-- Canonical rendered version: report/sdd-harness-benchmark.html -->

#### Pre-registered benchmark · pilot, correction pass, and the handoff experiment · 2026-07-28

# Do SDD harnesses ship what they say they shipped?

Four spec-driven-development harnesses, three no-harness controls, and an acceptance suite none of them ever saw. Run by the author of one of the four — who lost, found that half of what he'd concluded about losing was wrong, then built the one experiment his own tool was expected to win and watched a single sentence of prompt match it for a seventh of the price.

**Scored runs:** 98 · **Features:** 4 · **Arms:** 7 + 3 writer controls · **Models:** 2 · **Transcripts:** 148 · **Corrections:** 17 · **Discarded:** 12 · **Rows unscored:** 20

---

## 01 — The result

### Every arm scored 100%. Running no harness was cheapest and fastest every time.

Across three features and every completed run on Sonnet 5, each arm passed every criterion of a hidden acceptance suite, with zero escaped defects anywhere. The control — the same prompt, same model, no methodology at all — did it for a third to a tenth of the cost.

That headline has not moved. What follows it has. A second pass re-read all 28 retained transcripts with instrumentation the pilot did not have, and overturned **two published characterisations, one aggregation figure, and one fix that was never verified**. Those corrections are §05, and they are the reason this page is longer than a results table.

- **Acceptance, all arms** — `100%` — Every completed run, all three features, both models — except one cell (§04).

- **Escaped defects found** — `0` — The metric the benchmark was built to measure. Nothing escaped, anywhere.

- **Ceremony cost vs control** — `2.9–5.4×` — Cheapest harness against no harness, same model. Wall-clock tracks it: 3.0–6.0×.

- **Arms that failed to finish** — `1 → 0` — `shapeup-sdlc` on F3 — killed at the 1800 s cap, and not for the reason first reported. Fixed: 9/9 in 997 s (§06).

**F1 · todo CLI · 13 criteria**

- bare — $0.245
- cc-sdd — $1.333
- openspec — $1.807
- shapeup-sdlc — $2.341
- spec-kit — $2.607

**F2 · budgets · 14 criteria**

- bare — $0.656
- shapeup-sdlc — $1.922
- openspec — $2.591
- shapeup-auto — $2.713
- spec-kit — $3.402
- cc-sdd — $4.107

**F3 · wiring trap · 9 criteria**

- bare — $0.285
- openspec — $1.269
- cc-sdd — $2.407
- spec-kit — $2.685
- shapeup-sdlc — did not finish

> Cost per run, USD, `claude-sonnet-5`, n=1 per bar. Shared scale across all three panels (0–$4.11). Solid bar = no-harness control. Hatched bar = killed at the declared 1800 s budget, so no cost is comparable. All bars scored 100% acceptance.

---

## 02 — Full results

### Every cell, including the ones that make my tool look bad

**Sonnet 5 · all three features**
| Feature | Arm | n | Acceptance | Escaped | Wall s | USD | Turns |
|---|---|---|---|---|---|---|---|
| F1 todo | bare | 1 | 100% | 0 | 51.0 | 0.245 | 8 |
| F1 todo | cc-sdd | 1 | 100% | 0 | 304.5 | 1.333 | 40 |
| F1 todo | openspec | 1 | 100% | 0 | 431.6 | 1.807 | 61 |
| F1 todo | shapeup-sdlc | 1 | 100% | 0 | 489.4 | 2.341 | 57 |
| F1 todo | spec-kit | 1 | 100% | 0 | 523.9 | 2.607 | 70 |
| F2 budgets | bare | 1 | 100% | 0 | 133.6 | 0.656 | 26 |
| F2 budgets | shapeup-sdlc | 1 | 100% | 0 | 395.7 | 1.922 | 48 |
| F2 budgets | shapeup-auto | 1 | 100% | 0 | 563.0 | 2.713 | 63 |
| F2 budgets | openspec | 1 | 100% | 0 | 774.1 | 2.591 | 66 |
| F2 budgets | spec-kit | 1 | 100% | 0 | 646.5 | 3.402 | 97 |
| F2 budgets | cc-sdd | 1 | 100% | 0 | 644.2 | 4.107 | 108 |
| F3 wiring | bare | 1 | 100% | 0 | 51.0 | 0.285 | 16 |
| F3 wiring | openspec | 1 | 100% | 0 | 245.5 | 1.269 | 53 |
| F3 wiring | cc-sdd | 1 | 100% | 0 | 487.5 | 2.407 | 81 |
| F3 wiring | spec-kit | 1 | 100% | 0 | 526.7 | 2.685 | 82 |
| F3 wiring | shapeup-sdlc | 1 | DNF | — | >1800 | — | 327 |

**Haiku 4.5 · F2 budgets**
| Arm | n | Acceptance | Escaped | Wall s | USD |
|---|---|---|---|---|---|
| bare | 1 | 100% | 0 | 162.6 | 0.195 |
| openspec | 1 | 100% | 0 | 146.8 | 0.221 |
| cc-sdd | 1 | 100% | 0 | 193.3 | 0.268 |
| spec-kit | 1 | 100% | 0 | 394.8 | 0.624 |
| shapeup-auto | 3 | 100% | 0 | 205.9 | 0.307 |
| shapeup-sdlc | 5 | 29% | 10 | 37.5 | 0.064 |

Medians shown; every multi-run cell had zero variance. The aggregator refuses to claim an ordering between arms below n=3 — these are pilot numbers, and the ranking between harnesses is not established.

---

## 03 — The instrument

### What makes a number here worth anything

The scoring is a **deterministic, dependency-free oracle**. It spawns the produced artifact with controlled argv, stdin and environment, and grades the observed exit code and output. It never reads source, and it never asks a model anything — a model judge would be the single biggest credibility hole in an author-run benchmark.

The acceptance contract for each feature is written *before* any run of that feature, is never copied into a workspace, and is applied afterward from outside. `shapeup-sdlc`'s own evaluator and QA skills are explicitly barred from the scoring path.

### The rules that stop a broken measurement becoming a result

Each was learned by throwing a measurement away rather than publishing it.

- **A session with no parseable model events writes nothing.** Conflating "the measurement broke" with "the harness scored 0" is the one error that fabricates benchmark results.
- **A zero-work session aborts.** A run can end `subtype:"success"` having done nothing — "Unknown command", zero turns, clean exit. Scored naively that is indistinguishable from a harness that tried everything and failed.
- **A failed harness `init` cancels the paid session.** Otherwise you buy a bare-agent run and label it with a harness's name.
- **A timeout is a completion failure, not a measurement failure.** An API error means the run didn't happen; a timeout means the harness didn't finish. Folding them together quietly excuses slow arms.
- **The oracle self-tests before every run.** It must pass a correct reference and catch every planted defect in a deliberately defective one, or the benchmark refuses to start.
**The control arm**
A fifth arm runs the same prompt with no harness at all. Without it, a benchmark cannot separate "this harness helps" from "the model is good at todo CLIs" — the most common flaw in published SDD comparisons, and the one that most flatters whoever ran it. It turned out to be the most important decision in the design.

### What the pilot's instrument could not do

Four numbers per run — acceptance, escaped defects, cost, wall-clock — are enough to *rank* arms and not enough to *correct* one. The pilot proved it twice: a did-not-finish row carried a dash in every column, and a run that never started looked identical to a run that built the wrong thing. Those two need opposite fixes.

Both are failures of the instrument, not of the harness under test. Every transcript had been retained, so the information existed the whole time and was never read. A second pass now derives, for **every** run including timeouts, and for **every arm equally**:

**Diagnostic metrics — outside the score, by design**
| Metric | What it isolates |
|---|---|
| narration_ratio | prose chars ÷ (prose + tool-input chars) — describing the work instead of doing it |
| writes / work_calls | whether anything happened, independent of whether it was right |
| turns_to_first_write | time-to-first-artifact; null means it never wrote a line |
| last_gate_reached | where a run died — the attribution a DNF row lacked |
| stall_signals | turns that end asking for a confirmation nobody is there to give |
| ended_on_promise | a future-tense plan as the session's last word |
| failure_mode | narrated / stalled / never_started / built_and_failed / ok |
None of it enters a score — acceptance stays the oracle's alone. Its only job is to say *which* failure a row is, so a bad cell becomes a bug report instead of a lament. It has its own self-test, on the same rule as the oracle: it must classify a known-narrated transcript, a known-busy one, and a known-stalled one correctly, or it does not ship. That test exists because the first version of the classifier read a file path where the metrics belonged and labelled every narrated run `unknown` — plausible, and completely inert.

---

## 04 — The one cell that failed

### On a cheap model, one harness collapsed — and it wasn't a competitor's

The Haiku row was run to test a specific hypothesis: that methodology compensates for a weaker model, so ceremony buys you the ability to run something cheap. It does not.

The control scored **14/14 on Haiku for 20 cents**. Every competitor degraded gracefully at 14/14. One arm broke, reproducibly, five times out of five with zero variance: `shapeup-sdlc`, at **29% acceptance and 10 escaped defects**.

Same harness, same model, same feature, one sentence of prompt apart, the self-routed variant scored 14/14 three times out of three. So this is not "Haiku is too weak for methodology" — it is something narrower and more specific.

```
TOOL   Skill(shapeup-sdlc-plugin:tech-lead, "--unattended --rounds 3\n\n# F2 — category budgets…")
RESULT "Launching skill: shapeup-sdlc-plugin:tech-lead"
TEXT   "⚠️ No human review before ship. Running --unattended end-to-end.
        All gates (L0, L1a, L1b, L2, L3, L4) are pre-approved…
        The tech-lead skill is orchestrating the full Shape Up harness. It will: 1. …"
FINAL  (same text — session ends)
```

**The model treats invoking the skill as having done the work.** It loads a 450-line instruction file with eleven gates, writes a confident future-tense summary of what the harness "will" do, and stops. No code, no board, no gate artifacts — and prose that reads exactly like a successful run.

Re-read with the diagnostic metrics, that transcript has a signature no other row in the matrix has:

**F2 · Haiku 4.5 · what each arm's transcript looks like**
| Arm | Turns | Writes | narration_ratio | Stalls | Ends on |
|---|---|---|---|---|---|
| shapeup-sdlc (5 runs) | 4 | 0 | 0.31–0.38 | 0 | promise |
| shapeup-auto | 82–278 | 8–10 | 0.25–0.41 | 0 | claim |
| bare | 55 | 8 | 0.16 | 0 | claim |
| spec-kit | 137 | 26 | 0.06 | 0 | claim |

Four turns, zero writes, ending on a future-tense promise — five times out of five. Note the row directly beneath it: `shapeup-auto` has the *highest* narration ratio in the table and still scores 14/14. **Narration ratio alone diagnoses nothing.** The signature is narration *with zero writes*, which is why the classifier keys on writes first.

**Why this one stings**
That is the "agent claims done" pathology this harness exists to prevent, reproduced by the harness, on its own front door, five times out of five. Its guard for exactly this case — an advisory hook that fires when a completion claim contradicts the run's mechanical facts — never triggered, and it missed for **two independent structural reasons**: it is scoped to active runs, and **a run that never started produces none of the files it looks for**; and its detector matches past-tense completion, while narration is future-tense. It catches "claimed done on a half-green board" and misses "claimed done with no board at all". The emptier the failure, the less of it there is to detect.

---

## 05 — The corrections

### Five things this benchmark published or believed that turned out to be wrong

Kept in order, with the correction under each. A benchmark that quietly rewrites its own conclusions is worth less than one that shows where it was wrong and what the re-run said.

### 1. The cause of the Haiku collapse

The first diagnosis was that the requirement text was being dropped on the hand-off — the orchestrator reached as `args:"--unattended"` with no spec attached. That was observed, and it was wrong as a cause. A deny-hook was built to block a dispatch with no resolvable intake, verified on ten cases, packaged, and the failing cell re-run. **Still 4/14, n=2.** The hook never fired — correctly, because on the re-run the full requirement text *was* passed. The dropped text co-occurred with the failure; it did not cause it.

### 2. The F3 timeout was not a stall

The DNF was reported as a run killed at the cap, inside an argument about gate ceremony. The transcript says something else entirely:

```
327 assistant turns · 262 tool calls · 130 work calls · 37 file writes · 92 reads
19 gate markers · last gate reached L3 · narration_ratio 0.047 · stall_signals 0
```

It has the **lowest narration ratio of any `shapeup-sdlc` run in the matrix** and one of the highest work-call counts in the dataset. It was not waiting for a human. It was building, and it was still building when the clock ran out, mid-loop at GATE L3.

The DNF stands exactly as recorded. What changes is what it is evidence *of*: not ceremony overhead, but a harness whose circuit breakers count **events** — one per round, one per verification attempt — and therefore cannot notice that a single round has been running for twenty-nine minutes. The real cost is not the dash in the table; it is that a run killed from outside ships nothing, including the scopes that had already passed their smoke tests.

### 3. An aggregation figure with no referent

The aggregator grouped cells by feature × harness. The model was not in the key. That merged five failed Haiku runs with one full-price Sonnet run into `n=6, acc 29% [29–100]`, and a ceremony ratio of **0.17× the control** — a number that means nothing. The protocol states "the model is never implicit"; that rule was enforced at the runner, where every row carries its model, and not at the aggregator, where rows are pooled. A rule that holds for the raw data and not for the summary only protects the inputs.

### 4. A fix that could not run

Four mechanisms were built against §04 and §05.2 — a run receipt, a blocking zero-work check, a pre-recorded gate answer set, a wall-clock breaker. The re-run showed they never executed. Every load-bearing step is a script that ships *with the plugin*, so it lives outside the working directory, and executing it needs an approval no headless run can give. **26 denials in one session, six invocation shapes attempted**, then the agent abandoned the harness and built the feature by hand.

### 5. And a fix for *that* which also did nothing

The obvious accommodation — a prefix allow-rule for the plugin's script directory — changed nothing, because the agent's commands are variously quoted, compound, heredoc-fed or wrapped in scripts it writes itself, and a prefix rule matches none of those. Same 26 denials. **The runs still scored 14/14 and 9/9**, with the harness demonstrably never reachable. Had the workspace not been inspected for harness artifacts, that would have been published as the harness succeeding.

### 6. A metric that was wrong for the whole pilot

A session emits one `result` event per segment. `total_cost_usd` is **cumulative** across them; `num_turns` and `output_tokens` are **per-segment**. The runner kept only the last event — so cost came out right, and turns and tokens came out as whatever the final fragment happened to be: `turns: 1, out: 848` for a run that took 80 turns and 26,735 output tokens.

Because the cost was correct, nothing looked broken, and it survived the entire pilot. It under-reports in one direction only, and *only for arms that fan out to sub-agents* — which is precisely the arms whose ceremony this benchmark exists to price. Two published rows are affected; no acceptance, escaped-defect or cost figure changes.

**The lesson those last two share**
Both were plausible mechanisms verified by reasoning rather than by measurement — the same shape as correction 1. And both produced *passing scores* while the thing under test was inert. **A passing score is not evidence that the thing under test ran.** That is this benchmark's own founding error, arriving from the measurement side instead of the agent side.

- **HOLDS** — The collapse is real and reproducible — n=5 across two prompt variants, 29% every time.
- **HOLDS** — The control holds on Haiku at 14/14 for $0.195.
- **WRONG** — Cause was dropped intake. Corrected — intake was valid on re-run.
- **HOLDS** — Cause is the model narrating instead of executing, shown in transcript with a valid spec.
- **WRONG** — The intake gate fixes it. Measured: it does not.
- **HOLDS** — The existing completion-claim guard structurally cannot see total failures.
- **WRONG** — The F3 DNF was a gate stall. Measured: 327 turns, 37 writes, zero stall signals.
- **WRONG** — The F2 shapeup cell was `n=6, 29–100%`. That pooled two models; it is two cells.
- **WRONG** — Per-run `turns` and `tokens_out` for sub-agent arms. Read from one result segment instead of all of them.
- **HOLDS** — Every `cost_usd`, every acceptance figure, every escaped-defect count. None of them touch that path.
---

## 06 — What was built, and what it measured

### The collapse is fixed. The ceremony is not thereby justified.

Four mechanisms, each aimed at a failure measured here. The harness's organising rule is that every invariant that matters lives in the runtime rather than in a prompt — and each of these was living in a prompt, which is precisely why each got dropped, paraphrased or summarised.

**F2 · Haiku 4.5 · shapeup-sdlc — the cell that was 29%**
| Build | Acceptance | Escaped | Writes | Receipt | Last gate | Wall s | USD |
|---|---|---|---|---|---|---|---|
| before — n=5 | 29% | 10 | 0 | — | L4 | 37.5 | 0.064 |
| after — rep 1 | 100% | 0 | 48 | ✓ | L4 | 2258 | 3.286 |
| after — rep 2 | 100% | 0 | 67 | ✓ | H | 1741 | 2.305 |
| after — rep 3 | 100% | 0 | 48 | ✓ | L4 | 1456 | 2.101 |
| control (no harness) | 100% | 0 | 8 | n/a | — | 162.6 | 0.195 |

Zero variance on both sides: 29% five times, then 100% three times. And the harness *demonstrably ran* — which §05.5 is the reason to check rather than assume. Every rep left a full artifact tree, not just a passing binary:

```
receipt.json · intake.md · harness-run.md · active-scope
orient/{code-surface-map, spike-findings, hill-signal, discovered-task-seed}.md
spec/{_index, domain-model, requirements, integration}.md + 4 use cases
orders/r1-a1.json, r1-a2.json  →  results/r1-a1.json, r2-bugfix.json     (envelope dispatch)
evaluation/EVAL-FEATURE-…-r1.md, …-r2.md                                 (round 1 FAILED, looped)
qa/hunt-report.md · GATE-H-ship-decision.md
```

Two evaluation reports is worth noticing on its own: **round 1 failed and the harness looped to a fix round.** That is the loop working, not a lucky first pass.

**What this does not establish**
The failing runs cost **$0.064 because they did nothing.** Fixing the collapse converted a fake cheap loss into a real expensive pass: **11.8× the control's cost and 10.7× its wall clock, for an identical 14/14.** "The collapse is fixed" and "the ceremony is worth paying" are different claims, and only the first is supported here. The v1.4 work removed a *defect*; it was never designed to change the pilot's central result, and it does not.

**The four mechanisms, and the honest scoreboard on each**
| Mechanism | The failure it answers | Measured |
|---|---|---|
| run receipt | Whether a run had started was not a fact on disk — every guard could only observe what a run did, so a run that did nothing was invisible to all of them. | works present in 3/3 reps |
| zero-work block | §04. Blocks a session that dispatched the orchestrator and left no receipt. Predicate is a mechanical absence, so no phrasing changes it. | untested live nothing narrated after the fix, so it never had to fire |
| gate answer set | Headless sign-off was carried in prose, and prose consent gets paraphrased — Sonnet acted on it, Haiku re-summarised it. | works fixes a real stall — but not the F3 DNF (§05.2) |
| wall-clock breaker | §05.2. The two existing breakers count events, so neither sees a long round. Tripping routes to ship-triage instead of an external kill. | fired, mistuned see below |
### F3 — fixed, and I credited the wrong fix

Four fixes were aimed at this timeout. The first three improved the *failure* and left the *run* exactly as long. When F3 finally passed, I credited the fourth — the lane fix — and published it.

**That was wrong, and it was one directory listing away from being caught.** The passing run's build predates the fit-check: its receipt records no lane, and its workspace holds `wire.json`, `analyze.json`, `evaluate-r1.json` and a QA hunt report — the full eleven-gate pipeline. It also tripped the deadline breaker and finished anyway.

This is the ninth correction on this page and the fourth of one shape: *attributing a result to the mechanism most recently built, without checking that the mechanism was in the build.* It is precisely the failure the run receipt exists to make impossible, committed by the person who built the receipt.

**F3 · self-routed · sonnet-5 — the lane fix, measured properly**
| Build | Lane | Wall s | USD | Turns | Oracle |
|---|---|---|---|---|---|
| without fit-check | full (11 gates) | 997.0 | 5.850 | 101 | 9/9 |
| with fit-check | tiny | 820.8 | 4.826 | 84 | 9/9 |
| control (no harness) | — | 51.0 | 0.285 | 16 | 9/9 |
The mechanism does what it claims: the receipt records `lane: tiny` with all four checks passing, and the workspace contains no wiring, analysis, evaluation or QA artifacts — the pipeline genuinely shortened rather than merely being labelled shorter.

**And it is worth 18%. Not 80%.** A three-file change routed to the light lane still costs $4.83 and fourteen minutes against a control that does it for $0.285 in fifty-one seconds. Seventeen times the money for an identical 9/9 — and that is the light lane *working*.

**Settled:** the did-not-finish is gone, robustly — two independent passes, two different lanes, 997 s and 821 s against an 1800 s cap. **Not settled:** which fix earns the credit, at n=1 per configuration. **Unchanged:** the pilot's central result. Every fix here removed a defect; none made the ceremony pay for itself, and the lane designed for exactly this case closes about a fifth of a seventeen-fold gap.

The first three treated the timeout as a *budget* problem. It was a *sizing* problem: a three-file change — one new module plus one dispatcher wiring — was being run through an eleven-gate pipeline, and no amount of budget management makes that finish. **The harness's own fit-check had said so from the start.** The pilot transcripts have it calling the smallest feature "squarely inside the light lane" and then running the full pipeline anyway, because the lane was a judgment a model can talk itself out of. Same defect as narration, same defect as consent-by-prose, same remedy: move it into the runtime.

**And it cost more than ever**
**$5.85 — the most expensive run of this harness in the entire dataset, against a $0.285 control on the same feature. Twenty times.** The did-not-finish is gone and the ceremony tax is worse than it has ever looked. Those are two findings and they must not be quoted as one.

### Eight rows unscored, retroactively

Applying §05.5's lesson to the data rather than only to the prose: a row that produced **no run receipt** did not measure the harness. The scripts could not execute, the agent built the feature by hand, and the oracle scored the agent. Seven such rows existed — *two of them scoring 100%*, which is exactly why the rule has to be mechanical rather than a matter of noticing. An eighth was the truncated session. All are now recorded as unmeasured.

The discrimination is exact, and both sides of the before/after survive it: the three runs that left receipts stay scored at 100%, and the five that pre-date the receipt stay scored at 29%.

### A third pooling bug, same shape as the first two

With the fix in, the summary read `n=8, acceptance 29% [29–100]` — pooling the pilot build with the fixed one. The grouping key had gained the model (§05.3) and still lacked the **build**, because both reported the same version string: `git describe` cannot see uncommitted work. Two different tools under one label is how a summary pools them. The version now derives from the packaged manifest, and the record separates cleanly:

**The same cell, once the key is complete**
| Feature | Build | n | Acceptance | Escaped | Wall s | USD |
|---|---|---|---|---|---|---|
| F2 budgets · Haiku | v1.3.0 | 5 | 29% | 10 | 37.5 | 0.064 |
| F2 budgets · Haiku | v1.4.0 | 3 | 100% | 0 | 1740.8 | 2.305 |
| F3 wiring · Sonnet | v1.4.0 | 1 | 100% | 0 | 997.0 | 5.850 |

**A fourth fairness problem, found the hard way**
The three other harnesses install their machinery *into* the workspace, where a session runs it freely. This one ships its scripts with the plugin, outside the working directory, where executing them needs a permission grant. Read access had been equalised across arms long ago; nobody noticed **execute** had not been, because until now this arm's critical path did not depend on running anything — it depended on the model following prose, which is the failure these mechanisms exist to fix. Moving an invariant out of a prompt and into a script exposed a permission gap the prose version could not reach. The accommodation is what a real install produces, so running with it is the more faithful measurement, not the more generous one — but the asymmetry is real, and no competitor here pays it.

---

## 07 — What was thrown away

### Seven measurements discarded before any number was published

Roughly half the spend went on runs that were deleted. On a benchmark, debugging the measurement is not overhead — it is most of the work.

### Four of five adapters were wrong on the first attempt

The entry points came from real `init` trees only after documentation-derived guesses failed. `spec-kit` ships skills, not `/specify` commands. OpenSpec namespaces its commands `opsx`, and the bare `openspec` package on npm is an unrelated 0.0.0 placeholder. Each would have run a paid session against a harness that was never installed, and scored it as though it had been.

### A fairness fix that was nearly a contamination vector

One arm could not read its own instructions under the shared permission mode. The obvious fix — grant it read access to its development checkout — would have handed it `examples/todo-cli`, a complete working implementation of F1's exact deliverable, that no competitor had. It now runs against the packaged distributable, verified to contain no example implementations.

### A transcript-naming collision that overwrote the evidence

The transcript filename carried no harness version, so re-running the same cell at a new build silently overwrote the pilot's raw transcripts — the evidence behind published findings, recoverable only because the results directory happens to be under git. Every correction on this page came from re-reading retained runs. **The archive is the instrument**, and a naming scheme that can quietly overwrite it is not a cosmetic defect. Discarded and re-run under a version-tagged name.

### Three re-runs where the harness could not execute

§05.4 and §05.5. Three accommodations were tried and two failed silently; all three produced runs with no harness artifacts at all. They are kept in the discard log rather than deleted, because they are the evidence for the permission finding — and because two of them scored full marks while measuring nothing.

**The asymmetry worth naming**
Every one of these bugs happened to make the *author's own* harness look catastrophic, which is why each got investigated. That is not evidence of even-handedness — it is the danger. A bad result gets diagnosed; a flattering one gets published. The two v1.4 attempts that scored 14/14 and 9/9 while the harness sat inert are the proof: those would have been published as wins. Had the same bugs landed only on the competitors, nothing in the process would have caught them. The verification steps exist so the direction of the accident stops mattering.

---

## 08 — Limits

### What this does not show

Everything measured here fits in **one session and one context window**. The claims these tools actually make — surviving compaction, multi-session continuity, onboarding someone new, holding a large codebase coherent over weeks — are outside what this design can see. That is a real limitation of the benchmark, not a hedge, and not evidence against the tools.

What it does establish is narrow and, as far as I can tell, unpublished elsewhere: **for single-session features up to six files and five seams, on these two models, SDD ceremony cost 3–10× and produced no measurable quality difference against an acceptance suite the tools never saw.**
One number points at where to look next. The ceremony ratio narrows as features get harder — 5.4× on the simplest feature, 2.9× on the hardest. At n=1 that trend is not established, but it is the most interesting quantity in the dataset, and it says the next feature should be bigger rather than the next matrix deeper.

> **That last sentence was half wrong — §09 is what happened when it was tested.** Bigger bought nothing: a 12-file feature at ~4× F2 saturated exactly as the others did. What discriminated was *discontinuity* — cutting the session and handing the workspace to a fresh agent.

The features were also revised mid-flight: F2 was replaced with a harder five-seam version *after* F1 and F3 saturated, under an appended, timestamped amendment carrying the pilot data that motivated it. That is a deviation from the pre-registration, and it is recorded as one.

Finally, the v1.4 arm is **not the same arm as the pilot's**. It has different mechanisms and different flags, and every row carries its harness version so the two are never silently compared. The pilot's `shapeup-sdlc` numbers remain valid measurements *of the pilot's version*, and must be labelled with it wherever they are quoted.

30 scored runs · 8 unscored on inspection · 7 discarded · 28 transcripts re-read · `claude-sonnet-5` and `claude-haiku-4-5-20251001` — every number labelled with its model.  Protocol committed before run 1; every amendment appended and timestamped. Every raw transcript retained, which is why the corrections in §05 were possible at all. Harnesses under test: spec-kit, OpenSpec, cc-sdd, shapeup-sdlc, and no harness at all.  Pilot stage — n=1 on most cells. No ordering between harnesses is claimed.

---

## 09 — F4: the crossover, found

§08 said the next feature should be bigger rather than the next matrix deeper. That was half right,
and the half that was wrong is the more useful finding.

**Bigger did nothing.** F4 is a 12-file service with eight seams, two of them cross-cutting
invariants, run as a three-rung ladder up to ~4× F2. The no-harness control scored **100% at every
rung on both models** — 10/10, 18/18, 26/26, twice each on Haiku, and 26/26 twice on Sonnet. Eight
runs, eight perfect scores, zero escaped defects. A pre-declared kill gate closed the question for
**$3.54** — **no crossover up to 4× F2 on single-session features** — and the remaining
single-session volume was never bought.

**Discontinuity did everything.** Cut a session at a uniform 60 seconds, then hand the workspace to
a *fresh* agent — never a resume — with a one-sentence continuation prompt containing no requirement
text. Run the acceptance oracle at the cut and again after. Now the control cannot recover: it
closes 25% of the remaining gap where it closed 100% at a 90s cut, because at 90s it had already
written 21/26 criteria worth of code, and **code is externalised memory**.

### What predicts recovery is bytes on disk, not the tool

Every scored handoff row at the 60s cut, both models, all seven arms, split only on whether the
requirement reached a file before the interruption:

| | rows | **finished the feature** | gap closed (median) | **arms** |
|---|--:|--:|--:|--:|
| wrote a file (>0 B) | 12 | **6 / 12** | 97% | **2** |
| wrote nothing (0 B) | 20 | **0 / 20** | 19% | **5** |

**p = 0.048**, Fisher exact one-tailed, **at the arm level (n=7) — which is the defensible unit and
is right on the 0.05 boundary.** By row it is 0.001, and the row-level figure is what this report
originally implied. The 32 rows are not 32 independent draws: they cluster into seven arms, and only
*two* arms ever wrote a file, so the effective comparison is 2-that-wrote against 5-that-did-not.
Quoting the row figure overstated the effect by roughly 47×. This is pseudoreplication, it is the
single most likely thing to be caught in review, and it is corrected here in the table rather than in
a footnote.

**Zero of twenty.** Writing the requirement down before the interruption is *necessary*, across
seven arms, two models, and every ceremony level from none to eleven gates. It is *not sufficient* —
half the rows that wrote it still failed, because the second session must also spend its window
building rather than on ceremony.

Three of the four SDD harnesses under test are in the **zero-byte** group. `spec-kit`, `openspec`
and `cc-sdd` recovered no better than no harness at all (22%, 14%, 19%) because their pipelines had
not reached disk when the cut landed — at 1.5–3.9× the control's price.

By arm, on the model where the one-sentence trigger fires reliably:

| arm — Haiku 4.5 · F4/R3 · 60s cut · n=3 | gap closed | finished | wrote | $ A+B |
|---|---|--:|--:|--:|
| **`bare-intake`** — *"write it down first"* | **100%** [94–100] | 2/3 | 3.4 KB | **0.346** |
| `shapeup-sdlc` | 100% [0–100] | 2/3 | 3.2 KB | 1.598 |
| `bare-notes` — *"leave notes before you stop"* | 25% [9–33] | 0/3 | 0 B | 0.247 |
| `bare` | 25% [17–67] | 0/3 | 0 B | 0.230 |
| `spec-kit` | 22% [19–25] | 0/2 | 0 B | 0.566 |
| `cc-sdd` | 19% | 0/3 | 0 B | 0.351 |
| `openspec` | 14% | 0/1 | 0 B | 0.887 |

### It is worth one sentence

The artifact that did the work, read out of the winning `shapeup-sdlc` workspace, is `intake.md`:
**a near-verbatim copy of the prompt**, written as step one. At the cut that arm had one write and
no run receipt — the pipeline had not started. The eleven gates did not recover those runs; the
transcription did.

A seventh arm was added to test exactly that. `bare-intake` is the control plus one sentence —
*"Before you write any code, copy the requirement above into a file"* — and on Haiku it matched the
harness on every outcome axis, more stably (94–100 against 0–100), for **$0.35 against $1.60**.

**The cost of the win leads, because "the mechanism is real" and "this tool is worth paying for" are
different claims.** The author's arm did win the Haiku cell. It won at **4.6×** the price of a
one-sentence control that matched it, with a wider spread (0–100 against 94–100), and on the
stronger model it turned a reliably-written artifact into zero recovery three times out of three.
The mechanism SDD sells is real; the pipeline sold alongside it is not what delivers it.

The two control arms differ by one clause. `bare-notes` says *"before you stop, leave notes"* and
wrote **0 bytes in all five of its rows**, because a cut session never reaches "before you stop".
**Externalised memory written last is not externalised memory.** That arm was my own first
steelman, mis-specified in the direction that flattered my own tool, and publishing the harness's
win against it would have been publishing against a strawman I built myself.

### What does not reproduce on Sonnet

Two things, both published rather than buried:

1. The one-sentence trigger wrote the file on **3/3** Haiku runs but only **3/8** Sonnet runs. A
   mechanism that costs nothing also cannot be depended on — and reliably producing the artifact is
   a real thing a harness could sell.
2. **`shapeup-sdlc` did not convert it.** On Sonnet it wrote the file **3/3** and recovered
   **0/3**, its second session spending the whole 1800s window on gates, at **$9.25 per handoff
   against the control's $0.75.**

So the harness's measured edge is the *reliability of writing*, and on this evidence it converts
that into nothing, at twelve times the price.

### Three things the fairness machinery caught, all pointing the same way

F4-handoff is the first design in this project that the author's own tool was expected to **win**,
so the guards had to exist before the runs:

1. **The pre-declared decision metric would have inverted the gate.** Raw recovery points are
   bounded by how much an arm had left to do; the harness "won" 62 points to 19 while both had
   closed 100% of their own gap. `gap_closed` is the cut-invariant form.
2. **The wall-clock cap did not bind on the one arm that loads plugin hooks** — mine. A session
   capped at 60s ran for **950 seconds**. Three rows retracted; the cap is now enforced on the
   runner's own clock, with a `capOverrun` check that refuses to score any row exceeding it.
3. **The winning arm's artifact was a copy of the prompt**, which demoted the result from "the
   pipeline pays" to "writing it down pays".

None of these were caught by intent. They were caught because the run-evidence rule, the noise
guard and the artifact inspection were mechanical and ran on every arm — including, and especially,
on the author's.

108 sessions · ~$56 · `claude-haiku-4-5-20251001` and `claude-sonnet-5`, every number labelled with
its model · five rows retracted and documented · protocol amended before each stage, appended and
timestamped.

---

## 10 — Where this is

Four features and 151 rows have mapped a very small region of the space these tools operate in.
Here is what has actually been visited, what was found there, and the one direction that matters
and has never been travelled.

The axes are not arbitrary. They are the two conditions under which **externalised memory can
possibly pay**. If the agent still holds the requirement in its own context, writing it down is
transcription and pure cost — that is the horizontal axis, and F1 through F4-solo walked it by
making features bigger. If nothing ever interrupts the agent, the question never arises at all —
that is the vertical axis, and everything before F4 sat at zero on it.

```
  who chose          │                            ┌─ memory can fail here ──┐
  the interruption   │                            │                         │
        ↑            │                            │      ◌ F5 — the target  │
   the system        │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ↑ never measured ─ │
   (compaction)      │                            │      ╎                  │
                     │                            │      ╎                  │
   the author        │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ○────────┼──────●  cut @60s        │
   (wall-clock)      │              cut @90s   P4 sweeps this line          │
                     │                            │                         │
   nobody            │  ○ F1–F3   ○ F4 solo       │                         │
                     └────────────────────────────┴─────────────────────────┘
                       all of it  ── how much of the requirement survives ──▶  none of it
                                     in the agent's own context

   ● an effect was found     ○ searched, nothing there     ◌ not yet visited
```

Everything below the middle line is a benchmark with **no interruption in it**, which is where this
project spent its first three features and $58. The boxed region is the only place externalised
memory can pay, and the single point inside it that has been measured is the one §09's headline
rests on.

### Why the vertical axis is the one that matters now

Every interruption measured so far is a wall-clock number **I chose** — 60 seconds, 90 seconds.
That is why the result is fragile: at 90s the control recovers everything and the finding vanishes.
The interruption these tools are built for is **context compaction**, which fires when the window
fills, far later, and at a moment nobody selects. It is also the only condition under which
`shapeup-sdlc`'s two continuity hooks can fire at all — §09 established mechanically that they
cannot fire across a fresh-session handoff.

### Where the horizontal axis actually is — and how thin the evidence is

Two measured points, 30 seconds apart, with opposite results. The curve between them is the
finding; right now it is an assumption.

| Cut | Arm | n | Gap closed | Finished | Status |
|---|---|--:|---|--:|---|
| 60 s | `bare` | 3 | 25% [17–67] | 0/3 | **measured** |
| 60 s | `bare-intake` | 3 | 100% [94–100] | 2/3 | **measured** |
| 90 s | `bare` | 2 | 100% [100–100] | 2/2 | **measured** |
| 30 / 45 / 75 / 120 s | both | — | *unmeasured — this is what P4 buys* | — | planned |

Three solid points is the entire empirical basis for §09's headline, and the two `bare` points
thirty seconds apart **disagree completely** — 25% against 100%. P4 measures the four missing cuts
on both arms, which turns an assumed shape into a located crossing. If the two lines never
separate, §09's headline is retracted for about $11.

### What "where we are" honestly amounts to

One feature, one rung, one model for most of it, three measured points on the axis that carries the
claim, and an effect whose supporting statistic is **p≈0.048 at the arm level** rather than the
p≈0.001 a row-level count implies. The mechanism is real, and this is the first time this project
has been able to support any mechanism claim at all. The confidence interval around *where* it
applies is much wider than §09's prose suggests, and the map above is the honest picture of that.

---

## 11 — P4: auditing our own headline, and retracting part of it

P4 exists to attack §09's result on two specific counts — a headline resting on **one arbitrary cut
point**, and a p-value quoted at **the wrong unit of analysis**. The sweep that settles the first is
still running. Three things are already settled, and two of them are worse than the thing being
audited.

### The statistic is corrected, and it cost nothing

Fixed in §01 and in the results table above, before any new run: **p = 0.048 by arm (n=7)**, not the
0.001 a row-level count implies. The 32 rows cluster into seven arms and only *two* arms ever wrote a
file, so the effective comparison is 2-that-wrote against 5-that-did-not — right on the 0.05
boundary. Quoting the row figure overstated the effect by roughly 47×.

This was the one item in P4 that is strictly a *fix* rather than an improvement, so it shipped
independently of whether anything else ran. `runner/stats.mjs` now computes both units exactly, from
the rows on disk, and prints the arm count beside every pooled claim in both output formats.

### The author's own harness was shipping an inert enforcement layer

Found by reading the transcripts of this benchmark's *worst* result for that arm — the three Sonnet
rows that wrote the artifact 3/3 and closed 0/3 of the gap — and asking what they spent 82–120 turns
on before writing anything. The answer was forensics against their own bootstrap: `init-run.mjs`
retried six ways, five permission refusals while trying to capture an exit code, and finally
`find /` searching for their own skill.

Twenty-six of the plugin's scripts and hooks gated their entire body on a comparison between
`import.meta.url` and a path built from `process.argv[1]`, in two different spellings. Both are false
under any symlinked directory — and on macOS `/var` is a symlink to `/private/var`, which makes every
path under the system temp directory a failing path. **That is exactly where this benchmark installs
the packed plugin.**

| `init-run.mjs` (GATE L0.1) invoked via | result |
|---|---|
| its real path | writes the run receipt, prints it, exit 0 |
| a symlinked directory | **writes nothing, prints nothing, exit 0** |
| a path containing a space | **writes nothing, prints nothing, exit 0** |

The sharpest case is `validate-envelope.mjs`, a `PreToolUse` hook the plugin's own documentation calls
the mechanism by which *"a malformed envelope is denied by hook before it reaches a worker"*. Given a
dispatch against a dangling order file, by its real path it emits `deny`; by a symlinked path it
emits **nothing**, which the CLI reads as allow.

The full finding is F-16. Three things it deliberately does not do:

1. **It does not retract anything.** Every published v1.4.0 figure stands as measured — those rows are
   honest measurements of the tool as installed, and identifying a cause is not a correction.
2. **It does not explain the recovery failure.** The defect accounts for ~25 wasted tool calls of
   bootstrap forensics. It does not account for eleven gates. A re-measure is pending, and the
   prediction registered *before* that run says gap closed on Sonnet stays at 0/3.
3. **It sharpens §09 rather than softening it.** The competitor arms carry no such defect, and
   `bare-intake` — one sentence, nothing installed, nothing to mis-resolve — closed 100% of the gap
   at the 60 s cut for $0.26. A tool whose advantage over one sentence depends on eleven gates
   executing has more ways to fail than a tool that has no gates.

There is a control case in the same repository: the plugin's *extracted* enforcement kit
(`anti-lying-kit`, three hooks) carries **no main guard at all**, and all three of its hooks execute
correctly by every path tested. The guard existed so a test could `import` a script without running
`main()` as a side effect — a real need, satisfied in a way that introduced a failure mode the need
never had. A testability affordance became the thing that stopped the code from running.

### Five more instrument defects, all of one family

Every correction this project has published has had the same shape: **a figure whose referent is not
the thing it appears to describe**, caused by one missing term in an identity key. P4 found five more,
bringing the count to nine. Four were caught before they touched a published number; one had already
destroyed evidence.

| # | The missing term | What it would have produced |
|---|---|---|
| 5 | the pack cache was never invalidated | a re-measure of the *old* build, convincingly labelled as the new one |
| 6 | the `gap` figure's denominator is not the cell's `n` | `n=3 · gap 0%` where one row of three had a gap to close |
| 7 | `harness_build` was in the grouping key and **nothing ever wrote it** | v1.4.1 rows pooling into the published v1.4.0 cell — a fix averaged with the defect it fixed |
| 8 | the write rate pooled a calibration probe with experiment rows | one denominator spanning two different questions |
| 9 | the transcript stamp had no **cap** | 20 transcript paths overwritten; one published file found at 98 KB where git held 370 KB |

Defect 9 predates P4 — F4 already ran a 60 s and a 90 s cut against that stamp — and the sweep merely
widened it from two colliding cuts to six. No published *number* was affected, because the runner
computes diagnostics inline and stores them on the row; nothing here was ever read out of a
transcript file. What was destroyed is the ability to read a run back, which is precisely how F-16 was
found. Twelve rows were retracted to `transcript_collided` and re-run, and the overwritten files were
restored from git — recoverable only because `results/` happens to be tracked, which is luck, not a
design. Retention no longer depends on the stamp being right: a colliding write now lands beside the
earlier file instead of on top of it.

Two of the five were introduced *during* P4, by the same hand that had just documented the previous
one. Both were caught by writing the rule down as a check rather than by being more careful, which is
the same argument the plugin fix rests on and the reason it is stated here rather than quietly fixed.

### The sweep reported: BRANCH B, and the retraction is narrower than the name

The six cut points were frozen in `PROTOCOL.md` and in code — `sweep.mjs --caps` selects from the
list and cannot extend it. The gate rule, `runner/gate-s1.mjs`, was **committed before the data it
decides on existed**, and `runner/p4-pipeline.sh` branches on its *exit status* rather than on
anyone's reading of the curve. There was no threshold left to move at the moment of decision.

It returned branch B. The run stopped at **$13.41**, with roughly **$95 of the authorised envelope
unspent**.

| cut | `bare` gap closed | `bare-intake` gap closed | **write rate** | separates? |
|---|---|---|--:|---|
| 30 s | 0, 0, 0 | 19, 0, 19 | **0/3** | no |
| 60 s | 19, 19, 19 | 100, 19, 19, 0, 19, 19, 19, 100 | **3/8** | no |
| 90 s | 0, 44, 67 | 100, 100, 19, 100, 100 | **4/5** | no |

**On Sonnet 5 there is no cut at which the two arms can be ordered.**

> **Disclosure.** The 90 s `bare-intake` cell gained two rows *after* the gate was called, from a
> second sweep process left running from an earlier session and killed four minutes later. The rows
> are valid — same runner, same frozen cut, same build, same oracle — and are kept under Q3.
> Re-run against the complete cell the gate **still returns branch B**. The statistic below moved
> *in the author's favour* as a result, which is why this is a dated entry in `PROTOCOL.md`
> (2026-07-29) rather than a silent restatement.

### The arm is not the mechanism

`handover_bytes` records per row whether the file was *actually written*. It is published beside the
recovery only because invariant Q4 demanded it, and that is the sole reason the next table exists.
Conditioning within `bare-intake`, on Sonnet:

| Sonnet, `bare-intake`, 60 s + 90 s | gap closed |
|---|---|
| **wrote the file** (n=7) | 100, 100, 100, 100, 100, 100, **0** |
| **did not write** (n=6) | 19, 19, 19, 19, 19, 19 |

**p = 0.004** (n=13; Fisher exact, one-tailed, success = gap closed ≥ 94%) — **within one arm and
one model**, so neither K1's arm-clustering nor §6's model-pooling applies. The six rows that did not
write closed *exactly* 19%, six times out of six: the figure `bare` posts at that cut. When the
sentence does not fire, `bare-intake` **is** `bare`.

`bare-intake` is not a mechanism. It is a one-sentence **trigger** for one, and it fires
probabilistically — **3/3 on Haiku, 3/8 on Sonnet**. An arm-level comparison therefore measures the
effect *multiplied by the trigger's reliability*. At 3/3 that dilution is invisible and the arms
separate cleanly, which is what §09 saw. At 3/8 it destroys any orderable separation while leaving
the underlying effect untouched.

**Retracted:** any reading of §09 in which *choosing the `bare-intake` arm* buys recovery on Sonnet,
and P4's own curve-per-arm framing, which could only ever see the product of the two.
**Not retracted:** §09's actual published sentence, which was always about files and never about
arms — and which this data supports more strongly than §09's own did.

Branch H fired alongside it: at 60 s Haiku's arms **are** disjoint ([17–67] against [94–100]) and
Sonnet's are not. Both are published, neither pooled. That split is exactly what the deleted **S4**
stage existed to buy for $25; moving the sweep to Sonnet produced it for nothing.

### A prediction of the author's died here, on the first cell that could kill it

Hours before these cells were bought, a **turn-threshold hypothesis** was registered: every first
write in the record landed at turn ≥ 19, so the cut in *seconds* might really be buying a *turn*
budget. A 90 s row then wrote at **turn 16**. Prediction 1 is refuted and recorded as refuted.
Prediction 3 — that the instruction buys no *promptness*, only different content — survived. The
third named cells that branch B means are never bought, and is recorded unresolved rather than
quietly dropped.

**What was deliberately not bought.** `n` was **not** raised at 90 s to resolve the overlap. Raising
reps after seeing which way an overlap fell is the exact move pre-registration exists to prevent.

One number is worth keeping as a caution about n=3: two independent sets of three `bare` runs at the
*same* 30 s cut produced gap-closed medians of 13% [0–19] and 0% [0–0]. The first was retracted for
the transcript defect and re-run, which is the only reason both exist — and the spread is a reminder
that a three-run cell locates a range, not a point.

### The fix to my own harness works exactly as predicted, and buys nothing

The defect above was fixed, the fix was verified, and the re-measure was **registered before it
ran** — including the prediction that recovery would not move. Stage R, n=3, $28.01, Sonnet 5, the
same 60 s handoff.

| Sonnet 5, 60 s handoff, session B | **v1.4.0** (n=3) | **v1.4.1** (n=3) |
|---|---|---|
| `turns_to_first_write` | 94, 82, 120 | **25, 58, 20** |
| **gap closed** | 0, 0, 0 | **0, 0, 0** |
| session B cost | $8.77, $10.36, $4.57 | $7.99, $9.20, $8.42 |
| last gate reached | L4, L1a, H | L1a, L1a, L1a.5 |

Two of three registered predictions confirmed, one refuted, all scored as written:

1. **`turns_to_first_write` leaves the 82–120 band — confirmed**, disjoint ranges. Roughly sixty
   turns of bootstrap forensics per run are gone. This is the mechanical proof the fix reached the
   *measured* path and not merely the test suite.
2. **Session-B cost falls — refuted.** Medians $8.77 → $8.42, ranges overlapping. Forensics is
   billed, so removing it should have shown in the bill; instead the freed turns went straight into
   pipeline work. The money moved, it did not leave.
3. **Gap closed stays 0/3 — confirmed.**

The gate column is the part worth reading twice. **All three fixed runs consumed the entire 1800 s
window and reached only the orient and wiring gates**, while the broken build reached L4 and H —
because it was broken, and the row that got furthest did less, finishing in 921 s. *Fixing the
bootstrap made the tool run its pipeline properly, and running it properly is what does not fit in
the window.*

**Why no further fix is attempted.** The plugin already owns a `--tiny` lane and a `fit-check` that
computes which lane a change belongs in. On this exact intake it returns `lane: "full", confidence:
"clear"` — 11 source files, a 3499-character intake. It is not misrouting; it is correctly
classifying a 12-file service with eight seams as full-lane work. Moving that threshold so this
feature lands in the tiny lane would make the number go up and would be **tuning the tool to the
test**. The limitation is the design, and it is published as one.

**A real defect, correctly diagnosed and correctly fixed, can leave the measured outcome exactly
where it was.** The finding about the inert enforcement layer was right about everything. It simply
was not what stood between this tool and a recovered feature — and the only reason that sentence
carries any weight is that it was registered before the $28 that confirmed it.

---

*§11's sweep is complete and its branch is called: **B**.* Every §01–§10 figure is final and
unaffected. One P4 stage remains in flight — the `shapeup-sdlc` v1.4.1 re-measure, which sits
outside the S1 gate on its own registration — so the arm-level v1.4.1 figures are not yet in.
Twelve P4 rows are retracted to `transcript_collided` and excluded from scoring; the reason is above
and in `DISCARDED-RUNS.md`.

At the time of writing: 98 scored runs · 4 features · 7 arms + 3 writer controls · 219 rows ·
148 transcripts retained · `claude-sonnet-5` and `claude-haiku-4-5-20251001`, every number labelled
with its model · F4 alone was 108 sessions and ~$56 · **$42.62 of P4's fresh $150 envelope spent** —
the sweep $14.61, stage R $28.01. The kill gate stopped the sweep, not the budget.
