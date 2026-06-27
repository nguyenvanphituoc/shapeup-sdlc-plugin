# Changelog

All notable changes to this plugin are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Trigger-eval evidence layer (Stage C1, dismantles the F1 fiction).** The real version of the
  evidence layer the prior roadmap claimed "LANDED" but never committed. Each skill now has
  `skills/<name>/evals/trigger-evals.json` — 103 `{query, should_trigger}` cases across 9 skills,
  every dataset pairing positives with **cross-skill hard negatives** (a sibling's queries, tagged
  `expected_other`) plus an out-of-harness control. `scripts/trigger-eval.mjs` (repo-only) measures
  **real Skill-tool activation** with the plugin installed (`--plugin-dir .`), explicitly *not* the
  slash-command self-invocation that made the prior TPR≈0 a proxy artifact. Two honesty guards: the
  baseline (`evals/baselines/trigger-evals.baseline.json`) ships `status: "unmeasured"` /
  `results: null` and **no number is fabricated** until an auth'd run produces it; and a measurement
  run that produces no parseable model events **aborts without writing** rather than recording every
  case as a non-trigger. Structural **#16** enforces dataset shape + the honesty invariant (an
  `unmeasured` baseline carrying results fails CI). Coverage grew 137 → **159 checks**.
- **Judge calibration — verdict ledger (Stage D1, closes F3).** `spec-evaluator` (v0.7) gains
  `references/verdict-ledger.md`: (1) **re-probe on FAIL** — re-run a failing probe once before
  finalizing; if the two disagree the FAIL stands but is marked flaky/confidence-low; (2)
  **per-criterion confidence** (high/medium/low) by a fixed rule, reported but never overriding the
  verdict; (3) an append-only **`.verdicts-<task>.jsonl` ledger** that flags verdict **flips**
  across runs (a flip forces confidence low and a stability line in the report). New GATE V2.1b +
  Phase B.0 steps, two hard rules, and a report stability block. The single-judge invariant is
  untouched — same judge, same probe, bookkeeping over its own outputs (no second grader). A
  repo-only `scripts/verdict-ledger.mjs` implements the flip/confidence grammar with structural test
  **#15** proving it discriminates an unstable judge from a stable one; **not shipped** (F9).
  Structural coverage grew 127 → **137 checks**.
- **GATE L2 is now runtime-enforced (Stage E1, closes half of F2).** A `PreToolUse` hook
  (`hooks/gate-l2.mjs`, matcher `Skill`) hard-blocks the once-per-round EVAL delegation
  (`spec-evaluator --single-pass`/`--feature`, no `--task`) whenever `tasks/_index.md` is not fully
  green — the deny message names the unfinished tasks and routes back to BUILD. It reads two
  independent sources (per-task frontmatter `status:` + the board table) and **fails closed** on a
  partial board, **open** when there's nothing to verify (no `--spec`, no board, per-task eval,
  other skill) so it can't break legitimate or standalone runs. This is the audit's "one real gate
  beats ten honor-system ones" — every other ⏸ GATE remains a prompt-level instruction. Structural
  test **#14** exercises deny/allow against temp board fixtures; **#4** was hardened to reject the
  invalid-event bug class (the dead `ShapeupSessionStart` → real `SessionStart`) and to assert every
  hook-referenced script exists. Structural coverage grew 119 → **127 checks**.
- **Anti-leniency regression fixture (Stage C2, judge-first).** The first Tier-2 functional fixture
  — `examples/eval-planted-bug/` — plants a FizzBuzz AC4 bug (`15` → `Fizz`) in a build dressed to
  look done: every AC box ticked, its own test suite green-but-blind. The skeptical
  `spec-evaluator` must FAIL it by probing the running CLI (TS-04), not trusting the green suite; a
  known-correct control build must PASS. The bug's reality is proven **deterministically** by
  structural test **#13** via the `process` oracle (PASS on correct, FAIL on buggy) — no Claude
  auth needed; the LLM behavioral assertion (`evals.json` + `EXPECTED-VERDICT.md`) is documented for
  the auth-gated `eval-gate` run. Repo-only dev/CI asset (not shipped, per F9). Structural coverage
  grew 107 → **119 checks**. See `examples/eval-planted-bug/README.md`.
