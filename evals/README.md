# Evals — the evidence layer (repo-only, dev/CI)

This directory is the **real** version of the evidence layer the prior roadmap claimed had
"LANDED" but never committed (audit finding **F1**). It is a repo-only dev/CI asset — not shipped
to installs.

## Tier 1 — Trigger evals (Stage C1)

**Datasets** live next to each skill: `skills/<name>/evals/trigger-evals.json` — ~11–12
`{query, should_trigger}` cases each, every dataset mixing positives (queries that *should*
activate the skill) with **cross-skill hard negatives** (a sibling skill's queries, tagged
`expected_other`) and one out-of-harness control. **149 cases across 13 skills** today (74
positives / 75 negatives). The negatives are the point: a description that triggers on its own
examples but *also* steals its siblings' is not actually discriminating.

**Harness:** `tools/trigger-eval.mjs`.

```bash
# Inventory only — no auth, safe in CI: refresh the baseline's dataset counts.
node tools/trigger-eval.mjs

# Measure — needs Claude auth + the plugin installed. Runs every case, detects REAL Skill-tool
# activation, writes a measured baseline with method + timestamp.
node tools/trigger-eval.mjs --measure \
  --model claude-sonnet-5 [--concurrency N] [--max-turns N]
```

> **Always pass `--model` explicitly.** A full run is 149 headless sessions of up to 8 turns each —
> roughly **$18 on Sonnet 5** ($3/$15 per MTok; ~$12 at the introductory $2/$10 through 2026-08-31),
> against ~$6 on Haiku 4.5 — spent in the background where it is easy not to notice.
>
> **`claude-sonnet-5` is the model for every eval layer in this repo**, so one model explains every
> number in this directory. The cost of that consistency is stated rather than hidden: it is 3× the
> older Haiku figure for a layer that measures *activation*, not quality. That trade was made
> deliberately — a cheaper number that cannot be compared against the quality layers costs more to
> interpret than it saves to produce.
>
> **Consequence, stated plainly:** the committed trigger baseline was measured on Haiku 4.5 on
> 2026-07-26. **A Sonnet-5 run does not update it — it starts a second one.** Trigger rates are
> model-dependent; a Sonnet number placed beside the Haiku number is not a regression signal, and
> the first Sonnet run establishes a new baseline with no history behind it.

### What "activation" means here, exactly

One probe = one headless session: `claude --plugin-dir . -p "<query>" --max-turns 8`, scanning
the stream for a `tool_use` named `Skill`. A skill counts as activated when that tool fires for
it within the turn budget. Two normalizations, both deliberate:

- **Namespace stripping.** The CLI reports plugin skills as `shapeup-sdlc-plugin:<name>`, and
  the input field is `input.skill` (not `skill_name` — the detector was wrong about this until
  it was checked against a live stream).
- **Command aliasing.** The phase commands (`/eval`, `/qa`, …) also surface through the `Skill`
  tool, so a wrapper firing counts for the skill it delegates to. A wrapper firing on the
  *wrong* query still scores as a false positive, so this never launders a misfire.

**Baseline:** `evals/baselines/trigger-evals.baseline.json`. Ships as `status: "unmeasured"` with
`results: null` — **on purpose**. Per F1, no TPR/FPR number is written until a real run produces
it. The structural test enforces this: an `unmeasured` baseline with fabricated results fails CI.

### Honest measurement — the four traps this harness avoids

Traps 3 and 4 were found the hard way, by running the harness for real and refusing to publish
the first two baselines it produced. Both had fabricated a low TPR from a measurement bug.

1. **The proxy-artifact trap (the prior TPR≈0).** The earlier measurement counted slash-command
   self-invocation, not `Skill`-tool activation, so it measured nothing real. This harness detects
   an actual `tool_use` named `Skill` in the model's output, with the plugin installed
   (`--plugin-dir .`). Override the invocation with `TRIGGER_EVAL_CMD` (placeholders `{{query}}`,
   `{{root}}`) if your CLI differs.
2. **The broken-harness trap.** If a measurement run produces no parseable model events (CLI
   missing, not authed, plugin not loadable), the harness **aborts and writes nothing** rather than
   recording every case as a non-trigger. A broken harness must look broken — never like a real
   "0% trigger" result. That conflation is precisely what made the prior baseline fiction.
3. **The errored-probe trap.** A probe that hits a rate-limit or API error and shows no
   activation is **unmeasured**, not a miss. Scoring it as a miss is how the first real run
   produced a flat TPR 0 for nine skills whose solo re-runs activated fine. Errored probes now
   retry once and then abort the whole run. That baseline was reverted, not published.
