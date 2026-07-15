# Tests

Two tiers, by cost and what they prove. See `docs/audit/independent-audit-and-evolution-plan.md`
for why this layering exists.

## Tier 0 — Structural (built, runs in CI today)

`node tests/structural.mjs`

Zero dependencies, no network, no Claude calls. Proves the plugin is **well-formed**:

1. `plugin.json` / `marketplace.json` / `package.json` parse; required fields present; plugin and
   package versions agree; the marketplace lists the plugin.
2. Every skill directory has a `SKILL.md` with valid frontmatter, `name` matching the directory,
   and a non-trivial `description`.
3. Every `references/<file>.md` mentioned in a `SKILL.md` resolves on disk (broken-link guard).
4. `hooks/hooks.json` parses, every event key is a **real** Claude Code event (guards the F2
   dead-`ShapeupSessionStart` bug class — an invalid event is silently ignored), and every
   `${CLAUDE_PLUGIN_ROOT}` script a hook invokes exists.
5. Regression guard for the `AGENT.md` vs `AGENTS.md` bug the audit found.
6. The `process` worked example (`examples/todo-cli/`) PASSes its reference impl and FAILs a
   do-nothing one.
7. Migrations are well-formed (`NNNN__slug.sh`, unique ids, `migration_up` + `MIGRATION_DESC`).
8. The evaluation-contract **oracle registry** (`scripts/shapeup-sdlc/oracles/index.mjs`) is complete and
   consistent with the docs — every registered oracle has a runner file and is documented.
9–11. Each non-UI oracle PASSes its worked fixture **and** FAILs a negative control (so a
   rubber-stamp grader cannot pass): `test` (`examples/lib-mathx/`, green vs red suite),
   `snapshot` (`examples/refactor-greet/`, golden vs do-nothing), `http` (`examples/http-ping/`,
   working vs reachable-but-broken server). These runners + fixtures are **repo-only dev/CI assets**
   (not shipped) — executable proof that the `probing.md` grammar discriminates.
12. **Install-safety guard (F9):** no shipped skill file (`skills/**/SKILL.md`,
   `skills/**/references/*.md`) references a repo-only path (`scripts/`, `examples/`,
   `docs/audit|plan|research/`, `tests/`) that would be absent at install. Runtime project paths
   the harness creates (`docs/shapeup-sdlc/`, `.shapeup-sdlc/`) are allowed.
13. **Anti-leniency fixture (Stage C2):** the `spec-evaluator` planted-bug fixture
   (`examples/eval-planted-bug/`) discriminates — the `process` oracle PASSes the correct control
   and FAILs the buggy build on TS-04 — and its `evals.json` / gold files are well-formed with the
   leniency trap armed (AC4 ships ticked).
14. **GATE L2 enforcement (Stage E1):** the `PreToolUse` hook (`hooks/gate-l2.mjs`) DENIES the
   once-per-round EVAL on a partial board (naming the unfinished task) and ALLOWS it on a green
   board, while never gating per-task evals, other skills, or non-`Skill` tools. Driven against
   temp board fixtures — proves the gate actually enforces, not just that it parses.
15. **Verdict-ledger calibration (Stage D1):** `scripts/shapeup-sdlc/verdict-ledger.mjs` flags a PASS→FAIL flip
   across runs, forces that criterion's confidence to `low`, leaves stable criteria untouched, and
   exits non-zero on a flipping ledger / zero on a stable one. Proves the judge-calibration grammar
   (`spec-evaluator/references/verdict-ledger.md`) discriminates an unstable judge from a stable one.
16. **Trigger-eval evidence layer (Stage C1):** every skill has a well-formed
   `evals/trigger-evals.json` (own-skill name, ≥4 positives + ≥3 cross-skill negatives, every
   `expected_other` a real skill or `none`), and the baseline obeys the **honesty invariant** — an
   `unmeasured` baseline may carry no results, a `measured` one must carry method + `measured_at`.
   This is the F1 lesson encoded as a test: numbers can never be fabricated.

17–24. Pure-skill architecture mechanics (v0.3–v1.1): sandbox-guard substrate enforcement,
   t0-verify verdict artifacts, aegis-digest triples, envelope schema discrimination,
   compile-order fact-only assembly, ingest-result single-writer behavior, board-derive +
   spec-lint planner math, and the central domain-registry consistency check.
25. **Prompt line-count ratchet (v1.2):** `skills/tech-lead/SKILL.md` may not exceed 750 lines —
   the 24995ba changelog-extraction win encoded as a regression; new logic goes into scripts.
