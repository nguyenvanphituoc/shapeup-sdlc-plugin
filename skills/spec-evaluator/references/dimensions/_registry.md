# Dimension Registry

The core reads this at GATE V0.5 to decide which dimensions to load. `--dimensions` on the
command line overrides this table for a single run.

## Active set

| id | enabled | file | applies_to (summary) | notes |
|----|---------|------|----------------------|-------|
| `spec-conformance` | ✅ true | `dimensions/spec-conformance.md` | all tasks | baseline correctness: AC + Done-when + contract shapes + non-go |
| `tdd-surface` | ✅ true | `dimensions/tdd-surface.md` | all tasks | suite green + companion test files for new code; TDD-1/2 critical, TDD-3 advisory |
| `integration` | ✅ true | `dimensions/integration.md` | `.be` and `.e2e` variants only | full-stack integration test + auth boundary + RLS-JWT pattern; runs only when variant matches |
| `completeness` | ⚙️ auto | `dimensions/completeness.md` | all tasks (lens lite/standard) | auto-ON when spec has UC `## Invariants` (v2.8+); no-op on older specs |
| `test-surface-conformance` | ⚙️ auto | `dimensions/test-surface-conformance.md` | all tasks (lens lite/standard) | auto-ON when spec has UC `## Test Surface` (v2.9+ or `--surface-only` retrofit); no-op otherwise. Report must list every TS row probed — qa-edge-hunter's negative-space input |
| `security` | ⛔ false | `dimensions/security.md` | be / shared | stub — flip on when ready |
| `performance` | ⛔ false | `dimensions/performance.md` | be / web | stub — flip on when ready |

Default active set = every row with `enabled: true` whose `applies_to` matches the task variant, **plus** each ⚙️ auto dimension when its auto-enable condition holds:
- All tasks: **`[spec-conformance, tdd-surface]`** (baseline)
- `.be` / `.e2e` tasks additionally pick up: **`[integration]`**
- When any UC declares `## Invariants`: also **`[completeness]`**
- When any UC carries `## Test Surface`: also **`[test-surface-conformance]`**

## Load order
Dimensions run in table order. `spec-conformance` first so a correctness failure is the
headline; cosmetic / non-functional dimensions report after it. Order does not change the
overall verdict (all dimensions are ANDed) — it only affects reading order in the report.

## How to add a dimension (the injection recipe)
1. Copy the "Minimal valid dimension" block from `dimension-contract.md` to
   `dimensions/<id>.md` and fill in criteria, probes, threshold, bug template.
2. Add a row here and set `enabled: true` — or leave it false and turn it on per-run with
   `--dimensions spec-conformance,<id>`.
3. Run. No core file changes. GATE V0.5 validates it against the contract; if it doesn't
   conform, it is skipped with a warning rather than silently mis-run.

## Scoping reminder
A dimension only grades tasks its `applies_to` matches. Example: `security` with
`applies_to: { variant: [be, shared] }` is ignored when evaluating `TASK-007.web`, even if
it is enabled. This keeps the active set honest per task.
