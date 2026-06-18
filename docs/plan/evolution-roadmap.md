# Evolution Roadmap — making the harness self-improving

> Status: **Phases 0, 1, 4 landed** (2026-06-18). Phase 2/3/5 remain.
> Build phases land in separate, individually-reviewed PRs.
>
> **Landed in this increment** (see `evals/README.md`):
> - **Phase 0** — `evals/` convention + `evals/baselines/<name>.json` snapshots for all 8 skills
>   (unmeasured; metrics `null` until `make eval` populates them) + the version-bump rule, now an
>   invariant in `AGENT.md`.
> - **Phase 1** — tier-1 `skills/<name>/evals/trigger-evals.json` for all 8 skills: 20 cases each,
>   English-only triggers for downstream skills (Vietnamese triggers only for `translator` as the L0 gate), cross-skill hard
>   negatives. Live measurement wired via `evals/run-trigger-eval.sh` / `make eval` (validated
>   end-to-end against skill-creator's `run_eval.py`). **Running the full 3×-run measurement +
>   `run_loop` description optimization is the deliberate local step** that fills the baselines.
> - **Phase 4** — deterministic seesaw gate `evals/check-gate.py` (`make eval-gate`) + the
>   `eval-gate` CI job. Reads committed baselines + git only, **never calls Claude**. Freshness +
>   seesaw enforced progressively (unmeasured baseline → warn-only until measured).
>
> **Next:** Phase 2 (tier-2 functional fixtures) then Phase 3 (the `skill-evolver` AEGIS pass).

## Why this exists

The eight skills under `skills/` are hand-tuned prose. When we edit one — bump
`ba-pitch-analyzer` v2.9→v3.0, tighten a `spec-evaluator` dimension, reword a `description:`
trigger — we have **no way to prove the change is actually better**. Versions live in prose
(`docs/mechanism-roadmap.md` + each `SKILL.md`); CI only validates manifests + lints JSON;
there are zero functional tests. Every skill edit is a leap of faith, and trigger
descriptions are especially easy to regress silently.

**Goal:** an *evolution loop* in which each skill change is measured against a committed
baseline and ships only if it provably improves — or at minimum does not regress.

Two inputs converge:

1. **`/skill-creator:skill-creator`** — the *measurement engine*, already installed at
   `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator/`.
   It gives us:
   - **Trigger-eval description optimization** — `scripts/run_loop.py`: 60/40 train/held-out
     split, runs each query ~3× for a stable trigger rate, asks Claude to rewrite the
     `description`, iterates ≤5×, returns `best_description` selected by **test** score (guards
     against overfitting the train split).
   - **Functional benchmarks** — `scripts/run_eval.py` + `scripts/aggregate_benchmark.py`:
     runs each test case **with-skill and without-skill** in the same turn, grades assertions,
     produces `benchmark.json` with `pass_rate` / `time` / `tokens` as **mean ± stddev** plus
     the with/without **delta** (proves the skill *adds value*, not just that it passes).
   - **`agents/analyzer.md`** — variance/flakiness + non-discriminating-assertion detection.
   - **`agents/comparator.md`** — blind A/B between two skill versions.
   - **`agents/grader.md`** — the offline judge (PASS needs cited evidence; burden of proof is
     on the expectation).

2. **HarnessX** (arXiv **2606.14249**, *"A Composable, Adaptive, and Evolvable Agent Harness
   Foundry"*) — the *evolution architecture*. Its **AEGIS** engine is a four-stage loop,
   **Digester → Planner → Evolver → Critic + Deterministic Gate**, where LM subagents propose
   but a typed/deterministic layer decides what ships: *"Language-model subagents explore,
   hypothesize, and propose; typed structure and deterministic gates determine what ships."*
   Its **seesaw constraint** — *a candidate must not regress any previously-passing task* — is
   the formal statement of "ensure each change works better." Companion paper **HarnessFix**
   (arXiv **2606.06324**) adds *diagnosis-driven* repair: trace → localize the failing step →
   map to a **scoped repair operator** → a patch is accepted only if `Δtarget ≥ δmin` **and**
   `regression ≤ rmax`.

**The scaffold already exists.** `skills/tech-lead/references/ledger-schema.md:139` already
names a **3-tier eval design** — tier-1 trigger-evals, tier-2 per-skill golden fixtures, tier-3
e2e pipeline benchmark — and explicitly defers tier-1/tier-2 to "isolated fixtures." Only
**tier-3** is built today (the `metrics.jsonl` harvest at SHIP). This roadmap builds tier-1 and
tier-2 and wraps them in an AEGIS-shaped loop.

**Locked decisions:** human-in-loop + CI seesaw gate (not full auto); tier-1 first; eval runs
**locally** with committed baselines (no Claude calls in CI).

---

## How AEGIS maps onto our harness

| HarnessX / AEGIS | Our realization |
|---|---|
| Harness ℋ (first-class object being evolved) | the 8 skills under `skills/` + their prose versions |
| Trace store 𝒯 (accumulates, never discarded) | `docs/shapeup-sdlc/metrics.jsonl` (tier-3) + per-run `discovery/ledger.md` + `harness-run.md` |
| Verifier → scalar reward `r` | skill-creator `grader` → `grading.json` `pass_rate` — **offline, on fixtures** |
| **Digester** (traces → structured evidence) | read `metrics.jsonl` + failing eval cases → "which skill / which case underperforms" |
| **Planner** (adaptation landscape) | choose the target skill + the specific cases to fix; avoid only-prompt-nudges when a structural edit is due |
| **Evolver** (typed edit + change manifest) | propose the `SKILL.md` / `references/` edit **plus a change manifest** (what changed, expected Δ, expected regressions) |
| **Critic** (LM, may request one revision) | human reviewer reading the manifest + re-run results |
| **Deterministic Gate** (manifest → build → seesaw) | CI `eval-gate` job (Phase 4) |
| **Seesaw constraint** | CI rule: on every previously-passing case, new pass ≥ old; net score ≥ baseline |
| Change manifest + smoke test | PR-description template + `claude plugin validate --strict` |
| HarnessFix repair operator + `Δ≥δmin ∧ R≤rmax` | Phase-5 scoped repair, same accept rule as the seesaw gate |

### Invariant guardrails (do not violate — these keep the harness predictable)

- **The eval grader is an offline judge on isolated fixtures — it is *not* the in-run
  `spec-evaluator`.** The "one judge per build round" invariant is untouched; evolution happens
  *outside* any live feature run.
- **tier-3 `metrics.jsonl` stays facts-only.** No computed `run_quality_score` (that would be a
  second judge → Goodhart, per `ledger-schema.md:131-137`). The reward signal lives in the
  tier-1/2 *fixtures*, never in production harvest.
- **No skill grades another, and `tech-lead` stays thin.** The loop is orchestration *around*
  skills, not a new role *inside* the pipeline.

---

## Phases

### Phase 0 — Foundations & baseline (no behavior change) — ✅ LANDED
- Establish the `evals/` convention per skill: `skills/<name>/evals/` holds `trigger-evals.json`
  (tier-1), later `evals.json` + `fixtures/` (tier-2).
- Add `evals/baselines/<name>.json` — committed score snapshots (trigger accuracy + functional
  pass-rate) the seesaw gate reads.
- Snapshot today's scores per skill as the first baseline.
- **Rule:** a skill version bump (the prose `vX.Y` in its `description` / `mechanism-roadmap.md`)
  now *requires* a refreshed baseline + a non-regression report in the PR.

### Phase 1 — Tier-1 trigger-evals  *(FIRST — cheapest, highest ROI)* — ✅ LANDED + MEASURED (opus, 3 runs/query, 2026-06-18)

> **First measured baseline** (`evals/baselines/*.json`, model `claude-opus-4-8`):
>
> | skill | accuracy | TPR | TNR |
> |---|---|---|---|
> | ba-pitch-analyzer | 0.45 | 0.00 | 1.00 |
> | orient | 0.50 | 0.00 | 1.00 |
> | qa-edge-hunter | 0.55 | 0.10 | 1.00 |
> | shapeup | 0.40 | 0.00 | 1.00 |
> | spec-evaluator | 0.50 | 0.09 | 1.00 |
> | task-executor | 0.50 | 0.00 | 1.00 |
> | tech-lead | 0.50 | 0.00 | 1.00 |
> | translator | 0.50 | 0.00 | 1.00 |
>
> **Read this correctly — TNR is perfect, TPR is a proxy artifact.** skill-creator's
> `run_eval.py` registers the skill under test as a *slash command* and counts a trigger ONLY
> when `claude -p` invokes that command via the `Skill`/`Read` tool as its **first** action
> (`run_eval.py:137-154`); a plain text answer counts as no-trigger. Real installed skills
> auto-trigger through the system prompt — injected *commands* rarely self-invoke from an NL
> prompt, even on opus. So the near-zero **TPR understates real auto-trigger** (it measures
> command self-invocation, not skill auto-activation). The perfect **TNR=1.0 across all 8 skills
> is the trustworthy signal**: the descriptions do **not** over-trigger, and every cross-skill
> hard negative (ba↔task-executor, evaluator↔qa, orient↔ba, tech-lead↔sub-skills,
> translator↔all) is correctly rejected — the disambiguation this phase set out to prove holds.
>
> **Two gotchas hit & fixed during the run:** (1) the wrapper must pass `--model` the *session*
> model — the `claude -p` default model never self-invoked the command (uniform TPR=0); (2) a
> bash-3.2 empty-array under `set -u` (`evals/run-trigger-eval.sh`) silently swallowed the run.
>
> **Before driving description rewrites off TPR** (the `run_loop` optimization step), validate
> proxy fidelity — ideally measure with the skills *installed* (`claude --plugin-dir .`) and
> detect `Skill`-tool activation of the real skill name, rather than command self-invocation.
> Until then the committed baselines serve the **seesaw** (relative regression protection — the
> freshness + per-case checks are live and proven), not absolute trigger scoring.
- Per skill, author ~20 queries `{ "query": "...", "should_trigger": true|false }` in English (except for the `translator` skill which evaluates both English and Vietnamese triggers). Include **hard negatives** that disambiguate overlapping skills (e.g. a query that must hit `ba-pitch-analyzer` not `task-executor`; `qa-edge-hunter` vs `spec-evaluator`; `orient` vs `ba`).
- Run, from the skill-creator skill dir, with the **session model id**:
  ```bash
  python -m scripts.run_loop \
    --eval-set <repo>/skills/<name>/evals/trigger-evals.json \
    --skill-path <repo>/skills/<name> \
    --model <session-model-id> \
    --max-iterations 5 --verbose
  ```
- Adopt the returned `best_description` only if its **test-split** score ≥ baseline; commit the
  new `description:` + refreshed baseline.
- Outcome: every skill's trigger accuracy is measured and the cross-skill ambiguity risk is
  closed with evidence.

### Phase 2 — Tier-2 per-skill functional golden fixtures
- Per skill, author `evals/evals.json` (prompt + `files`/fixtures + **objective assertions**),
  run **with-skill vs without-skill** (`run_eval.py` → `aggregate_benchmark.py`) to prove the
  delta, and use `analyzer` to flag flaky / non-discriminating assertions. Representative cases:
  - **`ba-pitch-analyzer`** — a pitch fixture → assert doc-tree shape, `## Test Surface` rows
    present, **no invented ACs** (anti-invention rule).
  - **`spec-evaluator`** — a built task with a **planted bug** → assert it FAILs and files a
    `file:line` bug (this is the anti-leniency regression test).
  - **`task-executor`** — a `TASK-NNN.md` spec → assert minimum-code discipline + AC checkboxes
    ticked (GATE D).
  - **`translator`** — non-English intake → assert faithful English + glossary, original file
    untouched.
- Commit functional pass-rate baselines.

### Phase 3 — The evolution loop (AEGIS-adapted, human-in-loop)
- Add a `skill-evolver` skill (or `/evolve` command) that runs **one** AEGIS pass over a
  *named target skill*: **Digester** (read failing eval cases + `metrics.jsonl`) → **Planner**
  (name the cases to fix, decide prose-edit vs structural-edit) → **Evolver** (propose the
  `SKILL.md`/`references/` edit + a **change manifest**) → **stop** and hand the manifest +
  re-run scores to a human (the Critic). It **proposes, never auto-commits.**
- This is the only genuinely new artifact; everything else is config + fixtures.

### Phase 4 — CI seesaw gate (the "provably better" guarantee) — ✅ LANDED
- `make eval SKILL=<name>` — runs that skill's tier-1 + tier-2 evals locally, writes a
  regression report vs the committed baseline.
- New CI job **`eval-gate`** on PRs touching `skills/<name>/**` — **does not call Claude.** It
  asserts the PR carries a refreshed `evals/baselines/<name>.json` + regression report proving
  **every previously-passing case still passes** (seesaw) and net score ≥ old. Block merge
  otherwise. Gate ordering mirrors AEGIS: manifest completeness → `validate --strict`
  (build/smoke) → seesaw.

### Phase 5 — Diagnosis-driven repair (HarnessFix) — optional/later
- Adapt the ETCLOVG layer taxonomy to our roles (shaping / planning / building / evaluation /
  QA / orchestration). Use tier-3 `metrics.jsonl` signals as failure *symptoms* that point at
  which skill to send through the Phase-3 loop — e.g. high `surprise_count` ⇒ shaping/planning;
  high `round_count` ÷ `slice_count` ⇒ planner or builder; low `qa_findings.promoted` with high
  `total` ⇒ QA charter. Keep `docs/repair-memory.md` (flaw → repair operator → outcome), the
  HarnessFix "repair memory."

---

## Sequencing

```
Phase 0 (convention + baselines)
   └─> Phase 1 (tier-1 trigger-evals)      ← start here
          └─> Phase 2 (tier-2 functional fixtures)
                 ├─> Phase 4 (CI seesaw gate)   ← needs baselines from 1+2
                 └─> Phase 3 (evolution loop skill)
                        └─> Phase 5 (diagnosis-driven repair)
```

## References
- `skills/tech-lead/references/ledger-schema.md:139` — the existing tier-1/2/3 definition + the
  facts-only / no-second-judge rules this roadmap must honor.
- `AGENT.md` — architecture invariants (one judge, role separation, thin tech-lead).
- HarnessX — arXiv 2606.14249 (AEGIS four-stage loop; seesaw constraint).
- HarnessFix — arXiv 2606.06324 (diagnosis-driven repair; ETCLOVG; `Δ≥δmin ∧ R≤rmax`).
- M. Fowler, *Harness engineering for coding agent users* — feedforward/feedback controls;
  "direct human input where it is most important" (basis for human-in-loop over full auto).
- skill-creator: `scripts/run_loop.py`, `scripts/run_eval.py`, `scripts/aggregate_benchmark.py`,
  `agents/{grader,analyzer,comparator}.md`.
