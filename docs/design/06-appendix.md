# 06 — Appendix: File Layout & Invariants

[← Back to index](README.md)

## Repository layout

```
.claude-plugin/          plugin.json · marketplace.json
skills/<name>/SKILL.md   the 12 harness skills (+ references/, evals/)
skills/tech-lead/        schemas/ (WorkOrder · WorkResult · domain registry) + scripts/
                         (compile-order · ingest-result · validate-envelope ·
                          t0-verify · aegis-digest · run-snapshot · stats)
skills/ba-pitch-analyzer/scripts/   board-derive.mjs · spec-lint.mjs
commands/*.md            slash commands (/ship)
hooks/                   hooks.json + safety-spine.mjs · gate-l2.mjs · sandbox-guard.mjs
                         (PreToolUse) + anti-rationalization.mjs · slop-cleaner.mjs
                         (Stop, advisory) + compact-snapshot.mjs (PreCompact) +
                         session-rehydrate.mjs (SessionStart)
scripts/install-harness.sh, migrate.sh    stable public entrypoints
scripts/shapeup-sdlc/    dev/CI tooling — lib/, migrations/, oracles/, distribute.js
tests/structural.mjs     Tier 0 — 330+ checks, zero LLM calls (the floor is asserted by
                         the suite itself; the exact count may only grow)
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
- **Safety spine.** Destructive commands and secret reads are denied mechanically
  (`hooks/safety-spine.mjs`); the only override is a human-authored, schema-governed local file
  (`SafetyOverrides`), itself write-protected and logged when exercised.
- **Advisory hooks never block.** Stop-event hooks may only inform (`systemMessage`); a
  blocking Stop hook would be a second gate behind the judge.
- **Lanes thin ceremony, never verification** *(design — §4.7, not yet implemented)*. No lane
  skips EVAL, T0, or the hooks; a lane may only remove PO ceremony and scout work.

---
[← Verification & Quality Strategy](05-verification-and-quality-strategy.md) · [Back to index](README.md)
