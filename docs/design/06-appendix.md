# 06 — Appendix: File Layout & Invariants

[← Back to index](README.md)

## Repository layout

```
.claude-plugin/          plugin.json · marketplace.json
skills/<name>/SKILL.md   the 12 harness skills (+ references/, evals/)
skills/tech-lead/        schemas/ (WorkOrder · WorkResult) + scripts/
                         (compile-order · ingest-result · validate-envelope ·
                          t0-verify · aegis-digest)
skills/ba-pitch-analyzer/scripts/   board-derive.mjs · spec-lint.mjs
commands/*.md            slash commands (/ship)
hooks/                   hooks.json + gate-l2.mjs + sandbox-guard.mjs
scripts/install-harness.sh, migrate.sh    stable public entrypoints
scripts/shapeup-sdlc/    dev/CI tooling — lib/, migrations/, oracles/, distribute.js
tests/structural.mjs     Tier 0 — 159 checks, zero LLM calls
examples/                fixtures for oracle + planted-bug discrimination tests
dist/                    compiled Cursor rules/extension + Antigravity subagents
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
- **Two-level circuit breaker.** An exhausted scope queues a proposal; only the outer round
  budget hitting zero stops the whole run.
- **Hill phase is mechanical.** Derived only from T0 / T1 / seesaw facts — never self-reported
  by a worker.
- **Envelope port.** Every dispatch is WorkOrder in / WorkResult out; shared state is written
  only by `ingest-result.mjs`. A malformed envelope is denied before it reaches a worker.

---
[← Verification & Quality Strategy](05-verification-and-quality-strategy.md) · [Back to index](README.md)
