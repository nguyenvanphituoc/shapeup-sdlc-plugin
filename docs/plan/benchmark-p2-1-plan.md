# P2-1 Plan — The SDD Harness Benchmark

- **Item:** §6 P2-1 of `docs/research/market-position-and-growth-2026.md` (status ⬜)
- **Deliverable:** a standalone public repo (`sdd-harness-bench`) that runs the same features
  through this harness / spec-kit / OpenSpec / cc-sdd and reports wall-clock, tokens, first-pass
  verdict rate, and escaped defects.
- **Precedent:** `cameronsjo/spec-compare` reached 92★ as pure research with *no* measurements —
  only a feature matrix. A measured benchmark is strictly stronger content.

---

## 0. The model question, answered first

**Yes — and cheap models are not a compromise here, they are the correct choice for three of the
four roles.** But the roles must be separated, because only one of them is a controlled variable.

| Role | What it does | Model | Why |
|---|---|---|---|
| **R1 — Model Under Test (MUT)** | the agent that actually drives each harness | **Sonnet 5**, identical across all four harnesses | This is the *one* variable that must be held constant. It is also where ~95% of the budget goes. |
| **R2 — Benchmark runner code** | Node scripts: spawn, timer, token parser, oracle, report gen | **Haiku 4.5 / Sonnet 5** | Mechanical scripting against a known contract format. No judgment required. |
| **R3 — Escaped-defect oracle** | decides pass/fail on the hidden acceptance suite | **no model at all** — deterministic `process-oracle.mjs` | A model judge is the single biggest credibility hole. Do not open it. |
| **R4 — The written analysis** | the README that is the actual product | **you**, with one Opus/Sonnet drafting pass | ~30k tokens total. This is the part worth paying for; it is also the part that gets read. |

**Opus is not needed anywhere in P2-1 except optionally R4.** The report itself (§5, §7 risk 4)
says the scarce asset is an *honest* number, not an impressive one — and honesty is produced by
the oracle design, not by model tier.

### The one real constraint on going cheap

Do not run the MUT on Haiku *as the headline row*. If the MUT is too weak, a harness can fail for
reasons that have nothing to do with its design, and the benchmark silently measures "Haiku cannot
sustain an 8-gate pipeline" while claiming to measure harness quality. That is the same class of
error as the four traps already documented in `evals/README.md` — a broken measurement that looks
like a result.

Sonnet 5 is the floor for a defensible headline. **Haiku 4.5 belongs in the benchmark as a
deliberate second row, not as a cost dodge** — and it is a genuinely marketable one:

> *"Which of these four still produces a passing feature when you run it on a cheap model?"*

Nobody has published that, it directly answers the "$2,000/mo/dev" objection quoted in §3, and it
costs a third of a Sonnet row to add.

### Budget

Cost is driven almost entirely by `features × harnesses × repetitions` full agent runs.

| Configuration | Runs | Est. cost (Sonnet 5 MUT) | Est. cost (Haiku 4.5 MUT) |
|---|---:|---:|---:|
| **Pilot** — 1 feature × 4 harnesses × 1 rep | 4 | ~$5–12 | ~$2–4 |
| **Core** — 3 features × 4 harnesses × 3 reps | 36 | ~$45–110 | ~$15–35 |
| Core + Haiku second row | 72 | — | +~$15–35 |
| *(Opus MUT, for reference — do not do this)* | 36 | *~$300–800* | — |

Assumes ~150k–400k tokens per full harness run on a small feature. **Run the pilot first and
re-derive these numbers from measured token counts before committing to the core matrix** — the
benchmark should measure its own cost before it measures anything else.

**Three repetitions is not optional.** Agent runs are stochastic; `n=1` per cell is an anecdote,
and a benchmark published off `n=1` will be correctly dismissed. If budget forces a cut, cut
*features* (3 → 2), never repetitions. Report median with full range, never a bare mean.

---

## 1. What must be frozen before a single run

Pre-registration is the credibility mechanism. Everything in this section is committed and
timestamped **before** the first measured run, in `PROTOCOL.md`.

