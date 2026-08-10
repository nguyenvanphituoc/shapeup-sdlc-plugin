---
schema: plan-execution-contract/v1
plan: docs/workflow_migration_plan.md
plan_sha256: 949dab984ae36514786bdc40aeddef002266160da7187ededf570c0c91848937
title: Migration plan — extract the tech-lead orchestrator into a Workflow, executed in an isolated worktree
fresh_state: head
commit_per_stage: true
attempt_budget: 3
no_progress_rounds: 2
execute_model: sonnet
diagnose_model: fable
verify_model: haiku
stages: [S0, S1, S2, S3]
---

# Execution contract — tech-lead orchestrator → Workflow migration

Design authority (all committed on this branch, readable in any clone):
`docs/workflow_migration_plan.md` (the plan), `docs/workflow_extraction_review.md` (what and
why, §6 decision record D1–D4), `docs/workflow_architecture_design.md` (channels C1–C6,
RunArgs/RunReturn). The executing agent MUST read the plan file itself before starting a stage —
the stage bodies below are verbatim copies, but the plan's surrounding context (budget lines,
acceptance contract table A1–A7) binds too.

Baseline recorded at run start: `npm test` green, **1112 checks**, at commit 78e56bc.

## Acceptance

| stage | cmd | cwd | expect_exit | expect_match | expect_absent | note | review |
|---|---|---|---|---|---|---|---|
| S0 | cat docs/migration/stage0-evidence.md | $CLONE | 0 | Decision: GO | NO-GO | evidence must end in the literal line `Decision: GO`; a NO-GO on check 2 or 3 ends the migration (D1) |  |
| S0 | test $(grep -c deny docs/migration/stage0-evidence.md) -ge 2 | $CLONE | 0 |  |  | the two quoted decisions.jsonl deny rows (sandbox-guard + validate-envelope) are the proof hooks fire inside workflow subagents |  |
| S0 | grep -qi sonnet docs/migration/stage0-evidence.md | $CLONE | 0 |  |  | the cost measurement must be on Sonnet (D5 floor) and labelled |  |
| S1 | npm test | $CLONE | 0 | structural tests passed |  | count must be ≥ 1112 (baseline); new structural checks for workflows are part of this stage |  |
| S1 | test -f skills/tech-lead/workflows/shapeup-build-round.js | $CLONE | 0 |  |  |  |  |
| S1 | ! grep -riq haiku skills/tech-lead/workflows/ | $CLONE | 0 |  |  | D5 floor, greppable: no model below sonnet anywhere in workflow scripts |  |
| S1 | node -e 'const s=require("./skills/tech-lead/schemas/domain.schema.json");process.exit(s["$defs"]&&s["$defs"].RunArgs&&s["$defs"].RunReturn?0:1)' | $CLONE | 0 |  |  | C1 is a cross-boundary record; central-registry rule says it is defined once |  |
| S1 | grep -q workflows/ tests/structural.mjs | $CLONE | 0 |  |  | proxy: test-#45 discipline extended to the new workflow file; human reviews the check is real, not just present |  |
| S1 | cat docs/migration/stage1-evidence.md | $CLONE | 0 | gate_h |  | negative-probe output must show the inner breaker returning {status: "gate_h", breaker: "inner"} with the round NOT blocked |  |
| S2 | npm test | $CLONE | 0 | structural tests passed |  | suite must never be red at a stage boundary; structural updates for moved prose are part of this stage |  |
| S2 | test -f skills/tech-lead/workflows/shapeup-run.js | $CLONE | 0 |  |  |  |  |
| S2 | test $(wc -l < skills/tech-lead/SKILL.md) -le 160 | $CLONE | 0 |  |  | plan says thin shell target ≤ ~150 lines; 160 is the tolerance ceiling |  |
| S2 | cat docs/migration/stage2-evidence.md | $CLONE | 0 | A2 |  | full unattended run (preset ci) green end to end, transcript referenced |  |
| S2 | cat docs/migration/stage2-evidence.md | $CLONE | 0 | A3 |  | interactive run: ≥2 gates via pause → decision → relaunch; fast-forward re-dispatched nothing (orders/ minus results/ empty) — human reviews the transcript, this row only proves the section exists |  |
| S2 | grep -qE '^kill-resume-probe: (PASS\|FAIL\|NOT-RUN)' docs/migration/stage2-evidence.md | $CLONE | 0 |  |  | **tightened 2026-08-10.** The probe's outcome is a literal status line, so "not run" is *recorded* rather than inferred from absence. The old row (`grep -qiE 'kill\|resume'`) was satisfied by any sentence containing either word — including one stating the probe had **not** been run |  |
| S3 | npm test | $CLONE | 0 | structural tests passed |  | includes the new gate-zerowork unit fixture (A5) |  |
| S3 | node -e 'import("./hooks/gate-zerowork.mjs").then(m=>process.exit(m.dispatchedOrchestrator([{type:"assistant",message:{content:[{type:"tool_use",name:"Workflow",input:{scriptPath:"p/shapeup-run.js"}}]}}])?0:1))' | $CLONE | 0 |  |  | **tightened 2026-08-10.** The predicate arm asserted **behaviourally**, not by grep: a synthetic `Workflow` event must make `dispatchedOrchestrator` return true. The old row (`grep -qi workflow hooks/gate-zerowork.mjs`) passes on a comment, and comments are exactly what this arm was missing |  |
| S3 | test -f tests/structural/17-gate-zerowork-workflow.mjs | $CLONE | 0 |  |  | **tightened 2026-08-10.** A5's fixture must exist **as its own new file**. The old row — a recursive, case-insensitive `gate-zerowork` grep over `tests/` — matched three files that predate the branch (`10-run-receipt`, `11-is-main`, `15-hook-receipts`), so it scored work nobody had done. See the revision note below for why the old command is described and not quoted |  |
| S3 | ! grep -qiE 'attempt_budget loop\|round protocol\|for each scope, dispatch' skills/tech-lead/SKILL.md | $CLONE | 0 |  |  | proxy for A4 (no round/attempt loop prose in SKILL.md); human confirms the runbook prose is deleted, not paraphrased back in. **Pipes escaped 2026-08-10** — the raw `\|` split this cmd across three table columns, so a runner that reads the table could not execute the row at all |  |
| S3 | grep -q 'no in-tree prose lane' CHANGELOG.md | $CLONE | 0 |  |  | **tightened 2026-08-10.** The rollback must be stated in the **cutover** entry's own words. The old row — a case-insensitive `pin` grep over `CHANGELOG.md` — matched `**Pinned:**` in the 1.6.2 entry, text that predates this branch, so it passed with no cutover entry written at all. See the revision note below for why the old command is described and not quoted |  |
| S3 | grep -qi workflow commands/build.md | $CLONE | 0 |  |  | commands instruct the Workflow launch (the legitimate opt-in surface) |  |
| S3 | cat docs/migration/stage3-evidence.md | $CLONE | 0 | candidate |  | benchmark section must show both arms; see guardrails — A7's comparative bar (candidate ≥ control on acceptance, ≤ on wall clock) is reviewed by a human from the run log, it cannot be encoded here without the log schema |  |
| S3 | cat docs/migration/stage3-evidence.md | $CLONE | 0 | control | [Hh]aiku.*baseline | both arms model-matched on Sonnet; historical Haiku rows are never the baseline |  |

