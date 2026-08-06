# Stage 1 evidence — `shapeup-build-round` (the inner loop as a Workflow)

Plan: `docs/workflow_migration_plan.md` Stage 1. Review: `docs/workflow_extraction_review.md` §6
Stage 1. Design: `docs/workflow_architecture_design.md` §2 (C1–C4), §3. All runs below happened
outside both checkouts, in the same scratch project (`spike`, under the session scratchpad)
Stage 0 already trusted and pointed at a **directory-source marketplace** resolving live to THIS
worktree — so every run below exercised the actual `shapeup-build-round.js` committed on this
branch, edits included. Every session ran on **Sonnet** (`--model sonnet`), the D5 floor. No
sub-Sonnet tier appears in this document or in `skills/tech-lead/workflows/`.

## Verify 1 — `npm test` with the new structural check

```
$ npm test
...
✅ structural tests passed (1117 checks)
```
Baseline at run start: 1112 checks (recorded in the contract). `tests/structural/16-workflows.mjs`
(new) adds checks for the D5 model floor and the path-literal discipline extended to
`skills/tech-lead/workflows/*.js`; it is registered in `tests/structural.mjs`, which is why the
count moved from 1112 to 1117 (5 new assertions: dir exists, file present, no sub-floor model,
no hardcoded storage root, every script invocation `${args.pluginRoot}`-rooted) rather than one.

## Verify 2 — scratch-project unattended run of a small real feature

**The feature (hand-authored, same spirit as Stage 0's own hand-planted scope fixture, not routed
through ba-pitch-analyzer/scope-architect — Stage 1 exercises the round mechanism, not the
upstream planning skills):** slug `s1verify`, one scope `SC-hello`
(`shapeup/s1verify/scopes/SC-hello.md`, `allowed_file_substrate: [output/**]`,
`e2e_verification_fixtures: [test -f output/hello.txt, grep -qx ok output/hello.txt]`), one task
`TASK-001` ("create `output/hello.txt` containing `ok`").

**Launch**, from a headless `claude -p --model sonnet --permission-mode auto` session in the
scratch project (headless workflow launches require `--permission-mode auto`, Stage 0's own
finding):

```js
Workflow({
  scriptPath: ".../skills/tech-lead/workflows/shapeup-build-round.js",
  args: {
    slug: "s1verify", round: 1,
    scopes: [{ scope_id: "SC-hello", path: "shapeup/s1verify/scopes/SC-hello.md" }],
    attemptBudget: 3, models: { exec: "sonnet", eval: "sonnet" },
    pluginRoot: ".../workflow-orchestrator", startedAt: "...", answers: "ci",
  },
})
```

**Return value**, read back from the task-completion notification, not the subagent's paraphrase:
```json
{"status":"ok","round":1,"verdict":"pass","hammer_proposals":[],"green_scopes":["SC-hello"]}
```

**Independently re-verified from disk** (not taken on the subagent's word):

| Check | Result |
|---|---|
| Board | `TASK-001` status: `done`, AC ticked |
| T0 verdict | `.shapeup/s1verify/t0/verdicts/r1-a1-t1.json`, `overall: "green"` (both fixtures pass) |
| `orders/` vs `results/` | `r1-a1.json`, `evaluate-r1.json` — one order, one result, per id |
| EVAL ran exactly once | one `evaluate-r1` order, one `evaluate-r1` result, one `EVAL-FEATURE-s1verify.md` |
| Verdict recorded | `EVAL-FEATURE-s1verify.md` frontmatter: `verdict: pass`, `t0_citation:` names the artifact above by sha256 |
| Hooks fired inside the workflow-dispatched workers | `sandbox-guard` (2× `allow`, "1 path(s) inside scope SC-hello substrate"), `validate-envelope` (2× `allow`, "order validated against work-order.schema.json") — both read back from `decisions.jsonl` |

**A defect this run found and the fix that closed it (not a pass/fail item on its own, but part of
the evidence — "measured, not theorized").** The first real run returned `status: "ok"` /
`verdict: "pass"` correctly, but the T0 artifact landed at `shapeup/s1verify/t0/verdicts/…` (the
COMMITTED tree) instead of `.shapeup/s1verify/t0/…` (the LOCAL tree T0 artifacts belong under,
ADR-0001) — `t0-verify.mjs`'s own `--out` default is `dirname(dirname(<scope contract path>))`,
which resolves to the SHARED tree next to the contract when no `--out` is passed. The workflow
never passed `--out`. Fixed by deriving the LOCAL root from `compile-order`'s own stdout
(`orderPath.slice(0, orderPath.lastIndexOf("/orders/"))`) — a string operation on a runtime value,
not a new path literal, so the test-#45-extended discipline (§16-workflows.mjs) still holds. The
clean re-run above is with the fix applied; the T0 verdict path shown was re-verified from disk
after the fix, in the SHARED tree's absence (`find shapeup/s1verify -type f` shows only the scope
contract, no `t0/`).