4. **The turn-budget trap.** The cap defines what is being measured. At `--max-turns 2` the
   model routinely announces "I'll run the breadboarding step", orients for a turn or two, and
   calls `Skill` at turn ~5 — scoring as a miss. `breadboard the checkout flow` measures TPR 0
   at cap 2 and activates cleanly at cap 6. The default is **8**; lowering it to save tokens
   changes the result, so the cap is recorded in the baseline's `method` string.

`measured_at` / `model` are taken from the environment (`TRIGGER_EVAL_AT`, `TRIGGER_EVAL_MODEL`),
not invented by the script.

## Measured baseline — 2026-07-26, Haiku 4.5

149 cases (74 positives / 75 cross-skill hard negatives), `--max-turns 8`, `--concurrency 4`,
`--model claude-haiku-4-5-20251001`. Full data:
[`baselines/trigger-evals.baseline.json`](baselines/trigger-evals.baseline.json).

**The clean result: FPR = 0. Zero false activations across all 75 hard negatives.** That is the
number this dataset was built to produce — every negative is a *sibling skill's* query, so the
question it answers is "do these thirteen descriptions steal each other's work?" and the answer
is no. Precision is 1.0 wherever it is defined.

**TPR is not yet a clean measure and should not be quoted as one.**

| Skill | TPR | deictic positives |
|---|---|---|
| spec-evaluator | 0.833 | 6/6 |
| qa-edge-hunter | 0.600 | 1/5 |
| scope-hammer | 0.500 | 1/6 |
| shapeup | 0.429 | 2/7 |
| orient | 0.400 | 2/5 |
| tech-lead | 0.400 | 5/5 |
| scope-architect | 0.200 | 3/5 |
| advisor-protocol | 0.167 | 2/6 |
| ba-pitch-analyzer · coach · solution-architect · task-executor · translator | 0.000 | 6/6 · 2/5 · 0/6 · 5/6 · 3/6 |

