# Workflow-orchestrator migration — where it stands

**Read this first.** Ten documents describe this migration and they were written at four different
moments. This file says which of them is current, and what the position actually is today. It is
updated whenever the position changes; everything else is left as the dated record it is.

**Position, 2026-08-12, at `c4735c0` — re-derived by running the instruments, not by reading them:**

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
  is unreachable and must be deleted or documented. ⟐ **Re-derived 2026-08-12 and one thing was
  missed:** deleting it also turns an **S1 acceptance row red** (`test -f
  skills/tech-lead/workflows/shapeup-build-round.js`, `execution-contract.md`) — a closed, green
  stage's row. B.1 names the test fixture and the Stage 1 negative probe; it does not name that row.
  Delete and amend in the same commit, or the contract drops to 18/5 and S1 stops being green.
- ⟐ **The branch is NOT pushed. `origin/feat/workflow-orchestrator` is at `5209df7` — 20 commits
  behind**, which is everything Stage A2 and Stage A3 produced. The earlier reading ("pushed for
  review", true on 2026-08-10) was carried forward instead of re-derived — the same class of error
  this branch keeps catching. **Nothing is merged, tagged, or published** — that remains the PO's
  move after Stage C, and the push is theirs to ask for.

**Numbers, and what they are not.** Both re-derived on 2026-08-12 at `c4735c0` by execution:
`npm test` is green in-tree at **1363 checks** (1351 after Stage A2; 1328 before it; 1179 at the
Stage A commit `2a134cd`, where the differences are merged day-2 work rather than migration work).
The acceptance contract reads **19 PASS / 4 RED** above **GATE MET**, from
`node tools/contract-check.mjs` — all four reds are Stage B/C rows (the CHANGELOG cutover entry,
`commands/build.md`, and `stage3-evidence.md` twice), none of which has started. *That row count is
not the ship gate* — for three runs all six S2 rows were green above a **failed** probe, because the
rows prove the evidence file was written and machine-readable, never that the probe passed. Reading
19/23 as "nearly done" is the specific mis-navigation the instrument revision exists to end; the
gate line above the count is what moved, and it moved because a run passed.

---

## Which document to trust

| Document | Status | Read it for |
|---|---|---|
| **`execution-report.md`** | **CURRENT** — cumulative, run 1→4 | What each run delivered and found; the nine environment findings; the next action |
| **`stage-a3-evidence.md`** | **CURRENT** — the stage that met the gate | `kill-resume-probe: PASS` and its four assertions; the grader self-tested in the failing direction (§4.2); findings #12–14; the six items **not** demonstrated (§5) |
| **`stage-a3-plan.md`** | **CURRENT** — the plan A3 executed | The two composing findings (artifact-less completion; WIRE before `analyze`), G1–G8 |
| **`stage-a2-evidence.md`** | **CURRENT** — what A2 delivered | G1–G7 status, the mutation transcript (including the two mutations that survived and forced code changes), and what is *not* demonstrated |
| **`stage-a2-plan.md`** | **CURRENT** — the plan A2 executed | The acceptance contract (G1–G7), the four sub-stages, and the five decisions, all taken 2026-08-11 |
| **`execution-contract.md`** | **CURRENT** — the instrument | The 23 acceptance rows, the four replaced in Stage A, the re-derived 19/4 |
| **`stage0-evidence.md`** · **`stage1-evidence.md`** | **CURRENT** — closed stages | S0's GO decision; S1's cost arms (candidate $2.010 vs control $1.461) |
| **`stage2-evidence.md`** | **CURRENT** — S2, gate now met | A2/A3 transcripts, the two execution-only defects, and **§4** — whose status line now reads `PASS`, above the two failure records it preserves unedited |
| `remaining-stages-plan.md` | **PARTLY SUPERSEDED** | Stages B, C, D stand. Its Stage A ran and its ship gate failed; **Stage A2 now sits between A and B** |
| `status-review-2026-08-10.md` | **HISTORICAL SNAPSHOT** — headline refuted | Still-live analysis: the A4 restatement, A7's unobtainability, the do-not-do list. Its "stalled as paperwork" framing is dead |
| `stages-visual.md` | **HISTORICAL SNAPSHOT** — figures at `c469a6c` | The stage-by-stage figures. Its Stage A panels describe work that has since run |
| `../workflow_migration_plan.md` | **DESIGN AUTHORITY** + amendment log | A1–A7, the touch-map, D1–D4. Read the ⟐ Rev B/C annotations, not the un-annotated body |

## The shortest path from here

1. ~~**`stage-a2-plan.md` §6** — five open decisions.~~ **All five taken, 2026-08-11** (PO): keep
   `status` after enumerating its readers, absorb `probe` + both writers into `resume-state.mjs`,
   build the mutation harness, re-run the same probe shape first, and bring the order-id fix in.
2. ~~**A2.1 → A2.4**, then **A3.1 → A3.6**~~ **done. The probe PASSES** — the escalated-phase defect
   is closed (a phase completes only when its artifact exists) and so is its cause (`analyze` runs
   before WIRE). G1–G8 all met.
3. **← YOU ARE HERE. Stage B** (`remaining-stages-plan.md`), ~2–3 h, $0, on this machine today.
   Five rows, R7–R11, in the order the plan gives them: **B.1** resolve `shapeup-build-round.js`
   (delete + amend `16-workflows.mjs` **and** the S1 contract row **and** re-point Stage 1's negative
   probe at `shapeup-run.js:593` — that re-pointing, not the deletion, is the item's real cost);
   **B.2** confirm-only on `round-protocol.md`; **B.3** `commands/{build,ship}.md`; **B.4** the
   CHANGELOG cutover entry + `docs/upgrading.md`; **B.5** A6, the fresh-clone `npm test` (last
   clone-derived figure is **1120 at `7c1b15e`**; in-tree is 1363 and in-tree green does not
   transfer). Exit artifact: `docs/migration/stage3-evidence.md`.
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
