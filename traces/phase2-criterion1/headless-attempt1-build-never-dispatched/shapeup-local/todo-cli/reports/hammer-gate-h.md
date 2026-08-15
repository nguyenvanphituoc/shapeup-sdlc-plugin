---
type: hammer-report
feature: todo-cli
gate: GATE H — Decide When to Stop
breaker: inner
run_id: todo-cli-20260815T152011Z-1a6a2efb
generated_at: 2026-08-15T16:00:00Z
verdict: CANNOT SHIP — escalate to PO
---

# GATE H — Scope Hammer Report: `todo-cli`

## Trigger

Inner circuit breaker. BUILD round 1: `attempt_budget: 3` (from `receipt.json`) exhausted on
every one of the 6 board scopes with **0 scopes reaching T0-green**. `green_scopes: []`. All 6
scopes (`foundation`, `add-todo`, `list-todos`, `complete-todo`, `remove-todo`,
`cli-integration`) queued as hammer proposals.

## GATE H0 — Census

**Unresolved scopes (all 6, all carry candidates):**

| scope | hill phase | tasks | T0 evidence |
|---|---|---|---|
| foundation | UPHILL_SOLVED (design) | TASK-001, TASK-002, TASK-003 | none — no `t0/verdicts/*.json` on disk |
| add-todo | UPHILL_SOLVED (design) | TASK-004 | none |
| list-todos | UPHILL_SOLVED (design) | TASK-005 | none |
| complete-todo | UPHILL_SOLVED (design) | TASK-006 | none |
| remove-todo | UPHILL_SOLVED (design) | TASK-007 | none |
| cli-integration | UPHILL_SOLVED (design) | TASK-008, TASK-009 | none |

Note: "design solved" (scope contracts + hill files) is not implementation. A repo-wide check
confirms **zero source files exist**: no `src/`, no `bin/`, no `package.json` anywhere in the
tree. `.shapeup/todo-cli/trace/report.json` independently confirms this —
`entry_point "bin/todo.js" is not on disk — reachability skipped` (finding `ENTRY-MISSING`).
`.shapeup/todo-cli/receipts/dispatch.jsonl` shows dispatches for `orient`, `analyze` (ba
planner), `wire` (x2), `map-scopes`, and `hammer` — **no `task-executor`/build dispatch is
recorded**. The stall is not attributable to a specific failing test (no T0 verdict artifacts
exist to cite); the attempt budget appears to have been exhausted without a build attempt ever
reaching an executable artifact. This is flagged as a process/wiring gap for the next cycle,
not a scope-hammer finding to resolve.

**QA findings (H0.2):** none — `qa-edge-hunter` never ran (no PASS was ever reached to trigger
it); no `hunt-report.md` exists anywhere in the tree.

**Discovered-task ledger (H0.3):** empty — `.shapeup/todo-cli/discovery/` contains no files.

**Attempt-budget hammer proposals (H0.4):** all 6 scopes, per `payload.hammer_proposals` in the
order.

**Classification (H0.5):** All 6 scopes are **MUST-HAVE**. Each traces directly to a pitch
boundary — `idea.md` names exactly four commands (`add`, `list`, `done <n>`, `rm <n>`) plus the
store they share; `foundation` is the shared substrate every command scope depends on and
`cli-integration` is the only path any command is reachable from a shell. There is no
nice-to-have surface to default into — the board has no scope beyond the four named commands
and their two supporting scopes.

```
⏸ GATE H0 — Census
Must-have (unresolved)  : 6 — foundation, add-todo, list-todos, complete-todo, remove-todo,
                           cli-integration (source: scope, attempt-budget exhausted, breaker=inner)
Nice-to-have (~)        : 0
Carry candidates        : all 6 scopes (zero implementation artifacts produced for any of them)
```

## GATE H1 — Baseline Comparison

