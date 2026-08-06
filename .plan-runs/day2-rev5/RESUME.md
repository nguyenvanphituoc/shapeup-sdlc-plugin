# Resume — Day-2 rev 5, from another machine

The run stopped on a **session usage limit**, not a plan failure. S0 is green and committed; S1, S2
and S4 have not been started. Nothing is half-applied — the working tree is clean apart from
untracked files that predate the run.

## Read this first: the workspace is normally gitignored

`.plan-runs/` is in `.gitignore`. That is right for a run that resumes in a later session on the
same machine, and wrong for one that moves. So four files were **force-added** so this branch is
self-sufficient:

```
.plan-runs/day2-rev5/contract.md          the acceptance contract — the only thing that decides "done"
.plan-runs/day2-rev5/preflight.mjs        runs the whole acceptance table; costs no model tokens
.plan-runs/day2-rev5/REPORT.md            what landed, what I changed beyond the plan, and why
.plan-runs/day2-rev5/RESUME.md            this file
```

If you would rather they stayed ignored, `git rm --cached -r .plan-runs/` undoes it in one step —
but then the contract does not travel and the next machine has to recompile it from the plan.

`execute-plan.local.js` was deliberately **not** committed: it is a verbatim copy of the tracked
`.claude/skills/plan-executor/workflows/execute-plan.js`, frozen so that S4 can edit the real one
without disturbing a running workflow. Recreate it with the `cp` in step 2 below.

## Step 1 — re-derive what is done. Never trust this file's claim about it

```bash
cd <repo>
node .plan-runs/day2-rev5/preflight.mjs          # all 28 rows, in a fresh clone
node .plan-runs/day2-rev5/preflight.mjs S0       # or one stage
```

Expected as of `1bb0d73`: **15/28 rows, `S0=GREEN S1=RED S2=RED S4=RED`**. If S0 is not green, stop
and read `REPORT.md` before touching anything — something moved that should not have.

## Step 2 — relaunch

```bash
cp .claude/skills/plan-executor/workflows/execute-plan.js .plan-runs/day2-rev5/execute-plan.local.js
```

Then invoke the workflow with `scriptPath` pointing at that local copy and these args. S0 is left in
the list on purpose — the workflow's own preflight will find it green and skip it, which costs one
cheap agent and is safer than asserting it from a file.

```json
{
  "repo": "<absolute repo path>",
  "workdir": "<absolute repo path>/.plan-runs/day2-rev5",
  "contractPath": "<absolute repo path>/.plan-runs/day2-rev5/contract.md",
  "stages": [
    {"id": "S0", "title": "Withdraw the unsupported claim", "depends_on": [], "optional": false},
    {"id": "S1", "title": "Make the predicate and the model scope into fields", "depends_on": ["S0"], "optional": false},
    {"id": "S2", "title": "Guard all three", "depends_on": ["S1"], "optional": false},
    {"id": "S3", "title": "Probe the Sonnet baseline before buying anything", "depends_on": ["S2"], "optional": true},
    {"id": "S4", "title": "Gate the plan-executor", "depends_on": ["S2"], "optional": false}
  ],
  "freshState": "head", "commitPerStage": true,
  "attemptBudget": 3, "noProgressRounds": 2, "reserveTokens": 60000,
  "executeModel": "sonnet", "diagnoseModel": "fable", "verifyModel": "haiku"
}
```

**Set a token target** (`+500k` or similar) if this runs unattended. Without one the only limits are
the per-stage attempt budget and the no-progress breaker, and this run has already shown how it ends.

## Step 3 — do not take the run's word for it

When it returns, re-run `preflight.mjs` yourself over every stage. The last run reported S0 as
`stalled` when S0 was in fact green — the verifier died on the usage limit, so the workflow could not
tell. That is the whole reason this step exists.

## Two decisions waiting for you

1. **The two Compiled notes in `contract.md`** — where Stage 1's `required` is enforced, and the
   register work Stage 2 implies. `REPORT.md` §"Two places the plan is under-specified" has the
   argument. Agree with them before S1 runs, because S1 and S2 are built on them.
2. **Stage 3 is still held.** $5.8 for n=3 Sonnet reps at pre-fix `a280e86`, plus a `product_writes`
   change committed to `/Users/teo/workspace/sdd-harness-bench`. §2(e)'s n=1 says the likely answer
   is *no collapse on Sonnet*, which would end with FC-01 permanently Haiku-scoped. Nothing in
   S1/S2/S4 depends on it.

## Guardrails that bind whoever resumes

The plan's §5 in full is in `contract.md` under `## Guardrails`. The three that matter most here:

- **Do not compare a Sonnet current against the Haiku baseline.** Switching the floor model is
  exactly the moment the pooling rule gets broken by accident — S2's rule 3 is the mechanical form
  of this and does not exist yet.
- **Do not patch a rate and keep `reduces: true`.** p = 0.107 does not meet the criterion.
- **Do not fix the plan-executor by asking agents to be careful.** S4 needs a gate, not a warning.