**A second, unrelated finding, not a fail:** one of the ten `agent()` calls in this run
(`active-scope:SC-hello`) was transiently `blocked by safety classifier: Stage 2 classifier error
- blocking based on stage 1 assessment` on the first attempt (per the task notification's
`failures` field) and succeeded on the runtime's own retry — `agent_count=10, agents_done=9,
agents_error=1` in that run's usage summary. The overall round still completed correctly; flagged
because a workflow author relying on every `agent()` call succeeding on the first try should know
the runtime itself already retries a transient classifier block.

**Cost (Sonnet, the D5 floor):** the clean re-run (post-fix) — one attempt to green, one EVAL —
cost **$2.010** total for the whole headless session (`claude -p` cumulative `total_cost_usd`,
read from the session's own final result, not estimated).

## Verify 3 — negative probe: the inner breaker

**The probe (hand-authored):** slug `s1probe`, one scope `SC-impossible`
(`e2e_verification_fixtures: [false]` — a fixture no attempt can ever satisfy), `attemptBudget: 2`.

**Return value:**
```json
{"status":"gate_h","breaker":"inner","hammer_proposals":["SC-impossible"],"green_scopes":[]}
```
Exactly the shape the migration contract names: `{status: "gate_h", breaker: "inner"}`, the scope
in `hammer_proposals`, and the round **not blocked** — this is a typed return, not a hang, a crash,
or a stall. task-executor was still dispatched and did real work (`output/impossible.txt` was
created, per its own execution log) — the breaker is about the scope's fixture never going green,
not about the worker failing to run.

**Independently re-verified from disk:**

| Check | Result |
|---|---|
| Attempts consumed | exactly 2 (`attemptBudget`) — `t0/verdicts/r1-a1-t1.json`, `t0/verdicts/r1-a2-t1.json`, both `overall: "red"` |
| `trials.jsonl` | 2 rows: attempt 1 `status: "kept"` (baseline), attempt 2 `status: "reverted"` (`"delta":"no change"` — a tie is not better, the ratchet's own rule) |
| No EVAL order | `orders/` and `results/` each contain only `r1-a1.json`, `r1-a2.json` — no `evaluate-r1` of either kind, confirming GATE L2/EVAL were never attempted once the round short-circuited to `gate_h` |

This exercises the design's own reasoning
(`skills/tech-lead/workflows/shapeup-build-round.js`'s comment on the `gate_h` early-return):
a round where every scope exhausts its attempt budget has no board-green state for GATE L2 to
check and nothing to EVAL, so it returns the breaker signal directly rather than attempting a
doomed gate/eval pair. A round with at least one green scope alongside a hammer-proposed one would
instead carry `hammer_proposals` through the normal `status: "ok"` return (AGENTS.md: "an
exhausted scope queues a GATE H proposal, it never blocks the round") — not exercised by this
probe, which deliberately makes every scope in the round fail, but stated here because it is the
other branch of the same `if` in the script.

**Cost:** $1.286 total (2 attempts, no EVAL dispatched).

## Token cost vs. a main-checkout control run of the same feature

**The control (same shape, no Workflow tool):** slug `s1control`, scope `SC-hello2` — identical to
`SC-hello` except its own fixture/task text (`output/hello2.txt` / `ok2`), driven by a
conversational session performing the exact sequence `skills/tech-lead/SKILL.md`'s BUILD section
prescribes today — Bash calls to `compile-order.mjs` / `ingest-result.mjs` / `t0-verify.mjs` /
`gate-answers.mjs`, Agent-tool dispatches to `task-executor` and `spec-evaluator` — with the
Workflow tool never invoked. This is the "prose lane" arm, scaled down from Stage 3's eventual A7
benchmark to Stage 1's own cost check.

| Arm | Cost (Sonnet) | Outcome |
|---|---|---|
| Candidate — `shapeup-build-round.js` (Workflow) | **$2.010** | 1 attempt to green, EVAL PASS |
| Control — conversational session, no Workflow | **$1.461** | 1 attempt to green, EVAL PASS |

The candidate cost **~37% more** than the control for the identical outcome on this trivial,
single-scope, single-attempt feature. This is consistent with Stage 0's own flag ("per-call cost
on Sonnet is higher than the review inferred") — the Workflow tool's per-`agent()`-call overhead
(schema-forced structured output, fresh context per call) is not free, and this comparison is the
measured number Stage 0 asked Stage 1 to produce. It is **not** a Stage 1 pass/fail criterion (the
contract's exit criterion asks for the number, not a threshold), and it is exactly the kind of
signal the review's own §7 names as something that "would change the answer" if it held at scale —
Stage 3's real benchmark (A7, n=3 each arm) is where that question gets a real verdict, on a real
multi-scope, multi-round feature rather than one trivial scope going green in one attempt. Both
arms here are Sonnet-matched (D5 floor) — no cross-model comparison, per the guardrails.

## Summary

| # | Verification | Result |
|---|---|---|
| 1 | `npm test` — structural suite green with the new check | passed — 1117 checks (baseline 1112) |
| 2 | Unattended run of a small real feature | passed — board green, T0 green, EVAL ran exactly once, verdict PASS, re-verified from disk |
| 3 | Negative probe — inner breaker | passed — `{status:"gate_h", breaker:"inner"}`, scope in `hammer_proposals`, round not blocked (typed return) |
| — | Cost vs. control | measured: candidate $2.010 vs. control $1.461 (same feature, Sonnet both arms) — informational, not a gate |

One real defect surfaced and fixed during this verification (T0 artifacts landing in the SHARED
tree without an explicit `--out`) — exactly the kind of thing Stage 1's own exit criterion asks
for evidence to catch before Stage 2 builds the outer loop on top of this file.
