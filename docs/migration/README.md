# Workflow-orchestrator migration — where it stands

**Read this first.** Ten documents describe this migration and they were written at four different
moments. This file says which of them is current, and what the position actually is today. It is
updated whenever the position changes; everything else is left as the dated record it is.

**Position, 2026-08-11, at `5209df7`:**

- **S0 GREEN · S1 GREEN · S2 SHIP GATE NOT MET · S3 not started.**
- The kill/resume probe — the one test of the failure class the whole migration exists to retire —
  **FAILED** on 2026-08-10 (`stage2-evidence.md` §4, `kill-resume-probe: FAIL`). Two of its four
  assertions are red: a completed ORIENT order was re-dispatched and its result re-ingested.
- Per the plan's own rule (*"if it fails, stop"*), **Stage B did not start** and does not start until
  the probe passes.
- **Stage A2 is executed and its probe was re-run** (`stage-a2-evidence.md`, 2026-08-11).
  **The Stage A defect is fixed and proven fixed on a live ungraceful kill**: ORIENT survived
  byte-identical, `status` moved, the substrate pointer tracked the scope in flight, and the resumed
  leg carried the run to `shipped` with a passing verdict. **But the probe still reads FAIL**, on a
  *different* phase: `solution-architect` escalated without writing `wiring-map.md`, the pipeline
  recorded the phase as complete anyway, and every relaunch therefore re-dispatches it. G1–G5 and G7
  are met; **G6 is not**, so the ship gate is shut and Stage B does not start.
- The branch is pushed to `origin/feat/workflow-orchestrator` for review. **Nothing is merged,
  tagged, or published** — that remains the PO's move after Stage C.

**Numbers, and what they are not.** `npm test` is green in-tree at **1351 checks** (1328 before
Stage A2; 1179 at the Stage A commit `2a134cd`, where the difference was merged day-2 work rather
than migration work). The acceptance contract reads **19 PASS / 4 RED**, re-derived by running it:
`node tools/contract-check.mjs`. *That row count is not
the ship gate* — all six S2 rows are green above a failed probe, because the rows prove the evidence
file was written and machine-readable, never that the probe passed. Reading 19/23 as "nearly done"
is the specific mis-navigation the instrument revision exists to end.

---

## Which document to trust

| Document | Status | Read it for |
|---|---|---|
| **`execution-report.md`** | **CURRENT** — cumulative, run 1→4 | What each run delivered and found; the nine environment findings; the next action |
| **`stage-a2-evidence.md`** | **CURRENT** — what A2 delivered | G1–G7 status, the mutation transcript (including the two mutations that survived and forced code changes), and what is *not* demonstrated |
| **`stage-a2-plan.md`** | **CURRENT** — the plan A2 executed | The acceptance contract (G1–G7), the four sub-stages, and the five decisions, all taken 2026-08-11 |
| **`execution-contract.md`** | **CURRENT** — the instrument | The 23 acceptance rows, the four replaced in Stage A, the re-derived 19/4 |
| **`stage0-evidence.md`** · **`stage1-evidence.md`** | **CURRENT** — closed stages | S0's GO decision; S1's cost arms (candidate $2.010 vs control $1.461) |
| **`stage2-evidence.md`** | **CURRENT** — the open stage | A2/A3 transcripts, the two execution-only defects, and **§4, the failed probe** |
| `remaining-stages-plan.md` | **PARTLY SUPERSEDED** | Stages B, C, D stand. Its Stage A ran and its ship gate failed; **Stage A2 now sits between A and B** |
| `status-review-2026-08-10.md` | **HISTORICAL SNAPSHOT** — headline refuted | Still-live analysis: the A4 restatement, A7's unobtainability, the do-not-do list. Its "stalled as paperwork" framing is dead |
| `stages-visual.md` | **HISTORICAL SNAPSHOT** — figures at `c469a6c` | The stage-by-stage figures. Its Stage A panels describe work that has since run |
| `../workflow_migration_plan.md` | **DESIGN AUTHORITY** + amendment log | A1–A7, the touch-map, D1–D4. Read the ⟐ Rev B/C annotations, not the un-annotated body |

## The shortest path from here

1. ~~**`stage-a2-plan.md` §6** — five open decisions.~~ **All five taken, 2026-08-11** (PO): keep
   `status` after enumerating its readers, absorb `probe` + both writers into `resume-state.mjs`,
   build the mutation harness, re-run the same probe shape first, and bring the order-id fix in.
2. ~~**A2.1 → A2.4**~~ **done; the probe ran and returned FAIL** on a new cause. The next unit is
   **an escalated phase must not be recorded as complete** — `shapeup-run.js` ingests a
   `status: "escalated"` result and moves to the next gate without inspecting it, and because such a
   phase writes no artifact it is re-dispatched on every relaunch forever. Fix that, re-run the
   probe, and G6 is reachable.
3. **Stage B** (`remaining-stages-plan.md`) unblocks only after `kill-resume-probe: PASS` — now
   Stage A3's job, not A2's.
4. **Stage C** is the money fork and does not run autonomously: A7 needs `sdd-harness-bench`, which
   is unobtainable here (`node .plan-runs/day2-rev5/s3-feasibility.mjs` — re-derive it, never trust
   this sentence).

## Standing guardrails

- No merge, no tag, no publish. Branch pushes only.
- Everything outside the active plan's file-touch map is scope creep.
- Every stage exit is an artifact on disk, never a claim. A stage without its evidence file did not
  happen — and an evidence file whose status line reads `FAIL` is a stop, not a scoreboard entry.
