# 06 — Appendix: File Layout & Invariants

[← Back to index](README.md)

## Repository layout

```
.claude-plugin/          plugin.json · marketplace.json
skills/<name>/SKILL.md   the 12 harness skills (+ references/)
skills/tech-lead/        schemas/ (WorkOrder · WorkResult · gate-answers · domain registry)
                         workflows/shapeup-run.js — the whole pipeline as one launchable script
kernel/harness.mjs       the deterministic half behind ONE entry point (and therefore one
                         permission prefix). Subcommands:
                          compile — the envelope port's order compiler
                          verify  — t0 · spec · envelope · dispatch · skills · budget ·
                                    ratchet-tree · trace
                          reduce  — ingest (the single writer) · board · verdict · hill ·
                                    graph · snapshot · ship · leftovers
                          probe   — resume · t0 · stats · digest
                          report  — export · facts (read-only fact tables keyed by run id)
                          init    — run · fit
                          gate    — the gate answer set
                          lib/    — argv · contract · paths
bin/init.mjs             `npx shapeup-sdlc init` — pure-Node scaffolding + permission grant
commands/*.md            10 slash commands (/shape /orient /scopes /wire /build /eval /qa
                         /hammer /ship /retro)
hooks/                   hooks.json + PreToolUse: safety-spine · gate-intake ·
                         sandbox-guard (+ the kernel's harness verify envelope) ·
                         PostToolUse: dispatch-receipt (records only, no deny path) ·
                         Stop: gate-zerowork (the one blocking hook)
                         + lib/decision.mjs (every hook records allow / deny / error)
scripts/install-harness.sh, migrate.sh    stable public entrypoints — a frozen URL contract
scripts/shapeup-sdlc/    what those two entrypoints run on a user's machine — lib/
oracles/                 the evaluation-contract oracle registry (test · snapshot · http ·
                         process), proven to discriminate against negative controls
tools/                   repo-only, never shipped — demo/
tests/structural.mjs     Tier 0 runner — threads tests/lib/ helpers through the per-domain
tests/{lib,structural}/  suites in tests/structural/*.mjs; 1000+ checks, zero LLM calls (a
                         FLOOR, deliberately not the exact count — this line is where the suite
                         parses it, and pinning it to the running total would fail on every
                         legitimate removal. It may only grow EXCEPT when checks are deliberately
                         removed with the code they covered: lowered twice during v2.0, once when
                         six hooks were retired into the runtime and their behavioural checks went
                         with them, and again when eight tech-lead references were consolidated
                         into four; raised to 1000 once the v2 suite settled above it. A floor
                         left far below the real count is a check that can no longer fail)
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
- **Advisory checks never block — with exactly one named exception.** The claim-versus-facts
  census and the leftovers scan may only inform, and they now do it as *sections of the ship
  report* rather than as Stop hooks; either one blocking would be a second gate behind the judge.
  `gate-zerowork.mjs` **does** block (`decision: "block"`), deliberately: it fires on a run that
  produced no receipt at all, which is not a judgement about quality but the absence of any work
  to judge. Stated here because the invariant read as absolute while the code carried a
  counter-example — and an invariant with an undocumented exception is how a reader concludes the
  code is wrong when it is the sentence that is.
- **Lanes thin ceremony, never verification** *(design — §4.7, not yet implemented)*. No lane
  skips EVAL, T0, or the hooks; a lane may only remove PO ceremony and scout work.

---
[← Verification & Quality Strategy](05-verification-and-quality-strategy.md) · [Back to index](README.md)