### 1.1 The features (3)

Chosen to be small enough to run cheaply, and to include the failure mode this harness uniquely
claims to catch. All three are CLI/library-shaped so the oracle is a deterministic process probe
and no browser is involved.

| # | Feature | Why this one |
|---|---|---|
| **F1** | A todo CLI: add / list / done / rm, JSON store | Baseline greenfield. `examples/todo-cli/` already has a contract; **it must be rewritten from scratch** for the benchmark so this repo has no head start. |
| **F2** | Add a `--due <date>` filter to an *existing* small codebase | Brownfield delta. OpenSpec's stated strength (§1) — include the axis where a competitor should win. |
| **F3** | A feature with a deliberate wiring trap: an engine that must be reached from the CLI entry point | The escaped-defect axis. §3 item 6 claims the traceability spine catches "built but never wired". This is where that claim gets tested — or falsified. |

Each feature ships as **one prompt file**, given verbatim to all four harnesses. No per-harness
prompt tuning. The prompt is written in each harness's *own* idiom only where the tool requires
it (spec-kit wants `/specify`, OpenSpec wants a change proposal) — the requirement text is
byte-identical.

### 1.2 The metrics

| Metric | How measured | Model-free? |
|---|---|---|
| Wall-clock | monotonic timer around the whole session | ✅ |
| Total tokens + USD | parsed from each CLI's own session accounting | ✅ |
| Human interventions | count of turns where the run stalled and needed a human reply | ✅ (logged by runner) |
| **First-pass acceptance** | hidden contract suite run once, on the first artifact the harness declares "done" | ✅ deterministic |
| **Escaped defects** | criteria in the hidden suite that fail *after* the harness reports success | ✅ deterministic |
| Reachability | does the entry point actually reach the new code (static call-graph check) | ✅ deterministic |
| Setup cost | time from `git clone` to first prompt accepted, on a clean container | ✅ |

### 1.3 The oracle — the most important design decision

**The judge is a hidden, declarative contract suite, never a model and never any of the four
harnesses.** Reuse `scripts/shapeup-sdlc/oracles/process-oracle.mjs` (already the shared runner
behind `oracle: process` criteria) but **vendor it into the benchmark repo as a standalone
~200-line file** with no dependency on this plugin, so a reader can audit it in one sitting.

Rules:
- The contract JSON is written **before** any run and is **not** shown to any harness.
- It is published in the benchmark repo *after* results, alongside every raw transcript.
- Escaped defects are defined as: criteria that fail on an artifact the harness itself called done.
  This deliberately measures *self-report honesty*, which is the axis §4.6 says does not erode.
