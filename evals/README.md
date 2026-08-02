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
  --model claude-haiku-4-5-20251001 [--concurrency N] [--max-turns N]
```

> **Always pass `--model` explicitly.** A full run is 149 headless sessions of up to 8 turns
> each — roughly $6 on Haiku 4.5 and several times that on a frontier model, spent in the
> background where it is easy not to notice. Haiku activates skills correctly (verified: it
> reaches `Skill` in 3 turns on `breadboard the checkout flow`), so it is the right default for
> a regression baseline. Trigger rates are **model-dependent**, so the model is recorded in the
> baseline and a number is only meaningful next to it.

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

## Not built yet

- Measured trigger-eval baselines (run the harness with auth).
- A CI `eval-gate` job that runs Tier 1/2 once auth is available in CI (the current `eval-gate` job
  is an honest placeholder — see `.github/workflows/ci.yml`).
