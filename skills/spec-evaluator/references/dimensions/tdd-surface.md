---
id: tdd-surface
title: "TDD surface"
enabled: true
weight: 1.0
hard_threshold: no-critical
applies_to:
  lens: [lite, standard]
  package: any
  variant: any
requires_browser: false
---

# TDD Surface Dimension

**Why this exists.** `spec-conformance` answers "does the built behavior match the spec?"
It does not answer "did the build produce regressions, and is the new code actually tested?"
An implementation can be spec-conformant and still fragile — passing all AC manually but
having zero automated tests, or silently deleting tests that used to catch a class of bugs.
This dimension adds the discipline layer: the evaluator refuses a PASS unless the test
suite is green and new code carries test coverage.

**TDD in this context** means: tests exist alongside production code, they actually run,
they stay green after the change, and they exercise the AC behaviors — not just internal
wiring. The classic failure mode is a PR that passes `pnpm typecheck` but deletes or
skips the one test that would have caught the regression.

**`.e2e` variant:** the e2e suite *is* the tests. TDD-2 (companion file check) is N/A
and excluded from the denominator; TDD-1 (suite passes) still applies and is redundant
with `SC-AC` — dual enforcement is intentional for e2e tasks.

---

## Criteria

```yaml
- id: TDD-1
  statement: "The package test suite runs green — non-zero test count, no failing tests."
  probe: cmd
  evidence_required: true
  pass_rule: >
    Run `pnpm --filter <pkg> test` (or the equivalent runner for the package). The command
    exits 0. The output shows ≥1 test executed (zero tests = no coverage = FAIL, not a skip).
    Capture stdout + exit code as evidence. A suite that is skipped entirely or that has
    no test files is a FAIL at `critical` — "tests pass" is vacuously true with no tests,
    and that vacuous truth is worse than a failure.
  source: task

- id: TDD-2
  statement: "Each new non-trivial source file introduced by this task has a companion test file."
  probe: static
  evidence_required: true
  pass_rule: >
    List all `.ts`/`.tsx` files added (not modified) by this task, excluding test files
    themselves (`*.test.ts`, `*.spec.ts`, `__tests__/`), type-only files (`*.d.ts`), and
    index/barrel files (`index.ts` whose sole content is re-exports). For each remaining
    file, a companion test file must exist: either co-located (`foo.test.ts` next to `foo.ts`)
    or in the package's test directory pointing at it. A new service or use-case with zero
    test coverage → FAIL at `critical`. A new utility under 20 lines → FAIL at `major` (still
    needs a test, just lower severity). Do not credit test files that were deleted or emptied
    as part of this task.
  source: code

- id: TDD-3
  statement: "Tests target AC behaviors, not just internal structure — each key AC scenario has a corresponding test case."
  probe: static
  evidence_required: false
  pass_rule: >
    Read the test files covering the task's new code. For each `[cmd]` or `[data]` AC that
    passed spec-conformance, verify that a test case exercises that exact scenario (not just
    that the function is imported). Tests that only call `expect(result).toBeDefined()` or
    only test constructor/initialization do NOT count. A gap between AC scenarios and test
    scenarios is a `minor` finding — advisory, does not fail the dimension. evidence_required
    is false: a spec with no discoverable test gap simply yields no TDD-3 finding.
  source: code
```

---

## Threshold

`no-critical` — TDD-1 (suite green) and TDD-2 (companion files) are `critical` FAILs:
a build with no passing tests or no test coverage is not done regardless of how well it
scores on `spec-conformance`. TDD-3 (AC-scenario alignment) is advisory (`minor`) and
does not block — it is a quality signal for the generator, not a gating condition.

---

## Bug template

```
severity: [critical|major|minor]
criterion: [TDD-1|TDD-2|TDD-3]
location: <package path | file:line | test file path>
repro: <command run — e.g. "pnpm --filter api test" | "find src/modules/canvas -name '*.ts' ! -name '*.test.ts'">
expected: <e.g. "test suite passes with ≥1 test" | "companion test file for BoardService.ts">
actual: <e.g. "exit code 1; 2 failing tests" | "no BoardService.test.ts found anywhere in packages/api/">
fix_hint: <e.g. "add __tests__/BoardService.spec.ts; cover the createBoard and getBoard use cases">
```

## Probing notes

- Run `pnpm --filter <pkg> test` (or `pnpm --filter <pkg> test:unit` if scripts are split).
  Capture the full output. Most Jest/Vitest outputs emit `Tests: N passed` and an exit code.
- For TDD-2, `git diff --name-only --diff-filter=A HEAD~1` (or the relevant base) lists
  added files. Use `find <pkg>/src -name '*.ts'` if the git range is unclear; then diff
  against `find <pkg>/src -name '*.test.ts' -o -name '*.spec.ts'` to spot uncovered modules.
- Never skip TDD-1 because the test suite "probably hasn't changed." Always run it. Wiring
  changes in one module routinely break tests in another — that is the exact regression
  class this gate exists to catch.
