# Run report — Day-2 tool-efficacy plan, rev 5

**Plan:** `docs/day2_tool_efficacy_review.md` @ sha256 `55fc3b87…` — **unchanged** since the contract
was compiled against it, so nothing drifted underneath this run.
**Branch:** `plan/day2-tool-efficacy`
**Started from:** `8bc21ff` (S0 already landed at `1bb0d73`) · **ended at:** `f0b33d7`
**Stopped because:** every stage reached green, S3 included. The operator lifted S3's hold on
2026-08-07; it was executed and closed **without spending its $5.8**, for the reason in §S3 below.

## Where it got to

| stage | status | verified how |
|---|---|---|
| **S0** — Withdraw the unsupported claim | ✅ green | 9/9 rows, by hand, before the run spent anything |
| **S1** — Predicate and model scope as fields | ✅ green | 5/5 rows at its own commit `9cbbc1f` |
| **S2** — Guard all three | ✅ green | 8/8 rows at its own commit `5546fee`, four of them mutation rows |
| **S3** — Probe the Sonnet baseline | ✅ green | 8/8 rows at its own commit `f0b33d7`, three reading the benchmark repo |
| **S4** — Gate the plan-executor | ✅ green | 6/6 rows at its own commit `bc61af3` |

**36 / 36 acceptance rows pass, each evaluated at the commit that produced it.** Against where the
branch started this session (15/28 at `8bc21ff`), the table also grew: S3 had **no acceptance rows
at all** until this session, which under Phase 3's own rule means it would have been marked green
by default.

### The one row that is red at final HEAD, and why that is correct

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

## Cost

- **$0 external spend, S3 included.** No benchmark reps were bought. The only thing written to
  `/Users/teo/workspace/sdd-harness-bench` is the committed `product_writes` change (`d3787fa`),
  which S3 names as its prerequisite and which costs nothing to make.
- Workflow (S1/S2/S4, prior session): 7 agents, 0 errored, **566k subagent tokens**, 216 tool
  calls, ~57 min wall clock. **S3 used no workflow and no subagents** — the stage was a benchmark
  change plus a re-scoring of existing transcripts, both cheaper to do directly than to delegate.
- Every verification in this report cost **zero model tokens** — `preflight.mjs` and the
  independent check scripts run the commands directly.

## What is still open

1. **The $26.8 after-arm is not bought, and on this evidence should not be.** The disposition
   table only reaches it on a 3/3 baseline. The baseline came back 0/8 on the arm and 0/2 at the
   pre-fix build, which is its **first** row: stop. Buying it anyway would also hit the same
   `a280e86` wall the $5.8 hit.
2. **`error_predicate.source` cannot cite the predicate it most needs to.** §48 rule 6 resolves
   `source` as **repo-relative** (`join(ROOT, file)` + `existsSync`). FC-02 and FC-04 satisfy it
   because their predicates are `structural` and decided in this repo. But every `measured` or
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
4. **The two working-tree changes above** need someone to decide keep-or-discard. Still
   uncommitted, still unattributed, and still not seen by any acceptance row.
5. **`product_writes` is better, not proven** — the plan's §5 says so and the code says so in the
   same words. Its stated weakness: hand-written harness scripts (`run-init.mjs`, `spike-*.mjs` at
   the workspace root) are `.mjs` at product-shaped paths and still count, so the number is an
   upper bound. A harness that games it would exit the corrected class exactly as `writes === 0`
   was exited. That is what `predicate_independence` exists to make attackable.