- The `spec-evaluator` and `qa-edge-hunter` skills **do not judge anything** in this benchmark.
  Their outputs are inputs (they are what "first-pass verdict" means for this repo's row), never
  the scoring function. Anything else is self-grading.

---

## 2. Phases

### Phase A — Protocol + pilot (≈1 day, ~$10)
1. Create `sdd-harness-bench` repo. Write `PROTOCOL.md`: features, metrics, oracle, model matrix,
   repetition count, conflict-of-interest statement. **Commit before running anything.**
2. Vendor the process oracle; write the F1 contract.
3. Build the runner skeleton (R2 — Haiku/Sonnet): fresh temp dir per run, per-harness adapter,
   timer, token parser, JSONL result log. Model this on `scripts/shapeup-sdlc/trigger-eval.mjs`,
   including its abort-rather-than-fabricate discipline: **a run that produces no parseable
   session events writes nothing.**
4. Install all four harnesses in a clean container; record setup friction verbatim as it happens
   (this is a metric *and* the most quotable content in the writeup).
5. Run the F1 pilot: 1 rep × 4 harnesses on Sonnet 5. Re-derive the budget from real token counts.

**Gate A:** the pilot produced four completed runs and four oracle scores. If any harness could
not be driven at all, that is a finding — but fix the adapter before proceeding, not the result.

### Phase B — Core matrix (≈2 days mostly unattended, ~$45–110)
6. Write F2 and F3 fixtures + contracts.
7. Run 3 features × 4 harnesses × 3 reps on Sonnet 5. Runs are background-able; log everything.
8. Optional Haiku 4.5 row (+~$15–35) — the "does it survive a cheap model" axis.
9. Aggregate: median + range per cell, all raw transcripts committed.

**Gate B:** every cell has ≥3 completed reps or a documented reason it does not. No cell is
silently dropped.

### Phase C — Publication (≈1 day, ~$0)
10. Write the README (R4). Structure: method → results tables → **where this harness lost** →
    caveats → reproduction instructions → "PR the adapter if I ran your tool wrong".
11. Charts: cost-vs-acceptance scatter, escaped defects per harness, setup friction bar.
12. Cross-link from the main repo README; this feeds P2-3 (Show HN) as evidence, not as the lead.

---

## 3. Credibility guardrails

The author benchmarking his own tool is the obvious objection, and §7 risk 4 says the eval
integrity is this project's scarcest asset. Spend it carefully:

1. **Pre-register.** `PROTOCOL.md` committed before run 1, referenced by hash in the results.
2. **Publish losses.** Commit in `PROTOCOL.md` to publishing every cell regardless of outcome. If
   this harness loses on wall-clock and tokens — which it very likely will, it is the heaviest of
   the four — **lead with that**. A benchmark where the author's tool wins every column is not
   read as a benchmark.
3. **Deterministic oracle only.** No LLM-as-judge anywhere.
4. **Use each competitor per its own docs**, pin versions, link the exact commands used.
5. **Invite correction.** A `harnesses/<name>/adapter.mjs` per tool plus an explicit "if I drove
   your tool wrong, open a PR" — turns the strongest attack into contributions (and into P3-3's
   contributor count).
6. **Declare the conflict** in the first paragraph, not a footnote.
7. **Label the model everywhere.** Every number carries its MUT. An unlabeled agent benchmark
   number measures nothing — the same rule `evals/README.md` already enforces for trigger evals.

---

## 4. Honest risks

| Risk | Mitigation |
|---|---|
| This harness loses on speed and tokens | Expected — it is the heaviest. Frame the axes it should win (escaped defects, reachability, self-report honesty) and publish the losses plainly. If it *also* loses those, that is the most valuable thing P2-1 can tell you, and it is cheaper to learn now than after a Show HN. |
| n=3 is still noisy | Report median + range, never a bare mean. Widen reps on any cell whose range is wider than the between-harness gap it is being used to claim. |
| 4 different install paths (uv, npx ×2, plugin) are fragile | Containerize; pin versions; the friction itself is a published metric. |
| Scope creep into 6 harnesses × 5 features | Hard cap: 3 features, 4 harnesses. Extensions are follow-up PRs. |
| Benchmark leaks into the launch critical path | P2-1 does **not** block P2-3. Order per §6: release cut → P0-6 sends → P0-4/P1-4 → P2-3. P2-1 is the *second* content beat, and works better as a follow-up post anyway. |

---

## 5. Bottom line

- **Sonnet 5 as the model under test, held constant. Haiku 4.5 as a deliberate second row.**
  Opus nowhere except optionally drafting the writeup.
- **Total: ~$60–150 and ~4 working days**, versus ~$300–800 if the MUT were Opus.
- The expensive part is 36 agent runs, not the code — so the savings come from choosing the MUT,
  not from writing the runner more cheaply.
- The oracle must be deterministic and hidden. That single decision is worth more to the
  benchmark's credibility than any model upgrade could buy.

---

## 6. Execution status — 2026-07-26

**Phase A complete. Gate A met.** Repo built at `../sdd-harness-bench` (local git, 5 commits,
nothing pushed). ~$25 spent, of which roughly half went on discarded runs.

Built and verified: pre-registered `PROTOCOL.md` (committed before run 1), a deterministic
dependency-free oracle with a self-test that blocks the runner if it cannot discriminate, F1 and
F3 features with hidden contracts and correct/defective references, five adapters, a session
driver implementing the anti-fabrication rules, a matrix runner and an aggregator that refuses to
claim an ordering below n=3.

