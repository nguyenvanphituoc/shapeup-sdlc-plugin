# Changelog

All notable changes to this plugin are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.4.0] - 2026-07-12

### Changed
- **Local Tasks Architecture** (`docs/plan/local-tasks-architecture.md`). The task board
  (`tasks/TASK-NNN*.md` + `tasks/_index.md`) moves out of the committed SHARED spec dir
  (`docs/shapeup-sdlc/<slug>/spec/`) into the LOCAL, gitignored run-trace root
  (`.shapeup-sdlc/<slug>/tasks/`). The shared repo now carries only high-level requirements —
  `usecases/`, `domain-model.md`, `contracts/`, `scopes/`, `scope-summary.md` — never
  implementation-planning detail.
  - **`ba-pitch-analyzer` v3.2**: Phase 6 writes `tasks/` to the LOCAL root. New bare
    `--tasks-only [spec_folder]` bootstrap mode regenerates a missing local board from the
    committed spec alone (no discovered-ledger reconciliation).
  - **`spec-evaluator` v0.9**: grading source of truth moves from a task file's own
    `## Acceptance Criteria` onto the committed `usecases/UC-*.md` (Steps, Error Cases,
    Invariants, Test Surface) + `domain-model.md`. A local task file, when present, is
    read only for traceability and AC-checkbox bookkeeping — its absence is no longer a
    hard stop (new GATE V0.2b).
  - **`tech-lead` v0.15**: GATE L1b (Board Review) now reviews the SHARED plan —
    `usecases/_index.md` + `scopes/*.json` + `scope-summary.md` — instead of the LOCAL task
    board, keeping implementation detail out of the PO gate on any spec with scope contracts.
    New bootstrap check auto-invokes `ba-pitch-analyzer --tasks-only` when a teammate (or a
    resumed run) has the shared spec but no local board yet.
  - **`task-executor` v1.5**: GATE A resolves `tasks/<task_id>*.md` from the LOCAL root; a
    missing local board next to a present shared `usecases/` is a soft, bootstrappable
    condition, not a hard failure.
  - **Migration `0003__local-tasks-architecture.sh`**: moves any pre-v0.4.0 committed
    `docs/shapeup-sdlc/<slug>/spec/tasks/` to `.shapeup-sdlc/<slug>/tasks/` for every existing
    feature slug, idempotently.

## [0.3.0] - 2026-07-12

