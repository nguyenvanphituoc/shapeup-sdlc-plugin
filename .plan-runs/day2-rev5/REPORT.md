# Run report — Day-2 tool-efficacy plan, rev 5

**Plan:** `docs/day2_tool_efficacy_review.md` @ sha256 `55fc3b87…` — **unchanged** since the contract
was compiled against it, so nothing drifted underneath this run.
**Branch:** `plan/day2-tool-efficacy`
**Started from:** `8bc21ff` (S0 already landed at `1bb0d73`) · **ended at:** `f0b33d7`
**Stopped because:** every stage reached green, S3 included. The operator lifted S3's hold on
2026-08-07; it was executed and closed **without spending its $5.8**, for the reason in §S3 below.

**Two machines ran this branch, and they disagreed about S3 for a good reason.** A second session
on a machine **without** the benchmark attempted S3 on 2026-08-08, derived that it could not run
there, and closed it as *blocked — reopens on the machine that holds the benchmark*. This machine
**is** that machine. Its determination is preserved in `contract.md` rather than overwritten,
because its exhausted-search record is what stops the next session repeating it.

## Verdict — the rung is met, scoped to Haiku

**Day 2's rung has its first sampled reduction, bought 2026-08-11.** FC-01 carries `reduces: true`,
`reduction_basis: "sampled"` — **5/5 shipped-nothing at pre-fix `a280e86` against 1/10 at
`v1.6.3+3864b1d09f71`, Fisher exact one-tailed p = 0.0020**, both rates `model_scope`
`claude-haiku-4-5-20251001`. Rule 9 recomputes that p-value and accepts it; the same rule refused
this class at 1/3 (p = 0.107) hours earlier, which is exactly what the arm was bought to fix.

**The scope is part of the claim, not a caveat.** This is a statement about Haiku. The class does
**not** occur on the model under test — 0 of 8 scored Sonnet rows against 7 of 16 on Haiku, and the
MUT is now `claude-opus-5`. Read as one finding: *this tool measurably reduces this class on the
instrument where the class occurs, and the class does not occur on stronger models.* Quoting the
reduction without its instrument would be the defect rev 3 withdrew.

**The method is the evidence.** Cell, target n=10 scored, 30-attempt cap, statistic and **both**
dispositions were registered (`f286567`) before any rep existed; the model-scope objection
(`71ded49`) and the interpretation rule (`38d1829`) were filed before any row; a data-independent
20:00 time-box (`9542605`) replaced an open-ended run. **The p-value crossed 0.05 at n=4 and the arm
was not stopped** — stopping when the number looks good is optional stopping, and the
pre-registration exists to make that refusal automatic rather than a matter of character.

| | |
|---|---|
| Attempts / scored | 10 / 10 — **100% yield** (prior arm: 4 of 11, the rest `harness_unreachable`) |
| Failure observed | rep 3: `writes=1`, `product_writes=0` — finished, wrote one intake file, shipped nothing. **The retired `writes === 0` predicate would have scored it a success.** S0's withdrawal, observed live |
| Cost | $18.86 |
| Limits travelling with the number | one feature, one model, an author-owned benchmark with no external replication, n=10 |

**What remains true from the earlier verdict:** every stage is green, the plan's question was answered
*no* — the original 3-of-8 claim was an artifact and stays withdrawn — and the register reads 3 of 8
at the bar (FC-02, FC-04 `structural`; FC-01 `sampled`).

<details><summary>Superseded verdict, kept because it was the honest reading before the arm was bought</summary>

**The plan is complete. The rung is not passed, and that is now a derived result rather than a
status.** All five stages are green, every exit criterion the plan set is met, and the question it
was written to answer — *is the 3-of-8 claim true?* — is answered: **no**. The `sampled` reduction
was an artifact of counting a predicate this harness's own intake write forecloses; it is withdrawn.
The register stands at **2 of 8, both `structural`**, which is exactly what Stage 0's exit predicted.

The register's `note` has always named the reading in force — *"the rung requires at least one
sampled reduction; structural claims remain valid and stay labelled"* — so Day 2's rung is open. What
this run adds is **why it is open, per class, mechanically**, in place of an open-ended backlog:

