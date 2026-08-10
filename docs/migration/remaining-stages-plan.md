# Execution plan — the remaining stages of the workflow cutover

**Compiled:** 2026-08-10 at `c469a6c`, branch `feat/workflow-orchestrator`.
**Supersedes for execution purposes:** `docs/workflow_migration_plan.md` §6 (Rev B), which summarises
what this file details. The original plan remains the design authority and the historical record.
**Evidence base:** `docs/migration/status-review-2026-08-10.md` — every claim below traces there.
**Model floor (D5, unchanged):** every agent in every phase runs on **Sonnet or higher. No Haiku.**
**Hard rule (unchanged):** every stage exit is an artifact on disk, never a claim. A stage without
its evidence file did not happen.

**Position at compile time:** 23 contract rows → 17 PASS / 6 RED, of which **2 passes are false**;
15 rows honestly done. `npm test` green at **1168 checks**. S0 and S1 green. S2's behaviour proven
but its evidence file unwritten and one verification never run. S3 partly entered — which is itself
a contract violation, since S2's ship gate was never formally met.

---

## Acceptance contract

Every row is a predicate that **can only pass if the work was done**. This is deliberate: the
existing contract carries two rows that pass on pre-existing text (`grep -qi pin CHANGELOG.md`
matches the 1.6.2 entry; `grep -rqli gate-zerowork tests/` matches three files that predate the
branch), and one row — `grep -qiE 'kill|resume'` — that a sentence saying the probe was *not* run
would satisfy. A row that cannot fail is worse than no row.

| # | Criterion | Verified by |
|---|---|---|
| **R1** | `stage2-evidence.md` exists and carries A2's verbatim `RunReturn` | `grep -q '"status":"shipped"'` **and** `grep -q '"verdict":"pass"'` |
| **R2** | A3's gate table names both crossed gates and the empty re-dispatch set | `grep -q 'L1a'` **and** `grep -q 'L1b'` **and** `grep -qi 'redone'` |
| **R3** | The kill/resume probe has a machine-readable outcome | `grep -qE '^kill-resume-probe: (PASS\|FAIL\|NOT-RUN)'` — a literal status line, so "not run" is *recorded*, never *inferred from absence* |
| **R4** | `gate-zerowork` treats a `Workflow(shapeup-*)` tool_use as a dispatch | `node -e` importing `dispatchedOrchestrator` and asserting `true` on a synthetic Workflow event — a **behavioural** assertion, not a grep |
| **R5** | A5's unit fixture exists as its own file and the suite grew | new `tests/structural/NN-gate-zerowork-workflow.mjs`; `npm test` count **> 1168** |
| **R6** | The two false-passing rows are replaced in `execution-contract.md` | `! grep -q 'grep -qi pin CHANGELOG.md'` and `! grep -q "grep -rqli 'gate-zerowork' tests/"` |
| **R7** | The cutover CHANGELOG entry states the rollback in its own words | `grep -q 'no in-tree prose lane'` **and** `grep -q '1.7'` |
| **R8** | The headless-truncation hazard ships as documentation | `grep -q 'CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS' docs/upgrading.md` |
| **R9** | Both commands instruct the Workflow launch | `grep -qi workflow commands/build.md` **and** `commands/ship.md` |
| **R10** | `shapeup-build-round.js` is resolved — deleted, or documented as a live second entry point | XOR: `! test -f skills/tech-lead/workflows/shapeup-build-round.js` **or** `grep -q 'shapeup-build-round' skills/tech-lead/SKILL.md` |
| **R11** | A6 — `npm test` green in a fresh `git clone --local` at the final commit | clone transcript with its check count pasted into `stage3-evidence.md` |
| **R12** | A7's disposition is recorded as a finding, and "passed" is unreachable | `grep -qE '^A7: (DEFERRED\|PASS\|FAIL)' stage3-evidence.md`; if `DEFERRED`, `grep -q 's3-feasibility'` for the blocker citation |

**Ship gate:** R1–R6 must all be green before Stage B starts. That is S2's ship gate, restated —
and it is currently unmet while S3 work has already landed.

---

## Stage A — close S2's ship gate