**H1.1 — Baseline resolution:** `shapeup/todo-cli/shaping/baseline.md` does not exist (no
`shaping/` directory under `shapeup/todo-cli/` at all). Degrading honestly per the skill's
instructions: the implicit baseline is `idea.md`'s problem statement — *"Developers keep todos
in their head and lose them"* — i.e., today's baseline is **no tool**, todos tracked ad hoc /
from memory. **Baseline is not first-class — this comparison is approximate.**

**H1.2 — Per must-have, does cutting it still leave a product strictly better than baseline?**

| item | cut/carry outcome | still better than baseline? |
|---|---|---|
| foundation | store + domain model never exist | NO — nothing to build on |
| add-todo | `add` never works | NO — no command is reachable without `cli-integration` regardless |
| list-todos | `list` never works | NO |
| complete-todo | `done <n>` never works | NO |
| remove-todo | `rm <n>` never works | NO |
| cli-integration | no dispatcher, no command reachable from a shell at all | NO |

Every must-have fails H1.2, for a single underlying reason: **there is no shipped product to
compare.** Zero source files exist on disk (`find` for `src/`, `bin/`, `package.json` returns
nothing; `trace/report.json` confirms `bin/todo.js` is not on disk). A developer running `todo`
today gets a "command not found," which is not distinguishable from — and is not better than —
the current baseline of no tool at all. This is not a partial-feature situation where some
commands work and others don't; none of the 6 scopes produced an executable artifact, so there
is no subset of must-haves that could be cut down to a smaller-but-shippable product.

Per the hard rule, a must-have that fails H1.2 is **never cut silently**. All 6 are ship-blocking.

## GATE H2 — Cut List & Verdict

```
⏸ GATE H2 — Cut List & Verdict
Baseline      : approximate — pitch problem statement (idea.md), no shaping/baseline.md exists
Ship-blocking : foundation, add-todo, list-todos, complete-todo, remove-todo, cli-integration
                (all 6 — none cuttable; zero implementation exists to fall back to)
Proposed cuts : none — there is no partial product to trim; cutting is moot when the whole
                product fails the baseline comparison
Carry-forward : all 6 scopes, to be re-attempted next cycle, tagged with the process gap below
Verdict       : CANNOT SHIP — escalate to PO
```

**Confirmation (GATE H2, resolved via `gate_answers: ci` preset, unattended):** no cuts are
proposed to confirm — the ci preset's role here is limited to acknowledging the empty cut list;
per the skill's hard rule and this run's explicit instruction, a must-have failing H1.2 is
**never** auto-shipped, breaker or no breaker. The ci preset does not override that. This
report logs the outcome as CANNOT SHIP with all 6 items ship-blocking and none silently
dropped.

## Root-cause note for the next cycle (carried, not a cut)

`receipts/dispatch.jsonl` shows the run dispatched `orient → ba-pitch-analyzer → wire (x2) →
map-scopes → hammer` but **never dispatched `task-executor`**. Combined with `attempt_budget: 3`
being exhausted and 0 T0-green scopes, this suggests BUILD round 1 either never actually
invoked the generator worker, or invoked it in a way that left no artifact/receipt trail. Before
re-attempting `todo-cli`, the next cycle should verify the BUILD dispatch path itself is wired
(not just the scope contracts), since all 6 scope contracts and hill files are in good shape
(`hill_phase` design-solved, scope-board lint all green) — the gap is entirely on the
implementation side, not the shaping/scoping side.

## Sources consulted

- `.shapeup/todo-cli/orders/hammer.json` (WorkOrder)
- `shapeup/todo-cli/scope-board.md`, `shapeup/todo-cli/scopes/*.md`, `shapeup/todo-cli/hill/*.yml`
- `.shapeup/todo-cli/harness-run.md`, `.shapeup/todo-cli/receipt.json`
- `.shapeup/todo-cli/receipts/dispatch.jsonl`
- `.shapeup/todo-cli/trace/report.json`
- `.shapeup/todo-cli/discovery/` (empty)
- `idea.md`, `.shapeup/todo-cli/intake.md`
- Repo-wide file search for `src/`, `bin/`, `package.json` — none found
