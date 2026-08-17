# Tests

One tier. The structural suite is the whole of the automated proof; the tiers above it were built,
measured, and removed. See `../docs/design/05-verification-and-quality-strategy.md` for what that
leaves uncovered.

## Tier 0 — Structural (built, runs in CI today)

`node tests/structural.mjs`

Zero dependencies, no network, no Claude calls. Proves the plugin is **well-formed**.

**Layout (Track C split).** `structural.mjs` is a thin runner: it threads one shared context
(`lib/harness.mjs` — the `ok`/`fail`/`section` counters plus `read`/`readJSON`/`frontmatter`/`walk`)
through the per-domain modules under `structural/`, isolating a thrown module as a single failure
so the suite never aborts, then asserts the §26d checks-floor against the grand total. The name is
kept because docs cite `tests/structural.mjs` (§26c would fail otherwise). Modules run in file
order and the docs module (`08-docs.mjs`) is last so the floor sees every check:

| Module | Owns sections |
|---|---|
| `structural/01-manifests.mjs` | §1 plugin/marketplace/package agreement |
| `structural/02-skills.mjs` | §2, 3, 12, 2b per-skill wellformedness, install-safety, escalation-rule parity |
| `structural/03-hooks.mjs` | §4, 14, 17, 27, 28, 29 hook manifest + behavioral hook suites |
| `structural/04-oracles.mjs` | §6, 8, 9, 10, 11, 13 oracle registry + discriminating fixtures |
| `structural/05-tech-lead.mjs` | §18–22, 24, 30, 31 orchestrator-owned scripts, domain registry, spine |
| `structural/06-ba-pitch-analyzer.mjs` | §23 board-derive + spec-lint |
| `structural/07-spec-evaluator.mjs` | §15 verdict-ledger |
| `structural/23-scheduler.mjs` | §63 BUILD's fan-out, executed against fixtures on a virtual clock |
| `structural/08-docs.mjs` | §5, 7, 25, 26 AGENT.md guard, migrations, ratchets, doc-drift |

A **new check lands in the module matching its owner** (a tech-lead script check → `05-tech-lead.mjs`,
a doc ratchet → `08-docs.mjs`, etc.), which keeps a skill change touching one small file.

The numbered sections below are the checks themselves, in section order:

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
8. The evaluation-contract **oracle registry** (`oracles/index.mjs`) is complete and
   consistent with the docs — every registered oracle has a runner file and is documented.
9–11. Each non-UI oracle PASSes its worked fixture **and** FAILs a negative control (so a
   rubber-stamp grader cannot pass): `test` (`examples/lib-mathx/`, green vs red suite),
   `snapshot` (`examples/refactor-greet/`, golden vs do-nothing), `http` (`examples/http-ping/`,
   working vs reachable-but-broken server). These runners + fixtures are **repo-only dev/CI assets**
   (not shipped) — executable proof that the `probing.md` grammar discriminates.
12. **Install-safety guard (F9):** no shipped skill file (`skills/**/SKILL.md`,
   `skills/**/references/*.md`) references a repo-only path (`scripts/`, `examples/`,
   `docs/audit|plan|research/`, `tests/`) that would be absent at install. Runtime project paths
   the harness creates (`shapeup/`, `.shapeup/`) are allowed.
14. **GATE L2 enforcement (Stage E1):** the `PreToolUse` hook (`hooks/gate-l2.mjs`) DENIES the
   once-per-round EVAL on a partial board (naming the unfinished task) and ALLOWS it on a green
   board, while never gating per-task evals, other skills, or non-`Skill` tools. Driven against
   temp board fixtures — proves the gate actually enforces, not just that it parses.
15. **Verdict-ledger calibration (Stage D1):** `kernel/reduce/verdict.mjs` flags a PASS→FAIL flip
   across runs, forces that criterion's confidence to `low`, leaves stable criteria untouched, and
   exits non-zero on a flipping ledger / zero on a stable one. Proves the judge-calibration grammar
   (`spec-evaluator/references/verdict-ledger.md`) discriminates an unstable judge from a stable one.
17–24. Pure-skill architecture mechanics (v0.3–v1.1): sandbox-guard substrate enforcement,
   t0-verify verdict artifacts, aegis-digest triples, envelope schema discrimination,
   compile-order fact-only assembly, ingest-result single-writer behavior, board-derive +
   spec-lint planner math, and the central domain-registry consistency check.
25. **Prompt line-count ratchet (v1.2; lowered to 450 by the skills-optimization plan A3):** `skills/tech-lead/SKILL.md` may not exceed 450 lines —
   the 24995ba changelog-extraction + A3 gate-playbook extraction (→ `references/gates.md`,) encoded as a regression; new logic goes into scripts or references/.
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
29. **Compaction resilience (v1.2):** `harness reduce snapshot` derives slug/scope/round/attempt/board/
   pending-orders from files alone and the result validates against `RunSnapshot`; the PreCompact
   hook persists it mid-run and never blocks; the SessionStart(compact) hook injects the
   rehydrate hint as `additionalContext` and stays silent with no active run.