**Depends on:** —
**Estimate:** ~2–3 h · **$0 external** (one scratch-project run, dev tokens)
**Exit artifact:** `docs/migration/stage2-evidence.md`
**Rows:** R1, R2, R3, R4, R5, R6

### A.1 — Write `stage2-evidence.md`

The content exists at `execution-report.md:32-125` and needs transcribing with citations, not
re-deriving. Sections, in order:

1. **A2 — the unattended lane.** The verbatim `RunReturn`
   (`{"status":"shipped","verdict":"pass","rounds_used":1,"dims_not_evaluated":[…],"qa_findings":6,
   "report":"shapeup/todo-persist/REPORT.md"}`), the receipt's `auto_level`/`gate_answers`/`lane`,
   the 9-orders/9-results count, and the single `evaluate-r1.json`. Note that the evaluator
   re-hashed its own T0 citation and found a `WRITE_FAILED` case the suite missed — the evaluation
   was not a rubber stamp, and that is worth the two lines.
2. **A3 — the interactive lane.** The six-leg table, and the correction to the instrument: the
   first dispatch check asserted "no order file may be rewritten," which is stricter than the
   contract's "re-dispatched nothing *already done*". It flagged `analyze.json`, an order left with
   no result by leg 4's blocked ingest — resuming that **is** the fast-forward working. The check
   now separates *redone completed work* (empty at every leg) from *resumed incomplete work*.
3. **The two execution-only defects**, `e4c8fa6` and `7c1b15e`, with the tables from the execution
   report. `e4c8fa6`'s third row is the one that matters: a null gate decision meant **QA never
   dispatched under preset `ci`**, and A2 would have reported green end-to-end with QA silently
   skipped.
4. **What is NOT demonstrated** — stated plainly, not buried: no single interactive run reached
   `shipped`, and the kill/resume probe's status line from A.2 below.

### A.2 — Run the kill/resume probe

Plan §3 verification step 4, never run. Scratch project, plugin installed from this branch via
`npm pack`:

1. Launch an unattended run, let it reach BUILD with at least one scope green and one in flight.
2. Kill the session mid-BUILD (not a graceful stop — the point is the ungraceful case).
3. Fresh session. Relaunch the **same** `Workflow` call with the **same** args.
4. **Assert:** the fast-forward re-dispatched nothing already completed — `orders/` minus
   `results/` is empty before it proceeds, and the green scope's T0 citation survives.

Record the outcome as the literal line `kill-resume-probe: PASS` (or `FAIL` / `NOT-RUN`) in
`stage2-evidence.md`. **If it fails, stop.** A3 is not green, S2's ship gate is not met, and every
Stage B item unwinds. That is not a formality — this probe is the one test of the failure class
(82–120-turn handoff loss) the whole migration was built to retire.

> **Dev-loop note:** iterate the probe with `Workflow({scriptPath, resumeFromRunId})`. The unchanged
> prefix of `agent()` calls replays from cache instead of re-spending. Same-session only, so it is a
> development accelerator, **not** a substitute for the disk-derived fast-forward under test.

### A.3 — Implement A5

Add the predicate arm to `hooks/gate-zerowork.mjs`. Current state: `:66` `WORK_TOOLS` is
`{Write, Edit, MultiEdit, NotebookEdit, Bash, Task, Agent}` — no `Workflow`; `:69-74`
`dispatchedOrchestrator()` matches only a `Skill` block resolving to `tech-lead`.

This is a **correctness repair, not a new detector**: `SKILL.md:12-14` already tells operators the
hook blocks a session leaving "neither a receipt NOR a `Workflow` tool_use naming `shapeup-run`".
The doc is ahead of the code. Practical exposure is small — the block is decided by receipt absence
and `init-run.mjs` writes the receipt first — but an invariant currently lives in a prompt, which
`AGENTS.md` says must never happen. Structural #26 does not catch it: it checks paths and counts,
not claimed predicates.

Preserve both existing properties: a session that loaded tech-lead and produced **neither** a
Workflow call nor a receipt still blocks; non-harness sessions still defer (fail-open).

### A.4 — The fixture (R5)

Its own file under `tests/structural/`. Assert in both directions:

