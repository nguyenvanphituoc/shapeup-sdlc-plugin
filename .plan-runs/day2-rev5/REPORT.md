# Run report — Day-2 tool-efficacy plan, rev 5

**Plan:** `docs/day2_tool_efficacy_review.md` @ sha256 `55fc3b87…` — **unchanged** since the contract
was compiled against it, so nothing drifted underneath this run.
**Branch:** `plan/day2-tool-efficacy`
**Started from:** `8bc21ff` (S0 already landed at `1bb0d73`) · **ended at:** `bc61af3`
**Stopped because:** every non-optional stage reached green. S3 was attempted on 2026-08-08 and is
**blocked on this machine** — see *"S3 — attempted, blocked, nothing faked"* below.

## Where it got to

| stage | status | verified how |
|---|---|---|
| **S0** — Withdraw the unsupported claim | ✅ green | 9/9 rows, by hand, before the run spent anything |
| **S1** — Predicate and model scope as fields | ✅ green | 5/5 rows at its own commit `9cbbc1f` |
| **S2** — Guard all three | ✅ green | 8/8 rows at its own commit `5546fee`, four of them mutation rows |
| S3 — Probe the Sonnet baseline | ⛔ **blocked — cannot run on this machine** | attempted 2026-08-08; determination derived by `s3-feasibility.mjs` (exit 3) |
| **S4** — Gate the plan-executor | ✅ green | 6/6 rows at its own commit `bc61af3` |

**28 / 28 acceptance rows pass, each evaluated at the commit that produced it.** Against where the
branch started this session (15/28 at `8bc21ff`), 13 rows moved green and none regressed.

### The one row that is red at final HEAD, and why that is correct

At final HEAD the table reads **27/28**. The single red is S1's

```
git diff --quiet 1bb0d73 HEAD -- evals/failure-classes.json
```

which the contract marks **stage-local**: S1 must leave the register byte-identical, and S2 then
edits it on purpose. Verified against S1's own commit `9cbbc1f` it passes. This is the plan working
as designed, not a regression — and it is the reason `preflight.mjs` grew an `--at=<ref>` flag this
session. Reporting 27/28 without that distinction would have been the more convenient number and the
less true one.

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

**What now exists so S3 is one step elsewhere:** `s3-feasibility.mjs` (the gate to run first), four
compiled acceptance rows covering *both* branches of the plan's `or` exit criterion, and a 4-step
runbook — all in `contract.md` under Stage S3. The rows are deliberately **outside** the live
`## Acceptance` table: `preflight.mjs` runs everything it finds there, and a never-attempted stage
reporting `S3=RED` is indistinguishable from a stage that was done wrong.

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

- **$0 external spend.** S3 was first held and then found unrunnable here, so no benchmark reps were
  bought and nothing was written to `/Users/teo/workspace/sdd-harness-bench` — a path that does not
  exist on this machine.
- Workflow: 7 agents, 0 errored, **566k subagent tokens**, 216 tool calls, ~57 min wall clock.
- Every verification in this report cost **zero model tokens** — `preflight.mjs` and the two
  independent check scripts run the commands directly.

## What is still open

1. **S3 is unrun and unbought, and cannot be run here.** $5.8 for n=3 Sonnet reps at pre-fix
   `a280e86`, plus a `product_writes` change committed to the benchmark repo — **a repository that
   is not on this machine and has no remote to fetch it from.** It needs the machine that holds it;
   everything else is staged and one command away (`s3-feasibility.mjs` first, then the runbook).
   §2(e)'s n=1 says the likely answer is *no collapse on Sonnet*, which ends with FC-01 permanently
   Haiku-scoped — the state the register is already in. Nothing that shipped depends on it.
2. **Day 2 still has no sampled reduction**, which is the plan's own conclusion rather than a
   shortfall of this run. What shipped is the machinery that stops the *next* unsupported claim:
   a claim now cannot be `sampled` without a citable predicate, an independence argument, and
   matching model scopes on both rates.
3. **`.gitignore`** still needs someone to decide keep-or-discard. (`SKILL.md`, the other half of
   this item, was resolved at `b33579d`.)