| Class | Why no sampled reduction |
|---|---|
| FC-01 | **Underpowered, not dead.** Within its Haiku scope both rates are measured and rules 6–8 all accept it; Fisher exact on 5/5 → 1/3 is p=0.107, so rule 9 refuses it on power alone. **3–7 more reps at the same scope and build would clear it** (2/6 → p=0.046, 3/10 → p=0.019). The n must be pre-registered. On the MUT the class doesn't occur (0/8 Sonnet), so the reachable claim is explicitly Haiku-scoped. |
| FC-05 | Its registered tool **is** the trigger-eval harness — an instrument that reveals the class, not a mechanism that reduces it. Its first measured rate was already 0/75, so there is no before-state either. |
| FC-03 · 06 · 07 · 08 | Unmeasured on both sides, and each tool is a hook, oracle or ledger that forbids its class by construction — measuring them yields more `structural` claims, not sampled ones. |

**What would reach it** is a class not yet registered, meeting three conditions at once: the failure
occurs on the model under test, the tool is a mechanism rather than an instrument, and both rates are
measurable within one model scope. That is a new bet, not a remainder of Day 2.

**The shape worth carrying forward:** the stronger the model under test, the fewer of these failures
occur at all — so a sampled reduction gets *harder* to buy exactly as the harness gets better. FC-01
is the worked example (7/16 → 0/8), and the benchmark's move to opus sharpens it further.

</details>

## Where it got to

| stage | status | verified how |
|---|---|---|
| **S0** — Withdraw the unsupported claim | ✅ green | 9/9 rows, by hand, before the run spent anything |
| **S1** — Predicate and model scope as fields | ✅ green | 5/5 rows at its own commit `9cbbc1f` |
| **S2** — Guard all three | ✅ green | 8/8 rows at its own commit `5546fee`, four of them mutation rows |
| **S3** — Probe the Sonnet baseline | ✅ green | 8/8 rows at its own commit `f0b33d7`, three reading the benchmark repo (⛔ blocked on the other machine, 2026-08-08) |
| **S4** — Gate the plan-executor | ✅ green | 6/6 rows at its own commit `bc61af3` |

**36 / 36 acceptance rows pass, each evaluated at the commit that produced it.** Against where the
branch started this session (15/28 at `8bc21ff`), the table also grew: S3 had **no acceptance rows
at all** until this session, which under Phase 3's own rule means it would have been marked green
by default.

### Four stages now read red at HEAD and green at their own commits — the honest accounting

**After the 2026-08-11 arm, `preflight.mjs` at HEAD reads 27/36.** That number is correct and is not
a regression. Every stage passes against the commit that produced it:

| stage | at | result |
|---|---|---|
| S0 | `1bb0d73` | **9/9** |
| S1 | `9cbbc1f` | **5/5** |
| S2 | `5546fee` | **8/8** |
| S3 | `f0b33d7` | **8/8** |
| S4 | HEAD | **6/6** |

**Why they diverge.** These rows pin the register's state *as their stage left it* — S0's assert
"FC-01 claims nothing" and "2 of 8 at the exit criterion, both `structural`". Both were true of the
register S0 delivered, and both stop being true the moment a later stage buys a real rate. S0's
deliverable was withdrawing the **artifact** rate — the one counting a predicate this harness's own
intake write forecloses — and that withdrawal is untouched: the bad rate is still in `superseded[]`
exactly where S0 put it. What FC-01 carries now is a **different** claim, pre-registered and
measured, which the plan's own §7 explicitly contemplates ("FC-01 cannot be re-based … *at all*" is
conditioned on the arm being unbuyable, not forbidden outright).

**What was deliberately not done.** These rows were not edited, relaxed, or deleted to make HEAD read
36/36. Changing an acceptance row because the result disagrees with it is the exact failure this plan
was written about, one level up. The `--at=<ref>` flag exists for this, it was built for S1's row,
and it now covers four.

**The count the plan tracks moved**: **2 of 8 at the exit criterion, both `structural`** → **3 of 8**,
FC-01 `sampled`, FC-02 and FC-04 `structural`.

### The row that was already red before this arm, and why that too is correct

At final HEAD the table reads **35/36**. The single red is S1's

```
git diff --quiet 1bb0d73 HEAD -- evals/failure-classes.json
```

which the contract marks **stage-local**: S1 must leave the register byte-identical, and S2 then
edits it on purpose (S3 now edits it again). Verified against S1's own commit `9cbbc1f` it passes,
5/5. This is the plan working as designed, not a regression — and it is the reason `preflight.mjs`
grew an `--at=<ref>` flag. Reporting 35/36 without that distinction would have been the more
convenient number and the less true one.