- a synthetic event carrying `{type:"tool_use", name:"Workflow", input:{scriptPath:"…/shapeup-run.js"}}`
  → `dispatchedOrchestrator` returns `true`;
- an unrelated `Workflow` call (no `shapeup-` in scriptPath/name) → `false`;
- a session with neither → still blocks;
- a non-harness session → still defers.

Mutation-verify it (flip the arm, watch the fixture go red) — the repo's own discipline for a check
that must be real rather than merely present.

### A.5 — Tighten the instrument (R6)

In `execution-contract.md`, replace:

| Old row | Replace with |
|---|---|
| `grep -qi pin CHANGELOG.md` | `grep -q 'no in-tree prose lane' CHANGELOG.md` |
| `grep -rqli 'gate-zerowork' tests/` | `test -f tests/structural/<NN>-gate-zerowork-workflow.mjs` |
| `grep -qiE 'kill\|resume' stage2-evidence.md` | `grep -qE '^kill-resume-probe: (PASS\|FAIL\|NOT-RUN)'` |

Then re-derive the count and state it. The execution report's headline "15 PASS / 7 RED" was
computed by the untightened instrument.

**Commit:** `wf-migration(stage-2): close the ship gate — evidence, kill/resume probe, A5 arm`

---

## Stage B — cutover paperwork and the dead-code decision

**Depends on:** Stage A green (R1–R6)
**Estimate:** ~2–3 h · **$0**
**Exit artifact:** `docs/migration/stage3-evidence.md` (parts 1–4)
**Rows:** R7, R8, R9, R10, R11

### B.1 — Resolve `shapeup-build-round.js` (R10)

**Established:** the file is unreachable. `SKILL.md` launches only `shapeup-run.js`;
`shapeup-run.js:19-27` explains it deliberately inlines the round because build-round "always
attempts every scope from attempt 1, with no awareness of what a PRIOR invocation already
finished." Every other mention across `skills/ hooks/ commands/ bin/` is a comment or a schema
note. The only live reference is `tests/structural/16-workflows.mjs:65-68`, asserting the file
**exists** — nothing asserts it **runs**. That is `fd5ad3d`'s class recurring one layer up.

**Recommended: delete it.** Not for tidiness — for three specific reasons:

1. **The nesting cap lands wrong if you revive it.** Workflow scripts cannot import (verified: zero
   `import`/`require` across all 7 official plugin workflow scripts; `claude-security/workflows/scan.js`
   ships bundled on one line). So reuse is duplication, a `workflow()` child, or a build step — and
   `workflow()` nesting is **one level only**. Making the round a child spends that level exactly
   where fan-out will want it later, at the scope layer.
2. **Reviving it costs a contract.** The resume state the parent derives would have to cross the
   boundary as data, and the central-registry rule requires it be defined once in
   `domain.schema.json`, versioned, kept in sync. Inlining costs zero contracts.
3. **Stage 3 step 1 forbids commented-out corpses.** A 418-line unreachable duplicate of the
   attempt loop is the same thing at file scale.

**The real work, and the honest cost:** `stage1-evidence.md`'s negative probe
(`{status:"gate_h", breaker:"inner"}`) exercised `shapeup-build-round.js:351`. Production takes
`shapeup-run.js:593`. Deleting means re-pointing that probe at the outer script, which means driving
it through ORIENT → WIRE → MAP SCOPES to reach BUILD. **That is more expensive than the deletion**
and is the whole of this item. Budget it as such.

Then amend `tests/structural/16-workflows.mjs`: drop the presence assertion, keep the D5 model-floor
and path-literal checks over whatever workflow files remain.

**If you keep it instead:** R10's other arm — say so in `SKILL.md`, name who launches it and when.
An undocumented second entry point is the worse outcome either way.

### B.2 — Confirm, do not re-execute, plan step 1 (A4 as amended)

Revision A ordered deleting `round-protocol.md`'s normative sections. **Do not.** `SKILL.md:50-55`
routes `--tiny` runs and every spec without committed `scopes/*.md` there, verbatim and
non-regression; `round-protocol.md:11-22` states the same split. Deleting it removes the only
normative home a supported lane has.