- **Evaluation contract complete (Stage G).** `spec-evaluator` can now judge non-UI deliverables
  with evidence-cited verdicts. `references/probing.md` describes each oracle as a **self-contained
  spawn-and-grade procedure** (with an inline `expect` grammar) the evaluator runs via Bash —
  `process` (CLI/scripts), `test` (libraries; zero-test suite FAILs), `snapshot` (generators/pure
  refactors; diff vs golden), `http` (services; unreachable = FAIL every criterion), plus `ui`
  (Playwright). The single-judge invariant is untouched — the oracle changes only *how* evidence is
  gathered. See `docs/audit/evaluation-contract-spec.md`.
- **Executable reference implementations (dev/CI only).** `scripts/oracles/*.mjs` + `examples/*`
  implement that exact grammar with negative-control tests, so the documented procedure is proven to
  discriminate. They are **not shipped** (and not called by the installed skill) — see "Runtime
  model" in the spec.
- **Install-safety guard.** Structural test **#12** fails any shipped skill file that references a
  repo-only path (`scripts/`, `examples/`, `docs/audit|plan|research/`, `tests/`) that would not
  exist in an install. Fixes finding **F9** (shipped skills had dangling refs to the oracle runners,
  example contracts, and `docs/` cross-refs). Structural coverage grew 62 → **107 checks**.

### Changed
- **Versioned migration system.** Updating an install is now a Flyway/Rails-style migration:
  `scripts/migrate.sh` updates code (replaces skills) then applies pending
  `scripts/migrations/NNNN__*.sh` in order, tracked in a committed
  `docs/shapeup-sdlc/.harness-migrations` ledger + `.harness-version` stamp. Idempotent; every
  future version adds its own migration. The old flat-KB transform is now migration `0001`.
  Runner lives in `scripts/lib/lib-migrate.sh`. See `docs/audit/migration-system.md`.

### Removed
- **PowerShell scripts** (`install-harness.ps1`, `lib/lib-harness.ps1`, `migrate-knowledge-base.ps1`)
  — the harness is bash-only now (macOS / Linux; Windows via WSL or Git Bash), keeping a single,
  well-tested code path.
- **`scripts/migrate-knowledge-base.sh`** — superseded by `scripts/migrate.sh` (its transform is
  migration `0001`). Update existing installs with `migrate.sh` instead.

## [0.2.6] - 2026-06-23

### Fixed
- **`curl | bash` / `irm | iex` install was broken in 0.2.5.** The shared lib refactor made the
  installer source a sibling `lib/lib-harness.{sh,ps1}` that does not exist when the script is
  piped, failing with `lib/lib-harness.sh: No such file or directory`. Both installers and the
  migration scripts now bootstrap the lib: source the sibling file when run from a clone, or
  download it from the repo when piped.

### Added
- **Remote update one-liner.** Existing installs can upgrade with a piped
  `migrate-knowledge-base.sh` (auto-detects installed CLIs under `--yes`); documented in the README.

## [0.2.5] - 2026-06-23

### Added
- **Team-shared, read-back knowledge base.** `/coach` now files each guideline by skill under
  committed `docs/shapeup-sdlc/knowledge-base/<skill>.md` (shared on `git pull`) instead of one
  flat, gitignored `.shapeup-sdlc/knowledge-base.md` that was never read back. New **GATE COACH-1**
  asks the PO which skill each rule belongs to (`task-executor`, `ba-pitch-analyzer`,
  `qa-edge-hunter`) — never assumes. `spec-evaluator` is deliberately not coachable (single-judge
  rule: the KB is guidance, not an invariant).
- **Read-side hooks**: `task-executor` (Phase 1), `ba-pitch-analyzer` (Phase 1), and
  `qa-edge-hunter` (Phase Q1) each load their own knowledge-base file at the top of their run.
- **Migration scripts** (`scripts/migrate-knowledge-base.sh` and `.ps1`): one-time, idempotent,
  non-destructive upgrade for existing installs. Prompts for which AI CLI(s) are in use (Claude
  Code / Antigravity / Codex) — auto-detecting under `--yes`/`-Yes` — and **replaces the installed
  skills** for each, then moves an old flat knowledge base into the new committed location,
  preserving rules into `_INBOX.md` for `/coach` to categorize (never auto-assigned), and retires
  the old file.