## S3 — what it established, and why it cost $0 instead of $5.8

S3 asked for n=3 Sonnet reps at the pre-fix build `a280e86`, ~$1.92/rep. **The arm was not bought,
because it is not purchasable with today's adapter.** That is arithmetic, not judgement:

- The adapter requires run evidence: `requireEvidence: [".shapeup/*/receipt.json",
  ".shapeup-sdlc/*/receipt.json"]` (`harnesses/shapeup-sdlc/adapter.mjs`).
- That receipt is written by `skills/tech-lead/scripts/init-run.mjs`, which **first exists at
  `36521ba` (v1.4.0)**.
- `git grep receipt.json a280e86` returns **nothing** — the string does not occur anywhere in the
  tree at that build.
- So every rep at `a280e86` is scored `harness_unreachable`, `scored: false`, excluded by PROTOCOL
  §8. **14 such rows are already in the record**, five of them this exact cell.

`a280e86` is the *pre-fix* build **because** it predates `init-run.mjs`. The adapter demands the
artifact whose absence defines the build, so the two are mutually exclusive by construction. This
is the same defect shape the plan is about — a predicate the subject cannot satisfy — one level up,
in the instrument. It is the plan's §7 falsifier and its disposition-table row 4 (*"instrument
fault — discard, change nothing, and say so"*), reached before any money moved rather than after.

### The question the arm was to answer, answered from transcripts already paid for

The prerequisite — `product_writes` and a `shipped_nothing` mode — was built and committed to the
benchmark (`sdd-harness-bench @ d3787fa`, 76 self-test checks, up from 48). Applying it to every
surviving transcript, joined to `results/runs.jsonl` **by each row's own recorded transcript path**:

| cell | n | ships nothing |
|---|--:|---|
| Sonnet, all arms, scored | 50 | **0** |
| Sonnet, `shapeup-sdlc`, scored | 8 | **0** — every rep made ≥1 product write (3, 8, 2, 2, 1, 2, 1, 2) |
| Sonnet at pre-fix `a280e86` | 2 | **0** — 3 and 8 product writes, both 1.0 acceptance |
| Haiku, `shapeup-sdlc`, scored | 16 | **7** — 5 `narrated` at 0 writes, 2 `shipped_nothing` at one intake write |

That is the disposition table's **first** row — the class does not occur on Sonnet — so: stop,
record FC-01 as Haiku-scoped, buy no after-arm. It is recorded in `FC-01.current.method`, which is
what S3's acceptance checks. **n=8 on the arm rather than the n=3 the probe would have bought.**

### Two places I nearly got this wrong, and the checks that caught it

- **Filenames lie in this record.** Scoring transcripts by their build tag produced an apparent
  refutation — a Sonnet run with 24 writes and 0 product writes at `a280e86`. Joining on the
  recorded `transcript` path instead showed it was `status: interrupted`, `scored: false`, and at
  harness_build **v1.4.0**. It was never evidence. Nothing was reported until the join was done.
- **`shipped_nothing` fired on 87 `cut` rows.** `cut` is the handoff protocol's deliberate mid-run
  cut of session A; every one has, by design, written nothing yet. Ungated they were the largest
  `shipped_nothing` population in the record and all of them spurious. The classifier now refuses
  every status that means the run was stopped from outside, with a test per status.

Both are the same lesson the plan is written about, which is why they are here rather than smoothed
over: the first draft of a measurement flattered the conclusion I was already expecting.

## What the run did not get to decide — checks no agent participated in

The workflow reported all four stages green on the first verification attempt, with no freezes and
no escalations. That is exactly the shape of result this skill exists to distrust, so beyond re-running
the contract by hand:

- **The zero-work gate was tested against rev 3's actual defect, not against the test S4 shipped.**
  A stage whose only proof is a test written by the same agent proves self-consistency. An
  independent `node:vm` harness reconstructed the real failure — `stages` non-empty but every stage
  optional, so `selected` comes out empty and the report path computes `complete` — plus three
  neighbours. **All four refuse, and refuse before any model call is spent.**
- **The one parser was cross-checked against a second, independently written one.** S4 item 3 exists
  because two readers disagreed on `\|`. Its selftest proves the parser agrees with itself; running
  it against `preflight.mjs`'s separately written parser over the real contract shows **both agree on
  all 28 rows, including the 12 whose `cmd` contains a literal pipe.**