Confirm instead: (a) `SKILL.md` carries no scoped-lane round/attempt loop — already true at 121
lines; (b) `round-protocol.md` and `gates.md` each say which lane their surviving sections serve;
(c) no commented-out corpses.

### B.3 — Commands (R9)

`commands/build.md` and `commands/ship.md` instruct the Workflow launch as the legitimate opt-in
surface. Neither mentions `Workflow` today. Keep `build.md`'s existing standalone-task path — it is
the single-task front door and is not what the cutover replaces.

### B.4 — CHANGELOG and `docs/upgrading.md` (R7, R8)

The cutover entry names D1–D4 and states the rollback: **pin the previous release**. Three things
revision A could not have known and that must appear:

1. **"No in-tree prose lane" is too strong.** The *scoped* lane is code-only; the `--tiny` and
   pre-scope-contract lanes remain prose by design. Say which is which, or users will read the
   deletion as wider than it is.
2. **Pinning also reverts the merged day2 ratchet work** (`af99937`). 24 of 46 changed files fall
   outside the migration's own touch-map. The rollback's blast radius is wider than this migration,
   and a user who pins to fix a workflow bug will silently lose the ratchet changes too.
3. **`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` is mandatory for headless runs.** Without it
   `claude -p` terminates the Workflow at 600 s, **exits 0**, and reports a truncated run as a clean
   one. This is the one item promoted out of the deliberately-deferred list (below) because a
   truncated run that exits 0 is a shipping hazard, not a backlog item.

### B.5 — A6, fresh clone (R11)

`git clone --local` the branch at its final commit, `npm test` in the clone, paste the count.
In-tree green does not transfer — the last clone-derived count was **1120 at `7c1b15e`**, and the
tree is at 1168 plus whatever Stage A adds.

**Commit:** `wf-migration(stage-3): cutover paperwork, detectors, dead-code resolution`

---

## Stage C — the fork · PO decision, not executor work

**Depends on:** Stage B green
**Estimate:** minutes to decide; $40–60 **only** on the C2 path
**Rows:** R12
**This stage spends money or defers a measurement. It does not run autonomously.**

A7 needs `sdd-harness-bench`. Re-derive before deciding — never trust this file's claim about it:

```bash
node .plan-runs/day2-rev5/s3-feasibility.mjs    # exit 0 = runnable · exit 3 = blocked, reason named
```

At compile time it returns **C1 NO / C2 NO / C3 NO**: the repository is absent from this machine and
commit `8fe70bc` records the last search axes closed (npm 404, global GitHub 0 results).

| | **C1 — ship, defer A7** *(recommended)* | **C2 — hold for the bench machine** |
|---|---|---|
| Cost now | $0 | $40–60, at an unknown date |
| Given up | The §7 falsifier. The one cost number in hand — **candidate $2.010 vs control $1.461, +37.6%**, Sonnet-matched (`stage1-evidence.md`) — stays unrefuted at scale | Time; the branch keeps absorbing unrelated work, as it already has |
| Required | `stage3-evidence.md` line `A7: DEFERRED`, citing the three blocker codes and the date | `A7: PASS` / `FAIL` with both arms' run logs by commit and path |
| Precedent | day2's S3 took exactly this posture on this same blocker and it held: *"No number was invented in the meantime"* | — |

**Recommendation: C1, conditional on Stage A.2 having actually run.** A7 answered *"does this pay for
itself"*; the kill/resume probe answers *"does it do the thing it was built for."* Deferring the
first while skipping the second rests the cutover on two unrun tests with the only measured cost
number pointing the wrong way. One deferral is a judgement call; two is a hope.

**If A7 ever runs and the candidate scores below control** on acceptance, or above on wall clock:
the merge waits (plan §5). Note honestly that a **sequential** workflow racing a sequential
conversation has no wall-clock story to tell — see Phase 2.

**Merge is the PO's move.** No executor merges, tags, pushes, or publishes.

---

## Stage D — Phase 2, after the cutover ships · a separate release

Explicitly **not** part of this cutover. Listed so the arc is visible and so nothing here leaks into
Stage A/B, where it would widen a touch-map already 24 files over.

