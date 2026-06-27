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
8. The evaluation-contract **oracle registry** (`scripts/oracles/index.mjs`) is complete and
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
15. **Verdict-ledger calibration (Stage D1):** `scripts/verdict-ledger.mjs` flags a PASS→FAIL flip
   across runs, forces that criterion's confidence to `low`, leaves stable criteria untouched, and
   exits non-zero on a flipping ledger / zero on a stable one. Proves the judge-calibration grammar
   (`spec-evaluator/references/verdict-ledger.md`) discriminates an unstable judge from a stable one.

Exit 0 = pass, 1 = fail (currently **137 checks**). This is the cheapest, highest-ROI guard and the
one the project lacked. Sections #8–#11 prove the oracle grammar is runnable; #12 proves the shipped
skills are self-contained; #13–#15 prove the anti-leniency fixture, the L2 gate, and the verdict
ledger actually do their jobs (discriminate / enforce / detect flips), not merely that they exist.

## Tier 1 — Trigger evals (NOT built — Stage C1)

Per skill: `skills/<name>/evals/trigger-evals.json` — ~20 `{query, should_trigger}` cases with
cross-skill hard negatives. Measured with skills **installed** (`claude --plugin-dir .`) detecting
real `Skill`-tool activation. Prior measurement's TPR≈0 was a proxy artifact (it measured slash-
command self-invocation) — do not repeat that method.

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
