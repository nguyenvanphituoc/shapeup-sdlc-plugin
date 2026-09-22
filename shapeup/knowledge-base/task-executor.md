# Knowledge Base — task-executor

> Team-shared guidelines distilled from PO/TL feedback at the Ship Gate (L4) or from a project
> scan, by `/coach`. Read by `task-executor` at the top of its run. **Guidelines, not invariants** —
> they steer the worker; they never override a spec, widen a substrate, resolve a gate or change
> the spec-evaluator verdict (single-judge rule). Committed on purpose: a teammate inherits these
> on `git pull`.

## Guidelines

- **KB-TE-001** — A fixture that calls your new function directly proves the function is correct,
  never that anything uses it. Drive the real entry point — the CLI, the command, the pipeline — in
  at least one fixture per change. _(why: measured 2026-09-22 — a stage shipped a correct kernel
  derivation that nothing called: the CLI was untouched and the caller still used the old logic.
  Every fixture invoked the new function directly, so all of them passed while the defect the work
  existed to close was still live. A green fixture over a dead path is the failure mode, not the
  exception.)_ · from `defect-plan-3.7` (2026-09-22)

- **KB-TE-002** — A check whose pass condition is *"this command fails"* also passes when the
  command is **missing**. Assert both directions in one command:
  `<probe> <normal> && <mutate> && ! <probe> <mutated> && echo BOTH_DIRECTIONS`. Lead a
  suite-level mutation with a green suite, so it cannot score over one that was already broken.
  _(why: measured 2026-09-22 — four falsifier checks scored green against fixtures that did not
  exist yet; `node <missing-file>` exits non-zero and `!` inverts that into a pass. Each one
  reported success having measured nothing.)_ · from `defect-plan-3.7` (2026-09-22)

- **KB-TE-003** — When you write a fixture for a known defect, check that it reproduces *that
  defect's* state and not a weaker neighbour. State the precondition the defect actually had, then
  assert your fixture has it. _(why: measured 2026-09-22 — a guard was written to refuse an attempt
  opened over an unanswered one, and its first fixture modelled a precondition the guard
  deliberately exempts. The guard correctly stayed silent, the fixture read as a failing guard, and
  the fixture was testing the exemption rather than the rule. A fixture aimed slightly off the
  defect is indistinguishable from a broken fix.)_ · from `defect-plan-3.7` (2026-09-22)
