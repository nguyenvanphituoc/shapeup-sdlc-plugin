# The execution contract

One markdown file, `<workdir>/contract.md`, compiled from a plan document. It is the only thing
the run reads about what to do and the only thing that decides whether a stage is done.

It is markdown because it gets hand-edited. The one step no amount of parsing can do for you —
turning *"Exit: `npm test` green; the register shows 2 of 8 classes at the exit criterion"* into a
command — is a judgement call someone has to make, and asking them to make it inside a JSON blob is
asking them not to make it.

## The shape

```markdown
---
schema: plan-execution-contract/v1
plan: docs/<the plan document this contract was compiled from>.md
plan_sha256: <sha256 of the plan file, so drift is detectable>
title: <the plan's H1>
fresh_state: head
commit_per_stage: true
attempt_budget: 3
no_progress_rounds: 2
execute_model: sonnet
diagnose_model: fable
verify_model: haiku
stages: [S1, S2, S3, S4]
---

# Execution contract — <plan title>

## Acceptance

| stage | cmd | cwd | expect_exit | expect_match | expect_absent | note | review |
|---|---|---|---|---|---|---|---|
| S1 | npm test | $CLONE | 0 | 0 failures |  | plan expects ~1112 checks |  |

## Guardrails

- <the plan's §5 "what deliberately not to do", one bullet each, verbatim>

## Stage S1 — <title>

**Depends on:** —
**Optional:** no
**Exit criterion:** <the plan's own Exit line, verbatim>
**Estimate:** ~30 min · $0

<the stage's instructions, copied from the plan — not summarised. The executing agent works from
this and nothing else, and a summary is where the detail that mattered goes missing.>
```

### Frontmatter fields

| field | meaning |
|---|---|
| `plan`, `plan_sha256` | which document this came from, and whether it has changed since. A drifted plan means the run is executing something nobody is reading. |
| `fresh_state` | `head` clones HEAD only — uncommitted work is invisible, deliberately. `worktree` replays the working tree on top; faster, blind to the "fix lives only on my laptop" defect, never accept a stage on it. |
| `commit_per_stage` | whether the executing agent commits. Under `head` this must be true, or acceptance can never see the work. |
| `attempt_budget` | fix attempts per stage before it is marked exhausted. |
| `no_progress_rounds` | identical failures tolerated before the stage is abandoned. |

### The acceptance table

One row per check. `$CLONE` is the fresh clone; `$REPO` is the working repository.

| column | meaning |
|---|---|
| `stage` | which stage this check judges |
| `cmd` | the command, run from `cwd`, exactly as written. Escape a literal `\|` as `\\|` or the table splits mid-command. |
| `expect_exit` | usually `0` |
| `expect_match` | regex the combined stdout+stderr must contain |
| `expect_absent` | regex it must *not* contain |
| `note` | context from the plan. Never blocks a run. |
| `review` | this row cannot run as written. **A contract with any `review` cell must not be run.** |

## Authoring acceptance — the part that matters

A stage with no acceptance command gets marked green by default, and a green stage nobody checked
is the single outcome this whole run exists to prevent. So every non-optional stage needs at least
one row, and the rows have to be honest.

**Turn the plan's Exit line into a command, not a vibe.** The plan says what done looks like; your
job is the shell equivalent.

| The plan says | A weak row | A row that means something |
|---|---|---|
| "`npm test` green, ~1112 checks" | `npm test`, exit 0 | `npm test`, exit 0, `expect_match: 1112 checks` — an exit-code-only check passes on a suite that silently ran 790 of them, which is the exact defect these plans were written about |
| "the register shows 2 of 8 classes at the exit criterion" | `npm test` | a `node -e` one-liner that counts the rows and exits 1 when the count is wrong |
| "re-applying the mutation turns the suite **red**" | — | `node -e "<mutate>" && ! npm test` — the check *is* that the suite fails. The clone is disposable, so nothing needs restoring afterwards. |
| "commit as its own change" | — | `git log --oneline -5 \| grep -q '<the change>'` |