30. **Telemetry read-plane (v1.2):** `harness probe stats` emits a schema-valid `StatsReport`, aggregates
   correctly, skips-and-counts malformed rows, partitions pathology rows, renders `--format
   table`, leaves the metrics dir byte-identical (read-only proof), and returns a valid empty
   report on a missing dir.
56. **The installed project (`structural/22-consumer-install.mjs`):** §43 proves the grant matches
   the shipped call sites and that `bin/init.mjs` writes it; this runs the real installer into a
   temp project and asserts what the *user* is left holding. The allow-list is exactly what
   `bin/lib/grant.mjs` emits (presence cannot see accumulation) over at most two Bash rules naming
   one entry point; an upgrade from a v1.x settings.json purges the superseded rules and keeps the
   user's own; `--no-native-workflow` removes the `Workflow` token from a project that already had
   it and re-running init restores it; a second install replaces the harness block rather than
   appending one; no shipped directory still contains a `scripts/` folder; and the kernel runs from
   that project at its documented exits (2 unknown verb, 0 run opened, 3 re-open refused, 4 gate
   ask, 6 wall-clock trip). Each of these fails silently in production — a settings.json full of
   dead rules works, and an opt-out that does nothing prints the same success line as one that
   works — so the module is kept honest by mutation: breaking the purge, the opt-out, or the
   one-entry-point rule each turns it red.


Exit 0 = pass, 1 = fail (the docs state a floor, section #26 asserts it against the real total).
This is the cheapest, highest-ROI guard and the one the project lacked. Sections #8–#11 prove the
oracle grammar is runnable; #12 proves the shipped skills are self-contained; #14–#15 prove the L2
gate and the verdict ledger do their jobs (enforce / detect flips), not merely that they exist.

## Tier 1 — checks that need a real session (`npm run test:grant`, and two that are not written)

Two things this repo asserts cannot be decided offline, because the decision happens inside a live
CLI. One of them has a runner; two do not, and saying so is the point of this section.

**`npm run test:grant` — RUN, and stamped.** The permission grant is the check the structural suite
provably cannot make: it once asserted the granted prefix was a string *prefix* of each documented
command, which was true of a rule that granted nothing at all, and stayed green for three releases
over a pipeline that could not take its first step. So this starts nine real `claude` sessions under
the rules `bin/lib/grant.mjs` actually emits, asks each to run one command, and decides ALLOWED vs
DENIED by whether the target script's marker file landed on disk. Evidence, not a claim. The result
is stamped to `tests/grant/last-verified.json`, and structural §43 fails when the generator has
moved since that stamp. **Last run: 9/9 against the v2.0 two-line kernel grant.**

**G2 — a full unattended run, zero prompts. NOT WRITTEN.** The gauntlet
(`tests/structural/21-gauntlet.mjs`) covers four of the architecture review's six probes. This is
one of the two it does not: the grant half is proven above, and the installer-writes-it half is
executed in structural §43, but "a real `--unattended` run completes on a fresh clone" needs a real
feature, a real model and real money. It is unproven, and it is listed here rather than approximated
by something cheaper that would read like coverage.

**G6 — cost and wall-clock against a v1 baseline. NOT WRITTEN.** Needs two live runs of the same
feature, one on `v1.7.0-final` and one on v2.0. The v2.0 rebuild recorded a structural baseline
(`docs/output/BASELINE-v1.md`: line counts, script and hook inventory, the green suite) but never
executed a v1 feature run, so there is nothing to compare against. **No number about v2.0's cost or
wall-clock appears anywhere in this repo**, which is the honest position until that pair of runs
exists — the fan-out and the warm sub-agents are reasons to *expect* an improvement, not a
measurement of one.

## There is no second tier beyond that

Every layer above the structural suite was built, measured, and removed: per-skill trigger-eval
datasets, the Day-1 rubrics and the Day-2 failure register (with structural §16 and §48), and then
the judge-first planted-bug fixtures with structural §13. Ordinals are not reused.

What remains proves **mechanism** — a gate denies, an oracle discriminates against a negative
control. It does not prove **craft**, and three specific claims now have no automated check behind
them:

- that a skill's `description` makes the model reach for it, and does not steal a sibling's queries;
- that the evaluator stays skeptical — that it FAILs a build dressed to look done;
- that the honesty invariant holds. *No number may be written from anything but a run that produced
  it* is still the rule, but it is upheld by review rather than by CI, which is weaker and is
  recorded as such.