**A `bare` no-harness control arm was added** beyond the original plan. It turned out to be the
single most important decision in the design — see below. Matrix is therefore 3 × 5 × 3 = 45 runs.

### What the pilot measured (n=1, `claude-sonnet-5`)

| Feature | `bare` | `openspec` | `cc-sdd` | `spec-kit` | `shapeup-sdlc` |
|---|--:|--:|--:|--:|--:|
| F1 acceptance | 13/13 | 13/13 | 13/13 | 13/13 | 13/13 |
| F1 cost | **$0.245** | $1.807 | $1.333 | $2.607 | $2.341 |
| F1 wall | **51s** | 432s | 305s | 524s | 489s |
| F3 acceptance | 9/9 | 9/9 | 9/9 | 9/9 | **did not finish (1800s)** |
| F3 cost | **$0.285** | $1.269 | $2.407 | $2.685 | — |

Every arm that finished scored 100% on both features, with zero escaped defects. The no-harness
control was cheapest and fastest every time, by 5–10×. On F3 `shapeup-sdlc` ran past the 30-minute
cap — roughly 35× the control's wall-clock — and produced nothing scored.

### What this changes about the plan

1. **F1 and F3 do not discriminate between harnesses.** Everything hits the ceiling, so paying for
   n=3 on them buys precision about a tie. Their remaining value is pricing ceremony, which n=1
   already does adequately.
2. **The escaped-defect axis found no escaped defects.** The orphaned-engine failure did not occur
   naturally at this size on this model — it had to be planted by hand to exist. That bounds where
   the failure mode is real; it does not disprove it. Detecting it needs a materially harder
   feature (multi-file, multi-seam), not more repetitions of an easy one.
3. **The honest headline available today is not the one the plan anticipated.** It is *"for small
   well-specified features, SDD ceremony costs 5–10× and buys nothing measurable"* — a finding that
   argues against this repo's own product. Pre-registering before knowing that is what makes it
   publishable rather than suspicious.
4. **Risk 1 of the market report is now measured, not theorized.** "Complexity is the real product
   risk" showed up as a hard timeout against a 51-second control.

### F2 rebuilt and run (2026-07-27)

Per the Gate A decision, F2 was replaced with a genuinely harder feature (6-file seed, five seams,
one requirement buried inside an existing file) and piloted. `PROTOCOL.md` §9 carries the
amendment, appended before the run with the pilot data that motivated it.

| Feature | `bare` | shapeup-sdlc | cc-sdd | spec-kit | openspec |
|---|--:|--:|--:|--:|--:|
| F2 acceptance | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 |
| F2 cost | **$0.656** | $1.922 | $4.107 | $3.402 | $2.591 |
| F2 wall | **134s** | 396s | 644s | 647s | 774s |

It saturated too. Every arm found the forgettable seam; the control found it in 134 seconds.
`shapeup-sdlc` finished comfortably here and faster than three competitors, which is worth saying
given it timed out on F3.

**Final pilot state: 3 features, 14 completed runs, every arm 100%, zero escaped defects anywhere,
`bare` fastest and cheapest every time by 3–10×.** The ratio narrows as features get harder
(5.4× → 2.9×) — the only hint of a crossover, and the reason the next feature should be bigger
rather than the next matrix deeper.

Published lead, per the decision to report it plainly: *on features this size the methodology is
overhead.* The scope limit is stated equally plainly — everything here fits in one session, so
compaction survival, multi-session continuity and long-horizon coherence are outside what this
design can see.

### Superseded — the original recommendation

Spending the remaining ~$75 on the matrix as pre-registered would buy n=3 on two features already
known not to discriminate. The better spend is a **harder F2**: multi-file, several seams, a
genuine opportunity to leave an engine unwired — the conditions under which any of these harnesses
could plausibly beat doing nothing. If nothing beats `bare` there either, that is the real finding
and it is worth far more than three decimal places on a tie.

Any change to features is a `PROTOCOL.md` §9 amendment, appended and timestamped, with the pilot
results that motivated it stated as the reason.
