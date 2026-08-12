# Stage 3 evidence — the cutover paperwork (Stage B of `remaining-stages-plan.md`)

**Run 7, 2026-08-12, `/Users/teo/workspace/proj-harness-plugin`, branch `feat/workflow-orchestrator`.**

Stage B executes S3's rows R7–R11. It is the paperwork stage: no orchestrator behaviour changes
here, one dead file leaves, and the documents that describe the cutover start describing the thing
that actually shipped. The stage runs **only because A3's probe passed** — `kill-resume-probe: PASS`
(`stage-a3-evidence.md` §4). Twice before, that gate held and Stage B did not start.

```
stage-b: PASS
rows: R7 PASS · R8 PASS · R9 PASS · R10 PASS · R11 PASS
A6: PASS — clone-derived 1221 checks, exit 0
A7: FAIL
arm-candidate: sdd-harness-bench/results/a7/candidate.log @ 8c0c868
arm-control: sdd-harness-bench/results/a7/control.log @ f2889e2
```

⟐ **Stage C ran on 2026-08-12 and A7 with it. `A7: DEFERRED` above became `A7: FAIL`** — see §7.
The candidate arm did not clear the absolute bar (3× 14/14 with receipts present; it went 1 of 3),
and the comparative arm is **void as a test of this migration's thesis**: `shapeup-run.js` never
executed in any rep, so the workflow lane was never measured. Both facts are in §7.6.

Baseline entering the stage, both re-derived by execution at `c4735c0`: `npm test` green in-tree at
**1363 checks**; `contract-check.mjs` printing `GATE MET` above **19 PASS / 4 RED**.

---

## 1. What shipped

### B.1 — `shapeup-build-round.js` is deleted (R10, delete arm)