- **Shared installer library** (`scripts/lib/lib-harness.sh` and `.ps1`): factors out source
  resolution, CLI detection/selection, and per-skill replacement. **Both `install-harness` and
  `migrate-knowledge-base` now reuse it** — the installer no longer duplicates source-download or
  skill-copy logic.

### Changed
- `tech-lead` 0.12: GATE L4 hands raw feedback to `/coach`, which now owns categorization; the
  tech lead no longer points at the local knowledge-base path.

## [0.2.0] - 2026-06-19

### Added
- **Local scaffolding installer** (`scripts/install-harness.sh` and `install-harness.ps1`): installs
  the harness as local files into any target repository, configuring Claude Code (`.claude/skills/`),
  Antigravity (`.agents/skills/`, `.agents/subagents/`), and Codex (`.codex/skills/`) in one command.
- Remote install downloads the source tarball and `antigravity-subagents.zip` directly from the
  latest GitHub Release asset — no `git clone` of the repo required.
- Release workflow now archives and publishes `antigravity-subagents.zip` and `cursor-rules.zip`
  as GitHub Release assets, making them available for the remote installer.

### Changed
- **Two-root workspace.** Collapsed the three runtime artifact roots into two, keyed off
  the feature `<slug>` and split by collaboration need (`shapeup` v2.2, `tech-lead` v0.9):
  - **Shared** (committed): `docs/shapeup-sdlc/<slug>/shaping/` + `docs/shapeup-sdlc/<slug>/spec/`,
    plus the harvest feed `docs/shapeup-sdlc/metrics.jsonl`.
  - **Local** (hidden, gitignorable — one line `.shapeup-sdlc/`): run-state, digest, `orient/`,
    `evaluation/`, `qa/`, `discovery/ledger.md`, `harness-run.md`, `spikes/`.

  Migration for in-flight specs in target repos (old → new):
  - `docs/shaping/<slug>/`        → `docs/shapeup-sdlc/<slug>/shaping/`
  - `.claude/specs/<slug>/` (deliverable docs) → `docs/shapeup-sdlc/<slug>/spec/`
  - `.claude/specs/<slug>/` (orient/ · evaluation/ · qa/ · discovery/ · run-state · harness-run) → `.shapeup-sdlc/<slug>/`
  - `.claude/shapeup/runs/<slug>/` → `.shapeup-sdlc/<slug>/`
  - `.claude/shapeup/runs/metrics.jsonl` → `docs/shapeup-sdlc/metrics.jsonl`

  The `.gitignore` carve-out (`.claude/shapeup/runs/*/` keeping `metrics.jsonl` tracked) is
  replaced by a single `.shapeup-sdlc/` line, since the committed metrics feed now lives in
  the shared root.

## [0.1.0] - 2026-06-17

### Added
- Initial release of the Shape Up SDLC harness, packaging eight skills:
  - `shapeup` v2.1 — shaping, breadboarding, spike, framing/kickoff docs, plus a
    per-run context-compaction digest (derived decision read model) consumed at each gate
    (reuses material from [rjs/shaping-skills](https://github.com/rjs/shaping-skills)).
  - `translator` — non-English intake normalization (GATE L0).
  - `orient` — builder-led codebase recon (step 7).
  - `ba-pitch-analyzer` v2.9 — scope mapping into a DDD document tree + Test Surface.
  - `task-executor` v1.3 — vertical building of `TASK-NNN` specs.
  - `spec-evaluator` v0.5 — the single judge, once per round.
  - `qa-edge-hunter` v1.0 — post-PASS exploratory edge hunt.
  - `tech-lead` v0.8 — end-to-end orchestrator; SHIP harvests one fact-only signal row
    to `docs/shapeup-sdlc/metrics.jsonl`.
- `/ship` command, `reviewer` agent, and a `SessionStart` hook.
- Self-hosting marketplace manifest so the repo installs directly from GitHub.
- CI workflow (`claude plugin validate --strict`) and tag-driven release workflow.
- `docs/roadmap.md` — full annotated pipeline diagram.
