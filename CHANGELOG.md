# Changelog

All notable changes to this plugin are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
