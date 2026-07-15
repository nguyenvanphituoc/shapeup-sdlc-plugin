# Changelog

All notable changes to this plugin are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-07-15

**Absorb & Audit (dwarves-kit × shapeup-sdlc) — P1–P4 landed, P5 shaped.** The machine gets a
safety spine, the session gets advisory honesty checks, the metrics shards get a reader, and a
context compaction gets a mechanical "re-read the files" reflex. **No behavior change to
worker skills — all machinery is orchestrator-layer** (hooks/, tech-lead scripts/schemas,
tests, docs); every new data flow is a schema-governed JSON record registered once in the
domain registry.

### Added
- **P1 — `hooks/safety-spine.mjs`** (PreToolUse `Bash|Read|Write|Edit|MultiEdit`): denies
  destructive-fs (`rm -rf` on unrecoverable targets, wide `git clean`), git-destructive
  (force-push, push-to-main, `git reset --hard`), sql-destructive (`DROP`/`TRUNCATE`),
  secret reads (`.env`, `*.pem`, `*.key`, ssh/cloud credentials — shell readers and the
  `Read` tool alike), and self-protects its own override file. Escape hatch:
  human-authored `.shapeup-sdlc/safety-overrides.json` (`$defs/SafetyOverrides`) — a corrupt
  overrides file is treated as absent (override channel fails closed), and every exercised
  override is logged as a `SAFETY-OVERRIDE` pathology row. Denies log `SAFETY` rows.
- **P2 — advisory Stop hooks**, both harness-scoped and mechanically incapable of blocking
  (exit 0 always, at most a `systemMessage` — "QA is a level-up, not a gate"):
  `hooks/anti-rationalization.mjs` (a completion claim in the final message is checked
  against board frontmatter, the latest T0 verdict, and open escalates — contradictions are
  named out loud) and `hooks/slop-cleaner.mjs` (TODO/FIXME, `console.log`/`debugger`,
  commented-out-code blocks, 400+-line single-file adds — in added lines of the session's
  diff only).
- **P3 — `skills/tech-lead/scripts/stats.mjs`**: the telemetry read-plane over
  `docs/shapeup-sdlc/metrics/*.jsonl` — rounds per pitch, hammer-cut rate,
  attempt-budget exhaustions, QA promotion rate, round-count trend. Emits a self-validated
  `$defs/StatsReport` (`--format table` for humans); read-only by construction (only read
  APIs imported; a structural test asserts the metrics dir is byte-identical after a run).
  `MetricsRow` gains optional `at` + `attempt_exhaustions` fields so exhaustions are
  harvested facts, never re-derived (single-judge rule).
- **P4 — compaction resilience**: `skills/tech-lead/scripts/run-snapshot.mjs` derives a
  `$defs/RunSnapshot` from files only (pointer, `harness-run.md`, board, `t0/verdicts/`
  filenames, `orders/`−`results/` diff); `hooks/compact-snapshot.mjs` (PreCompact) persists
  it before compaction (PreCompact cannot inject context — verified); and
  `hooks/session-rehydrate.mjs` (SessionStart, matcher `compact|resume`) injects the
  fresh-derived `rehydrate_hint` as `additionalContext`: *trust the files, not the summary*.
