# Migration plan — extract the tech-lead orchestrator into a Workflow, executed in an isolated worktree

> ## ⟐ A7 correction — 2026-08-11, and it reverses a standing status
>
> **A7 is NOT blocked on this machine.** The "instrument unobtainable" verdict carried since
> Revision B was derived on `/Volumes/LibertyMobi/…`, where the benchmark genuinely was absent
> (C1 NO / C2 NO). On this machine `sdd-harness-bench` **is present** — checkout `14e4479`, with
> `harnesses/shapeup-sdlc/adapter.mjs`, `runner/run.mjs`, `features/f2-budgets`, and 240 rows in
> `results/runs.jsonl`.
>
> **The blocker that remains belongs to a different plan.** `.plan-runs/day2-rev5/s3-feasibility.mjs`
> still exits 4, and its only failing check is **C3 — "adapter prerequisites present at pre-fix build
> `a280e86`"**. That build is the **day-2 tool-efficacy plan's** control build for FC-01. It predates
> v1.4.0 and therefore lacks `init-run.mjs`, so no rep at `a280e86` can ever be scored. That is a
> real, permanent blocker — **for day-2's S3 arm, which is a different stage in a different plan
> that happens to use the same letter.**
>
> **A7's arms are not that build.** The migration's benchmark is candidate (this branch's workflow
> lane, v1.6.3+) versus control (the published v1.6.x prose lane). Both post-date v1.4.0 and both
> carry the machinery C3 reports missing. C3 does not apply to either.
>
> **Corrected status: A7 is OBTAINABLE HERE and UNSTARTED.** It is gated by two things and neither
> is the instrument: S2's ship gate above it, and the PO's spend decision (~$40–60, and the executor
> rule that it never launches autonomously). Revision B's "deferred obligation with a named trigger"
> was the right posture for a machine without the benchmark; the trigger it named — *the first run on
> a machine that holds `sdd-harness-bench`* — **has fired.**
>
> *How this survived four runs: the status was inherited across machines and never re-derived. It is
> the same class this branch keeps finding — a claim carried forward instead of a fact re-measured —
> and it was caught by asking a question the docs could not answer from their own text.*
>
> ## ⟐ Revision E — amended 2026-08-12: the gate is met
>
> **`kill-resume-probe: PASS`.** Four of four assertions, on a live ungraceful `SIGKILL` mid-BUILD,
> graded by an `assert.mjs` byte-identical to the one that failed Stage A and Stage A2 — and
> self-tested in the failing direction on A2's own snapshots first. `node tools/contract-check.mjs`
> prints **GATE MET — S2 ship gate — kill/resume probe: PASS**, 19 PASS / 4 RED (all four REDs are
> Stage 3 rows, which have not started).
>
> **Status at `e5bf9cd`** — `npm test` green, **1363 checks**.
>
> | Stage | State | Remaining |
> |---|---|---|
> | S0 · S1 | ✅ **GREEN** | — |
> | S2 — `shapeup-run` + thin skill | ✅ **SHIP GATE MET** — `kill-resume-probe: PASS` | — |
> | S3 — cutover, detectors, benchmark | 🟠 **unblocked, not started** | Stage B (R7–R11), then C's fork |
>
> **Stage A3 closed the gate in two places, and neither was the resume logic itself:**
>
> 1. **A phase is complete only when its ARTIFACT exists.** Every dispatch is now followed by
>    `resume-state.mjs --require <phase>` — the same derivation the fast-forward uses, so the two
>    cannot disagree. An escalated phase that writes nothing is an abort naming the phase, not a
>    silent forever-loop.
> 2. **`analyze` runs before WIRE.** `solution-architect` reads `usecases/` and writes one map entry
>    per use case; `analyze` is what writes them. The pipeline dispatched WIRE first, so on a
>    greenfield run the worker had nothing to wire and escalated — deterministically, every launch.
>    Handed a populated spec folder it returned `status:"done"`, `escalates:[]`, and a wiring map.
>
> Running it also produced two environment findings (#12, #13) and one defect (HD-006, filed): a
> declared marketplace is not an installed one; `claude plugin install` is a no-op over an existing
> cache version; and a WorkOrder never names its own result file.
>
> Evidence: `docs/migration/stage-a3-evidence.md`. Position: `docs/migration/README.md`.
> **Stage B is unblocked.**
>
> ## ⟐ Revision D — amended 2026-08-11 after the probe re-ran
>
> Revision C described Stage A2 as the work that would close the gate. **It ran, and the gate is
> still shut — for a different reason, which is the whole content of this revision.**
>
> **Status at `aad7807`** — `npm test` green, **1351 checks**. Contract **19 PASS / 4 RED**, now
> derived by executing it (`node tools/contract-check.mjs`, which prints the gate before the count).
>
> | Stage | State | Remaining |
> |---|---|---|
> | S0 · S1 | ✅ **GREEN** | — |
> | S2 — `shapeup-run` + thin skill | 🔴 **SHIP GATE NOT MET** — `kill-resume-probe: FAIL` | **Stage A3 (unplanned):** a phase's completion must depend on its artifact, not on its result record; then re-run the probe |
> | S3 — cutover, detectors, benchmark | ⛔ **blocked behind S2** | unchanged |
>
> **What Stage A2 proved, on a live ungraceful SIGKILL** — this is the migration's own product,
> demonstrated for the first time: ORIENT's order and result **byte-identical** across the kill,
> `status` moving `orienting → building → evaluating`, the substrate pointer naming the scope
> actually in flight, build orders no longer colliding, and the resumed leg carrying the killed run
> to `{"status":"shipped","verdict":"pass","rounds_used":2}` through an EVAL FAIL and a fix round.
> **Four of five completed phases survived untouched.**
>
> **What it did not close.** The fifth phase, WIRE, was re-dispatched — correctly. Its worker
> escalated and never wrote `wiring-map.md`, so the artifact-gated fast-forward re-ran a phase that
> had never actually completed. **A3 stays RED and the cause has moved one layer up**: an escalated
> phase is recorded as complete, writes no artifact, and is re-dispatched on every relaunch forever.
> Invisible inside a single leg; only a resume shows it.
>
> Evidence: `docs/migration/stage-a2-evidence.md` §7. Position: `docs/migration/README.md`.
>
> ## ⟐ Revision C — amended 2026-08-11 at `5209df7`
>
> Revision B's remaining work was executed on 2026-08-10 as **Stage A** (`2a134cd`). Four of its
> five items shipped and are green. The fifth — **the kill/resume probe — FAILED**, and it is the one
> that decides the cutover.
>
> **Status at `5209df7`** — `npm test` green, **1328 checks** (1179 at the Stage A commit; the
> difference is merged day-2 work, not migration work). Contract rows: **19 PASS / 4 RED** against
> the tightened instrument, derived at `2a134cd`. **The row count is not the gate.**
>
> | Stage | State | Remaining |
> |---|---|---|
> | S0 — kill-switch spike | ✅ **GREEN** | — |
> | S1 — `shapeup-build-round` | ✅ **GREEN** | — |
> | S2 — `shapeup-run` + thin skill | 🔴 **SHIP GATE NOT MET** — `kill-resume-probe: FAIL` | `docs/migration/stage-a2-plan.md` A2.1–A2.4: artifact-gate ORIENT, stop discarding courier results, regression fixture, **re-run the probe** |
> | S3 — cutover, detectors, benchmark | ⛔ **blocked behind S2** | unchanged; A5 has since gone green, A7 remains a deferred obligation |
>
> **What changed against Revision B, in one line each:** A5 is now **GREEN** (the arm and its
> fixture shipped in Stage A); A3 is now **RED** (the probe re-dispatched a completed ORIENT phase);
> A6's in-tree figure is 1328 with the clone figure still 1120 at `7c1b15e`; §6's Stage A is
> executed and **superseded by `stage-a2-plan.md`**; A7 is unchanged and still unobtainable here.
>
> **Read `docs/migration/README.md` first** — it is the one-page position and names which document
> is current. `status-review-2026-08-10.md`, cited throughout Revision B below, is now a historical
> snapshot: its analysis stands, its headline does not.
>
> ## ⟐ Revision B — amended 2026-08-10 at `c469a6c`
>
> Revision A (sha256 `949dab98…`) was compiled verbatim into `docs/migration/execution-contract.md`
> and executed across three runs. This revision amends it against what execution actually produced.
> **Read `docs/migration/status-review-2026-08-10.md` first** — it carries the evidence for every
> change below. `execution-contract.md`'s `plan_sha256` still names revision A **deliberately**: the
> contract is the record of what was executed, not a live mirror of this file. A resuming executor
> must read the amendment log at the bottom of this file before acting on any stage body.
>
> **Status at `c469a6c`** — `npm test` green, 1168 checks. Contract rows: **17 PASS / 6 RED, of which
> 2 passes are false** (§Acceptance notes) → 15 rows honestly done.
>
> | Stage | State | Remaining |
> |---|---|---|
> | S0 — kill-switch spike | ✅ **GREEN** | — |
> | S1 — `shapeup-build-round` | ✅ **GREEN** | — |
> | S2 — `shapeup-run` + thin skill | 🟡 **behaviour proven, evidence unwritten** | write `stage2-evidence.md`; run the kill/resume probe |
> | S3 — cutover, detectors, benchmark | 🟠 **partly startable, A7 blocked** | hook arm + fixture, commands, CHANGELOG/upgrading, A6; **A7 unobtainable on this machine** |
>
> **A7 is blocked, not merely unstarted.** `node .plan-runs/day2-rev5/s3-feasibility.mjs` returns
> C1 NO / C2 NO / C3 NO: `sdd-harness-bench` is absent from this machine, and commit `8fe70bc`
> records the last search axes closed (npm 404, global GitHub 0 results). See the amended A7 row and
> §6 below.

**Goal:** implement D1–D4 (`docs/workflow_extraction_review.md` §6 decision record) — a
deterministic Workflow control plane, the prose orchestrator deleted at cutover, both lanes
served, rollback by version pinning.
**Where it runs:** a dedicated git worktree, so the main checkout stays clean, releasable, and
available for comparison runs throughout.
**Design authority:** `docs/workflow_extraction_review.md` (what and why) and
`docs/workflow_architecture_design.md` (channels C1–C6, RunArgs/RunReturn). This plan adds no
design; where it must choose an implementation detail the choice is stated and marked **[impl]**.
**Budget:** ~4–6 working days; ≲ $2 (Stage 0) + dev-run tokens (Stages 1–2) + ~$40–60 for the
Stage-3 benchmark (two model-matched arms on Sonnet 5, n=3 each — label build id and model in
results).
**Model floor (D5, PO decision 2026-08-06):** every agent in every phase — workers, judge, QA,
and the mechanical couriers — runs on **Sonnet or higher. No Haiku anywhere.** Historical
Haiku-4.5 benchmark rows are cited as history only and are never comparison baselines for new
Sonnet runs (models must match — the Day-2 review's labelling lesson).
**Hard rule inherited from the harness:** every stage exit is an artifact on disk, never a claim.
A stage without its evidence file did not happen.

---

## Acceptance contract (the whole migration)

The migration is DONE when, on the worktree branch:

| # | Criterion | Verified by |
|---|---|---|
| A1 | Stage-0 evidence shows all three kill-switch checks passed | `docs/migration/stage0-evidence.md` + `decisions.jsonl` rows quoted in it |
| A2 | An **unattended** run of a real feature completes through `shapeup-run` (preset `ci`), verdict recorded, zero orchestration prose between gates | run transcript + `.shapeup/<slug>/` artifacts + `REPORT.md` |
| A3 | An **interactive** run completes with ≥2 gates crossed via pause → PO decision → relaunch fast-forward, and nothing re-dispatched (orders/results set difference empty on relaunch) | ⟐ **Rev E: GREEN, 2026-08-12.** `kill-resume-probe: PASS` — 4/4 assertions over a live SIGKILL, asserted against T0 verdict artifacts and completed phase orders rather than the set-difference wording this row started with (`stage-a3-evidence.md` §4). ⟐ **Rev D: still RED, different cause.** The ORIENT defect below is fixed and proven on a live kill; A3 now fails because an ESCALATED phase is recorded as complete and re-dispatched forever (`stage-a2-evidence.md` §7.3). — run transcript + `docs/migration/stage2-evidence.md`. ⟐ **Rev C: RED at `2a134cd`** — L1a and L1b were crossed across four fresh-session relaunches with the redone-work set empty, but the kill/resume probe **re-dispatched a completed ORIENT phase** and re-ingested its result (`stage2-evidence.md` §4). The set-difference clause in this very row is what fails. Note that the row's own wording — *orders/results set difference empty* — **passed on the failing run**, because a build order carries no scope id and scope 2's order overwrote scope 1's; assert over T0 verdict artifacts instead |
| A4 | ⟐ **Rev B.** No *scoped-lane* loop prose survives; `SKILL.md` ≤ ~150 lines; `shapeup-run.js`/`shapeup-build-round.js` are the only normative home **for specs with committed scope contracts**. The `--tiny` and pre-scope-contract lanes keep their prose loop by design, and `SKILL.md` names the boundary | `wc -l SKILL.md` (**121 at `c469a6c` ✅**); `SKILL.md` routes the excepted lanes explicitly (`:50-55`); `round-protocol.md` states the same split (`:11-22`) |
| A5 | `gate-zerowork.mjs` blocks a session that launches the skill and never invokes the Workflow (new predicate arm), and still defers on non-harness sessions | new unit fixture in `tests/` + `npm test`. ⟐ **Rev B: RED at `c469a6c`** — `hooks/gate-zerowork.mjs:66` has no `Workflow` in `WORK_TOOLS`, `:69-74` matches `Skill(tech-lead)` only, **while `SKILL.md:12-14` already tells operators the arm exists**. Closing A5 repairs that divergence. ⟐ **Rev C: GREEN at `2a134cd`** — the arm shipped, `tests/structural/17-gate-zerowork-workflow.mjs` exists and is mutation-verified both ways, and the contract's behavioural row (a `node -e` import asserting `dispatchedOrchestrator` returns `true` on a synthetic `Workflow` event) passes when run |
| A6 | `npm test` green in the worktree AND in a fresh `git clone --local` of the branch (the repo's own clone discipline) | clone + `npm test` output pasted in stage evidence. ⟐ **Rev B:** in-tree green at 1168; last clone-derived count was 1120 at `7c1b15e` — **must be re-derived at the final commit**. ⟐ **Rev C:** in-tree green at **1328** (`5209df7`); the clone figure is unchanged at 1120 and is still Stage B's job. ⟐ **Rev D:** in-tree **1351** |
| A7 | ⟐ **Rev D correction: OBTAINABLE HERE, UNSTARTED** — the benchmark is present on this machine and A7's arms are unaffected by the `a280e86` blocker, which belongs to the day-2 plan's S3. See the A7 correction block at the top. — Benchmark F2 cell, **model-matched on Sonnet 5**: candidate arm (workflow lane, n=3) vs control arm (v1.6.x prose lane, n=3). Absolute bar: 3× 14/14 oracle, 0 narrated, receipts present. Comparative bar: candidate ≥ control on acceptance, ≤ control on wall clock. The historical Haiku rows are NOT the baseline — models must match | ⟐ **Rev B — DEFERRED OBLIGATION, not a gate.** The instrument is unobtainable here (3 blockers, §6). A7 converts to an obligation with a named trigger: **the first run on a machine that holds `sdd-harness-bench`**. `stage3-evidence.md` MUST record the unobtainability as a finding — "A7 passed" must not be reachable by grep. See §6 |

⟐ **Rev B — acceptance-instrument notes.** Two rows in `execution-contract.md` pass without the work
being done, and must be tightened before the count is trusted:

- `grep -qi pin CHANGELOG.md` (`:50`) matches `**Pinned:**` at `CHANGELOG.md:65`, from the **1.6.2**
  entry. Replace with a predicate on the cutover text, e.g. `grep -q 'no in-tree prose lane' CHANGELOG.md`.
- `grep -rqli 'gate-zerowork' tests/` (`:48`) matches three pre-existing test files. Replace with a
  path test for A5's *new* fixture.

The same caution applies to the `grep -qiE 'kill|resume' stage2-evidence.md` row: a sentence saying
the probe was **not** run satisfies it. Either run the probe or tighten the row — do not let prose
about an absence score as evidence of a presence.

If A1 fails → the migration does not start (D1). If A2/A3 cannot both go green → the cutover
release does not ship (D2's ship gate) and the branch stays unmerged.

---

## 0. Worktree setup — one-time, ~10 min

> ⟐ **Rev B — this section is historical. The two-checkout premise no longer holds.**
> `git worktree list` returns a **single** checkout at
> `/Volumes/LibertyMobi/workspace/proj-harness-plugin`, on `feat/workflow-orchestrator` directly;
> the paths below (`/Users/teo/workspace/…`) are a different machine. Consequences that bind the
> remaining stages:
> - **There is no control arm available in-place.** The rule "reproduce in main before debugging"
>   has had no main checkout since run 2. Use `git stash` + `git checkout main`, or accept that
>   control-arm comparison is unavailable and say so in the evidence.
> - **The branch is no longer only this migration.** 41 commits ahead of `main`, 10 tagged
>   `wf-migration`; `af99937` merged the day2 ratchet work in, and **24 of 46 changed files fall
>   outside the Appendix touch-map**. That merge is in history and `npm test` is green across both —
>   do not un-merge it. Instead the cutover CHANGELOG must state that pinning the previous release
>   also reverts the ratchet changes (the rollback story is wider than revision A assumed).
> - **Freeze the branch at Stage B** (§6). Another unrelated merge makes the touch-map guardrail
>   unusable as an audit.


```bash
# from the main checkout (never develop on main directly)
git -C /Users/teo/workspace/proj-harness-plugin worktree add \
    ../proj-harness-plugin-wf -b feat/workflow-orchestrator
cd /Users/teo/workspace/proj-harness-plugin-wf

npm test                      # baseline MUST be green before any change (record the count)
mkdir -p docs/migration       # stage evidence lives here, committed on the branch
```

Worktree ground rules:

- **All edits, runs, and `.shapeup/` traces happen in the worktree.** The main checkout is the
  control arm — when a workflow-lane behavior looks wrong, reproduce in main before debugging.
- **Scratch projects for live runs** (Stage 0 spike, Stage 1/2 feature runs) are created under
  the session scratchpad or `/tmp`-equivalent, never inside either checkout — the harness writes
  `.shapeup/` into its target project, and a stray run inside the plugin repo pollutes the
  worktree's own gitignored state.
- **The plugin under test installs from the worktree**, not from npm: `npm pack` in the worktree
  → install the tarball into the scratch project (`npx shapeup-sdlc init` from it, which also
  writes the permission grant this migration must exercise). Never test against the published
  1.6.x — that measures the control, not the candidate.
- One commit per stage minimum, message prefixed `wf-migration(stage-N):`; the branch merges to
  `main` only at Stage 3's end, as the cutover release.

---

## 1. Stage 0 — the kill-switch spike · ~1–2 h · ≲ $1 · D1

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

**Exit artifact:** `docs/migration/stage0-evidence.md` — the four results, the quoted
`decisions.jsonl` rows, the measured cost, and a one-line GO / NO-GO. **NO-GO on check 2 or 3
ends the migration** (review §7 names the fallback postures); NO-GO on check 1 is a fixable
installer defect — fix, re-run Stage 0.

---

## 2. Stage 1 — `shapeup-build-round` · ~1–2 days

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

**Exit artifact:** `docs/migration/stage1-evidence.md` — run transcript refs, the
orders/results listing, breaker-probe output, token cost vs. main-checkout control run of the
same feature.

---

## 3. Stage 2 — `shapeup-run` + the thin skill + pause protocol · ~2–3 days

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

**Exit artifact:** `docs/migration/stage2-evidence.md` with A2/A3/kill-probe transcripts. This
is the **ship gate of the cutover** — Stage 3 does not begin until both lane types are green.

> ⟐ **Rev C (2026-08-11) — the evidence file was written and the probe was run: it FAILED.**
> `docs/migration/stage2-evidence.md` exists and §4 records `kill-resume-probe: FAIL` — two of four
> assertions red, a completed ORIENT order re-dispatched and its result re-ingested on resume.
> **A3 is therefore RED, not "substantially green", and this stage's ship gate is not met.** The
> block below is Revision B's reading, kept for the record; read §4 of the evidence file for what
> actually happened and `docs/migration/stage-a2-plan.md` for the fix.
>
> ⟐ **Rev B — status: behaviour proven on 2026-08-07, evidence file never written.**
> The content for `stage2-evidence.md` already exists at `docs/migration/execution-report.md:32-125`
> and only needs transcribing with its citations:
> - **A2 GREEN** — headless run returned `{"status":"shipped","verdict":"pass","rounds_used":1,…}`;
>   9 orders / 9 results; exactly one `evaluate-r1` order.
> - **A3 SUBSTANTIALLY GREEN** — L1a and L1b crossed via pause → PO decision → relaunch in fresh
>   sessions, across 4 relaunches, with the *redone-completed-work* set empty at every leg.
> - **NOT demonstrated, and the evidence file must say so:** no single interactive run reached
>   `shipped`, and **verification step 4 (the kill/resume probe) was never run.**
>
> **Two defects were found only by executing this stage** and are committed: `e4c8fa6` (the `mech()`
> courier manufactured `EXIT:0` into its own stdout — 8 parse sites now route through
> `parseMechJson`; the dangerous silent arm was QA never dispatching under preset `ci` while the run
> reported green) and `7c1b15e` (`agent()` returns `null` on a skipped/dead subagent, and every call
> site dereferenced it — `"failed"` is not a member of the `RunReturn` union, so `SKILL.md` Step 3
> had no arm for it). Both belong in the evidence file.
>
> **Stage 3 has already been partly entered while S2's ship gate is unmet.** That is a contract
> violation on paper (`execution-contract.md:64`) with no practical harm so far — but it means
> **running the kill/resume probe is not optional bookkeeping.** If it fails, A3 is not green, the
> ship gate was never met, and every Stage-3 item unwinds.

---

## 4. Stage 3 — cutover, deletion, detectors, benchmark · ~1 day + benchmark cost

1. ⟐ **Rev B — SUPERSEDED AS WRITTEN. Do NOT delete `round-protocol.md`'s loop.**
   Revision A ordered: delete "the round/attempt runbook from `SKILL.md` remnants and
   `gates.md`/`round-protocol.md` normative sections." Stage 2 deliberately refused half of that,
   and correctly: `SKILL.md:50-55` routes `--tiny` runs **and any spec without committed
   `scopes/*.md`** to `references/round-protocol.md` + `delegation.md` "verbatim, non-regression",
   because `shapeup-run.js` targets scope-contract specs by design. `round-protocol.md:11-22` was
   rewritten to state exactly that split. **Deleting that prose would delete the only normative home
   a supported lane has.** D2's scope shrank during execution and revision A never recorded it.
   **What this step now is:** confirm — do not re-delete — that (a) `SKILL.md` carries no
   scoped-lane round/attempt loop (**already true at 121 lines**), (b) `round-protocol.md` and
   `gates.md` state which lane each surviving section serves, and (c) no commented-out corpses
   remain. A4 as amended is the criterion.
2. **`hooks/gate-zerowork.mjs`:** add the predicate arm — a `Workflow` tool_use whose
   scriptPath/name matches `shapeup-` counts as "dispatched the orchestrator"; a session that
   loaded tech-lead and produced neither a Workflow call nor a receipt still blocks. Unit
   fixture added (A5).
   ⟐ **Rev B — this is now a correctness repair, not just a detector.** `SKILL.md:12-14` already
   states the hook blocks a session leaving "neither a receipt NOR a `Workflow` tool_use naming
   `shapeup-run`". The hook does not implement it (`:66` `WORK_TOOLS` has no `Workflow`; `:69-74`
   matches `Skill(tech-lead)` only). Practical exposure is small — the block is decided by receipt
   absence and `init-run.mjs` writes the receipt before launch — but an invariant currently lives in
   a prompt rather than the runtime, which is the one thing `AGENTS.md` says must never happen.
   Structural #26 does not catch it (it checks paths and counts, not claimed predicates).
3. **Commands** (`commands/build.md`, `ship.md`): instruct the Workflow launch (the legitimate
   opt-in surface). ⟐ Rev B: neither file mentions `Workflow` at `c469a6c`.
4. **CHANGELOG + `docs/upgrading.md`:** the cutover entry states the rollback explicitly —
   *pin the previous release; there is no in-tree prose lane* — and names D1–D4.
   ⟐ **Rev B — three additions revision A could not have known:**
   (a) "no in-tree prose lane" is **too strong** — say instead that the *scoped* lane is code-only
   and the `--tiny`/pre-scope-contract lane remains prose by design;
   (b) pinning the previous release **also reverts the merged day2 ratchet work** (`af99937`), so
   the rollback's blast radius is wider than this migration;
   (c) `docs/upgrading.md` must document `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` as **mandatory for
   headless runs** — without it `claude -p` terminates the Workflow at 600 s, **exits 0**, and
   reports a truncated run as a clean one. This is a shipping-safety note and it currently exists in
   no shipped document.
5. **Benchmark (A7):** F2 cell, **Sonnet 5, two arms, n=3 each** — candidate (workflow lane,
   worktree build via `npm pack`) and control (v1.6.x prose lane, same model). The historical
   Haiku rows in `results/runs.jsonl` are context, never the baseline: a cross-model comparison
   is the mislabelling class the Day-2 review documents. Label build id and model on every row
   (no number without its build).
   ⟐ **Rev B — BLOCKED ON THIS MACHINE. Do not attempt; do not substitute.**
   `node .plan-runs/day2-rev5/s3-feasibility.mjs` → **C1 NO** (`/Users/teo/workspace/sdd-harness-bench`
   absent), **C2 NO** (no `*harness-bench*` directory or archive under `/Users` or `/Volumes`),
   **C3 NO**. Commit `8fe70bc` records the last two search axes closed: npm 404, global GitHub
   0 results. **Rebuilding a lookalike benchmark is forbidden** — it produces a different instrument
   whose numbers look comparable and are not, which is the pooling error the day2 review exists to
   refuse. Proceed per §6's fork; `s3-feasibility.mjs` exiting 0 is the trigger that reopens this step.
6. Fresh-clone `npm test` (A6), then merge `feat/workflow-orchestrator` → `main` as the cutover
   release; `git worktree remove` after the tag. ⟐ Rev B: there is no worktree to remove.

**Exit artifact:** `docs/migration/stage3-evidence.md` + the release tag.
⟐ **Rev B:** if A7 is deferred, `stage3-evidence.md` must carry the unobtainability as a **finding**
with its date and the three blocker codes — omitting the section, or wording it so that "A7 passed"
is reachable by grep, is not an acceptable exit.

---

## ⟐ 6. Rev B — the remaining work, and the one fork that costs money

Full argument and evidence: `docs/migration/status-review-2026-08-10.md`. Sequence:

### Stage A — close the clerical debt · ~2–3 h · $0 external · all unblocked here

> ⟐ **Rev C — EXECUTED 2026-08-10 at `2a134cd`. A.1, A.3, A.4 shipped; A.2 FAILED.** "Clerical debt"
> was the wrong name for it: A.2 was never clerical, and it is the item that came back red. The
> stage that now closes the gate is **`docs/migration/stage-a2-plan.md`** (~6 h, $0, G1–G6), and
> **Stage B below depends on it, not on this table.**

| # | Item | Note |
|---|---|---|
| A.1 | Write `docs/migration/stage2-evidence.md` | Content exists at `execution-report.md:32-125`; transcribe with citations, and state what is **not** demonstrated |
| A.2 | **Run the kill/resume probe** (§3 verify step 4) | The one criterion that retires the 82–120-turn handoff class. If skipped, A3 is marked *partial* in writing — not green |
| A.3 | Implement A5 — the `Workflow` predicate arm + unit fixture | Also repairs the `SKILL.md:12-14` divergence |
| A.4 | Tighten the two false-passing contract rows + the `kill\|resume` row | Then re-derive the count |

### Stage B — cutover paperwork · ~2 h · $0

| # | Item |
|---|---|
| B.1 | `commands/build.md`, `commands/ship.md` — name the Workflow launch |
| B.2 | CHANGELOG cutover entry + `docs/upgrading.md`, with §4's three Rev-B additions |
| B.3 | Confirm step 1 as amended (no scoped-lane loop prose; lane boundaries stated) |
| B.4 | **A6** — fresh `git clone --local` + `npm test` at the final commit; paste the count |

Freeze the branch here. No further unrelated merges.

### Stage C — the fork · PO decision

| | **C1 — ship on the absolute bar, defer the comparative** | **C2 — hold the merge for the bench machine** |
|---|---|---|
| Cost now | $0 | $40–60 + a machine, at an unknown date |
| Given up | The §7 falsifier. The one cost number in hand (**candidate $2.010 vs control $1.461, +37.6%**, `stage1-evidence.md`) stays unrefuted at scale | Time; the branch keeps absorbing unrelated work, as it already has |
| Required | `stage3-evidence.md` records "A7 not run — instrument unobtainable, C1/C2/C3 NO at 2026-08-10" | — |
| Precedent | day2's S3 took exactly this posture on this same blocker (`RESUME.md`: *"No number was invented in the meantime"*) and it held | — |

**Recommended: C1 — conditional on Stage A.2 actually being run.** A7 answered *"does this pay for
itself"*; the kill/resume probe answers *"does it do the thing it was built for."* Deferring the
first while skipping the second rests the cutover on two unrun tests with the only measured cost
number pointing the wrong way. One deferral is a judgement call; two is a hope.

### Deliberately out of scope — record, do not fix

Run 3's seven environment findings (`execution-report.md:134-156`) are outside the Appendix
touch-map. **Their source file is gone**: `.gitignore:83` ignores `.plan-runs/` and only `day2-rev5`
was force-added, so `.plan-runs/workflow-migration/ledger/run3-environment-findings.md` is not on
disk and not in history — the seven-line summary is all that survives. **Transcribe it into a
committed register and file it as a raw idea for the Betting Table**; fix on `main` after cutover.
At least three are live at `c469a6c`: `project-profile.md` is written by prose and validated by
nothing at write time (a run emitted `cli`, not in the enum — `domain.schema.json:2079-2089`);
`ship-report.mjs` reported `rounds_used: 0` for a 1-round run; and the
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` requirement, which is the one exception — it ships as
documentation at B.2, because a truncated run that exits 0 is a shipping hazard, not a backlog item.

---

## 5. Abort & rollback paths

| Trigger | Action |
|---|---|
| Stage 0 check 2 or 3 fails | Migration ends. Worktree branch kept for the record; review §7 fallback postures apply (design decision D2 re-opens). |
| Stage 1/2 verification cannot go green within budget | Stop at the stage boundary; evidence file states what is red and why; nothing merges. Main checkout is untouched throughout — there is nothing to roll back. |
| Post-merge defect in the field | Users pin the previous release (D2). Fixes land forward on `main` only. |
| Benchmark regression at Stage 3 step 5 | The merge waits: a workflow lane that scores below the prose lane on the cell that motivated it has not paid for itself — re-open the review's §7 third falsifier before shipping. |

---

## Appendix — file-touch map by stage

| Path | S1 | S2 | S3 |
|---|---|---|---|
| `skills/tech-lead/workflows/shapeup-build-round.js` | **create** | — | — |
| `skills/tech-lead/workflows/shapeup-run.js` | — | **create** | — |
| `skills/tech-lead/schemas/domain.schema.json` (`RunArgs`/`RunReturn` $defs) | **modify** | — | — |
| `skills/tech-lead/SKILL.md` | modify (BUILD dispatch only) | **rewrite thin** | delete remnant prose |
| `skills/tech-lead/references/{round-protocol,gates,delegation}.md` | — | shrink | delete normative loop sections |
| `hooks/gate-zerowork.mjs` + test fixture | — | — | **modify** |
| `commands/{build,ship}.md` | — | — | modify |
| `tests/structural.mjs` | extend (#45 for workflows) | update for moved prose | update for deletions |
| `CHANGELOG.md`, `docs/upgrading.md` | — | — | modify |
| `docs/migration/stage{0..3}-evidence.md` | s0/s1 | s2 | s3 |

Everything else — all pipeline scripts, all other hooks, all worker skills, both envelope
schemas' shapes — **untouched by design**; a diff outside this map is scope creep and should be
challenged at review.

⟐ **Rev B — the map was breached and the breach is accepted, not silently absorbed.** 24 of the 46
files changed vs. `main` fall outside it, almost all from `af99937`, which merged the day2 ratchet
work onto this branch. `npm test` is green across both bodies of work and the merge is in history;
un-merging costs more than it buys. The consequence is carried forward in §4's CHANGELOG item (b)
instead: the rollback story must state that pinning reverts more than this migration.

---

## ⟐ Amendment log

**Revision D — 2026-08-11, after the probe re-ran.** Author: the Stage A2 run
(`docs/migration/stage-a2-evidence.md` §7). Revision C planned the work; this records what running
it produced, including the part that did not go to plan.

| § | Change | Cause |
|---|---|---|
| Header | Revision D banner: what A2 proved on a live kill, and what it did not close | The probe re-ran and returned FAIL on a different phase |
| A3 | RED → **still RED, cause moved** | ORIENT byte-identical across a SIGKILL; WIRE re-dispatched because its worker escalated and wrote no artifact |
| A6 | 1328 → **1351** | Stage A2's fixtures |
| S2 "Remaining" | A2.1–A2.4 → **Stage A3**: completion must depend on the artifact, not the result record | The defect the probe exposed |

### ⟐ Revision E (2026-08-12) — what changed

| Row | Change | Why |
|---|---|---|
| A3 | still RED → **GREEN** | `kill-resume-probe: PASS`, 4/4 assertions on a live SIGKILL; the instrument self-tested in the failing direction first (`stage-a3-evidence.md` §4.2) |
| S2 "Remaining" | Stage A3 → **none — the ship gate is MET** | `contract-check.mjs` prints GATE MET; Stage B is unblocked |
| S3 | blocked behind S2 → **unblocked, not started** | nothing above it is shut any more |

**Revision C — 2026-08-11, at `5209df7`.** Author: the Stage A run itself
(`docs/migration/stage2-evidence.md`, `docs/migration/execution-report.md` run 4). Revision B
described work to be done; this revision records what doing it produced. Same pinning rule as
Revision B — pin by commit, never by a hash written inside the file.

| § | Change | Cause |
|---|---|---|
| Header | Revision C banner above Revision B's: stage states, 19/4, **S2 ship gate NOT MET** | `stage2-evidence.md` §4 — `kill-resume-probe: FAIL` |
| A3 | **SUBSTANTIALLY GREEN → RED**, with the note that the row's own set-difference wording passed on the failing run | The probe re-dispatched a completed ORIENT phase; build orders carry no scope id, so `orders/` is not an audit trail |
| A5 | **RED → GREEN** | Arm + `tests/structural/17-gate-zerowork-workflow.mjs` shipped in Stage A |
| A6 | In-tree figure 1168 → **1328**; clone figure unchanged at 1120 | Merged day-2 work; A6's clone derivation is still unspent |
| §3 (S2) | Status block: the evidence file exists, the probe ran, it failed | Stage A A.1 and A.2 |
| §6 Stage A | Marked executed and **superseded by `stage-a2-plan.md`**; Stage B now depends on A2's G1–G6 | The gate moved to the stage that fixes the defect |
| — | `status-review-2026-08-10.md` demoted to historical snapshot; `docs/migration/README.md` added as the single current position | Nine documents written at four moments needed one landing page |

**Revision B — 2026-08-10, at `c469a6c`.** Author: architecture review
(`docs/migration/status-review-2026-08-10.md`). Revision A's sha256 `949dab98…` remains the value in
`execution-contract.md`; that contract records what was executed across runs 1–3 and is not updated
here. **A resuming executor pins revision B by commit, not by a hash written inside the file** — a
sha256 recorded in the document it hashes cannot be correct. Use
`git log -1 --format=%H -- docs/workflow_migration_plan.md`, then
`shasum -a 256 docs/workflow_migration_plan.md` against that revision. Changes, each with its cause:

| § | Change | Cause |
|---|---|---|
| Header | Status banner: stage states, honest row count, A7 blocked | 23 contract rows re-executed at `c469a6c` |
| A4 | Restated — workflows are the only normative home **for scoped specs**; tiny/pre-scope lanes keep prose | `SKILL.md:50-55` + `round-protocol.md:11-22` deliberately preserved that lane in S2 |
| A5, A6 | Current state annotated | Hook arm absent; clone count last derived at `7c1b15e` |
| A7 | Gate → **deferred obligation with a named trigger** | `s3-feasibility.mjs` C1/C2/C3 NO; `8fe70bc` closed the search |
| Acceptance | Two false-passing rows named; the `kill\|resume` row flagged as satisfiable by prose about an absence | `grep -qi pin` matches the 1.6.2 entry; `grep -rqli gate-zerowork tests/` matches 3 pre-existing files |
| §0 | Two-checkout premise marked historical | `git worktree list` — one checkout, different machine than the plan's paths |
| §3 (S2) | Status block: what is proven, what was never run, the two execution-found defects | `execution-report.md:32-125` |
| §4 step 1 | **Superseded** — do not delete `round-protocol.md`'s loop | Deleting it removes the only normative home of a lane `SKILL.md` still routes to |
| §4 step 2 | Reframed as a correctness repair | `SKILL.md:12-14` documents an arm `hooks/gate-zerowork.mjs:66,69-74` does not implement |
| §4 step 4 | Three CHANGELOG/upgrading additions | Lane wording; day2 blast radius; the headless-truncation hazard |
| §4 step 5 | Marked blocked; lookalike rebuild forbidden | Different instrument = the pooling error day2 refuses |
| §6 (new) | Stage A / Stage B / the C1–C2 fork, costed | The decision the review was asked to unblock |
| Appendix | Breach of the touch-map acknowledged and its consequence routed to §4(b) | `git diff --name-only main...HEAD` — 24 files outside |