### Instrument revision — 2026-08-10 (Stage A item A.5)

Four rows above were replaced, and the count re-derived with the replacements in place. The reason
is not bookkeeping: **a row that cannot fail is worse than no row**, because it produces a green a
human trusts. Three of the four could not fail, and two of those three were scoring S3 work that
nobody had started (`docs/migration/status-review-2026-08-10.md` §2).

The removed rows are **described** below rather than quoted. That is deliberate: R6's verifier is a
grep for their exact command text, so reproducing it here — even inside a changelog note — would
re-create the very string the row exists to prove is gone.

| Row, before | Why it could not fail | Row, now |
|---|---|---|
| a case-insensitive `pin` grep over `CHANGELOG.md` | matched `**Pinned:**` in the **1.6.2** entry (`CHANGELOG.md:65`), text that predates this branch | `grep -q 'no in-tree prose lane' CHANGELOG.md` |
| a recursive, case-insensitive `gate-zerowork` grep over `tests/` | matched `10-run-receipt`, `11-is-main`, `15-hook-receipts` — three files that predate the branch | `test -f tests/structural/17-gate-zerowork-workflow.mjs` |
| a case-insensitive `kill`-or-`resume` grep over `stage2-evidence.md` | satisfied by any sentence containing either word, **including one saying the probe was not run** | `grep -qE '^kill-resume-probe: (PASS\|FAIL\|NOT-RUN)'` |
| a case-insensitive `workflow` grep over `hooks/gate-zerowork.mjs` | matched a comment; the arm it was meant to prove is a *predicate*, and comments were exactly what the file already had | a `node -e` import of `dispatchedOrchestrator`, asserting `true` on a synthetic `Workflow` event |