- **P5 — risk lanes, design only**: `docs/design/04-functional-design.md` §4.7 (tiny/normal/
  full lanes, selection reusing ba's `lens: lite` predicate, per-lane `--auto` gate sets) and
  a draft `$defs/Lane` with a machine-readable `x-lane-policy`. New (design-marked)
  invariant: **lanes thin ceremony, never verification** — no lane skips EVAL, T0, or hooks.
  No runtime reads any of it yet.
- **Structural tests #25–#30** (265 → 369 checks): the tech-lead prompt line-count ratchet
  (≤750), the doc-drift check (skill counts, two-way hook inventory, cited-path existence,
  self-asserted checks floor), and fixture suites for every new hook and script.

### Changed
- `hooks/hooks.json` — registers the safety spine (PreToolUse), both advisory hooks (Stop),
  the compaction pair (PreCompact + SessionStart `compact|resume`).
- Docs synced and now drift-checked: README hook inventory completed (including the
  previously undocumented `validate-envelope.mjs` PreToolUse entry — pre-existing drift),
  design/03 gains §3.2b (advisory hooks) + §3.2c (compaction resilience), design/04 resolves
  the `--auto` gate-set inconsistency (the GATE L0.7/Flags table is authoritative:
  L1a/L1b/L3/L4), design/06 adds the three new invariants, design/07 adds the v1.2 entities
  and the read-plane ERD, and exact test-count literals became ratcheting floors
  ("330+ checks").
- `skills/tech-lead/SKILL.md` — **untouched** (724 lines; the ratchet now enforces it).

## [1.1.0] - 2026-07-14

**Central domain registry + tier-direction discipline.** Every cross-boundary record type and
payload field is now defined exactly once, and persisted links are linted to flow
LOCAL→SHARED only. No behavior change to the SDLC loop; all architectural invariants intact.

### Added
- **`skills/tech-lead/schemas/domain.schema.json`** — the central domain registry: every
  cross-boundary record type (`$defs`) annotated with tier/location/writer/readers, the
  `x-erd` relationship map, and the `x-payload-by-worker` / `x-result-by-worker` tables. The
  envelope schemas `$ref` it; no skill defines its own cross-boundary field.
- **`$ref` resolution in `validate-envelope.mjs`** — same-document (`#/$defs/Name`) and
  sibling-file (`domain.schema.json#/$defs/Name`) pointers, with a file cache and a
  cycle guard; still zero-dep.
- **Two new spec-lint rules** (`spec-lint.mjs`):
  - `TIER-DIRECTION` (red) — a committed (SHARED) spec doc wikilinking the LOCAL board
    (`[[tasks/...]]`): task ids are machine-local and `.shapeup-sdlc/` is gitignored, so a
    committed task link dangles on every fresh clone; cite the UC or scope_id instead.
  - `UC-ANCHOR` (red) — an implementation task with empty `use_case_refs` or a ref that
    resolves to no `usecases/UC-*.md` (single-anchor rule; SPIKE/CHORE/DOCS/MIGRATION exempt).
- **"Envelope contract — the domain layer" section in every worker SKILL.md** that lacked one
  (advisor-protocol, coach, scope-hammer, translator, tech-lead): documents the WorkOrder
  in / WorkResult out dispatch and maps standalone flags 1:1 onto the registry's
  per-worker payload/result fields.
- **`docs/design/` suite** (README + 01–07): objective & product value, high-level design,
  system design, functional design, verification & quality strategy, appendix, and the
  domain ERD that `domain.schema.json` mechanizes.
- **`examples/simulate-task-executor-flow.sh`** — end-to-end walkthrough of the
  compile-order → task-executor → ingest-result dispatch cycle.
- Structural test section #24 (domain registry: every `$ref` resolves, the payload map is
  consistent, validation discriminates through the ref chain): 223 → 265 checks.

### Changed
- `work-order.schema.json` / `work-result.schema.json` slimmed to `$ref` the domain registry
  instead of inlining shared record definitions (−200 lines of duplication).
- ba-pitch-analyzer templates and references aligned to tier direction: SHARED templates no
  longer link `[[tasks/...]]` or `[[run-state]]`; risk tables cite the UC instead of a task.
- `board-derive.mjs` / `compile-order.mjs` — header pointers to the domain registry.

## [1.0.0] - 2026-07-13

**Pure-skill architecture** (`docs/plan/pure-skill-architecture.md`, phases P0–P4 landed in
one pass). The orchestrator layer now owns ALL pipeline management and feeds each executor a
structured envelope; worker skills contain only craft. The high-level SDLC design is
unchanged: same three-phase loop, same gates L0–L4, and every architectural invariant intact
(single judge, EVAL exactly once per round, two-level circuit breaker, mechanical hill,
ledger single-source-of-truth, role separation) — they are application-layer policy and live
in tech-lead, exactly where clean architecture puts policy.

### Added
- **P0 — the two-envelope port.** `skills/tech-lead/schemas/work-order.schema.json` +
  `work-result.schema.json` (the harness's canonical ports) and
  `skills/tech-lead/scripts/validate-envelope.mjs` — a zero-dep validator that doubles as a
  PreToolUse hook (wired in `hooks/hooks.json` on Skill|Agent): a dispatch whose `--order`
  file is missing or schema-invalid is DENIED; no `--order` → defer (standalone stays free).
- **P1 — the pipeline sub-layer (scripts, not LLM skills — DD-7).**
  `compile-order.mjs` assembles a WorkOrder from facts only (scope contract, this scope's
  tasks + parsed ACs, promoted round-ledger decisions, the previous attempt's AEGIS triples,
  per-operation substrate whitelists) — replacing tech-lead's hand-assembled `isolated_brief()`
  and every worker's GATE A/B plumbing. `ingest-result.mjs` is the single writer of shared
  state: ticks AC boxes, flips task/board status, appends the Execution Log, propagates
  unblocks, appends discoveries to the ledger, applies the judge's refuted list + verdict
  JSONL, queues escalates — schema-validated, so a malformed result never mutates the board.
- **P3 — the planner's mechanical layer.** `board-derive.mjs` (unlocks = depends_on inverse
  with `--write`, Σ hours, critical path, Appetite-Guard arithmetic, board-vs-T0 drift flag —
  KB-BA-001's asymmetric edges become structurally impossible) and `spec-lint.mjs` (PA1
  directory-thinking, PA2 size cap, substrate DISJOINT check, spec-structure/wikilink/
  edge-symmetry walk — the worker no longer grades its own output).
