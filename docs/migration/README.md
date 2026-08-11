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
- The next unit of work is **`stage-a2-plan.md`** — fix the fast-forward's ORIENT branch, make the
  derivation testable, re-run the probe. ~6 h, $0 external, unblocked on this machine.
- The branch is pushed to `origin/feat/workflow-orchestrator` for review. **Nothing is merged,
  tagged, or published** — that remains the PO's move after Stage C.

**Numbers, and what they are not.** `npm test` is green in-tree at **1328 checks**; it was **1179**
at the Stage A commit `2a134cd`, and the difference is the merged day-2 ratchet work, not migration
work. The acceptance contract last derived **19 PASS / 4 RED** at `2a134cd`. *That row count is not
the ship gate* — all six S2 rows are green above a failed probe, because the rows prove the evidence
file was written and machine-readable, never that the probe passed. Reading 19/23 as "nearly done"
is the specific mis-navigation the instrument revision exists to end.

---

## Which document to trust

| Document | Status | Read it for |
|---|---|---|
| **`execution-report.md`** | **CURRENT** — cumulative, run 1→4 | What each run delivered and found; the nine environment findings; the next action |
| **`stage-a2-plan.md`** | **CURRENT** — the queued work | The A2 acceptance contract (G1–G7), the four sub-stages, and the five open PO decisions |
| **`execution-contract.md`** | **CURRENT** — the instrument | The 23 acceptance rows, the four replaced in Stage A, the re-derived 19/4 |
| **`stage0-evidence.md`** · **`stage1-evidence.md`** | **CURRENT** — closed stages | S0's GO decision; S1's cost arms (candidate $2.010 vs control $1.461) |
| **`stage2-evidence.md`** | **CURRENT** — the open stage | A2/A3 transcripts, the two execution-only defects, and **§4, the failed probe** |
| `remaining-stages-plan.md` | **PARTLY SUPERSEDED** | Stages B, C, D stand. Its Stage A ran and its ship gate failed; **Stage A2 now sits between A and B** |
| `status-review-2026-08-10.md` | **HISTORICAL SNAPSHOT** — headline refuted | Still-live analysis: the A4 restatement, A7's unobtainability, the do-not-do list. Its "stalled as paperwork" framing is dead |
| `stages-visual.md` | **HISTORICAL SNAPSHOT** — figures at `c469a6c` | The stage-by-stage figures. Its Stage A panels describe work that has since run |
| `../workflow_migration_plan.md` | **DESIGN AUTHORITY** + amendment log | A1–A7, the touch-map, D1–D4. Read the ⟐ Rev B/C annotations, not the un-annotated body |

## The shortest path from here

1. **`stage-a2-plan.md` §6** — five open decisions. Two change the shape of the work; three change
   its size. They are the PO's, and nothing should start before the first two are answered.
2. **A2.1 → A2.4** — testable derivation, the two fixes, the mechanisms, then re-run the probe.
   G6 (`kill-resume-probe: PASS`) is the gate; if it fails again, stop again — a second failure is a
   signal about the design, not about the patch.
3. **Stage B** (`remaining-stages-plan.md`) unblocks only after G6.
4. **Stage C** is the money fork and does not run autonomously: A7 needs `sdd-harness-bench`, which
   is unobtainable here (`node .plan-runs/day2-rev5/s3-feasibility.mjs` — re-derive it, never trust
   this sentence).

## Standing guardrails

- No merge, no tag, no publish. Branch pushes only.
- Everything outside the active plan's file-touch map is scope creep.
- Every stage exit is an artifact on disk, never a claim. A stage without its evidence file did not
  happen — and an evidence file whose status line reads `FAIL` is a stop, not a scoreboard entry.
