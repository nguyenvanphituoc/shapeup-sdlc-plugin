# 06 — Appendix: File Layout & Invariants

[← Back to index](README.md)

## Repository layout

```
.claude-plugin/          plugin.json · marketplace.json
skills/<name>/SKILL.md   the 6 harness skills (+ references/ and resources/)
agents/<worker>.md       the 4 workers as plugin subagents; each preloads its skill
kernel/harness.mjs       the deterministic half behind ONE entry point (and therefore one
                         permission prefix). Subcommands:
                          verify  — t0 · envelope · skills
                          init    — run (writes the launch record)
                          gate    — the gate answer set
                          order   — open · close: arms and retires the write fence
                          lib/    — argv · contract · paths · floor
kernel/schemas/          WorkOrder · WorkResult · gate-answers · domain registry
bin/init.mjs             `npx shapeup-sdlc init` — pure-Node scaffolding + permission grant
commands/*.md            10 slash commands (/shape /orient /scopes /wire /build /eval /qa
                         /hammer /ship /retro)
hooks/                   hooks.json + PreToolUse: safety-spine ·
                         sandbox-guard (+ the kernel's harness verify envelope) ·
                         PostToolUse: dispatch-receipt (records only, no deny path) ·
                         + lib/decision.mjs (every hook records allow / deny / error)
scripts/install-harness.sh, migrate.sh    stable public entrypoints — a frozen URL contract
scripts/shapeup-sdlc/    what those two entrypoints run on a user's machine — lib/
oracles/                 the evaluation-contract oracle registry (test · snapshot · http ·
                         process), proven to discriminate against negative controls
tools/                   repo-only, never shipped — demo/
tests/structural.mjs     Tier 0 runner — threads tests/lib/ helpers through the per-domain
tests/{lib,structural}/  ten modules in tests/structural/*.mjs, zero LLM calls; the runner holds a
                         floor on the check count so a refactor that silently deletes checks fails
                         loudly. The floor was reset in the native-first release, when the suite
                         went from 110 modules that pinned the removed engine to ten that execute
                         shipped code, and it should be raised again as the suite grows
examples/                worked fixtures + negative controls for the oracle registry
```

## Architectural invariants

- **Single judge.** The verdict belongs to `spec-evaluator` alone; QA has no verdict and no
  score.
- **EVAL exactly once per round.** QA sits after PASS, outside the loop — never a second
  evaluation pass.
- **Ledger is the single source of truth.** Orient, task-executor, and QA discoveries all funnel
  into one ledger; each writes only its own section.
- **QA is a level-up, not a gate.** It never blocks on what it finds; `--no-qa` or a `skip` answer skips
  it on the record, and the circuit breaker always outranks the hunter. What it cannot do is go
  missing unrecorded: the Ship Sign-off gate refuses `ship` over a hunt the run owed and never paid.
- **Role separation.** Evaluator grades, task-executor fixes, QA discovers — no one does
  another's job.
- **Two circuit breakers, one exit.** An exhausted scope queues a proposal and never blocks the
  round; the outer round budget ends the loop. Both route to the Cut-List Review gate — the run's ending is a ship
  decision made against what is green, never a kill.
- **The witness is mechanical.** A T0 verdict is a command's exit code and a hash, never a worker's
  account of its own progress.
- **Envelope port.** Every dispatch is WorkOrder in / WorkResult out; shared state is written
  only by the loop. A malformed order is denied before it reaches a worker.
- **Safety spine.** Destructive commands and secret reads are denied mechanically
  (`hooks/safety-spine.mjs`); the only override is a human-authored, schema-governed local file
  (`SafetyOverrides`), itself write-protected and logged when exercised.
- **Nothing advisory blocks.** The ship report is the loop's own statement of the run; no hook fires at
  `Stop`, and no check waits behind the judge.

---
[← Verification & Quality Strategy](05-verification-and-quality-strategy.md) · [Back to index](README.md)