- **New skill: `scope-architect`** — Phase 6b + `--remap`/`--split` extracted from
  ba-pitch-analyzer as its own pure worker (distinct authority: sole writer of
  `scopes/*.json`; distinct failure mode: PA1), with trigger-eval dataset.
- Structural test sections #20–#23 (envelope discrimination + hook deny/defer, compile-order
  fact-threading, ingest single-writer round-trip incl. refute/unblock/reject, board-derive +
  spec-lint discrimination): 223 checks total.

### Changed
- **P2 — task-executor rewritten pure** (580 → ~210 lines): WorkOrder in → code + WorkResult
  out. Deleted GATE A/B/E, Phase 3 doc fan-out, all standalone-vs-brief branching; kept the
  craft verbatim (PLAN assumptions + observable criteria, Karpathy minimum-code/surgical, UI
  Layer 1/2/3, contract-reference, Non-Go stop, ESCALATE, zero-memory rule). New
  anti-rationalization table + verification checklist (agent-skills anatomy).
- **P3 — spec-evaluator rewritten pure** (462 → ~230 lines): criteria/verdict/refuted-boxes
  return as data; `.verdicts` append, task-file annotation, box un-ticking and run-state
  writes moved to ingest. Skeptical posture, T0-citation (sha256 recomputed), affordance-only
  UI grading, dimension model — unchanged.
- **P3 — ba-pitch-analyzer rewritten pure** (670 lines/15 flags/12 prose modes → ~190 lines,
  4 operations): mode write-rules are now per-operation substrate whitelists in
  compile-order, enforced by the sandbox hook instead of trusted to prose. Stateless: no
  run-state.md, no pitch_hash, no counters. Standalone keeps two flags (input, `--lens`).
- **P3 — orient / qa-edge-hunter aligned**: output-path conventions moved into the order;
  QA findings return in `discoveries[]` (ingest appends the ledger; single-writer preserved
  mechanically).
- **tech-lead 1.0**: BUILD is four calls — compile order → dispatch (`--order`) → ingest
  result → t0-verify; MAP SCOPES dispatches ba-pitch-analyzer then scope-architect;
  delegation/round-protocol references rewritten to the envelope port; GATE L1b disjointness
  re-assertion now runs `spec-lint.mjs`.
- **Scripts live inside their owning skill** (per the custom-skills packaging model — a
  skill's scripts ship beside its SKILL.md, so they exist on every channel that ships
  `skills/`): the orchestrator pipeline (`compile-order`, `ingest-result`,
  `validate-envelope`, `t0-verify`, `aegis-digest` + the two envelope schemas) moved to
  `skills/tech-lead/scripts|schemas/`; the planner mechanics (`board-derive`, `spec-lint`)
  to `skills/ba-pitch-analyzer/scripts/`; `sandbox-guard.mjs` to `hooks/` beside
  `gate-l2.mjs` (it is a PreToolUse hook, not skill tooling). Skill prose references its own
  scripts skill-relatively and sibling skills' scripts as `skills/<name>/scripts/…`
  (plugin-root relative). `scripts/shapeup-sdlc/` retains only dev/CI tooling (oracles,
  trigger-eval, verdict-ledger, distribute, migrations).
- Structural test #12 reworked from a pattern whitelist to existence checks: skill-local
  `scripts/` references must resolve inside that skill's directory; cross-skill
  `skills/<name>/scripts|schemas/` references must exist. Spec-lint's glob matcher inlined
  from sandbox-guard so the ba skill stays self-contained.
- **Migration `0004__pure-skill-architecture.sh`** for existing installs (skill code itself
  is replaced by `migrate.sh` step 1, which now also carries the bundled scripts/schemas +
  the new scope-architect skill): (1) refreshes the target's AGENTS.md
  `<!-- HARNESS_START/END -->` block — the old block documents retired flags an agent would
  still try to use, and `migrate.sh` never touched AGENTS.md before; byte-stable on re-run,
  user content outside the block preserved; (2) runs `board-derive.mjs --write` per local
  board so pre-v1.0 hand-authored `unlocks` don't trip spec-lint's EDGE-SYMMETRY red;
  (3) flags (never deletes) retired `briefs/` dirs and worker-written `run-state.md`.

