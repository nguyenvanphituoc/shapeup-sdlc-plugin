# Workflow-orchestrator migration — where it stands

**Read this first.** Ten documents describe this migration and they were written at four different
moments. This file says which of them is current, and what the position actually is today. It is
updated whenever the position changes; everything else is left as the dated record it is.

**Position, 2026-08-12, at `e5bf9cd`:**

- **S0 GREEN · S1 GREEN · S2 SHIP GATE MET · S3 unblocked, not started.**
- **The kill/resume probe PASSES** — `stage-a3-evidence.md` §4, `kill-resume-probe: PASS`, all four
  assertions, on a live ungraceful `SIGKILL` mid-BUILD. It is the one test of the failure class this
  whole migration exists to retire, it failed twice (Stage A, Stage A2), and it is graded by an
  `assert.mjs` **byte-identical** to the one that produced both failures — self-tested in the
  failing direction on A2's own snapshots before the PASS was recorded.
- **Stage A3 closed it in two places.** A phase is complete only when its ARTIFACT exists (every
  dispatch is followed by a post-condition; an escalated phase can no longer be recorded as
  complete and re-dispatched forever), and **`analyze` now runs before WIRE** — so
  `solution-architect` is handed the `usecases/` its contract has always said it reads, and it wrote
  the wiring map instead of escalating.
- **Stage B is unblocked** (`remaining-stages-plan.md`). Its first item is R10: `shapeup-build-round.js`
  is unreachable and must be deleted or documented.
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
4. **Stage C** is the money fork and does not run autonomously. ⟐ **Corrected 2026-08-11: A7 is
   obtainable here.** `sdd-harness-bench` is present (`14e4479`, adapter + runner + `f2-budgets` +
   240 result rows). `s3-feasibility.mjs` still exits 4, but its only failing check (C3) is about
   the **day-2 plan's** pre-fix build `a280e86` — not about A7's arms, which are both modern builds.
   A7 is therefore **unstarted, not blocked**, and gated only by the ship gate above it and the PO's
   ~$40–60 spend decision.

## Standing guardrails

- No merge, no tag, no publish. Branch pushes only.
- Everything outside the active plan's file-touch map is scope creep.
- Every stage exit is an artifact on disk, never a claim. A stage without its evidence file did not
  happen — and an evidence file whose status line reads `FAIL` is a stop, not a scoreboard entry.
