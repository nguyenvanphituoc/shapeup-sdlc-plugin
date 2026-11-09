# Plan — the spec tree and the board

Converts the pitch into a fully linked tree: `_index` → `domain-model` → `ux-behavior` → `usecases/` →
`integration` → `tasks/`, with Obsidian wikilinks and a shared frontmatter taxonomy, navigable from pitch to
atomic task. Formats live in `resources/plan/references/` (the rules each phase follows) and `resources/plan/templates/` (one
template per document).

**Modes.** `full` (the default) writes the whole tree and the board. `board-only` — the tree is already
committed and FROZEN; the board is per-machine and is not on this machine — regenerates `tasks/` from the
use cases as they are: the same task derivation, every acceptance criterion carrying its
`(covers: REQ-…)` clause, ids numbered fresh for this machine. In `board-only` never touch the spec folder,
re-derive or "improve" a use case, or invent a task no use-case step or Test Surface row sources.

Payload the step may carry: `lens` (`lite` | `standard` | `cross-context`; absent → judge it: LITE for a
≤ 2-week appetite, no third party, ≤ 3 user-facing actions; STANDARD for multi-team, third-party or bigger;
genuinely unclear → one binary question to the PO), the pitch, the breadboard (its Places are your screens;
its U# and N# are the affordances you place and cite — absent = none separate, never inferred) and the
orient directory.

## The pipeline (mode `full`)

Read the reference file before its phase; pause for the PO at a checkpoint only when the run is
interactive, at most two questions each.

```
1  INGEST      pitch + breadboard + orient artifacts + guidance. Extract slug, appetite, in/out boundaries,
               rabbit holes, third-party mentions. With a breadboard, list every Place (P#) and UI
               affordance (U#) first — they are the screens and interactive elements phase 3 must place.
               No files written yet.
1b FEASIBILITY (third-party / API / SDK / webhook mentioned) verification questions + a fallback scope per
               API-NN → api-feasibility.md
2  DDD         bounded contexts, aggregates (new vs extended), value objects, domain events, repository
               interfaces → domain-model.md                              [resources/plan/references/ddd-patterns.md]
2b CONTRACTS   (standard lens) typed Request/Response/Error per repository; two-pass rule: unresolvable at
               spec time → `⏳ TBD — verify in the [UC-x] spike`, resolved post-spike with a citation →
               contracts/                                          [resources/plan/references/contract-patterns.md]
3  UX          per screen — with a breadboard, one screen per Place that owns UI affordances: state table
               (idle → loading → error → success), error cases with message + action, ASCII flows →
               ux-behavior.md                                    [resources/plan/references/ux-behavior-patterns.md]
4  USE CASES   one file per actor + action: typed Input/Output, numbered Steps, all error cases with
               codes, ## System Flow (UI → API → UC → Repo → DB), ## Test Surface (DERIVED ONLY from
               D1 Invariants · D2 Error Cases · D3 Contract shape · D4 No-gos — a sourceless test idea is
               a spec gap to raise, never a row to invent) → usecases/      [resources/plan/references/test-surface.md]
5  INTEGRATION (standard lens) cross-system data flows, events, silent-failure risks → integration.md
                                                                      [resources/plan/references/integration-analysis.md]
6  TASKS       atomic, ordered, executable → tasks/ (the LOCAL root, the one uncommitted branch of the
               tree: regenerable, machine-local)                      [resources/plan/references/task-generation.md]
7  DERIVE+READ BACK  not yours to grade, and no script does it for you:
                 recompute `unlocks` as the depends_on inverse over the whole board; sum the hours; find the
                 critical path; do the appetite arithmetic — an overflow is a fact you REPORT for the stop
                 gate, never resolve. Then read the tree back: structure, wikilinks, edge symmetry — fix what
                 you find. BREADBOARD-PLACE / BREADBOARD-UI: every Place with UI affordances is its own
                 screen — add it or defer the Place with the PO's yes; never fold it into another
               → scope-summary.md + synthesis.md (traceability matrix, risk register, dependency graph —
                 the judgment layers over the board's numbers)
8  INDEX       _index.md (pitch digest + document map) + feedback.md template
```

Working notes (`scope-summary.md`, `synthesis.md`, `assess-report.md`, `feedback.md`, `api-feasibility.md`,
`integration.md`) live in the LOCAL tier since the consumer layout split: the committed `spec/` keeps what
the evaluator grades against and a reviewer needs.

## Task generation rules (what makes a task executable)

- One task = one verifiable change (one package, one concern); acceptance criteria checkable by running
  commands.
- `depends_on` explicit; `unlocks` is the `depends_on` inverse, recomputed whenever a task changes, never filled in by feel.
- Contract-first: an implementation task touching a repository requires its contract file (else generate
  the contract-stub task first); third-party + `⏳ TBD` → the SPIKE task precedes and blocks it
  (`time_box_hours` hard cap, `api_ref`, `blocks[]`).
- AC trigger matrix (full rules in `resources/plan/references/task-generation.md`): conditional rendering → 🔁
  Inverse Conditions; data fetching → 📭 Empty & Null States; numeric limits → 🔢 Boundary Values; FEAT +
  a user actor or cross-layer → 🧪 BDD Scenarios; ≥ 1 service boundary → 🔗 Integration Flow; not
  triggered → remove the section entirely.
- After all implementation tasks: one integration-test task (DB round-trip, auth rejection, cross-service
  BDD).

**Coverage trust = use case.** Every task carries `use_case_refs`; a task with none is an orphan (red). An
invariant-backed regression task still anchors to its owning use case — there is no second path to green.

**The requirement edge is written on the AC line, or it does not exist.** An acceptance criterion that
grades a registry requirement ends with `(covers: REQ-…)` — the trailing clause, in the checkbox text, not a
mention in prose. A board AC reaches the judge through the refuted list alone: it can yield a FAIL and can
never yield a PASS, so an AC nothing cites by id produces no evidence for the requirement it was written
for. A board whose criteria carry no `covers:` clause beside a registry is sent back once.

**A requirement with no natural use-case home still becomes a task.** Contrast, localisation, a
performance ceiling, a test surface — a non-functional clause has no actor + action and so no use case of
its own, and the habit is to record it in the risk register, where nothing grades it. Give it a task whose
AC reaches the committed spec (the invariant, the contract field or the Test Surface row that states it)
and carries its `(covers: REQ-…)`. A line in the risk table is a note; a covered AC is a requirement the
run can be measured against.

## What is yours and what is not

You write the spec tree, the board and the working notes. You do not write `run-state` (dead — the loop
owns run truth), `tasks/_index.md` status flips for built work (the loop's, when it applies a result), scope contracts (the
scopes substep's), or any discovered-rounds counter. Verify before `close`: every task has
`use_case_refs`, explicit `depends_on`, command-verifiable acceptance criteria; no hand-authored `unlocks`;
`unlocks` was recomputed after the last board change; you read the tree back and found 0 red (or each remaining red
is explained to the PO); every Test Surface row cites a D1–D4 source (gaps raised, not filled); appetite
overflow, if any, is reported, not resolved.
