# Workflow-orchestrator migration — where it stands

**Read this first.** Fifteen documents describe this migration and they were written at different
moments. This file says which of them is current, and what the position actually is today. It is
updated whenever the position changes; everything else is left as the dated record it is.

> ## ⟐ Position, 2026-08-12, latest — the fix shipped, and the reason it was needed was refuted
>
> **Full record: `hd007-fix-evidence.md`.** Steps 1–3 of the pre-A7 fix list shipped and are green
> (`npm test` **1370**, contract **23/0 GATE MET**): the lane launches through the shipped
> `skills/tech-lead/scripts/run-workflow.mjs`; **HD-008 is closed** (the "work by other means"
> escape deleted, its test inverted in place, both arms mutation-verified); and the benchmark can
> now tell a lane that ran from a lane that was imitated — replayed against the six archived A7
> workspaces, it correctly rejects candidate reps 2 and 3, which had been **scored**.
>
> **Then step 4 refuted two things, and the second is bigger than the bug being fixed.**
>
> 1. **HD-007's diagnosis is false.** The `Workflow` tool *is* grantable — a bare `"Workflow"` token
>    in `permissions.allow` runs it headlessly, verified in the benchmark's own configuration. The
>    tool was never ungrantable; **the bench's settings file never carried the entry**, because
>    `init` writes Bash prefixes only. Six paid reps went to a missing allowlist line. What survives
>    is narrower and is now the stated justification: the grant **cannot be scoped**, so it permits
>    every dynamic workflow script in the project.
> 2. ⟐ **HD-009 — `init`'s pipeline grant matches nothing.** Bash prefix rules match on whole-argument
>    boundaries; `Bash(node …/scripts/:*)` ends mid-argument and grants **no command at all**. And a
>    *quoted* command — the form every skill uses, adopted so spaced install paths would not break —
>    matches no rule in either spelling. `14-invocation-paths.mjs` is green because it compares
>    **strings**, a proxy that diverges from the CLI's behaviour precisely here. The benchmark's own
>    scripts ran only because its adapter appends a broad `Bash(node:*)`, so the bench has been
>    measuring a permission configuration the plugin does not ship.
>
> **Consequences.** The full pipeline has run three times through the new launcher and **aborted at
> dispatch 1 every time** — the lane shipped in step 1 is blocked by HD-009, whose call site is
> quoted. **The A7 re-run is not merely unpaid, it is not yet runnable.** HD-009 is *filed, not
> fixed*: its options trade a security posture against a spaced-path break, and that is the PO's
> call. The merge still waits.