- **The predicate citations were read, not just resolved.** S2's acceptance checks that each
  `error_predicate.source` resolves to a real `file:line`. It cannot check that the cited line is
  *relevant* — which is this plan's entire thesis one level up. Both were opened:
  `tests/structural/11-is-main.mjs:152` is the fragile-main-guard scan FC-02 describes, and
  `tests/structural/02-skills.mjs:173` is the `unmeasured`-with-results branch FC-04 describes.
  Real citations, not grep-bait.
- **Check counts move 1128 → 1128 → 1130 → 1130** across the three commits. S2's rules added checks;
  nothing shrank. (A `2 failur…` string in the suite output turned out to be the §48 module title
  "Day-**2 failur**e register" — `npm test` exits 0 with 0 failures.)

## What is true of the register now

- `FC-01.reduces` and `reduction_basis` are `null`; both its rates carry
  `model_scope: "claude-haiku-4-5-20251001"`. The withdrawal from S0 survived S2's edits.
- `FC-02` and `FC-04` — the two remaining claimants — each carry an `error_predicate` with
  `expression`, `source` and `counts`, turned from the prose already in their `current.method`.
- **2 of 8 at the Day-2 exit criterion, both `structural`.** Unchanged by S2, which is itself an
  acceptance row.
- §48 gained rules 6–8: a non-null `reduces` needs a citable predicate; a `sampled` basis needs
  `predicate_independence`; and a `sampled` basis needs `baseline.model_scope === current.model_scope`
  — the mechanical form of the pooling rule, and the one that would have caught the Haiku→Sonnet
  switch silently invalidating FC-01.

## Escalations

**None.** No fix was proposed and refused, because no stage failed a verification. Every stage went
green on its first attempt, so the freeze → three-lens diagnose → adjudicate path never ran. Worth
saying plainly: **the rejection rule was never exercised in this run.** It is untested here, not
proven.

## S3 — attempted, blocked, nothing faked

A later session (2026-08-08) was asked to execute S3 with authorisation to set this machine up
however it needed. **The setup does not exist to be done.** Re-derive it in one command —
`node .plan-runs/day2-rev5/s3-feasibility.mjs`, exit 3:

- **The benchmark is not here and cannot be fetched.** `/Users/teo` does not exist on this machine;
  nothing matching `*harness-bench*` exists anywhere under `/Users` or `/Volumes`; the plan records
  the benchmark as author-owned **with no git remote**, and no such repository exists under the
  authenticated GitHub account. S3 needs it for **both** halves — `product_writes` is committed
  *there*, and the n=3 reps run through its runner and hidden scorer. **Nor is the other machine
  reachable to copy it from:** `~/.ssh/config` holds only git forges, there are no network mounts,
  and no Time Machine destination is configured.
- **The pre-fix build is missing the adapter's prerequisites.** At `a280e86`, `gate-answers.mjs`
  and `budget-check.mjs` are absent under any path (both present at HEAD). This confirms the
  repository-side half of the plan's own stated "Known risk" from primary evidence. It does *not*
  prove the reps would fail — the adapter lives in the unreachable benchmark — and is recorded as
  corroboration, not as a result.

**What was deliberately not done.** No lookalike benchmark was reconstructed to produce a number.
A rebuilt instrument would be a *different* instrument, and comparing its output to the Haiku
baseline is the precise pooling error this plan exists to refuse. **$0 was spent** and no rate was
invented. S3's exit criterion is met by neither of its two branches, so the stage is **not** green.

**No claim was moved, because none needed to be.** §7 says that if the pre-fix build cannot be
driven, *"FC-01 cannot be re-based on Sonnet at all, and the honest terminal state is FC-01
permanently Haiku-scoped with `reduces: null`."* The register is **already exactly there** —
`reduces: null`, `reduction_basis: null`, both rates `model_scope: claude-haiku-4-5-20251001` —
left that way by S0–S2. The blocked probe changes nothing about what the register claims.

**Operator decision, 2026-08-08.** The blocker was put to the operator with four options —
transfer the benchmark here and run it for real, accept the blocked determination, draft the
`product_writes` patch blind, or reconstruct a benchmark locally. **They accepted the blocked
determination.** S3 is therefore *closed here as blocked*: not green, not abandoned, carrying no
rate and claiming nothing. It reopens on the machine that holds the benchmark.

