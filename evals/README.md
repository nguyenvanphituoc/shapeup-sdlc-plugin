# Evals — the evidence layer (repo-only, dev/CI)

This directory is the **real** version of the evidence layer the prior roadmap claimed had
"LANDED" but never committed (audit finding **F1**). It is a repo-only dev/CI asset — not shipped
to installs.

## Tier 1 — Trigger evals (Stage C1)

**Datasets** live next to each skill: `skills/<name>/evals/trigger-evals.json` — ~11–12
`{query, should_trigger}` cases each, every dataset mixing positives (queries that *should*
activate the skill) with **cross-skill hard negatives** (a sibling skill's queries, tagged
`expected_other`) and one out-of-harness control. 103 cases across 9 skills today. The negatives
are the point: a description that triggers on its own examples but *also* steals its siblings' is
not actually discriminating.

**Harness:** `scripts/trigger-eval.mjs`.

```bash
# Inventory only — no auth, safe in CI: refresh the baseline's dataset counts.
node scripts/trigger-eval.mjs

# Measure — needs Claude auth + the plugin installed. Runs every case, detects REAL Skill-tool
# activation, writes a measured baseline with method + timestamp.
node scripts/trigger-eval.mjs --measure
```

**Baseline:** `evals/baselines/trigger-evals.baseline.json`. Ships as `status: "unmeasured"` with
`results: null` — **on purpose**. Per F1, no TPR/FPR number is written until a real run produces
it. The structural test enforces this: an `unmeasured` baseline with fabricated results fails CI.

### Honest measurement — the two traps this harness avoids

1. **The proxy-artifact trap (the prior TPR≈0).** The earlier measurement counted slash-command
   self-invocation, not `Skill`-tool activation, so it measured nothing real. This harness detects
   an actual `tool_use` named `Skill` in the model's output, with the plugin installed
   (`--plugin-dir .`). Override the invocation with `TRIGGER_EVAL_CMD` (placeholders `{{query}}`,
   `{{root}}`) if your CLI differs.
2. **The broken-harness trap.** If a measurement run produces no parseable model events (CLI
   missing, not authed, plugin not loadable), the harness **aborts and writes nothing** rather than
   recording every case as a non-trigger. A broken harness must look broken — never like a real
   "0% trigger" result. That conflation is precisely what made the prior baseline fiction.

`measured_at` / `model` are taken from the environment (`TRIGGER_EVAL_AT`, `TRIGGER_EVAL_MODEL`),
not invented by the script.

## Tier 2 — Functional fixtures

The first one — the `spec-evaluator` anti-leniency planted-bug fixture — lives at
`examples/eval-planted-bug/` (Stage C2). See `tests/README.md`.

## Not built yet

- Measured trigger-eval baselines (run the harness with auth).
- A CI `eval-gate` job that runs Tier 1/2 once auth is available in CI (the current `eval-gate` job
  is an honest placeholder — see `.github/workflows/ci.yml`).