### D.1 — `sandbox-guard`'s always-allow is stale, and closing it is what makes D6 true

**This item replaces an earlier draft that proposed declaring `agents/*.md` to enforce four
invariants. Two of those four do not survive inspection, and the third is better served by a hook.
The agent-definition spike was proposed as A.6 and REJECTED (PO, 2026-08-10) — it is not in Stage A
and not in this plan.** Recorded here so the reasoning is not re-derived from scratch later:

| Claimed win | Verdict | Why |
|---|---|---|
| Role separation via `Agent(plugin:name)` whitelists | **void** | None of the four workers spawn sub-agents — they are leaves. The whitelist restricts delegation that does not occur |
| Pipeline-blindness via `tools:` minus board reach | **impossible** | `tools:` restricts tool **names**, not paths. `tools: Read, Write, Bash` still reads the board. `sandbox-guard` is path-granular and strictly more precise |
| D5 model floor via `model:` frontmatter | **marginal** | The model already arrives per call from `RunArgs` and is allowlist-checked in code (`shapeup-run.js:90`) |
| Single judge via `tools:` without `Write` | **real, but a hook does it better** | See below — and a hook also covers `task-executor`, which legitimately needs `Write` for product code and therefore cannot be constrained by `tools:` at all |

**The actual finding.** No hook enforces single-writer. `hooks/sandbox-guard.mjs:17-18`:

> `.shapeup/<slug>/` **are always allowed**: that root is harness bookkeeping the doer **is REQUIRED
> to write** (task-executor P3 status/AC ticks + `tasks/_index.md`, run-state, execution logs, the
> P3.7 discovery ledger)

`safety-spine` guards the machine and the git remote, not the board. So **any worker can write the
board, the ledger and the verdicts today**, and nothing at the tool boundary stops it — while
`AGENTS.md` claims *"D6 closed: single-writer is mechanically true."* It is true by the envelope port
and worker prose, not by a mechanism.

**And the exemption's own rationale is stale.** It cites "task-executor P3 status/AC ticks +
`tasks/_index.md`" — exactly the writes `ingest-result.mjs` took over at v1.0. The comment describes
the pre-pure-skill architecture.

**The work:** narrow the `.shapeup/<slug>/` always-allow to the paths workers still legitimately
touch, and deny `Write`/`Edit` tool calls on board/ledger/verdict paths. `ingest-result.mjs` writes
through node `fs`, not the `Write` tool, so the single writer passes through unaffected. One hook
arm plus a fixture — the same shape as Stage A.3, in the architecture already trusted for this class.

**Where declared agents would still earn their place** (a quality argument, not a safety one, and
explicitly deferred): giving the `mech()` courier a stable, tested system prompt instead of a
runtime-assembled string. `e4c8fa6` — the courier manufacturing `EXIT:0` — is under-constraint, and
one declared agent is a plausible mitigation. One agent, not eleven, and not before the cutover.

### D.2 — A fourth breaker, on the axis that is actually worrying

Current breakers count rounds, attempts, and wall-clock seconds. The Workflow runtime exposes
`budget.total` / `budget.spent()` / `budget.remaining()` — a **token** ceiling, with `agent()`
throwing once it is hit. The scripts use none of it.

`AGENTS.md` justifies the wall-clock breaker precisely: *"both count events, so neither notices a
single round running for half an hour."* The same argument, verbatim, applies to cost — none of the
three notices a round burning $40. Route it to GATE H like the deadline breaker: a run that trips
its own breaker ships what is green.

### D.3 — Parallel scopes, and the singleton that blocks them

Both workflow scripts contain **zero** `parallel()` and **zero** `pipeline()`;
`shapeup-build-round.js:270` is a plain `for (const scope of args.scopes)`. That was deliberate —
design doc **[D3]**: *"`.shapeup/active-scope` is a singleton the sandbox hook reads; branch-per-scope
assumes one tree."*

The two blockers are no longer equal:

- *"branch-per-scope assumes one tree"* — the runtime now offers `isolation: 'worktree'` per
  `agent()` call, with auto-cleanup. That blocker is a parameter.
