# 06 — Appendix: File Layout & Invariants

[← Back to index](README.md)

## Repository layout

```
.claude-plugin/          plugin.json · marketplace.json
skills/<name>/SKILL.md   the 12 harness skills (+ references/)
skills/tech-lead/        schemas/ (WorkOrder · WorkResult · gate-answers · domain registry)
                         scripts/ — envelope port (compile-order · ingest-result ·
                          validate-envelope), run lifecycle (init-run · run-workflow ·
                          resume-state · run-snapshot · gate-answers · ship-report),
                          verification (t0-verify · trace-lint · hill-derive · aegis-digest),
                          policy (budget-check · fit-check · stats), measurement (export-run —
                          read-only fact tables keyed by run id), lib/ (argv · paths ·
                          contract-md · ratchet-tree · is-main · run-id · facts)
                         workflows/shapeup-run.js — the whole pipeline as one launchable script
skills/ba-pitch-analyzer/scripts/   harness reduce board · harness verify spec
skills/spec-evaluator/scripts/      harness reduce verdict (flip/confidence grammar, co-located
                                    with its owning skill)
bin/init.mjs             `npx shapeup-sdlc init` — pure-Node scaffolding + permission grant
commands/*.md            10 slash commands (/shape /orient /scopes /wire /build /eval /qa
                         /hammer /ship /retro)
hooks/                   hooks.json + PreToolUse: safety-spine · gate-l2 (advisory) ·
                         gate-intake · gate-deadline · sandbox-guard (+ tech-lead's
                         harness verify envelope) · Stop: gate-zerowork (blocking) ·
                         anti-rationalization · slop-cleaner (advisory) · PreCompact:
                         compact-snapshot · SessionStart: session-rehydrate
                         + lib/decision.mjs (every hook records allow / deny / error)
scripts/install-harness.sh, migrate.sh    stable public entrypoints — a frozen URL contract
scripts/shapeup-sdlc/    what those two entrypoints run on a user's machine — lib/
oracles/                 the evaluation-contract oracle registry (test · snapshot · http ·
                         process), proven to discriminate against negative controls
tools/                   repo-only, never shipped — demo/
tests/structural.mjs     Tier 0 runner — threads tests/lib/ helpers through the per-domain
tests/{lib,structural}/  suites in tests/structural/*.mjs; 930+ checks, zero LLM calls (the
                         floor is asserted by the suite itself; the exact count may only grow —
                         raised 880 → 930 in v1.8 for §53–54, the run key and the fact tables)
examples/                worked fixtures + negative controls for the oracle registry
```

## Architectural invariants

- **Single judge.** The verdict belongs to `spec-evaluator` alone; QA has no verdict and no
  score.
- **EVAL exactly once per round.** QA sits after PASS, outside the loop — never a second
  evaluation pass.
- **Ledger is the single source of truth.** Orient, task-executor, and QA discoveries all funnel
  into one ledger; each writes only its own section.
- **QA is a level-up, not a gate.** `--no-qa` can skip it; the circuit breaker always outranks
  the hunter.
- **Role separation.** Evaluator grades, task-executor fixes, QA discovers — no one does
  another's job.
- **Three circuit breakers, one exit.** An exhausted scope queues a proposal and never blocks the
  round; the outer round budget and the opt-in wall-clock budget both end the loop. All three
  route to GATE H — the run's ending is a ship decision made against what is green, never a kill.
- **Hill phase is mechanical.** Derived only from T0 / T1 / seesaw facts — never self-reported
  by a worker.
- **Envelope port.** Every dispatch is WorkOrder in / WorkResult out; shared state is written
  only by `harness reduce ingest`. A malformed envelope is denied before it reaches a worker.
- **Safety spine.** Destructive commands and secret reads are denied mechanically
  (`hooks/safety-spine.mjs`); the only override is a human-authored, schema-governed local file
  (`SafetyOverrides`), itself write-protected and logged when exercised.
- **Advisory hooks never block — with exactly one named exception.** `anti-rationalization.mjs`
  and `slop-cleaner.mjs` may only inform (`systemMessage`); a blocking Stop hook would be a second
  gate behind the judge. `gate-zerowork.mjs` **does** block (`decision: "block"`), deliberately:
  it fires on a run that produced no receipt at all, which is not a judgement about quality but
  the absence of any work to judge. Stated here because the invariant read as absolute while the
  code carried a counter-example — and an invariant with an undocumented exception is how a reader
  concludes the code is wrong when it is the sentence that is.
- **Lanes thin ceremony, never verification** *(design — §4.7, not yet implemented)*. No lane
  skips EVAL, T0, or the hooks; a lane may only remove PO ceremony and scout work.

---
[← Verification & Quality Strategy](05-verification-and-quality-strategy.md) · [Back to index](README.md)