**What now exists so S3 is one step elsewhere:** `s3-feasibility.mjs` (the gate to run first), four
compiled acceptance rows covering *both* branches of the plan's `or` exit criterion, and a 4-step
runbook — all in `contract.md` under Stage S3. The rows are deliberately **outside** the live
`## Acceptance` table: `preflight.mjs` runs everything it finds there, and a never-attempted stage
reporting `S3=RED` is indistinguishable from a stage that was done wrong.

## An instrument fault in `preflight.mjs`, found by tripping it

The 2026-08-08 session ran two `preflight.mjs` invocations that overlapped. They share one
hard-coded clean-room path (`clones/selfcheck`), and the second `rm -rf`s it at startup — so the
first ran its remaining rows against a clone being deleted underneath it and reported
**`S2=RED`**. Nothing in the repository had changed; a serial re-run reports `S2=GREEN`.

That is a **false RED**, and it is the same species of fault as the three benchmark instrument
faults §4 records: the measurement was wrong because the apparatus was, not because the thing
measured was. It matters more than it looks — a false RED invites someone to "fix" a stage that
was never broken, and the fix would be a change made to satisfy a corrupted check.

**Fixed by refusing rather than racing.** `preflight.mjs` now takes a `clones/.lock` directory and
exits 2 with an explanatory message if one is already held, keeping the single inspectable clone
path. Verified in both directions: the lock refuses while held, and re-acquires once released, so
it is not stuck-at-refused.

## Two changes in the working tree that belong to no stage

`.gitignore` and `.claude/skills/plan-executor/SKILL.md` are modified and **uncommitted**. The tree
was clean when I launched; both were modified during the run (04:53 and 04:57). No hooks are
configured, and a scan of all seven agent transcripts found **no** `Edit`/`Write`/`Bash` call
targeting either file. **I could not attribute the change, and I am not going to invent a cause.**

What is established: they are uncommitted, so acceptance — which clones HEAD — correctly never saw
them, and **the result above is unaffected**. They were left exactly as found.

One of the two is semantic rather than cosmetic and needs a human decision:

