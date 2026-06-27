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
4. `hooks/hooks.json` parses.
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

Exit 0 = pass, 1 = fail (currently **107 checks**). This is the cheapest, highest-ROI guard and the
one the project lacked. Sections #8–#11 prove the oracle grammar is runnable; #12 proves the shipped
skills are self-contained (they describe the procedure, never call the dev-only runners).

## Tier 1 — Trigger evals (NOT built — Stage C1)

Per skill: `skills/<name>/evals/trigger-evals.json` — ~20 `{query, should_trigger}` cases with
cross-skill hard negatives. Measured with skills **installed** (`claude --plugin-dir .`) detecting
real `Skill`-tool activation. Prior measurement's TPR≈0 was a proxy artifact (it measured slash-
command self-invocation) — do not repeat that method.

## Tier 2 — Functional fixtures (NOT built — Stage C2, judge-first)

Per skill: `skills/<name>/evals/evals.json` + fixtures, run with-skill vs without-skill to prove
the delta. **Start with the `spec-evaluator` planted-bug fixture** (the anti-leniency regression
test) — until it passes reproducibly, no other skill's correctness is trustworthy.

> Tiers 1 and 2 were claimed "LANDED" in `docs/plan/evolution-roadmap.md` but were never committed.
> They are genuine future work, not shipped infrastructure.