### Removed
- **P4 — the legacy brief format** (`briefs/r<N>-a<M>.md`) and `--brief` mode; all
  standalone-vs-orchestrated dual-mode branching inside workers; ba's 15-flag surface
  (`--tasks-only`, `--from-discovered`, `--remap`, `--surface-only`, `--status`, `--assess`,
  gate-skip flags — each now caller context: an operation, a whitelist, or a script);
  task-executor's plumbing reference files (gates/context-loading/doc-update-rules/
  implementation-rules); ba's gates.md + audit-rules.md; worker-held state everywhere
  (**D6 closed — mechanically**, not aspirationally: the delegation.md caveat is gone).

## [0.5.0] - 2026-07-13

Root-caused and fixed the `island-escape` Ship-Gate findings (KB-BA-001/KB-BA-002): both KB
entries were symptoms of structural defects, now mechanized into the harness instead of left
as worker steering.

### Fixed
- **GATE L2 hook fail-open since v0.4.0** (`hooks/gate-l2.mjs`). The hook resolved the task
  board at `<spec>/tasks/_index.md`, which the Local Tasks Architecture emptied — so the
  round-EVAL gate silently stopped enforcing (island-escape reached EVAL with 16/20 task files
  `status: ready`). It now resolves `.shapeup-sdlc/<slug>/tasks/` (slug from `--feature`, spec
  path convention as fallback, `<spec>/tasks/` kept for pre-v0.4.0 layouts) and stays fail-open
  only when no board exists on the machine (legitimate boardless grading, spec-evaluator v0.9).
  4 new structural tests (#14).
- **Sandbox guard (PA3) blocked the doer's own bookkeeping**
  (`scripts/shapeup-sdlc/sandbox-guard.mjs`). On scoped runs the guard denied every write
  outside the substrate — including task-executor P3's required doc updates (status, AC ticks,
  `tasks/_index.md`, run-state, the P3.7 discovery ledger), which is the mechanism behind the
  stale board. New run-trace carve-out: writes under the ACTIVE feature's
  `.shapeup-sdlc/<slug>/` root are always allowed; `.shapeup-sdlc/active-scope` (the guard's
  own pointer) and other features' roots remain guarded. 4 new structural tests (#17).

### Changed
- **`ba-pitch-analyzer` v3.3 — Link-Field Integrity + drift handling.**
  - `unlocks` is now a DERIVED field: recomputed as the full board's `depends_on` inverse on
    every board write (Phase 6, `--tasks-only`, `--from-discovered`). The reconcile mode's
    regenerate-whitelist now explicitly includes existing tasks' `unlocks` frontmatter —
    the old "Regenerate ONLY" list prohibited the back-patch, which is what produced
    island-escape's 10 asymmetric edges. Audit L3-06 upgraded from "field present" to an
    edge-symmetry check.
  - UC `related_tasks` RETIRED (schema, template, synthesis S-01 single-source, spec-evaluator
    CMP-2 rephrased with identical semantics). Rule: never declare a bidirectional field
    across the committed/local boundary — task ids renumber per machine, so reverse lookup is
    always computed live. Pre-v3.3 specs keep the field ignored (non-regression).
  - Bare `--tasks-only` bootstrap initializes task `status` from committed mechanical truth at
    SCOPE granularity (hill shard FINISHED → done; join on scope, never task id). Companion to
    the GATE L2 fix — without it the repaired hook would hard-block re-EVAL on every freshly
    bootstrapped machine for a finished feature.
  - `--from-discovered` gains a drift check that FLAGS (never fixes) board-vs-T0 status
    disagreement as ⚠️ markers in `tasks/_index.md`; `--remap` reports drift in its gate block
    only (its write contract stays `scopes/*.json` + `scope-board.md`). Status authority stays
    with task-executor / the tech lead.
- **`coach` — new `harness-defect` category at GATE COACH-1.** Feedback whose root cause is
  the mechanism itself (a fail-open hook, a gate reading the wrong file, contradicting skill
  contracts) is no longer force-fit into a worker KB: the PO can now categorize it
  `harness-defect`, and the coach files it to the committed defect register
  (`docs/shapeup-sdlc/knowledge-base/harness-defects.md`) as a drafted raw idea for the
  Betting Table — durable and PO-visible, but read by no worker. Step 3's merge pass also
  reclassifies wrong-premise KB rules into the register instead of re-teaching them
  (KB-BA-002 was exactly this class: it filed a PA3/gate defect as BA steering, on a premise
  task-executor v1.2 and tech-lead v0.5 contradict).

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