- `.gitignore` — adds `.claude/worktrees/`. Plausible housekeeping.
- `SKILL.md` — markdown reformatting (`*not*` → `_not_`, table alignment) **plus a real change**:
  the documented `verifyModel` flips **`haiku` → `sonnet`** in two places, including the Model policy
  table whose stated rationale for `haiku` ("Mechanical: clone, run listed commands, transcribe exit
  codes") is left intact underneath the new value. As it stands the table now argues for haiku and
  says sonnet.

**Update, 2026-08-08 — one resolved, one still open.** `SKILL.md` was decided and committed at
`b33579d`, which kept the `sonnet` value and rewrote the rationale under it so the table no longer
argues for haiku. `.gitignore` remains uncommitted and still needs the same keep-or-discard call;
this session did not decide it for you.

## Cost

- **$0 external spend, S3 included.** No benchmark reps were bought. The only thing written to
  `/Users/teo/workspace/sdd-harness-bench` is the committed `product_writes` change (`d3787fa`),
  which S3 names as its prerequisite and which costs nothing to make. The other machine spent $0
  too, for the different reason that it could not reach the benchmark at all.
- Workflow (S1/S2/S4, prior session): 7 agents, 0 errored, **566k subagent tokens**, 216 tool
  calls, ~57 min wall clock. **S3 used no workflow and no subagents** — the stage was a benchmark
  change plus a re-scoring of existing transcripts, both cheaper to do directly than to delegate.
- Every verification in this report cost **zero model tokens** — `preflight.mjs` and the
  independent check scripts run the commands directly.

## What is still open

1. **The $26.8 after-arm is not bought, and on this evidence should not be.** The disposition
   table only reaches it on a 3/3 baseline. The baseline came back 0/8 on the arm and 0/2 at the
   pre-fix build, which is its **first** row: stop. Buying it anyway would also hit the same
   `a280e86` wall the $5.8 hit. **This is now mechanical rather than only argued**:
   `s3-feasibility.mjs` exits **4** here — blocked by construction, not by this machine — and says
   in as many words that moving to another machine will not help and the arm must not be bought.
2. ~~**`error_predicate.source` cannot cite the predicate it most needs to.**~~ **Closed — see
   below.** §48 rule 6 resolved `source` as **repo-relative** (`join(ROOT, file)` + `existsSync`).
   FC-02 and FC-04 satisfied it because their predicates are `structural` and decided in this repo.
   But every `measured` or
   `sampled` predicate is decided in the **benchmark** — `failureMode()`, `product_writes` — which
   is a different repository with no remote. So the field, as built, cannot express a predicate for
   the very basis S2's rules 7 and 8 exist to police. **FC-01 therefore carries no
   `error_predicate`**: `reduces` is null so none is required, and writing a `source` that resolves
   nowhere would be a citation that looks like evidence and is not. Fixing it means either a
   cross-repo source form (`bench:runner/lib/transcript-metrics.mjs:214`) or vendoring the
   predicate — a schema change, so S1's territory, not S3's.
3. **Day 2 still has no sampled reduction**, which is the plan's own conclusion rather than a
   shortfall of this run. What shipped is the machinery that stops the *next* unsupported claim:
   a claim now cannot be `sampled` without a citable predicate, an independence argument, and
   matching model scopes on both rates.
4. ~~**The two working-tree changes above** need someone to decide keep-or-discard.~~ **Resolved,
   both halves, one per machine** — `SKILL.md` committed here at `b33579d`, `.gitignore` committed
   on the other machine at `21ae87b`. Both were unattributed; both are now decided, and no
   acceptance row ever saw them uncommitted.
5. **`product_writes` is better, not proven** — the plan's §5 says so and the code says so in the
   same words. Its stated weakness: hand-written harness scripts (`run-init.mjs`, `spike-*.mjs` at
   the workspace root) are `.mjs` at product-shaped paths and still count, so the number is an
   upper bound. A harness that games it would exit the corrected class exactly as `writes === 0`
   was exited. **Now recorded where it can be attacked** rather than only in prose: FC-01 carries a
   `predicate_independence` field naming the scorer's separation from the tool *and* this exact
   limit. Still not proven — that has not changed, and no claim rests on it.
6. ~~**`s3-feasibility.mjs` reports a false blocker on this machine.**~~ **Fixed.** `find` exits 1
   on the first unreadable directory under `/Users` **having already printed its hits**;
   `execFileSync` throws on that exit, so the assignment never ran and the empty `catch` discarded
   the answer with the error. C2 now reads stdout off the thrown error and agrees with C1. Two
   consequences worth naming. First, the probe now **corroborates** S3 instead of contradicting it:
   the only remaining blocker is C3, the pre-fix build genuinely lacking the machinery the adapter
   needs — disposition row 4, exactly what S3 concluded. Second, the blocked-message was written
   assuming reachability was the blocker and told a reader standing on the benchmark to go find the
   machine that holds it; blockers are now split by class, **exit 3 = blocked on this machine
   (reopens elsewhere)** and **exit 4 = blocked by construction (reopens nowhere)**. The runbook's
   step 1 could not otherwise ever open its own gate.

**Closed this pass, with what closed them:**

- **Item 2 — `error_predicate.source` can now cite the predicate it most needs to.** §48 rule 6
  gained a cross-repo form, `<repo>@<commit>:file:line`, resolved through a registry of known
  external repositories (`bench` → `BENCH_DIR`, defaulting to the recorded path). Where the repo is
  present the pin is verified against that commit for real; where it is absent the check says
  UNVERIFIED HERE in its own message rather than passing as though it had resolved. Requirement and
  validation were also split: `reduces !== null` still *requires* a predicate, but merely *carrying*
  one now triggers validation — otherwise FC-01's new citation would have been the very thing the
  rule exists to forbid, an unchecked citation. **FC-01 therefore now carries the
  `error_predicate` it could not express before**: `bench@d3787fa:runner/lib/transcript-metrics.mjs:387`,
  the `shipped_nothing` decision line, verified at that commit by the suite. The branch is
  exercised six ways — valid pin, bad commit, bad path, out-of-range line, unregistered repo
  prefix, and unreachable repo — four of them negative.
- **The Model policy table no longer argues one model and names another.** `b33579d` flipped
  `verifyModel` haiku → sonnet and left the haiku rationale ("Mechanical … nothing here is a
  judgement call") standing underneath it, recorded there as a known inconsistency. The *Why*
  column now states the judgement that actually justifies the tier: a verifier must notice a
  command that exits 0 having measured nothing, and report a red it was hoped not to find.