**Prefer a check the plan already ran.** These reports mostly quote a command and its output —
`git clone --local . /tmp/x && npm test`, `node skills/tech-lead/scripts/stats.mjs --hooks`. That is your row,
minus the cloning, because the harness has already put you inside a fresh clone.

**Acceptance only reads.** No `git push`, no `npm publish`, no `gh pr create`. A check that
publishes has left the repository, and a failed run then has to be un-done somewhere else.

**Say what you could not encode.** A stage whose exit criterion is genuinely a human judgement
("the caveat travels with the number") should carry the closest mechanical proxy plus a `note`
saying what the proxy misses. That is honest and useful. Silently dropping it is neither.

## Worked example — Day 1

The plan's §6 has three steps; only the third carries a shell block, so the first two need
acceptance authored from their prose.

```markdown
| stage | cmd | cwd | expect_exit | expect_match | expect_absent | note | review |
|---|---|---|---|---|---|---|---|
| S1 | test -n "$(git ls-files skills/tech-lead/scripts/stats.mjs)" | $CLONE | 0 |  |  | the instrument must survive a clone |  |
| S2 | grep -q '04-oracles.mjs' tests/structural.mjs | $CLONE | 0 |  |  | the module must be wired into MODULE_FILES |  |
| S3 | npm test | $CLONE | 0 | 0 failures |  |  |  |
| S3 | node skills/tech-lead/scripts/stats.mjs --ratchet --format table | $CLONE | 0 | improvement_rate | no scope has a second trial | the ledger must actually hold trials |  |
```

Note S3's last row: `expect_absent` is doing the real work. `--ratchet` exits 0 and prints a
well-formed report over an **empty** ledger — the line `no scope has a second trial yet` is the
tell — so an exit-code-only row would call an unmeasured run done. Any command whose empty case is
indistinguishable from its success case needs an `expect_absent`.

Note also what a plan should say about ordering — *do not wire a new structural module in as the
first commit if it takes a clone from 4 failures to 10*. That is why `depends_on` is a chain by
default, and why that sentence belongs in `## Guardrails` verbatim.

## Worked example — a mutation-verified guard

The pattern worth stealing here is S2: when a plan adds a check, the acceptance is not that the
suite stays green, it is that the suite **goes red** when the thing being guarded is broken. A
guard nobody has watched fail is an assumption.

```markdown
| stage | cmd | cwd | expect_exit | expect_match | expect_absent | note | review |
|---|---|---|---|---|---|---|---|
| S1 | npm test | $CLONE | 0 | 0 failures |  | baseline before touching anything |  |
| S2 | node -e "<write a decision row with verdict:'warn'>" && node skills/tech-lead/scripts/stats.mjs --hooks --format table | $CLONE | 0 | warn |  | the new column must count it |  |
| S2 | node -e "<revert the counter to allow/deny/block/error only>" && ! npm test | $CLONE | 0 |  |  | the acceptance IS that the suite goes red; the clone is disposable |  |
| S3 | git -C $CLONE diff --quiet | $CLONE | 0 |  |  | the mutation must not survive into the tree |  |
```

S2 is the sharpest row in either plan, and worth copying the shape of: the stage adds a check, so
its acceptance is that a deliberately broken input now *fails*. Verifying a new guard by confirming
the suite is still green proves only that the guard did not crash.

## Stage sections

One `## Stage <id> — <title>` per stage, in plan order.

- **Depends on:** default to the previous stage. These plans are sequenced, and the sequence is
  usually load-bearing — Day 1 measured that reordering two steps takes a clone from 4 failures to
  10. Break the chain only where the plan says the stages are independent.
- **Optional:** stages the plan marks optional or gates behind a decision (Day 2's Stage 4 is
  "only if someone disputes n=3"). Optional stages are skipped unless asked for.
- **Body:** copy the plan's text. Do not summarise it. The agent implementing the stage sees this
  and the acceptance rows, nothing else.