26. **Doc-drift (v1.2):** documented skill counts match `skills/`, every hook registered in
   `hooks.json` is documented in README + design/03 (and no orphan hook files exist), every
   concrete `hooks|skills|scripts|tests|commands/...` path cited in README/docs/design exists on
   disk, and the docs state a checks **floor** (`N+ checks`) that the suite asserts against its
   own final count.
27. **Safety spine (v1.2):** `hooks/safety-spine.mjs` denies destructive-fs / git-destructive /
   sql-destructive / secret-read / self-protect cases (naming the category), allows the precise
   look-alikes (`rm -rf ./build`, `--force-with-lease`, `.env.example`…), honors — and logs — the
   overrides file, treats a corrupt overrides file as absent, logs SAFETY pathology rows, and
   fails open on garbage stdin.
28. **Advisory Stop hooks (v1.2):** anti-rationalization emits a `systemMessage` naming the
   contradicting facts on a red fixture + completion claim, stays silent on green/claimless/
   no-run/`stop_hook_active` cases, and never emits a `decision` key; slop-cleaner's `scanDiff`
   flags console.log/TODO/big-add slop in added lines only and its CLI fails open.
29. **Compaction resilience (v1.2):** `run-snapshot.mjs` derives slug/scope/round/attempt/board/
   pending-orders from files alone and the result validates against `RunSnapshot`; the PreCompact
   hook persists it mid-run and never blocks; the SessionStart(compact) hook injects the
   rehydrate hint as `additionalContext` and stays silent with no active run.
30. **Telemetry read-plane (v1.2):** `stats.mjs` emits a schema-valid `StatsReport`, aggregates
   correctly, skips-and-counts malformed rows, partitions pathology rows, renders `--format
   table`, leaves the metrics dir byte-identical (read-only proof), and returns a valid empty
   report on a missing dir.

Exit 0 = pass, 1 = fail (330+ checks — the docs state the floor, section #26 asserts it). This is
the cheapest, highest-ROI guard and the one the project lacked. Sections #8–#11 prove the oracle
grammar is runnable; #12 proves the shipped skills are self-contained; #13–#16 prove the
anti-leniency fixture, the L2 gate, the verdict ledger, and the trigger-eval layer do their jobs
(discriminate / enforce / detect flips / stay honest), not merely that they exist.

## Tier 1 — Trigger evals (Stage C1 — datasets + harness LANDED, measurement pending)

Per skill: `skills/<name>/evals/trigger-evals.json` — `{query, should_trigger}` cases with
cross-skill hard negatives (103 cases across 9 skills today). Measured with skills **installed**
(`claude --plugin-dir .`) detecting real `Skill`-tool activation via `scripts/shapeup-sdlc/trigger-eval.mjs`.
The prior measurement's TPR≈0 was a proxy artifact (it measured slash-command self-invocation) —
the harness avoids that and **aborts rather than write zeros** if a run produces no model events.
The baseline (`evals/baselines/trigger-evals.baseline.json`) ships `unmeasured` / `results: null`;
no number is written until an auth'd `--measure` run produces it. Structural **#16** validates the
datasets and enforces that honesty invariant. See `evals/README.md`.

## Tier 2 — Functional fixtures (Stage C2, judge-first — first fixture LANDED)

Run a skill with-skill vs without-skill to prove the delta. **The first fixture — the
`spec-evaluator` planted-bug / anti-leniency regression — is built**, at
`examples/eval-planted-bug/` (repo-only dev/CI asset, not shipped — same F9 reasoning that keeps
the oracle runners out of installs). It plants a FizzBuzz AC4 bug in a build dressed to look done
(green self-suite, all AC boxes ticked) and asserts a skeptical judge FAILs it.

- **Deterministic half (runs in CI today):** structural test **#13** drives the planted bug
  through the `process` oracle — PASS on the correct control, FAIL on the buggy build (TS-04) —
  proving the bug is real and catchable, plus that the fixture + `evals.json` are well-formed.
- **LLM half (needs Claude auth, not yet in CI):** `evals.json` + `EXPECTED-VERDICT.md` score the
  actual `/spec-evaluator` transcript against must / must-not assertions. Wiring this into a real
  `eval-gate` job is Stage C/D follow-up.

Remaining Tier-2 work: the same pattern for `ba` (no-invented-ACs), `task-executor`
(minimum-code + checkbox), `translator` (faithful + untouched original).

> Tier 1 and the rest of Tier 2 were claimed "LANDED" in `docs/plan/evolution-roadmap.md` but were
> never committed. They are genuine future work, not shipped infrastructure.