> ## ⟐ Position, 2026-08-12, earlier — HD-007's mechanism is answered, and the answer ran
>
> **The control-plane probe ran** (`hd007-control-plane-probe.md`; prototype at
> `tools/control-plane/`, uncommitted): move the launch surface from the un-grantable `Workflow`
> tool to a granted Bash prefix. `node cp-run.mjs <script>` executes the same workflow-script
> format, and **the lane starts under `acceptEdits`**. The decisive pair: §7.5's record (tool,
> three-line script, `acceptEdits` → denied) against T1 (same mode, same script shape, Bash-carried
> → ran, `permission_denials: []`). P3 dispatched a real schema-forced worker under `acceptEdits`;
> P1 executed the **unmodified** `shapeup-run.js` to its own arg-validation abort — the script
> needs no fork to run on this lane.
>
> **Two consequences.** The A7 re-run no longer needs `bypassPermissions` on either arm — §7.7's
> "both arms under `bypassPermissions`" was too strong and is amended in place. And HD-007's fix
> has a concrete shape: the ship command launches via cp-run under Bash, `init`'s existing
> `mergePipelinePermissions` writes the one prefix, and cp-run already fails closed.
>
> **What the probe did NOT buy:** no full pipeline ran through cp-run (P1 stops at arg validation
> by design); the composed outer→cp→worker tree ran as two proven halves, not one; resume is
> journaled, not implemented; the settings-file grant channel failed in a never-trusted workspace
> (F2 — one user-run line from a trusted project closes it); HD-008 is untouched. **The merge
> still waits.** The PO decisions are unchanged in kind and cheaper in cost — see step 6 below.

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
- ⟐ **The branch is NOT pushed. `origin/feat/workflow-orchestrator` is at `5209df7`, now 38 commits
  behind (re-derived by execution, not carried forward)** — everything from Stage A2 onward: A2,
  A3, Stage B, Stage C, the HD-007/008 fix, and day-2 work landing in parallel. The HD-007 work is
  **committed** as four commits (`09f458b` launcher · `187aaa5` HD-008 · `8615975` the refutations
  and HD-009 · `15c6391` the staged re-run); the prototype no longer lives at `tools/control-plane/`
  — it ships at `skills/tech-lead/scripts/run-workflow.mjs`. The earlier reading ("pushed for
  review", true on 2026-08-10) was carried forward instead of re-derived — the same class of error
  this branch keeps catching. **Nothing is merged, tagged, or published** — that remains the PO's
  move, and the push is theirs to ask for.

> ⟐ **The suite is RED at `ebe2ea7`, and it arrived with parallel work, not with the migration.**
> Re-derived rather than carried forward: `npm test` is **1369 / 1 failure**, and
> `contract-check.mjs` therefore reports **S2 and S3 RED** (both rows run `npm test`). The single
> failure is structural #16(b) — *a workflow script hardcodes a storage root* — at
> `shapeup-run.js`'s QA hunt payload, which gained
> `eval_report: \`.shapeup/${slug}/results/evaluate-r${round}.json\`` in `81faf2e`/`ebe2ea7`. That is
> the invariant AGENTS.md states in its own words: *every path literal in a workflow script is
> `${args.pluginRoot}`-rooted or produced by a script's stdout*. The same line at `15c6391` carries
> no literal and the suite is **green there** (verified by checkout), so every green figure below is
> true as of the HD-007 commits and false at HEAD until that one payload is routed through the path
> resolver. Left for whoever owns that change.

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
| **`execution-report.md`** | **CURRENT** — cumulative, run 1→6 | What each run delivered and found; the nine environment findings. Its closing "what replaces it: Stage B" is done work — this README carries the position |
| **`stage-a3-evidence.md`** | **CURRENT** — the stage that met the gate | `kill-resume-probe: PASS` and its four assertions; the grader self-tested in the failing direction (§4.2); findings #12–14; the six items **not** demonstrated (§5) |
| **`stage-a3-plan.md`** | **CURRENT** — the plan A3 executed | The two composing findings (artifact-less completion; WIRE before `analyze`), G1–G8 |
| **`stage-a2-evidence.md`** | **CURRENT** — what A2 delivered | G1–G7 status, the mutation transcript (including the two mutations that survived and forced code changes), and what is *not* demonstrated |
| **`stage-a2-plan.md`** | **CURRENT** — the plan A2 executed | The acceptance contract (G1–G7), the four sub-stages, and the five decisions, all taken 2026-08-11 |
| **`stage3-evidence.md`** | **CURRENT** — Stage B **and Stage C's** exit artifact | R7–R11 green, the four assertions B.1 moved, the mutation transcript, A6's located 142-check clone gap, **§6 — what Stage B did not buy**, and ⟐ **§7 — Stage C: the refuted premise, R12's five-way mutation audit, and `A7: FAIL` with the lane that never ran** |
| **`hd007-fix-evidence.md`** | **CURRENT** — the newest, read it first | What shipped (launcher, HD-008, the bench's lane-evidence rule), the mutation transcripts, and §4 — the two refutations: HD-007's diagnosis, and **HD-009**, the grant that matches nothing. §5 is what is still unproven |
| `hd007-control-plane-probe.md` | **SUPERSEDED IN ITS DIAGNOSIS** | Its measurements (T1/P1/P3) stand; its explanation does not. Read the banner, then `hd007-fix-evidence.md` §4.1 |
| **`execution-contract.md`** | **CURRENT** — the instrument | The 23 acceptance rows, the four replaced in Stage A, the S1 row Stage B replaced, and the re-derived **23/0** |
| **`stage0-evidence.md`** · **`stage1-evidence.md`** | **CURRENT** — closed stages | S0's GO decision; S1's cost arms (candidate $2.010 vs control $1.461) |
| **`stage2-evidence.md`** | **CURRENT** — S2, gate now met | A2/A3 transcripts, the two execution-only defects, and **§4** — whose status line now reads `PASS`, above the two failure records it preserves unedited |
| `remaining-stages-plan.md` | **PARTLY SUPERSEDED** | **Stages A–C have all run** — only D stands. Its Stage C section carries the A7 record and the ⟐ HD-007-probe amendment; its R7 row carried an unescaped-dot false pass, fixed in place |
| `status-review-2026-08-10.md` | **HISTORICAL SNAPSHOT** — headline refuted | Still-live analysis: the A4 restatement, A7's unobtainability, the do-not-do list. Its "stalled as paperwork" framing is dead |
| `stages-visual.md` | **CURRENT** — position panels re-drawn 2026-08-12 at `89e07cd` | The figures: the corrected *Where it stands* panel, the HD-007-probe pair, the ⟐ EXECUTED banners; reasoning panels left as drawn |
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
5. ~~**The HD-007 mechanism question** — can the only post-cutover lane start headlessly at all?~~
   **Answered, 2026-08-12** (`hd007-control-plane-probe.md`): **yes, under `acceptEdits`, when Bash
   carries it.** cp-run executes the same script format; T1 ran headlessly with zero denials in the
   exact mode the `Workflow` tool was denied in; the unmodified `shapeup-run.js` runs on this lane
   (F3). Prototype only: nothing in `skills/` changed, the full pipeline has never run through it,
   resume is journaled not implemented, and F2's trusted-project one-liner is open.
6. ~~Promote the cp-run shape to HD-007's fix; fix HD-008; F2's open question.~~ **Done,
   2026-08-12** (`hd007-fix-evidence.md`). The launcher ships as
   `skills/tech-lead/scripts/run-workflow.mjs`; HD-008's escape is deleted and mutation-verified in
   both directions; the benchmark now records and can gate on lane evidence; F2 is answered (an
   untrusted workspace ignores `permissions.allow` in full, and the CLI names it).
7. **← YOU ARE HERE. `HD-009` blocks everything downstream, and it is a PO decision.** The grant
   `npx shapeup-sdlc init` writes matches no command, and the quoted call-site form the skills use
   matches no rule — so the lane cannot start, the pipeline aborted at dispatch 1 on all three
   legs, and **the A7 re-run cannot be bought yet**. The three options (enumerate whole-argument
   rules and unquote the call sites; grant `Bash(node:*)`; grant the unscoped `"Workflow"` token)
   trade least-privilege against the spaced-install-path break that motivated the quoting. Whichever
   is chosen, its regression guard must **execute** a granted command — comparing strings is what
   let this stand. The merge waits on this, not on cost: Stage 1's **+37.6%** did not reproduce
   (candidate ~10% *cheaper* per scored rep), unreplicated rather than refuted at n=2 vs n=2.
8. **The A7 re-run is staged, not run** — `hd007-fix-evidence.md` §6 carries both arms' exact
   commands, the `BENCH_REQUIRE_LANE=1` gate on the candidate arm, the R12 recording lines, and the
   three result checks to make before reading any score. It is one HD-009 decision away from being
   fireable, and it stays the PO's spend (~$30–40).

## Standing guardrails

- No merge, no tag, no publish. Branch pushes only.
- Everything outside the active plan's file-touch map is scope creep.
- Every stage exit is an artifact on disk, never a claim. A stage without its evidence file did not
  happen — and an evidence file whose status line reads `FAIL` is a stop, not a scoreboard entry.