Why it is not clean: **38 of 74 positives are deictic** — they point at a referent ("coach *this
feedback*", "analyze *this pitch*", "evaluate *TASK-007*") that the probe never supplies. Faced
with that, a model can reasonably either activate the skill and go looking, or ask for the
missing input. Only the first scores. Verbatim from a real `coach` probe:

> I'm ready to coach feedback into the knowledge base using the `/coach` skill, but I don't see
> any feedback in your message. Please provide the feedback you'd like me to coach…

That is the description working perfectly — the model named the right skill — and it counts as
a miss. Note also that deixis does **not** explain everything: `spec-evaluator` is 6/6 deictic
and scores 0.833, while `solution-architect` is 0/6 deictic and scores 0.0. So the TPR column is
a mix of description quality, the model's activate-versus-ask disposition, and dataset phrasing.
Fixing it is [#7](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/issues/7).

Read the zeros as **"needs investigation"**, not as "broken" — and read them only against Haiku
4.5. Trigger rates are model-dependent; a spot-check on a frontier model activated
`spec-evaluator` and `shapeup` on queries Haiku declined.

### Known limitation — queries whose referent is never supplied

Probes run against **this repository's own working tree** with no conversational context, so
neither the on-disk artifacts (a pitch, a spec folder, `TASK-NNN`) nor the inline content ("this
feedback", "this PRD") that **38 of the 74 positive cases** refer to actually exists. The model
frequently does the right thing — names the correct skill and asks for the missing input — and
that scores as a miss.

Fixing it has two halves:

1. **A fixture workspace** the probes run inside, containing the artifacts the queries
   presuppose (a pitch, a small spec tree, `TASK-007`, a ledger with an open item).
2. **Supplying the referent inline** for content-deictic queries, so "coach this feedback:
   <actual feedback>" is a fair test of the description rather than of the model's willingness
   to guess.

Both risk *inflating* the number if done carelessly, so whoever does it should measure before
and after and report the delta rather than silently banking it. Until then, treat FPR as the
result and TPR as diagnostic. Tracked in
[#7](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/issues/7).

## Tier 2 — Functional fixtures

The first one — the `spec-evaluator` anti-leniency planted-bug fixture — lives at
`examples/eval-planted-bug/` (Stage C2). See `tests/README.md`.

## Tier 3 — Day-1 reflective loop and the Day-2 failure register

The two rungs of *Graph Engineering* §VI whose exit criteria are numbers rather than states:
Day 1 exits on **measured quality improvement**, Day 2 on **tool reduces known error class**.
What has actually been measured, and what is left: [`DAY1-REPORT.md`](DAY1-REPORT.md), derived from
the committed baseline and regenerated by every `--measure`. The plan that finishes Day 1 is
[`docs/internal/plan/ratchet-and-receipt-plan.md`](../docs/internal/plan/ratchet-and-receipt-plan.md).

**Day 1 — the loop.** `tools/skill-loop.mjs` is the paper's `reflective_task` with every artifact
written to disk. Per-skill rubrics live next to the skill, beside its trigger-evals:
`skills/<name>/evals/day1-rubric.json`. **All 5 Tier-1 skills are instrumented today**
(`ba-pitch-analyzer`, `scope-architect`, `solution-architect`, `spec-evaluator`, `task-executor`),
and that ratio is recorded in the baseline's `coverage` block rather than left as an absence. The
honest ceiling is 6 of 13, not 13/13 — six skills document their own lack of ground truth and are
deliberately out of scope (`docs/internal/plan/ratchet-and-receipt-plan.md` §6).

Every number is `claude-sonnet-5`, n=3. **The results and their caveats live in
[`DAY1-REPORT.md`](DAY1-REPORT.md)**, derived from the baseline; nothing here restates a figure,
because a number with two homes has one that is wrong.

**Four of the five rubrics have ZERO or near-zero authored criteria**, which is the point of Tier 1:
each skill is sole writer of a committed artifact that a deterministic script already grades, so the
rubric is a lookup rather than a judgement. Two thin renderers turn those scripts' JSON reports into
the `PASS <id> <label>` rows `detector.rows` scores:

| Renderer | Wraps | Rows |
|---|---|---|
| [`oracles/lint-rows.mjs`](oracles/lint-rows.mjs) | `spec-lint.mjs`, `trace-lint.mjs`, `board-derive.mjs` | `--profile scopes` (PA1/PA2/DISJOINT) · `--profile wiring` (reachability) · `--profile spec` (spec-tree structure) |
| [`oracles/verdict-rows.mjs`](oracles/verdict-rows.mjs) | `process-oracle.mjs` | one row per Test-Surface row, passing when a JUDGE's verdict matches what the build actually does |

`verdict-rows` is what took `spec-evaluator` from nine authored criteria to three. A verdict is
right or wrong only relative to the running build, so the oracle supplies ground truth and the
rubric grades **agreement** — which makes a false-FAIL cost exactly what a false-PASS costs,
something criteria written around one known planted bug can never do.

**Vacuous truth is not a pass**, and it is the one hazard a lint-delegated rubric has: `spec-lint`
reports no PA1 finding for a `scopes/` directory that is empty. Every profile therefore fails ALL of
its rows when the artifact it grades is absent, and structural §48(d1b) asserts a seed-only
workspace scores exactly `0` — not merely less than the intact one.

```bash
node tools/skill-loop.mjs             # inventory — which skills have a rubric. No auth, no spend.
node tools/skill-loop.mjs --selftest  # prove each rubric DISCRIMINATES. No auth, no spend. Runs in CI.
node tools/skill-loop.mjs --report    # regenerate evals/DAY1-REPORT.md from the baseline. No spend.
node tools/skill-loop.mjs --measure --skill spec-evaluator --model claude-sonnet-5
```

> **`claude-sonnet-5` is the model for Day-1 measurement**, and `--model` has no default precisely so
> that choice is always written down. Budget from **measurement, not from a price ratio**: a
> `task-executor` run at n=3 cost **$0.61** on the six-row fixture and **$0.93** on the twelve-row
> one — roughly **$0.20–0.31 per run**, or about **$0.20 per round**. Earlier versions of this note
> budgeted by scaling a Haiku figure by the published price ratio and were ~34× high; cost capture
> exists so that no longer has to be guessed.

**Start at [`DAY1-REPORT.md`](DAY1-REPORT.md)** to see what has already been measured and what is
left — it carries the per-skill results, every caveat attached to them, and a derived *What remains*
table so the next session does not re-measure something already done.

> **`--selftest` scores are not skill quality, and the code will not let you pretend otherwise.**
> The selftest grades two *hand-authored* reference drafts — one reproducing the documented lenient
> failure mode, one showing the skeptical posture — to prove the rubric separates them. Every run
> record carries `mode`, every stored version carries `source` (`reference-weak` / `reference-strong`
> / `model`), and structural §48 asserts both. The current separation (0 → 1.0) is a property of the
> fixtures, not of `/spec-evaluator`.

Two controls make the rubric an instrument rather than a linter, both in §48: the score must **fall**
when the strong draft's verdict line is deleted, and an **empty** draft must score at or below the
weak floor. The second caught a real defect on its first run — scoring `must_not` criteria as
positive credit gave a blank draft 0.417, because saying nothing violates no prohibition. `must_not`
now only ever subtracts (`score = max(0, base − penalty)`).

A rubric may score an oracle criterion **per row** (`detector.rows`) instead of all-or-nothing. This
is not cosmetic: with one binary criterion over a five-row contract, `task-executor` recorded `0.0`
for fifteen consecutive rounds while passing four of five rows, so the delta the rung exits on had
only two reachable values and no revision could move it. `satisfied` still requires every row, so
`approve_at` keeps its meaning; only the score becomes readable. Any rubric using `rows` must ship a
committed `partial` reference draft, and §48 asserts **weak < partial < strong** — a control keyed on
the fixture, not on `rows`, because keying it on `rows` made it disarm itself when `rows` was deleted.

For `grades: "workspace"` rubrics the revision round **carries the deliverable forward** into a fresh
directory (one file crosses; stray files do not). Without it, every round got an empty directory and
a list of failing rows, which is re-sampling wearing a loop's clothes — fifteen rounds, zero
revisions, one of them trading a fixed row for two broken ones. Runs before 2026-08-04 are not
comparable on delta, and the baseline's `method` string says so.

**Baseline:** `evals/baselines/skill-loop.baseline.json` — `status: "measured"`, carrying a result
per skill **per model**, because a quality rate read against the wrong model name measures nothing.
No number is written until an authenticated `--measure` run produces one, and a run whose adapter was
overridden by `SKILL_LOOP_CMD` refuses to write a baseline at all.

**What survives a clone.** Raw run records and per-round drafts land in `evals/runs/`, which is
**gitignored** — machine run-trace, the same split as `.shapeup/` vs `shapeup/` (ADR-0001). So the
committed evidence is two files: the baseline above, and
[`evals/DAY1-REPORT.md`](DAY1-REPORT.md) **derived** from it by `node tools/skill-loop.mjs --report`
(rewritten automatically by every `--measure`). Edit the baseline, never the report.

That derivation is enforced, because with the run-trace gitignored the report is not documentation —
it is the only account of a paid run anyone else will ever see. §48(d7) regenerates it and compares
bytes, asserts every measured skill+model appears in it, and asserts every caveat in the baseline
reaches it verbatim. A number published without its caveat is how the last one was misread.

**Day 2 — the register.** `evals/failure-classes.json` links each tool to the error class it exists
for, the artifact where that failure was written down, and its before/after rates. Eight classes
today. `reduces` stays `null` unless BOTH rates are measured and a `reduction_basis`
(`sampled` | `structural`) is stated — §48 fails CI on a reduction claimed from unmeasured rates.

**One of eight currently meets Day 2's exit criterion**, and on a structural basis (the fabricated-
baseline class is now impossible by construction, not merely rarer). The rest report `reduces: null`.
The asymmetry is the finding: baselines exist where a failure hurt enough to measure, current rates
almost nowhere — **this repo measures its failures and not its fixes.**

## Not built yet

- Measured trigger-eval baselines (run the harness with auth).
- **Headroom on `claude-sonnet-5` for the four skills that ceiling on it.** `task-executor`,
  `scope-architect`, `ba-pitch-analyzer` and `spec-evaluator` approve on the FIRST draft in 3/3 runs,
  so their revision step never executes and their number is a pass/fail result wearing a loop's
  clothes. `solution-architect` is the only one that revises. **Three** deliberate fixture
  escalations did not move any of the four (P1's six rows → P5′'s twelve with batch selectors; P5's
  second planted bug reachable only by a seeded probe), and every one of those fixtures ships a
  committed `partial` reference scoring strictly between its weak and strong ones — so the range is
  real and the models do not produce the weak draft. Difficulty is the wrong dial: headroom is a
  property of task **and model jointly**. See `docs/internal/plan/ratchet-and-receipt-plan.md` §5.
- `translator` — the sixth and last skill inside the honest 6-of-13 ceiling.
- The `board-derive` arms P4 asked for and no oracle can answer: DAG acyclicity, and "every UC has a
  Test-Surface row". Writing them for the occasion would be the authored-criteria failure Tier 1
  exists to avoid, so they are a gap on the record rather than a rule of the renderer's own.
- The model-judge head over the rubrics' existing `assertion` fields (D2). Today's deterministic
  head is a regex: anchor-shaped criteria generalize to real transcripts, phrase-shaped ones
  (`no-green-suite-justification`, `no-tick-trust`) are brittle against paraphrase.
- A sampled `current` rate for any Day-2 class (D4) — the item that would convert the register from
  bookkeeping into evidence.
- A CI `eval-gate` job that runs Tier 1/2 once auth is available in CI (the current `eval-gate` job
  is an honest placeholder — see `.github/workflows/ci.yml`).