**The premise, re-derived rather than read.** `SKILL.md:58-59` launches exactly one script,
`shapeup-run.js`. Every other mention of the build-round file across `skills/ hooks/ commands/ bin/`
is a comment or a schema note. It was unreachable, and had been since Stage 2 inlined the round loop
(that script's banner gives the three reasons). 418 lines of duplicate attempt loop, kept alive by a
test that asserted it existed.

**The plan named three places the file was asserted. There were four.** The fourth was found by
grepping for the filename instead of reading the plan, which is the whole lesson of the item:

| # | site | what it asserted | what it is now |
|---|---|---|---|
| 1 | `tests/structural/16-workflows.mjs:65-68` | the file **exists** | **reachability** — every `.js` in `workflows/` is one `SKILL.md` launches |
| 2 | `execution-contract.md` S1 row | `test -f …/shapeup-build-round.js` | `grep -q 'breaker: "inner"' …/shapeup-run.js` |
| 3 | `stage1-evidence.md` Verify 3 | the negative probe, against `:351` | re-pointed at `shapeup-run.js:762-774` (§2 below) |
| 4 | `tests/structural/17-gate-zerowork-workflow.mjs:70` | the filename as a synthetic `scriptPath` | an explicitly hypothetical sibling |

Site 4 is the one worth dwelling on. It never touches the filesystem — it feeds a made-up
`scriptPath` to `dispatchedOrchestrator` to prove the gate's predicate is `shapeup-*` and not
`shapeup-run`. Deleting the file would have left that check **green while asserting something false
about the tree**, and no instrument on this branch would have noticed. Its subject is now a
hypothetical sibling, so the width of the predicate is the claim rather than the filename.

Two of the replacements are deliberately *not* what the plan proposed:

- **Site 1 is not simply dropped.** "Drop the presence assertion, keep the D5 and path-literal
  checks" would have removed the only guard over this directory's membership. A presence check on an
  unreachable file is a row that cannot fail in the direction that matters — which is precisely how
  an orphan read as shipped code for an entire stage. The replacement asserts the invariant B.1
  exists to resolve, and **fails in both directions**: an unlaunched script fires it, and so does a
  `scriptPath` naming a file that is not there. Both verified by mutation (§2).
- **Site 2 is not the `shapeup-run.js` presence assertion.** S2 already carries `test -f
  skills/tech-lead/workflows/shapeup-run.js`; adding it to S1 would inflate the count by one row
  that cannot independently fail. S1's subject was never *a file exists* — it was *the build round's
  attempt loop and its inner breaker live in a workflow script*. After the inlining, the row that
  reads that work is a grep for the surviving inner-breaker return.

### B.2 — plan step 1: confirmed, and one thing was not confirmable

Specified as confirm-only. Two of three checks confirm clean:

| check | result |
|---|---|
| (a) `SKILL.md` carries no scoped-lane round/attempt loop | **clean** — 122 lines, and `grep -cE 'attempt_budget loop\|round protocol\|for each scope, dispatch'` returns 0 |
| (c) no commented-out corpses | **clean** — no HTML-comment blocks anywhere in `skills/tech-lead/*.md` or `references/*.md` |
| (b) `round-protocol.md` and `gates.md` each say which lane their sections serve | **`round-protocol.md` yes (`:11-22`); `gates.md` no** |

`gates.md`'s header claimed *"`SKILL.md` carries the workflow spine, the build/eval loop, and the
hard rules"*, and its order line read *"(BUILD → GATE L2 → EVAL, in SKILL.md)"*. Both stopped being
true when Stage 2 moved that loop into code; the sentences stayed behind. That is the same shape as
A5 — a document telling operators a mechanism lives somewhere it does not — one file over. `gates.md`
now carries a lane table: the gate blocks are lane-independent, and what differs is who runs the
loop *between* them.

**Revision A's instruction to delete `round-protocol.md`'s normative sections was correctly refused,
and this stage re-confirms why.** `SKILL.md:50-55` routes `--tiny` runs and every spec without
committed `scopes/*.md` there, verbatim and non-regression. Deleting it would remove the only
normative home a supported lane has.

### B.3 — commands name the Workflow launch (R9)

`commands/build.md` and `commands/ship.md` both name it. `build.md` keeps its standalone
single-task path — that is the task front door, not what the cutover replaces — and gains a section
saying why a full round is *not* that path: hand-rolling the attempt loop one task at a time is the
prose lane the cutover replaced, and the breakers are branches in a script rather than steps a
caller can be trusted to reproduce. `ship.md` documents what the launch actually does — pause is a
return value, resume comes off disk, and the headless environment variable is mandatory.

### B.4 — CHANGELOG cutover entry and `docs/upgrading.md` (R7, R8)

The entry names D1–D4 from the PO decision record (2026-08-06) and states the rollback: **pin the
previous release, `1.6.3`**. The version number is deliberately left unset — the tag, the manifest
bump and the merge are the PO's move, and the executor rule excludes them.

The three things revision A could not have known all appear, and two were re-derived rather than
repeated:

1. **"No in-tree prose lane" is too strong, and the entry says so in its own words.** Only the
   *scoped* lane is code-only; `--tiny` and pre-scope-contract specs keep `round-protocol.md`
   unchanged. A reader who has not adopted scope contracts should learn that this release changes
   how nothing runs for them.
2. **A pin reverts the day-2 ratchet merge too — and the plan's number was wrong.** The plan said
   *"24 of 46 changed files"*. Measured against its first parent, `af99937` touched **30** files.
   More usefully, the number a **user** feels is **6**: the files in that merge which ship in the
   npm package (`skills/orient/SKILL.md`, `skills/qa-edge-hunter/SKILL.md`,
   `skills/task-executor/SKILL.md`, `skills/tech-lead/references/delegation.md`,
   `skills/tech-lead/references/round-protocol.md`, `skills/tech-lead/scripts/ship-report.mjs`).
   The rest is repo-side tooling and measurement traces that were never in a release. "Wider than
   this migration" is not actionable; a file list is, and both documents carry it.
3. **`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` is mandatory for headless runs.** Without it
   `claude -p` terminates the Workflow at 600 s and **exits 0** — a truncated run reported as a
   clean one, which is worse than a failure because nothing downstream can distinguish them.

`upgrading.md` additionally states that **there is no migration script for this release, and why**:
the cutover changes how the harness runs and touches no artifact on disk, so `migrate.sh` reporting
nothing pending is correct rather than broken. An upgrade document silent on that question leaves
the operator guessing.

---

## 2. The mutation transcript

Every new or replaced assertion in this stage was broken on purpose and watched go red. A check
that has never failed is a claim, not an instrument.

| assertion | mutation | result |
|---|---|---|
| S1 contract row `grep -q 'breaker: "inner"' …/shapeup-run.js` | `contract-check.mjs --mutate --stage S1` empties the cited file | **red** — reported `falsifiable … red when emptied`, 4/4 mutatable S1 rows falsifiable |
| `16-workflows.mjs` reachability, unreachable direction | planted `skills/tech-lead/workflows/shapeup-orphan.js` | **red** — `a workflow script nobody launches … shapeup-orphan.js`; suite `❌ 1 failure, 1362 passed` |
| `16-workflows.mjs` reachability, missing direction | renamed `shapeup-run.js` → `shapeup-renamed.js` | **red** — `SKILL.md launches a workflow script that is not on disk: shapeup-run.js` |
| both, restored | reverted each mutation | **green** — back to 1363 checks |
| R7's own verifier `grep -q '1.7' CHANGELOG.md` | ran it against the finished entry | **passed while the literal `1.7` appeared zero times** — see below |

**One of this stage's own acceptance rows could not fail, and running it is how that surfaced.**
`remaining-stages-plan.md`'s R7 verifies the cutover entry with `grep -q 'no in-tree prose lane'`
**and** `grep -q '1.7'`. The dot is unescaped, so in basic grep it is a wildcard: the row matched
`107`, `127` and `137` inside unrelated CHANGELOG entries — text predating this branch — while
`grep -cF '1.7'` returned **0**. The row would have scored a cutover entry with no version in it at
all, which is exactly what the entry had, because the version is the PO's to stamp.

This is the same class as the four rows `execution-contract.md`'s instrument revision replaced
(*"a case-insensitive `pin` grep matched `**Pinned:**` in the 1.6.2 entry"*), one document over, and
it survived because that revision audited the execution contract and not the stage plan's own row
table. Both were fixed rather than one: the row now reads `grep -qF '1.7'`, and the entry is
headed `## [1.7.0] — unreleased`, naming the target version while `package.json` and
`.claude-plugin/plugin.json` stay at `1.6.3` until release. Falsification checked — strip the
version from the heading and the row goes red.

---

## 3. The negative probe, re-pointed — and the half of it that was not paid

This is B.1's stated real cost, and it was paid in part. Recorded plainly rather than left to
inference.

**The line numbers in the plan had drifted and were re-derived by reading the files.** It cites
`shapeup-build-round.js:351` and `shapeup-run.js:593`; at `c4735c0` those are a T0 call and the WIRE
phase respectively. The inner breaker in the surviving script is `shapeup-run.js:762-774`.

It has **two branches**, one `if`:

| branch | condition | behaviour |
|---|---|---|
| proposal carried, round continues | ≥1 scope green alongside the exhausted one | falls through to GATE L2 → EVAL, `hammer_proposals` carried forward |
| degenerate short-circuit | `roundGreen.length === 0 && roundHammer.length > 0` | returns `{status: "gate_h", breaker: "inner", …}` at `:774` |

**The first branch is demonstrated live on `shapeup-run.js`, and it is the branch the invariant is
actually about.** Stage A3's leg 2 (`.plan-runs/wf-a3-probe/`) drove the production script through
ORIENT → ANALYZE → WIRE → MAP SCOPES → BUILD over two rounds. Re-verified from disk for this stage:

| fact | artifact |
|---|---|
| `integration-regression` burned 3 attempts in each round, every T0 red | `t0/verdicts/r{1,2}-a{1,2,3}-t4.json`, six `escalates/…json` |
| four sibling scopes went T0-green in the same rounds | `t0/verdicts/r{1,2}-a1-t{1,2,3,5}.json` |
| the round was **not** blocked — L2 and EVAL both ran, round 2 followed | `orders/evaluate-r1.json`, `orders/evaluate-r2.json` |
| the run returned the proposal | `leg-2.out`: `{"status":"gate_h","breaker":"outer","hammer_proposals":["integration-regression",…],"green_scopes":[…]}` |

That is AGENTS.md's three-level breaker — *"an exhausted scope queues a GATE H proposal, it never
blocks the round"* — observed from outside, on the shipped path. It is also exactly the branch
`stage1-evidence.md` recorded as **not** exercised by Stage 1's own probe, because that probe
deliberately made every scope fail. The two records are complementary halves of one `if`, and
between them the halves are now covered on *some* script — but not both on the same one.

**The degenerate branch at `:774` is NOT exercised on `shapeup-run.js`.** Reaching it live needs a
round in which every scope is impossible, which means driving the outer script through four phases
to BUILD — the cost B.1 named and this stage did not pay. It is **guarded, not proven**: the new S1
contract row greps that exact return, mutation-checked, so the branch cannot be removed silently. A
grep over source is a weaker instrument than a run and this file is the place that says so. To
close it: seed a project whose every scope carries `e2e_verification_fixtures: [false]` and
relaunch — `.plan-runs/wf-a3-probe/seed-project.sh` is the rig.

---

## 4. A6 — the fresh clone (R11)

```
git clone --local --branch feat/workflow-orchestrator <repo> a6-clone
cd a6-clone && npm test
```

| | commit | checks | exit |
|---|---|---|---|
| in-tree | `1ba63d8` (final) | **1363** | 0 |
| fresh clone | `1ba63d8` (final) | **1221** | **0** |
| fresh clone, mid-stage | `7557319` | 1221 | 0 |
| previous clone figure (Rev B–E) | `7c1b15e` | 1120 | 0 |

**A6 is PASS: green in the worktree and green in a fresh clone, at the final commit.** Run twice,
three commits apart, to check the figure was not an artifact of when the clone was taken. `npm ci`
is not part of the procedure and fails — correctly, since the package declares no dependencies and
ships no lockfile. The suite is pure Node.

**The acceptance contract was also executed inside the clone**, which is where its rows have always
specified they run (`cwd: $CLONE`) and where they had never actually been run on this branch:

```
cd a6-final && node tools/contract-check.mjs
GATE MET — S2 ship gate — kill/resume probe: PASS
23 PASS / 0 RED                                     (exit 0)
```

That matters more than the in-tree reading it matches. Every row resolves against committed files
only — no local run trace, no untracked artifact, nothing this machine has that a teammate's clone
does not.

**The 142-check gap is located, not left as a number.** Instrumented by running each structural
module in order against both trees and reporting its own check count:

| | in-tree | clone | delta |
|---|---|---|---|
| `48-day1-day2.mjs` | 445 | 303 | **−142** |
| every other module (21 of them) | identical | identical | 0 |

The entire difference is one module reading `evals/runs/` — the raw Day-1 measure records, which are
**gitignored by design**. `.gitignore:29-48` states that split and its rationale: the *instrument*
is committed (rubrics, fixtures, schemas, both stored comparison points) so a clone can re-run the
measurement; the 2.3 MB of *run records* it produces stay local. §48(d7) fails if that line moves in
either direction. The enforced floor is `880+` (`docs/design/06-appendix.md:31`), which 1221 clears
comfortably.

So the gap is expected and the clone is honest. **One finding falls out of it anyway:** `README.md:344`
advertises `Tier 0 — 1250+ checks`, which is true in-tree and **false in a fresh clone**. It is not
the enforced floor (that comes from the appendix), so no test catches it. Left unfixed here because
`README.md` is outside this plan's file-touch map; it is a one-line change and named in §6.

---

## 5. A7 — the benchmark: DEFERRED

**`A7: DEFERRED`** — 2026-08-12. Not run, and deliberately not run: the executor rule states the
~$40–60 benchmark does not launch autonomously, and Stage C is a PO decision rather than executor
work.

**Obtainable here, unstarted — re-derived by execution, not read:**

```
node .plan-runs/day2-rev5/s3-feasibility.mjs
  yes  C1  benchmark repository present at its recorded path   /Users/teo/workspace/sdd-harness-bench exists
  yes  C2  benchmark reachable anywhere on this machine        /Users/teo/workspace/sdd-harness-bench
  NO   C3  adapter prerequisites present at pre-fix build a280e86
```

The three blocker codes, and what they mean for **this** row: C1 and C2 are **clear** — the earlier
record of them as blockers ("npm 404, global GitHub 0 results", commit `8fe70bc`) described a
different machine and is superseded. C3 is **not about A7**. It reports that the *day-2 plan's*
pre-fix build `a280e86` predates `gate-answers.mjs` / `budget-check.mjs`, so that plan's S3 arm
cannot be bought on any machine. A7's two arms are both modern builds and are unaffected.

**A7 is therefore gated on one thing only: the PO's spend decision at Stage C.** Both arms are
specified and neither has run:

| arm | build | lane | n |
|---|---|---|---|
| **candidate** | this worktree, installed via `npm pack` | the Workflow lane | 3 |
| **control** | v1.6.x as published | the prose lane | 3 |

Both arms are model-matched on **Sonnet 5** (the D5 floor). Absolute bar: 3× 14/14 oracle, 0
narrated, receipts present. Comparative bar: candidate ≥ control on acceptance, ≤ control on wall
clock.

The historical Haiku-4.5 rows in `results/runs.jsonl` are context and history only.
They are never the comparison point for a Sonnet run — a cross-model comparison is the exact
mislabelling class the Day-2 review documents, and the reason this row insists both arms name their
build id and their model.

**The one cost number in hand remains Stage 1's, and it is not A7.** Candidate $2.010 vs control
$1.461 — **+37.6%**, Sonnet-matched, on one trivial feature (`stage1-evidence.md`). It is a single
observation on a scaled-down cell and it stays unrefuted at scale until A7 runs. That is what
deferring A7 costs, stated as a cost rather than filed as done.

---

## 6. What is NOT demonstrated

Stated plainly rather than left to inference — the discipline `stage-a2-evidence.md` §6 and
`stage-a3-evidence.md` §5 set.

- **The degenerate inner-breaker branch (`shapeup-run.js:774`) has never run.** §3. Guarded by a
  source grep, not by a probe. This is the item Stage B was told would be its real cost, and it is
  the half that was not paid.
- **No orchestrator behaviour was exercised in this stage at all.** Stage B is paperwork plus one
  deletion. Every behavioural claim it makes is either A3's evidence or a structural assertion; no
  run of `shapeup-run.js` happened here.
- **A7 has not run** (§5), so the +37.6% cost figure stands on one trivial feature.
- **`README.md:344` states a check count that is false in a fresh clone** (§4). One-line fix, left
  out of scope by the touch-map guardrail.
- **The branch is still not pushed.** `origin/feat/workflow-orchestrator` remains behind by
  everything Stage A2, A3 and B produced. Nothing is merged, tagged or published — the PO's move.
- **The CHANGELOG entry names `1.7.0` but nothing is stamped.** `package.json` and
  `.claude-plugin/plugin.json` still read `1.6.3`; the tag and the bump are the PO's move.
- **The stage-plan row tables were never audited the way `execution-contract.md` was.** R7's
  wildcard (§2) was found by running one row. The other eleven rows in that table have not been
  mutation-checked, and at least R10's XOR and R12's alternation carry the same unescaped-regex
  shape. Worth one pass before Stage C leans on them.

---

## 7. Instruments, after

Both re-derived by execution at the stage's final commit:

| instrument | before Stage B | after (at `1ba63d8`) |
|---|---|---|
| `npm test`, in-tree | 1363 | **1363** |
| `npm test`, fresh clone | 1120 (`7c1b15e`, stale) | **1221**, exit 0 |
| `contract-check.mjs`, in-tree | GATE MET · 19 PASS / 4 RED | **GATE MET · 23 PASS / 0 RED** |
| `contract-check.mjs`, in the clone | never run | **GATE MET · 23 PASS / 0 RED**, exit 0 |

The four rows that were red are the four Stage B was written to close: the CHANGELOG cutover entry
(R7), `commands/build.md` (R9), and `stage3-evidence.md` twice (this file). No closed stage went red
in the process — the specific outcome the `execution-contract.md` amendment of 2026-08-12 was
written to prevent, and the reason B.1 moved four assertions in one commit instead of one.

---

## 7. Stage C — the fork, and A7 run

**Run 8, 2026-08-12.** The plan calls Stage C "PO decision, not executor work". The fork itself is,
and it was put and answered — **C2, run A7 now**. But two things had to be repaired before it could
honestly be put, and both were found by running instruments rather than reading them.

### 7.1 — The fork rested on a refuted premise

Both plan documents told the reader A7 was unobtainable here; the design authority said
**"BLOCKED ON THIS MACHINE. Do not attempt; do not substitute."** Re-derived by execution:

```
node .plan-runs/day2-rev5/s3-feasibility.mjs      # exit 4
  yes  C1  benchmark repository present at its recorded path   /Users/teo/workspace/sdd-harness-bench
  yes  C2  benchmark reachable anywhere on this machine        /Users/teo/workspace/sdd-harness-bench
  NO   C3  adapter prerequisites present at pre-fix build a280e86
```

C1/C2 are clear — the "npm 404, global GitHub 0 results" record (`8fe70bc`) described a different
machine. C3 is **not about A7**: it asks whether the *day-2 plan's* pre-fix build `a280e86` carries
`gate-answers.mjs`/`budget-check.mjs`. It does not and never will.

The sharper point: §4 item 5 named `s3-feasibility.mjs` **exiting 0** as the trigger that reopens
A7. That trigger **can never fire**, because C3 is permanently NO for a reason unrelated to A7.
Waiting for it was waiting forever. The top-of-file A7 correction banner had said A7 was obtainable
since 2026-08-11 while §4 went on saying the opposite — a status inherited across documents rather
than re-derived, which is the class of error this branch keeps catching in itself.

### 7.2 — R12 took a claim for a measurement

§6 asked for one audit pass over the stage-plan row table before Stage C leaned on it. R12 is the
row Stage C leans on. Mutated in five directions:

| mutation | R12 | correct? |
|---|---|---|
| M1 status line deleted | RED | ✅ |
| M2 prose "A7 passed — the benchmark went green" | RED | ✅ ("passed" unreachable, as specified) |
| M3 `DEFERRED` kept, feasibility citation stripped | RED | ✅ |
| M4 file emptied | RED | ✅ |
| **M5 bare flip to `A7: PASS`, no run logs** | **PASS** | ❌ |

The `DEFERRED` arm carried an evidentiary burden; the `PASS`/`FAIL` arm carried none, so the
disposition this whole stage exists to record was reachable by typing it. R12 now requires
`^arm-candidate:` and `^arm-control:` lines naming each run log by path and pinning each build by
commit. **R1–R11 were audited in the same pass: all green.**

### 7.3 — The two arms

| arm | lane | build tag | files | commit |
|---|---|---|---|---|
| **candidate** | Workflow (`shapeup-run.js` present) | `v1.6.3+bde89a1bf91d` | 138 | `8c0c868` |
| **control** | prose (no `workflows/` dir; 459-line `SKILL.md`) | `v1.6.3+a497a068665b` | 135 | `f2889e2` (tag `v1.6.3`) |

Verified, not assumed: the control tree has **no `skills/tech-lead/workflows/` directory at all**,
and its `SKILL.md` is 459 lines against the branch's 122.

⟐ **Both builds report version `1.6.3`** — the branch never bumped. The record already held a
*third* `1.6.3` build (`3864b1d09f71`) with materially different receipt behaviour, so this is not
hypothetical: only `buildTag`'s shipped-surface hash keeps these arms apart. Rows are additionally
self-labelled via `BENCH_ARM`. Contamination checked: `docs/` ships zero files, and the untracked
`.claude/workflows/summarize-changes.js` is not in the pack.

### 7.4 — Model: Sonnet 5, off-MUT, deliberately

The runner enforces one model under test — `claude-opus-5` (PROTOCOL.md §6, amended 2026-08-11) —
and refuses others without the loud `BENCH_ALLOW_MODEL` hatch. A7 was pre-registered on **Sonnet 5**
and Sonnet is what ran, because:

1. A7's bars are **within-pair**, so MUT compliance buys no internal validity.
2. `cost_usd` is a recorded field, and the number A7 exists to test — Stage 1's **+37.6%** — is
   Sonnet-matched. On opus it would be comparable to nothing.
3. There are **zero** opus rows in the 240-row record (93 sonnet-5, 147 haiku-4.5).
4. D5's floor is "Sonnet or higher".

**These rows are off-MUT and are not comparable to future opus-scoped MUT rows.**

### 7.5 — What A7 measured, and what it did not

**`shapeup-run.js` executed ZERO times, in every rep of the candidate arm.** Every `Workflow` tool
call was denied by the client — `Review dynamic workflow before running` — and no rep fell back to
running the script through Bash either (Bash invocations of `shapeup-run.js`: 0 in every rep).

Reproduced outside the benchmark, minimally, on a trivial three-line workflow script:

| `--permission-mode` | `Workflow` result |
|---|---|
| `acceptEdits` (the bench's uniform mode, `session.mjs:56`) | **denied** — "requires interactive confirmation that isn't available in this session" |
| `bypassPermissions` | **launches**, returns `{"ok":true}` |

So the lane is not broken; it **cannot start headlessly without `bypassPermissions`**, and the
plugin says so nowhere: there is no `Workflow` permission string anywhere in the repository,
`npx shapeup-sdlc init` writes Bash allowances only, and `docs/upgrading.md` documents only
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` for headless runs.

**The candidate arm therefore measured the harness's fallback when its own lane is unavailable, not
the lane.** The comparative bar below is a real comparison — thin `SKILL.md` + improvised
orchestration versus the fat prose orchestrator — but it is **not** this migration's thesis, and it
must not be read as one.

⟐ **And rep 1 is the failure mode AGENTS.md says the runtime prevents.** `Skill(tech-lead)` was
dispatched, no receipt was written, and `gate-zerowork` **allowed** the Stop:
`"37 work calls — the session did work by other means"`. The invariant reads *"a session that
dispatched the orchestrator and left no receipt is blocked at Stop"*. The work-by-other-means escape
hatch swallows exactly the case the gate exists for, and the run scored 14/14 while reading like a
clean run.

### 7.6 — Results

```
A7: FAIL
```

| arm | rep | status | acceptance | escaped | receipt | wall (s) | cost |
|---|---|---|---|---|---|---|---|
| candidate | 1 | `harness_unreachable` | (14/14 oracle, **not scored**) | 0 | ✗ | 611 | $3.402 |
| candidate | 2 | ok · gate L4 | **100%** | 0 | ✓ | 1807 | $8.606 |
| candidate | 3 | ok · gate L1a | 28.6% | 10 | ✓ | 1352 | $3.939 |
| control | 1 | ok · gate H · `shipped_nothing` | 28.6% | 10 | ✓ | 1927 | $10.936 |
| control | 2 | ok · gate L1a · `shipped_nothing` | 28.6% | 10 | ✓ | 1200 | $2.997 |
| control | 3 | **`timed_out`** at the 2700 s cap | — | — | ✓ | *0 recorded* | *$0 recorded* |

**Absolute bar — 3× 14/14, 0 narrated, receipts present: candidate FAILS (1 of 3).** Rep 1 produced
a perfect artifact with no receipt; rep 3 shipped 4/14 with 10 escaped defects. *The control fails
it too (0 of 3)* — which is a finding about this cell, not a defence of the candidate.

**Comparative bar.** Candidate ≥ control on acceptance: **yes** — 64.3% vs 28.6% mean over scored
reps, and 10 escaped defects against the control's 20. Candidate ≤ control on wall clock:
**not established** (see the caveat).

⟐ **Arm totals must not be compared.** The control's timed-out rep burned a real 2700 s and is
recorded as `wall_clock_s: 0, cost_usd: 0`. Totals ($15.947/3769 s candidate vs $13.933/3127 s
control) therefore understate the control on both axes. Per **scored** rep: candidate 1580 s /
$6.27, control 1564 s / $6.97 — level on time, candidate ~10% cheaper.

**On Stage 1's +37.6%:** it did not reproduce. Per scored rep the candidate came in *below* the
control on cost. But n=2 vs n=2, on a cell where four of six reps failed the absolute bar, is far
too weak to retire the Stage 1 figure — it is not refuted, it is unreplicated.

### 7.7 — What Stage C did NOT buy

- **The migration's thesis is still untested.** The workflow lane has never been measured against
  the prose lane, because it cannot start under the benchmark's uniform permission mode. Doing so
  needs **both** arms re-run under `bypassPermissions` (uniformity is the rule) — another 6 reps.
  ⟐ **Amended 2026-08-12, later the same day — the last sentence was refuted by testing it.**
  `hd007-control-plane-probe.md` (T1/P3): the same script shape this section records the tool
  denying under `acceptEdits` **runs** under `acceptEdits` when a granted Bash prefix carries it
  (`tools/control-plane/cp-run.mjs`). The re-run is obtainable in the bench's uniform mode — no
  `bypassPermissions` on either arm. The first sentence stands: the full pipeline has never run
  through cp-run, and the re-run is still the PO's spend decision.
- **The absolute bar failed on both arms**, so this cell says as much about f2-budgets under Sonnet
  as about either lane.
- **A7's own bars are not sensitive to the thing that broke.** `receipt.json` is satisfied by an
  agent emulating the pipeline by hand (candidate rep 2 did exactly that and scored). The
  run-evidence check cannot distinguish "the lane ran" from "the lane was imitated".

arm-candidate: sdd-harness-bench/results/a7/candidate.log @ 8c0c868
arm-control: sdd-harness-bench/results/a7/control.log @ f2889e2
