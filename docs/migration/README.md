# Workflow-orchestrator migration — where it stands

**Read this first.** Ten documents describe this migration and they were written at four different
moments. This file says which of them is current, and what the position actually is today. It is
updated whenever the position changes; everything else is left as the dated record it is.

> ## ⟐ Position, 2026-08-12, after Stage C — and the cutover must not merge yet
>
> **Stage C ran. The PO took C2, A7 ran, and `A7: FAIL`.** The candidate arm missed the absolute bar
> (3× 14/14 with receipts; it went 1 of 3). But the number that matters is not the score:
> **`shapeup-run.js` executed zero times in every rep.** Every `Workflow` call was denied —
> `Review dynamic workflow before running` — so the lane the cutover makes the *only* lane never
> started, and A7 measured the fallback instead of the thesis.
>
> Reproduced minimally outside the benchmark: `acceptEdits` → denied; `bypassPermissions` → launches.
> The plugin documents this **nowhere** (`HD-007`). When the lane fails to start the session
> improvises — once hand-building the feature with no receipt while `gate-zerowork` allowed the Stop
> (`HD-008`), once emulating the pipeline by hand and reaching L4 with a valid receipt while the
> workflow never ran. **A receipt does not prove the lane ran.**
>
> **Plan §5's trigger is live:** the merge waits. Not on the cost comparison — Stage 1's +37.6% did
> *not* reproduce, and per scored rep the candidate came in ~10% *cheaper* — but on a lane that
> cannot start under a standard permission mode. Full record: `stage3-evidence.md` §7.

**Position, 2026-08-12, after Stage B — re-derived by running the instruments, not by reading them:**

- **S0 GREEN · S1 GREEN · S2 SHIP GATE MET · S3 — Stage B GREEN; Stage C RAN, `A7: FAIL`.**
- **The acceptance contract is 23 PASS / 0 RED above `GATE MET`.** Every row green for the first
  time on this branch. `npm test` green in-tree at **1363** and — the row that had never been
  re-derived — in a fresh `git clone --local` at **1221**, exit 0. A6 is PASS, not PARTIAL.
- **Stage B's five rows R7–R11 are closed** (`stage3-evidence.md`). `shapeup-build-round.js` is
  deleted and all **four** of its assertions moved in one commit — the plan named three; the fourth
  (`17-gate-zerowork-workflow.mjs:70`) used the filename in a synthetic event that never touches
  disk, so deletion would have left it green while asserting something false. The cutover CHANGELOG
  entry, `docs/upgrading.md`, and both commands now describe what shipped.
- ⟐ **Two instruments were found unfalsifiable while running them, both fixed.** R7's own verifier
  `grep -q '1.7'` passed on `107`/`127`/`137` in unrelated entries while the literal appeared zero
  times; and `gates.md` still told operators `SKILL.md` carried the build/eval loop it had not
  carried since Stage 2. Neither was reachable by reading — only by execution.
- **What Stage B did NOT buy:** the degenerate inner-breaker branch (`shapeup-run.js:774`) still has
  never run. Its sibling branch — the one AGENTS.md's invariant is actually about — is demonstrated
  live by A3's leg 2. See `stage3-evidence.md` §3; this is the half of B.1's cost that went unpaid.
- ~~**A7: DEFERRED.**~~ ⟐ **`A7: FAIL` — it ran on 2026-08-12** (`stage3-evidence.md` §7). Obtainable
  here exactly as this line said; the PO took C2 and spent **$29.88** over six reps. Candidate 1 of 3
  on the absolute bar, control 0 of 3 — and `shapeup-run.js` never executed once.
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

**Numbers, and what they are not.** All re-derived on 2026-08-12 by execution: `npm test` green
in-tree at **1363** (1351 after Stage A2; 1328 before it; 1179 at the Stage A commit `2a134cd`,
where the differences are merged day-2 work rather than migration work), green in a fresh clone at
**1221**, and `node tools/contract-check.mjs` printing **23 PASS / 0 RED** under **GATE MET**.

*The row count was never the ship gate, and that matters more now that it is full.* For three runs
all six S2 rows were green above a **failed** probe — the rows prove the evidence file was written
and machine-readable, never that the probe passed. 23/23 means every acceptance row this contract
knows how to ask has been answered; it does not mean the migration is finished. **A7 has not run**,
so the only cost figure in hand is still Stage 1's single trivial feature, and one branch of the
inner breaker has never executed. Read the gate line, then `stage3-evidence.md` §6.

**The 1221 is the more interesting number.** In-tree green has never transferred on this branch, and
the 142-check gap against 1363 is now located rather than noted: all of it is `48-day1-day2.mjs`
reading `evals/runs/`, which is gitignored by design (`.gitignore:29-48` — the instrument is
committed, the 2.3 MB of run records it produces is not). Every other module runs identically. The
enforced floor is `880+`, so the clone clears it; `README.md:344`'s advertised `1250+ checks` does
not, and is a one-line fix left outside this stage's touch map.

