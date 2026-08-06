# Run report — Day-2 tool-efficacy plan, rev 5

**Plan:** `docs/day2_tool_efficacy_review.md` @ sha256 `55fc3b87…`
**Branch:** `plan/day2-tool-efficacy`
**Started from:** `c9e6620` · **ended at:** `1bb0d73`
**Stopped because:** the session usage limit was hit mid-verification. **Not a plan failure.**

## Where it got to

| stage | status | verified how |
|---|---|---|
| **S0** — Withdraw the unsupported claim | ✅ **green** | 9/9 acceptance rows in a fresh `git clone --local` at `1bb0d73`, **run by hand, no agent involved** |
| S1 — Predicate and model scope as fields | ⬜ not started | 3 of 5 rows red (the two that are green are `npm test` and the register-unchanged check, both of which pass trivially before the stage runs) |
| S2 — Guard all three | ⬜ not started | blocked on S1 |
| S3 — Probe the Sonnet baseline | ⏸ **held by the operator** | compiled in full, `Optional: yes`, not run — $5.8 and the only stage that writes outside this repo |
| S4 — Gate the plan-executor | ⬜ not started | blocked on S2 |

**Full acceptance right now: 15 / 28 rows.** Against where the repository started (7/28 at `77f014c`),
S0 moved 8 rows green and nothing regressed.

## What S0 actually did

The claim is withdrawn, not patched — the distinction §3 insists on, and the acceptance holds the
register to it row by row:

- `FC-01.reduces` → `null`, `reduction_basis` → `null`. `co_attributed_to` still `["FC-02"]`, because
  Arm B is unaffected and that is where the finding lives.
- `FC-01.superseded[]` now carries **two** retired records — the pre-existing `re-measure` (the v1.5
  rate) *and* the new `instrument-change` (the v1.6.3 Haiku rate, value 0, n 3). Neither was
  overwritten. The new record's `method` states *why*: it counted `failureMode() === "narrated"`,
  whose predicate is `writes === 0`, which this harness's own intake write forecloses.
- `FC-01.current` is the corrected Haiku rate: **1/3 shipped-nothing**, `measured`, carrying Fisher
  **p = 0.1071** and rep 1's zero-product-writes evidence.
- `FC-01.baseline` is untouched — still 1.0, n=5, Haiku, `a280e86`. FC-02 is untouched.
- The register `note` now says a claim is only as good as the predicate its rate counted, and that
  both the predicate and the model it was counted on must be recorded.

**The headline moved: the register reads 2 of 8 at the Day-2 exit criterion, both `structural`.**
It read 3 of 8 with one `sampled`. That sampled claim was the one this whole revision argues is
unsupported, and it is now gone from the register rather than argued about in a document.

`npm test` in a clean clone: **1128 checks, 0 failures** (1130 before — two checks disappear because
§48(f)'s rules 3 and 4 only run against a `sampled` claim, and there no longer is one).

## What I changed beyond the plan, and why

Two commits are mine rather than a stage's, and both are flagged here so the diff is honest:

- **`77f014c`** tracked `.claude/skills/plan-executor/`. S4's acceptance runs in a clone of HEAD, and
  an untracked skill is invisible there — every S4 row would have failed for the one reason that says
  nothing about S4.
- **Three defects in my own contract**, found by running all 28 rows in a clean room *before*
  spending anything:
  1. S2's mutating rows shared one clone and contaminated each other — the rule-2 mutation landed on
     top of rule-1's, so the suite would have gone red for the wrong rule and the row would have
     "passed" proving nothing. Every S2 row now restores the register first.
  2. S4's mutation row passed **because the gate test is absent** — `<strip gate> && ! <run gate>`
     succeeds when the gate test does not exist. It now runs the test green before mutating.
  3. S1's register-unchanged check had no guarantee the sha it compares against was ever recorded.

- **A portability fix, made after the run stopped.** Two rows read a sha from
  `.plan-runs/day2-rev5/s0-register.sha256` by absolute path. `.plan-runs/` is gitignored and the path
  is machine-specific, so neither row could survive this branch moving to another machine. Both are
  now git-based and need no side-channel file at all:
  - S0: `git merge-base --is-ancestor 1bb0d73 HEAD`
  - S1: `git diff --quiet 1bb0d73 HEAD -- evals/failure-classes.json`

  This is stronger than what it replaced — it pins to S0's actual commit rather than to a hash
  someone recorded.

## Two places the plan is under-specified

Both are resolved in `contract.md` under explicit **Compiled note** headings, so a reader can always
tell the plan's words from mine. Whoever picks this up should agree with them before running S1.

1. **Stage 1 cannot both make the new fields `required` and leave the suite green.** Its exit line
   asks for *"register unchanged; `npm test` green"*, but today's register has measured rates with no
   `model_scope` and claiming classes with no `error_predicate`. A hard `required` makes the register
   schema-invalid and §48(f) fails. So the obligation is **declared in S1 and enforced in S2**, which
   is where the plan puts the mechanical rules and where its exit is explicitly *"not a green suite"*.
2. **Stage 2's rule 1 is red on arrival** unless FC-02 and FC-04 gain an `error_predicate` — they are
   the two remaining claimants. That is the plan's own intent (its Appendix: *"whether the other seven
   classes' implied predicates are tool-independent, [is] which Stage 1 would force each to answer"*),
   so populating them is written into S2 rather than left for an agent to discover mid-flight.

## Escalations

**None.** No fix was proposed and refused; the run never reached a diagnosis. The stop was a usage
limit during `verify:S0-a1`, which is why S0 shows `stalled` in the workflow's own result even though
S0 is in fact green — the workflow could not tell, because its verifier never returned. That gap is
exactly why Phase 5 re-runs acceptance by hand, and why this report does not take the run's word for
anything.

## Cost

- **$0 external spend.** Stage 3 was held, so no benchmark reps were bought and nothing was written
  to `/Users/teo/workspace/sdd-harness-bench`.
- Workflow: 124k orchestrator tokens, 238k subagent tokens, 3 agents (1 errored on the usage limit),
  ~46 min wall clock.
- All verification in this report cost **zero model tokens** — `preflight.mjs` runs the acceptance
  table directly.

## Left in the working tree

`package-lock.json` is untracked run detritus from a stray `npm install` (this project has no
dependencies and commits no lockfile). It is not committed and will not travel. Delete it or ignore
it. The other untracked paths — `.claude/workflows/`, `.claude/worktrees/`, `docs/workflow_*.md` —
predate this run and were not touched.