The fourth is a deviation from the Stage A plan's three-row table
(`docs/migration/remaining-stages-plan.md` §A.5), taken deliberately: acceptance row **R4** of that
plan already specifies the behavioural assertion as the verifier for this exact work, so leaving the
grep in place would have kept an instrument the plan itself had superseded. One further row —
A4's `! grep -qiE 'attempt_budget loop|…'` proxy — had its pipes escaped; unescaped, they split the
command across three table columns, so a runner reading the table could not execute the row at all.

**Re-derived count, 2026-08-10, in-tree at the Stage A working commit** (not a fresh clone — A6 is
Stage B's job, and the last clone-derived figure remains **1120 checks at `7c1b15e`**):

| Stage | Rows | Result |
|---|---|---|
| S0 | 3 | **3 PASS / 0 RED** |
| S1 | 6 | **6 PASS / 0 RED** |
| S2 | 6 | **6 PASS / 0 RED** — `stage2-evidence.md` now exists and carries all three |
| S3 | 8 | **4 PASS / 4 RED** — CHANGELOG, `commands/build.md`, and `stage3-evidence.md` ×2 |
| **Total** | **23** | **19 PASS / 4 RED** |

Compare to the pre-revision reading of **17 PASS / 6 RED**: one row moved from PASS to RED
(CHANGELOG, correctly — no cutover entry exists), one from a false PASS to a real PASS (the fixture
now exists), one previously-unrunnable row now runs and passes, and the three S2 rows went green when
Stage A wrote the evidence file. `npm test` green at **1179 checks** (1168 before Stage A; +11 from
the new fixture).

**The row count is not the ship gate.** All six S2 rows are green *and S2's ship gate is not met*:
`stage2-evidence.md` §4 records `kill-resume-probe: FAIL`, and the plan's §A.2 makes a failing probe
a stop. The rows prove the evidence was written and is machine-readable; they were never designed to
encode the probe's verdict, and reading 19/23 as "nearly done" would be the exact mis-navigation this
revision exists to end.

## Guardrails

- **Model floor (D5, PO decision 2026-08-06):** every agent in every phase — workers, judge, QA, and the mechanical couriers — runs on **Sonnet or higher. No Haiku anywhere.** Historical Haiku-4.5 benchmark rows are cited as history only and are never comparison baselines for new Sonnet runs (models must match — the Day-2 review's labelling lesson). (This binds the *deliverable and its runs*; the plan-executor's own clone-and-transcribe verify courier is outside the harness and not governed by D5.)
- **Hard rule inherited from the harness:** every stage exit is an artifact on disk, never a claim. A stage without its evidence file did not happen.
- **All edits, runs, and `.shapeup/` traces happen in the worktree.** The main checkout is the control arm — when a workflow-lane behavior looks wrong, reproduce in main before debugging.
- **Scratch projects for live runs** (Stage 0 spike, Stage 1/2 feature runs) are created under the session scratchpad or `/tmp`-equivalent, never inside either checkout — the harness writes `.shapeup/` into its target project, and a stray run inside the plugin repo pollutes the worktree's own gitignored state.
- **The plugin under test installs from the worktree**, not from npm: `npm pack` in the worktree → install the tarball into the scratch project (`npx shapeup-sdlc init` from it, which also writes the permission grant this migration must exercise). Never test against the published 1.6.x — that measures the control, not the candidate.
- One commit per stage minimum, message prefixed `wf-migration(stage-N):`.
- **If A1 fails → the migration does not start (D1).** NO-GO on Stage 0 check 2 or 3 ends the migration (review §7 names the fallback postures); NO-GO on check 1 is a fixable installer defect — fix, re-run Stage 0.
- **Stage 2 is the ship gate of the cutover** — Stage 3 does not begin until both lane types (A2 unattended AND A3 interactive) are green.
- Stage 1's SKILL.md asymmetry (workflow dispatch only under `--unattended`/`--auto`) is scaffolding that Stage 3 deletes, not a shipped dual path — nothing releases from Stage 1.
- Stage 3 deletion: `git rm`/edit — **no commented-out corpses**.
- **Everything else — all pipeline scripts, all other hooks, all worker skills, both envelope schemas' shapes — untouched by design**; a diff outside the plan's Appendix file-touch map is scope creep and should be challenged at review.
- Every generated path resolves through `skills/tech-lead/scripts/lib/paths.mjs` — never hard-code a storage root (structural test #45 enforces this); the test-#45 discipline extends to the new workflow scripts: every path literal inside them is either `${args.pluginRoot}`-rooted or produced by a script's stdout.
- **[executor rule] The run does NOT perform the plan's Stage 3 step 6 merge to `main`, does not tag, does not push, does not publish.** The branch stays local; merging the cutover release is a decision the PO makes after reading REPORT.md. Everything up to and including the fresh-clone `npm test` (A6) is in scope.
- **[executor rule] The benchmark (A7, ~$40–60) is not launched autonomously.** When Stage 3 reaches step 5, the run pauses and escalates to the user for an explicit go — it is the single most expensive action in the plan and depends on external bench tooling.
- Benchmark regression at Stage 3 step 5 → the merge waits: a workflow lane that scores below the prose lane on the cell that motivated it has not paid for itself — re-open the review's §7 third falsifier before shipping.

## Stage S0 — the kill-switch spike · D1

**Depends on:** —
**Optional:** no
**Exit criterion:** `docs/migration/stage0-evidence.md` — the four results, the quoted `decisions.jsonl` rows, the measured cost, and a one-line GO / NO-GO. **NO-GO on check 2 or 3 ends the migration** (review §7 names the fallback postures); NO-GO on check 1 is a fixable installer defect — fix, re-run Stage 0.
**Estimate:** ~1–2 h · ≲ $1

No harness code changes. One throwaway workflow, run against a scratch project that has the
worktree plugin installed.

**Steps:**

1. Scratch project: `mkdir spike && cd spike && git init` → install worktree tarball → verify
   `.claude/settings.json` carries the `permissions.allow` grant `bin/init.mjs` writes.
2. Author `spike-workflow.js` (throwaway, lives in the scratch project): three `agent()` calls —
   (a) Bash-runs `init-run.mjs --slug spike --intake-text "spike" --auto-level unattended`;
   (b) attempts a `Write` outside any substrate **after** an `active-scope` pointer is planted
   with a minimal scope contract, then attempts `Skill(shapeup-sdlc-plugin:task-executor)
   --order /nonexistent.json`;
   (c) returns `{grant_ok, receipt_written}` as schema-forced output.
3. **Check 1 — permission grant:** call (a) must run without an approval stall. Denial = the
   26-denial class reproduced inside workflow subagents.
4. **Check 2 — hooks fire in workflow subagents:** call (b) must be DENIED twice — once by
   `sandbox-guard` (out-of-substrate write), once by `validate-envelope` (dangling `--order`) —
   and `decisions.jsonl` must hold a `deny` row for each. The receipt rows are the proof; a
   deny with no row means the hook layer is inert (F-16's class) and the check FAILS.
5. **Check 3 — headless availability:** `claude -p` in the scratch project with a prompt that
   invokes a trivial named workflow. Workflow tool absent → FAIL.
6. **Cost measurement:** token cost of one `mech()`-shaped agent **on Sonnet** (the D5 floor),
   recorded against the review's ≲ $1/round estimate.

[executor addendum, formatting only] The evidence file's verdict line must be the literal
string `Decision: GO` (or `Decision: NO-GO — <check>`), so acceptance can grep it without
ambiguity. Quote the deny rows verbatim from the scratch project's `decisions.jsonl`.

## Stage S1 — `shapeup-build-round`

**Depends on:** S0
**Optional:** no
**Exit criterion:** `docs/migration/stage1-evidence.md` — run transcript refs, the orders/results listing, breaker-probe output, token cost vs. main-checkout control run of the same feature. All three verifications green, in order: (1) `npm test` with the new structural check; (2) scratch-project unattended run of a small real feature (`--gate-answers ci`): board green, T0 verdicts present, EVAL ran exactly once (one `evaluate-r1` order), verdict recorded; (3) negative probe returns `{status: "gate_h", breaker: "inner"}` with the scope in `hammer_proposals` and the round NOT blocked.
**Estimate:** ~1–2 days · dev-run tokens

The inner loop as a workflow, developed and exercised in the unattended lane. Not a release.

**[impl] Where workflow scripts live:** shipped with the plugin at
`skills/tech-lead/workflows/*.js`, invoked by the skill via
`Workflow({scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/<name>.js", args})`.
Rationale: the plugin's existing distribution mechanism ships and permission-grants files under
its own root; a copy-into-`.claude/workflows` install step would be a second install surface
(the v1.6.1 class).

**Create:**
- `skills/tech-lead/workflows/shapeup-build-round.js` — per-scope attempt loop + GATE L2 →
  single EVAL → GATE L3, per the review §6 Stage-1 sketch: `mech()` helper (sonnet — the D5
  floor, schema-forced `{exit_code, stdout, stderr}`), stagnation breaker read from
  compile-order stderr, T0 status branch, hammer-proposal queue, gate resolution via
  `gate-answers.mjs` exit codes. No `model:` value below `sonnet` appears anywhere in either
  workflow script — add a structural check for it (the D5 floor, greppable).
- `$defs.RunArgs` and `$defs.RunReturn` in `skills/tech-lead/schemas/domain.schema.json`
  **[impl]** — the central-registry rule says every cross-boundary record is defined once, and
  C1 is a cross-boundary record; the workflow validates its own `args` shape in code and the
  skill treats the return per the union contract (design doc §2).

**Modify:** `skills/tech-lead/SKILL.md` BUILD section only — under `--unattended`/`--auto`,
dispatch the round via the workflow; everything else untouched (this asymmetry is scaffolding
that Stage 3 deletes, not a shipped dual path — nothing releases from Stage 1).

**Verify (all three, in order):**
1. `npm test` — structural suite green; add a structural check that every path literal inside
   the workflow script is either `${args.pluginRoot}`-rooted or produced by a script's stdout
   (the test-#45 discipline extended to the new file).
2. Scratch-project unattended run of a small real feature (`--gate-answers ci`): board green,
   T0 verdicts present, EVAL ran exactly once (one `evaluate-r1` order), verdict recorded.
3. Negative probe: plant a scope that cannot go green (impossible fixture) → attempt budget
   exhausts → workflow returns `{status: "gate_h", breaker: "inner"}` with the scope in
   `hammer_proposals` and the round NOT blocked — the three-breaker contract observed from
   outside.

## Stage S2 — `shapeup-run` + the thin skill + pause protocol

**Depends on:** S1
**Optional:** no
**Exit criterion:** `docs/migration/stage2-evidence.md` with A2/A3/kill-probe transcripts. This is the **ship gate of the cutover** — Stage 3 does not begin until both lane types are green.
**Estimate:** ~2–3 days · dev-run tokens

**Create:** `skills/tech-lead/workflows/shapeup-run.js` — the outer pipeline: fast-forward
preamble (derive phase from receipt/board/trials — the exit-3 RESUME STATE derivation, §4 of the
design doc), then ORIENT → L1a → WIRE → L1a.5 → MAP SCOPES → L1b → rounds of
`workflow('shapeup-build-round'-equivalent inline or via `workflow()` child) bounded by
`maxRounds` with `budget-check.mjs` at every round boundary → QA → GATE H → ship-report.
Every gate: resolve via `gate-answers.mjs`; exit 4 → `return {status: "paused", …}`; exit 5 →
`return {status: "aborted", …}`.

**Rewrite:** `skills/tech-lead/SKILL.md` to the thin shell (review §6 Stage-2 sketch): L0
intake conversation → `init-run.mjs` → compile `RunArgs` → launch → branch on `RunReturn` →
gate conversations on pause → relaunch → L4/coach. Target ≤ ~150 lines. The references shrink:
`delegation.md` keeps worker contracts and the model-matrix table; `round-protocol.md`'s
normative loop moves into the workflow script as comments; `gates.md` keeps the gate-block
formats (the skill still emits them verbatim from the workflow's `block` field).

**Verify:**
1. `npm test` green (structural checks updated for the moved/deleted prose are part of this
   stage, not Stage 3 — the suite must never be red at a stage boundary).
2. **A2:** full unattended run, scratch project, preset `ci` — green end to end.
3. **A3:** full interactive run — PO crosses L1a, L1b, L3, L4 via pause/relaunch; on each
   relaunch, assert the fast-forward re-dispatched nothing (`orders/` minus `results/` is empty
   before the workflow proceeds) and landed on the paused gate.
4. Kill/resume probe: kill the session mid-BUILD, fresh session, relaunch — the fast-forward
   resumes from disk with no re-work (the 82–120-turn handoff class, retired by test).

## Stage S3 — cutover, deletion, detectors, benchmark

**Depends on:** S2
**Optional:** no
**Exit criterion:** `docs/migration/stage3-evidence.md` + the release tag. [executor rule: the tag and the merge to `main` are excluded from the run — the PO ships after reading REPORT.md. The benchmark step pauses for explicit user go-ahead before spending.]
**Estimate:** ~1 day + benchmark cost (~$40–60)

1. **Delete** the inline orchestration prose (D2): the round/attempt runbook from `SKILL.md`
   remnants and `gates.md`/`round-protocol.md` normative sections. `git rm`/edit — no
   commented-out corpses.
2. **`hooks/gate-zerowork.mjs`:** add the predicate arm — a `Workflow` tool_use whose
   scriptPath/name matches `shapeup-` counts as "dispatched the orchestrator"; a session that
   loaded tech-lead and produced neither a Workflow call nor a receipt still blocks. Unit
   fixture added (A5).
3. **Commands** (`commands/build.md`, `ship.md`): instruct the Workflow launch (the legitimate
   opt-in surface).
4. **CHANGELOG + `docs/upgrading.md`:** the cutover entry states the rollback explicitly —
   *pin the previous release; there is no in-tree prose lane* — and names D1–D4.
5. **Benchmark (A7):** F2 cell, **Sonnet 5, two arms, n=3 each** — candidate (workflow lane,
   worktree build via `npm pack`) and control (v1.6.x prose lane, same model). The historical
   Haiku rows in `results/runs.jsonl` are context, never the baseline: a cross-model comparison
   is the mislabelling class the Day-2 review documents. Label build id and model on every row
   (no number without its build).
6. Fresh-clone `npm test` (A6). [executor rule: STOP here — the merge of
   `feat/workflow-orchestrator` → `main` as the cutover release and the `git worktree remove`
   are the PO's move, recorded in REPORT.md as the remaining step.]