---

## Which document to trust

| Document | Status | Read it for |
|---|---|---|
| **`execution-report.md`** | **CURRENT** — cumulative, run 1→4 | What each run delivered and found; the nine environment findings; the next action |
| **`stage-a3-evidence.md`** | **CURRENT** — the stage that met the gate | `kill-resume-probe: PASS` and its four assertions; the grader self-tested in the failing direction (§4.2); findings #12–14; the six items **not** demonstrated (§5) |
| **`stage-a3-plan.md`** | **CURRENT** — the plan A3 executed | The two composing findings (artifact-less completion; WIRE before `analyze`), G1–G8 |
| **`stage-a2-evidence.md`** | **CURRENT** — what A2 delivered | G1–G7 status, the mutation transcript (including the two mutations that survived and forced code changes), and what is *not* demonstrated |
| **`stage-a2-plan.md`** | **CURRENT** — the plan A2 executed | The acceptance contract (G1–G7), the four sub-stages, and the five decisions, all taken 2026-08-11 |
| **`stage3-evidence.md`** | **CURRENT** — Stage B **and Stage C's** exit artifact | R7–R11 green, the four assertions B.1 moved, the mutation transcript, A6's located 142-check clone gap, **§6 — what Stage B did not buy**, and ⟐ **§7 — Stage C: the refuted premise, R12's five-way mutation audit, and `A7: FAIL` with the lane that never ran** |
| **`execution-contract.md`** | **CURRENT** — the instrument | The 23 acceptance rows, the four replaced in Stage A, the S1 row Stage B replaced, and the re-derived **23/0** |
| **`stage0-evidence.md`** · **`stage1-evidence.md`** | **CURRENT** — closed stages | S0's GO decision; S1's cost arms (candidate $2.010 vs control $1.461) |
| **`stage2-evidence.md`** | **CURRENT** — S2, gate now met | A2/A3 transcripts, the two execution-only defects, and **§4** — whose status line now reads `PASS`, above the two failure records it preserves unedited |
| `remaining-stages-plan.md` | **PARTLY SUPERSEDED** | **Stage B has now run too** — C and D stand. Its Stage A ran and its ship gate failed; A2 and A3 sit between A and B; its R7 row carried an unescaped-dot false pass, fixed in place |
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
3. ~~**Stage B**, five rows R7–R11.~~ **Done, 2026-08-12** — `stage3-evidence.md`, contract 23/23.
   B.1 deleted `shapeup-build-round.js` and moved four assertions (not the three the plan named);
   B.2 confirmed two of three checks and fixed the third (`gates.md` named the wrong home for the
   build/eval loop); B.3 and B.4 landed the commands, the cutover entry and `upgrading.md`; B.5
   re-derived A6 in a fresh clone at **1221**, exit 0. The one item **not** paid: B.1's negative
   probe was re-pointed on paper and half-demonstrated — the branch AGENTS.md's invariant is about
   is live from A3's leg 2, the degenerate `:774` branch has never run (`stage3-evidence.md` §3).
4. ~~**Stage C** — the money fork.~~ **Done, 2026-08-12.** The PO took **C2**. Two repairs first,
   both found by running instruments: the fork's own premise was refuted (`s3-feasibility.mjs`
   returns C1 **yes** / C2 **yes**; its one failing check belongs to the day-2 plan, and the "exit 0"
   trigger §4 named to reopen A7 could therefore **never fire**), and **R12 accepted a bare
   `A7: PASS` with no run logs** — repaired, then re-verified falsifiable. R1–R11 audited: green.
   A7 then ran: **`A7: FAIL`**, $29.88, six reps.
5. **← YOU ARE HERE. The merge decision — and plan §5 says it waits.** Not on cost: Stage 1's
   **+37.6%** did not reproduce (candidate ~10% *cheaper* per scored rep), though at n=2 vs n=2 that
   is unreplicated rather than refuted. It waits on **HD-007**: the lane the cutover makes the only
   lane **cannot start headlessly** without `bypassPermissions`, which the plugin documents nowhere.
   `shapeup-run.js` ran zero times in six reps. The open PO questions are (a) fix HD-007/HD-008
   before merging, and (b) whether to buy the real comparison — both arms under `bypassPermissions`,
   another ~6 reps.

## Standing guardrails

- No merge, no tag, no publish. Branch pushes only.
- Everything outside the active plan's file-touch map is scope creep.
- Every stage exit is an artifact on disk, never a claim. A stage without its evidence file did not
  happen — and an evidence file whose status line reads `FAIL` is a stop, not a scoreboard entry.
