# Migration plan — extract the tech-lead orchestrator into a Workflow, executed in an isolated worktree

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
| A3 | An **interactive** run completes with ≥2 gates crossed via pause → PO decision → relaunch fast-forward, and nothing re-dispatched (orders/results set difference empty on relaunch) | run transcript + `docs/migration/stage2-evidence.md` |
| A4 | The prose runbook is deleted; `SKILL.md` ≤ ~150 lines; the workflow scripts are the loop's only normative home | `git diff --stat` vs `main`; grep shows no round/attempt loop prose in `SKILL.md` |
| A5 | `gate-zerowork.mjs` blocks a session that launches the skill and never invokes the Workflow (new predicate arm), and still defers on non-harness sessions | new unit fixture in `tests/` + `npm test` |
| A6 | `npm test` green in the worktree AND in a fresh `git clone --local` of the branch (the repo's own clone discipline) | clone + `npm test` output pasted in stage evidence |
| A7 | Benchmark F2 cell, **model-matched on Sonnet 5**: candidate arm (workflow lane, n=3) vs control arm (v1.6.x prose lane, n=3). Absolute bar: 3× 14/14 oracle, 0 narrated, receipts present. Comparative bar: candidate ≥ control on acceptance, ≤ control on wall clock. The historical Haiku rows are NOT the baseline — models must match | `sdd-harness-bench` run log referenced by commit + log path, both arms |

If A1 fails → the migration does not start (D1). If A2/A3 cannot both go green → the cutover
release does not ship (D2's ship gate) and the branch stays unmerged.

---

## 0. Worktree setup — one-time, ~10 min

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

---

## 4. Stage 3 — cutover, deletion, detectors, benchmark · ~1 day + benchmark cost

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
6. Fresh-clone `npm test` (A6), then merge `feat/workflow-orchestrator` → `main` as the cutover
   release; `git worktree remove` after the tag.

**Exit artifact:** `docs/migration/stage3-evidence.md` + the release tag.

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