### Added
- **v0.3.0 harness upgrade (design spec v1.1 + file-organization addendum).** Design paper:
  `docs/v3/`. Six agent pathologies (PA1–PA6) now each have a mechanical countermeasure, active
  only when a spec folder has scope contracts (`docs/shapeup-sdlc/<slug>/scopes/*.json`) —
  fully non-regression on pre-v0.3.0 specs.
  - **T0 mechanical layer** (`scripts/shapeup-sdlc/t0-verify.mjs`, `scripts/shapeup-sdlc/aegis-digest.mjs`): every build
    attempt runs the scope's Playwright fixtures + an optional DB probe, then — on green — a
    **seesaw regression check** against every already-FINISHED scope's fixtures. Writes a citable
    JSON verdict artifact (sha256'd) that `spec-evaluator`'s new GATE V0.7 requires — a verdict
    is now structurally invalid on a scoped spec without citing it (closes the "hospitality
    trap", PA4). Zero LLM tokens; deterministic tooling, not a second judge (DD-7). A seesaw
    regression triggers a safe `git stash` (never a hard discard) + retry, not a silent merge
    (PA5). Failures are distilled by the AEGIS digester into `{file, line, core_message}` triples
    fed into the next attempt's brief — no raw log dumps (PA6).
  - **Sandbox guard** (`scripts/shapeup-sdlc/sandbox-guard.mjs`, new `PreToolUse` hook on `Edit|Write|MultiEdit`):
    blocks any write outside the active scope's `allowed_file_substrate` (+ declared
    `shared_substrate`), reading a `.shapeup-sdlc/active-scope` pointer written by `tech-lead` at
    scope checkout. Fail-open when no harness round is in progress; every denial is logged as a
    `PA3` pathology event to `docs/shapeup-sdlc/metrics/<machine-id>.jsonl`.
  - **Scope contracts** (`ba-pitch-analyzer` v3.1, new Phase 6b/GATE 6b): groups the task board
    into vertically-sliced, committed scope contracts — import/business-flow slicing (never by
    directory, PA1 lint), a size lint (PA2), an `affordance_manifest` (Layer 1 of the UI
    anatomy), and `e2e_verification_fixtures` authored at contract time. New `--remap` mode
    reconciles discovered tasks into scopes or splits a stuck one.
  - **`advisor-protocol`** (new skill): the `ESCALATE` grammar (design-decision / spec-ambiguity /
    substrate-expansion) workers use instead of guessing or asking ad hoc, capped at 3/scope/round,
    answers persisted immediately to a new committed `round-ledger.md` so they survive
    `task-executor`'s **zero-memory handoff** (isolated per-attempt briefs, no prior-attempt chat
    history — flat per-attempt token cost, PA6).
  - **`scope-hammer`** (new skill): GATE H's census → baseline comparison (never vs. a perfect
    ideal) → cut list + ship verdict, handling all three stop triggers (normal stop, outer
    round-budget breaker, inner per-scope attempt-budget breaker) — `tech-lead` SHIP now
    delegates here instead of hammering inline.
  - **Two-level circuit breaker** (`tech-lead` v0.13, DD-9): the existing `--max-rounds` becomes
    the OUTER breaker; a new per-scope `--attempts` (default 5) is the INNER breaker — an
    exhausted scope queues a GATE H hammer *proposal* instead of blocking the round. New GATE
    L0.8 (four-layer model/budget resolution, incl. `.claude/settings.local.json`) and mechanical
    **hill-phase derivation** (`UPHILL_UNKNOWN`/`UPHILL_SOLVED`/`DOWNHILL_EXECUTION`/`FINISHED`,
    committed `hill/<scope-id>.yml` shards) — never self-reported by a worker (DD-10, closes the
    confidence-score risk outright).
  - **Task-executor UI discipline** (v1.4): Layer 1/2/3 anatomy embedded in Phase 2 — bind only to
    the affordance manifest's `test_id`/`role`/`data-state`, hardcoded data arrays banned (the T0
    DB probe exists precisely to catch a pretty frontend over a hollow backend), pixel-perfect
    styling frozen out of this cycle. `spec-evaluator` (v0.8) grades UI **affordance-only** —
    never pixels/colors/fonts — so the freeze can't leak back in through the judge.
  - **File organization** (design spec addendum, Tiers A/B/C): scope contracts and hill shards
    move to the committed `docs/shapeup-sdlc/<slug>/` tree (never a gitignored runtime file — a
    teammate needs scope A's substrate to respect disjointness, and the sandbox hook enforces
    committed truth); the metrics harvest shards to `docs/shapeup-sdlc/metrics/<machine-id>.jsonl`
    so concurrent runs never merge-conflict on one file; new committed Tier C templates
    (`.claude/settings.local.example.json`, `.env.shapeup.example`) with matching `.gitignore`
    rules for the real per-member files. The env file/keys are `SHAPEUP_`-namespaced
    (`.env.shapeup.local`, `SHAPEUP_T0_DATABASE_URL`) so they can never collide with, or be
    mistaken for, the target project's own `.env`/`.env.local`.
  - **Scripts consolidated under `scripts/shapeup-sdlc/`** (mirrors the `docs/shapeup-sdlc/` /
    `.shapeup-sdlc/` naming): `lib/`, `migrations/`, `oracles/`, `distribute.js`, and every
    runtime script (`t0-verify.mjs`, `aegis-digest.mjs`, `sandbox-guard.mjs`, `trigger-eval.mjs`,
    `verdict-ledger.mjs`) moved out of the flat `scripts/` root. `install-harness.sh` and
    `migrate.sh` stay at the stable top-level `scripts/` path on purpose — they are the update
    mechanism's own bookmarked entrypoints, so they are the one thing this reorg must not move.
    `hooks/hooks.json`, `package.json`, `tests/structural.mjs`, and every skill/doc reference
    were repointed at the new paths; test #12's shipped-skill-path guard now matches
    `scripts/shapeup-sdlc/(t0-verify|aegis-digest|sandbox-guard)\.mjs`.
  - **Migration `0002`** brings a pre-0.3.0 install up to the file-organization addendum via
    `migrate.sh`: shards a flat `docs/shapeup-sdlc/metrics.jsonl` into
    `metrics/<machine-id>.jsonl` (old file retired to `metrics.jsonl.migrated`, never deleted),
    adds the Tier C `.gitignore` rules, and drops the Tier C example templates — the same three
    steps a fresh `install-harness.sh` run already did, now available to existing installs too.
  - Structural coverage grew 195 checks (3 new sections: sandbox guard allow/deny + pathology
    telemetry, T0 verdict/artifact/seesaw discrimination, AEGIS digest extraction/dedup).
- **Trigger-eval evidence layer (Stage C1, dismantles the F1 fiction).** The real version of the
  evidence layer the prior roadmap claimed "LANDED" but never committed. Each skill now has
  `skills/<name>/evals/trigger-evals.json` — 103 `{query, should_trigger}` cases across 9 skills,
  every dataset pairing positives with **cross-skill hard negatives** (a sibling's queries, tagged
  `expected_other`) plus an out-of-harness control. `scripts/shapeup-sdlc/trigger-eval.mjs` (repo-only) measures
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
  repo-only `scripts/shapeup-sdlc/verdict-ledger.mjs` implements the flip/confidence grammar with structural test
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
- **Executable reference implementations (dev/CI only).** `scripts/shapeup-sdlc/oracles/*.mjs` + `examples/*`
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
  `scripts/shapeup-sdlc/migrations/NNNN__*.sh` in order, tracked in a committed
  `docs/shapeup-sdlc/.harness-migrations` ledger + `.harness-version` stamp. Idempotent; every
  future version adds its own migration. The old flat-KB transform is now migration `0001`.
  Runner lives in `scripts/shapeup-sdlc/lib/lib-migrate.sh`. See `docs/audit/migration-system.md`.

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
