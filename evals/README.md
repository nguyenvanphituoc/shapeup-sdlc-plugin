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

**Harness:** `scripts/shapeup-sdlc/trigger-eval.mjs`.

```bash
# Inventory only — no auth, safe in CI: refresh the baseline's dataset counts.
node scripts/shapeup-sdlc/trigger-eval.mjs

# Measure — needs Claude auth + the plugin installed. Runs every case, detects REAL Skill-tool
# activation, writes a measured baseline with method + timestamp.
node scripts/shapeup-sdlc/trigger-eval.mjs --measure \
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

### Known limitation — artifact-presupposing queries

Probes run against **this repository's own working tree**, which contains no pitch, no spec
folder, and no `TASK-NNN`. **17 of the 74 positive cases** name such an artifact (`evaluate task
TASK-007 against the spec`, `translate this pitch to English`). On those, the model often does
the correct thing — searches, finds nothing, and asks for the artifact instead of activating.
That is a sensible refusal being scored as a miss, so the measured TPR **understates** true
activation for `spec-evaluator` (4/6 positives affected) and `task-executor` (4/6) in
particular.

Fixing this means running probes inside a fixture workspace that contains the presupposed
artifacts. Until that exists, read per-skill TPR with this caveat rather than as a clean
number — and do not quote a single headline TPR across all skills, because the confound is
distributed unevenly across them.

## Tier 2 — Functional fixtures

The first one — the `spec-evaluator` anti-leniency planted-bug fixture — lives at
`examples/eval-planted-bug/` (Stage C2). See `tests/README.md`.

## Not built yet

- Measured trigger-eval baselines (run the harness with auth).
- A CI `eval-gate` job that runs Tier 1/2 once auth is available in CI (the current `eval-gate` job
  is an honest placeholder — see `.github/workflows/ci.yml`).