- *"`active-scope` is a singleton"* — `hooks/sandbox-guard.mjs:102` reads one pointer. **This one is
  yours**, and it is the real thing standing in the way.

Why it matters beyond speed: invariant #3 — *"Parallel work cannot corrupt shared state,"* per-scope
write-whitelists, hook-enforced — is capacity built and never spent. And parallel scopes are the
**only** place the workflow lane can win A7's comparative bar, which it is not allowed to lose.

### D.4 — The seven environment findings

Transcribe `execution-report.md:134-156` into a committed register and file it as a raw idea for the
Betting Table. **Their source file is gone**: `.gitignore:83` ignores `.plan-runs/` and only
`day2-rev5` was force-added, so `.plan-runs/workflow-migration/ledger/run3-environment-findings.md`
is neither on disk nor in history — the seven-line summary is all that survives.

At least three are live at `c469a6c`: `project-profile.md` is written by prose and validated by
nothing at write time (a run emitted `cli`, not in the enum — `domain.schema.json:2079-2089`);
`ship-report.mjs` reported `rounds_used: 0` for a 1-round run; and the headless-truncation hazard,
which B.4 promotes to shipped documentation rather than leaving here.

---

## Guardrails

- **No merge, no tag, no push, no publish.** The cutover merge is the PO's move after Stage C.
- **Stage A is the ship gate.** Stage B does not start until R1–R6 are green. If A.2's probe fails,
  everything downstream unwinds — that is the gate doing its job, not an obstruction.
- **A7 does not launch autonomously.** It is the single most expensive action and depends on
  external tooling. Stage C pauses for an explicit go.
- **Do not rebuild `sdd-harness-bench`.** A reconstructed benchmark is a *different instrument*
  whose numbers look comparable and are not — the pooling error the day2 review exists to refuse.
- **Do not fix the seven environment findings inside this cutover** (except B.4's documentation
  item). They are outside the touch-map, and that guardrail is why the branch is still auditable
  after 41 commits.
- **Freeze the branch at Stage B.** Another unrelated merge makes the touch-map unusable as an audit
  and widens the rollback story again.
- **Every generated path resolves through `paths.mjs`**; every path literal in a workflow script is
  `${args.pluginRoot}`-rooted or produced by a script's stdout (structural #45 / #16).
- **Everything outside the touch-map below is scope creep** and should be challenged at review.

---

## File-touch map

| Path | A | B | C | D |
|---|---|---|---|---|
| `docs/migration/stage2-evidence.md` | **create** | — | — | — |
| `docs/migration/stage3-evidence.md` | — | **create** | append `A7:` line | — |
| `hooks/gate-zerowork.mjs` | **modify** | — | — | — |
| `tests/structural/<NN>-gate-zerowork-workflow.mjs` | **create** | — | — | — |
| `docs/migration/execution-contract.md` | modify (3 rows) | — | — | — |
| `skills/tech-lead/workflows/shapeup-build-round.js` | — | **delete** (or document) | — | — |
| `tests/structural/16-workflows.mjs` | — | modify | — | — |
| `skills/tech-lead/references/{round-protocol,gates}.md` | — | confirm only | — | — |
| `commands/{build,ship}.md` | — | modify | — | — |
| `CHANGELOG.md`, `docs/upgrading.md` | — | modify | — | — |
| `agents/*.md`, `package.json`, `AGENTS.md` | — | — | — | **create/modify** |
| `skills/tech-lead/workflows/shapeup-run.js` | — | — | — | modify (D.2, D.3) |
| `hooks/sandbox-guard.mjs` | — | — | — | modify (D.3) |

---

## Cost and sequence summary

| Stage | Wall clock | External $ | Gate |
|---|---|---|---|
| **A** — close S2's ship gate | ~2–3 h | $0 | R1–R6 green, or stop |
| **B** — cutover paperwork + dead code | ~2–3 h | $0 | R7–R11 green |
| **C** — the fork | decision | $0 (C1) / $40–60 (C2) | PO decides; PO merges |
| **D** — Phase 2, separate release | days | dev tokens | not part of this cutover |

Everything up to and including Stage B is unblocked on this machine, today, at zero external cost.
