# Stage A3 — a phase completes when its ARTIFACT exists, not when its result says so

**Compiled:** 2026-08-11 at `4f2ca09`, branch `feat/workflow-orchestrator`.
**Depends on:** Stage A2 (`aad7807`) · **Blocks:** Stage B of `docs/migration/remaining-stages-plan.md`.
**Evidence base:** `docs/migration/stage-a2-evidence.md` §7.3 — every claim below traces there or to
a line of code named inline.
**Model floor (D5, unchanged):** every agent in every phase runs on **Sonnet or higher. No Haiku.**
**Hard rule (unchanged):** every stage exit is an artifact on disk, never a claim.

**Position at compile time.** Stage A2 is complete. Its central fix is proven on a live ungraceful
SIGKILL — ORIENT byte-identical across the kill, `status` moving, the substrate pointer tracking the
scope in flight, and the resumed leg carrying a killed run to `shipped`. G1–G5 and G7 are met.
**G6 is not:** `kill-resume-probe: FAIL`, on a phase Stage A2 never touched. This stage exists to
close that and nothing else. It is the third attempt at the same gate, and the rule that put it here
is unchanged: **if the probe fails again, stop again.**

---

## 1. The problem, in two findings that compose

### Finding 1 — the pipeline records an artifact-less phase as complete

`shapeup-run.js` dispatches a phase, ingests its result, and moves to the next gate **without ever
asking whether the phase's artifact now exists**. Every phase block has the same shape
(`:433-452` ORIENT, `:465-481` WIRE, `:498-524` MAP SCOPES):

```
if (!facts.<artifact predicate>) { compile → dispatch → ingestOrAbort → mark dispatched }
```

The predicate is read **once**, before the dispatch, and never again. A worker that returns
`status: "escalated"` with `artifacts: []` — a legitimate outcome its own contract defines
(`work-result.schema.json:11`) — satisfies the ingest, so the run proceeds as though the phase had
landed.

Combined with the artifact-gated fast-forward Stage A2 installed, this produces an unbounded loop:
the phase writes no artifact → the next launch's `resume-state.mjs` finds no artifact → it
re-dispatches → the worker escalates again → forever. Invisible inside one leg; only a resume shows
it. That is exactly what the probe recorded (`stage-a2-evidence.md` §7.1, assertions 1 and 1b).

**The doctrine already says which side is right.** *Progress is derived, never claimed*
(AGENTS.md invariant 2). The result record is the claim; the artifact is the derivation. The
fast-forward reads the artifact. The completion check reads nothing at all.

### Finding 2 — WIRE is dispatched before the spec tree it is contracted to read

This is why the worker escalated, and it is deterministic, not a flake.

| what | where |
|---|---|
| The pipeline's order: ORIENT → L1a → **WIRE** → L1a.5 → **analyze** → map-scopes → L1b | `shapeup-run.js:463`, `:500`, `:512` |
| solution-architect's operation is defined as *"author/refresh the wiring map **after `analyze`**, before `map-scopes`"* | `skills/solution-architect/SKILL.md:43` |
| Its input contract reads `usecases/` for the UCs and the engine each one needs | `SKILL.md:44`, `:55` |
| Its verification checklist: *"Every use case in `usecases/` has exactly one wiring-map entry"* | `SKILL.md:108` |
| `usecases/` is written by **`analyze`** — which the pipeline runs *after* WIRE | `gates.md:161-170` (MAP SCOPES step 1) |
| `init-run.mjs` scaffolds `.shapeup/<slug>/{orders,results,discovery}` + `intake.md` + `harness-run.md` — **no spec tree** | `init-run.mjs:297-305` |

So on a greenfield run WIRE is handed a `spec_folder` that contains no use cases, has nothing to
wire, and escalates — **honestly, and on every relaunch, for the same reason**. `solution-architect`
did not misbehave; it was dispatched at a pipeline position its own contract excludes. The two
committed authorities disagree, and `shapeup-run.js` implements the one the worker does not.

*(gates.md numbers WIRE "step 7.5" and MAP SCOPES "step 8" — but step 8 contains **two** dispatches,
`analyze` then `map-scopes`. Placing WIRE between them satisfies gates.md's own gate wording,
*"confirm each UC has a declared seam before slicing"* (`gates.md:151`): the slicer is
`scope-architect`, and it still runs after WIRE.)*

### How they compose into the observed failure

Finding 2 makes WIRE produce no artifact. Finding 1 records it complete regardless. The
artifact-gated fast-forward then re-dispatches it on every launch, and probe assertions 1/1b — *no
completed phase order was re-dispatched, no result re-ingested* — go red.

**Both must be fixed, and neither alone is enough.** Fix only Finding 1 and the run stops at WIRE
with a named cause: correct behaviour, but leg 1 never reaches BUILD and the probe has nothing to
grade. Fix only Finding 2 and this one run goes green while the class stays open for every other
phase — the next worker that escalates re-opens it, and nothing on disk would say so.

---

## 2. Acceptance contract

Every row can fail, and every row is mutation-verified — the discipline Stage A2 established
(`stage-a2-evidence.md` §4) and the reason its own instrument was trustworthy.

| # | Criterion | Verified by |
|---|---|---|
| **G1** | The phase post-condition is a **testable predicate**, not an inline check in an unimportable script | `resume-state.mjs --require <phase>` exits non-zero when that phase's artifact is absent, 0 when present; fixture arms in `tests/structural/18-resume-state.mjs` |
| **G2** | **No phase proceeds on an unmet post-condition** | behavioural: a planted tree with a `status: "escalated"` result and no `wiring-map.md` must not read as complete; plus a structural arm over `workflows/*.js` — every phase dispatch is followed by a post-condition branch, the same shape as `16-workflows.mjs` arm (d) |
| **G3** | **WIRE runs after the spec tree exists** | order assertion over `shapeup-run.js`: the `analyze` dispatch precedes the `wire` dispatch; and `nextPhase()` returns `analyze` before `wire` on a tree with orient artifacts and no spec |
| **G4** | The fast-forward knows the phase chain it now drives | `resume-state.mjs` reports `has_spec_tree`; `next_phase` covers **five** phases (orient → analyze → wire → map-scopes → build); the four-phase fixture becomes five |
| **G5** | Every row in this contract is falsifiable | mutation transcript committed to the evidence, one line per row, each showing the row red under its mutation |
| **G6** | **The probe passes** | `kill-resume-probe: PASS` and all four assertions PASS, on a live SIGKILL, graded by an **unchanged** `assert.mjs` |
| **G7** | The rig re-runs as a repeat, not a rebuild | `.plan-runs/wf-a3-probe/seed-project.sh` committed: scratch project + intake + profile + `init-run.mjs`, so leg 0 is scripted rather than "by hand" |

**Ship gate: G6.** G1–G5 are what make G6 mean anything; G7 is what makes the *next* failure cheap.
G6 is graded by an assert file this stage does not touch — see §5.

---

## 3. Sub-stages

### A3.1 — the post-condition (Finding 1)

The completion check and the resume check become **the same predicate, in the same file**. That is
the whole design: two predicates that can disagree is what this stage is here to delete.

- `resume-state.mjs` gains `--require <phase>` (`orient|analyze|wire|map-scopes`): derives the state
  and exits **0** when that phase's artifact predicate holds, **6** when it does not, printing the
  ResumeState either way. No new predicate is written — it reuses `deriveResumeState`.
- `shapeup-run.js`: after each phase's `ingestOrAbort`, call `--require <phase>`. On a non-zero exit
  the run **returns `{status:"aborted", aborted_at:<PHASE>, reason:…}`** naming the phase, the
  missing artifact, and the result's own `status` — one loud stop instead of a silent forever-loop.
  *(Decision D1, §6.)*
- Structural arm: every `dispatch(` for a phase in `workflows/*.js` is followed by a post-condition
  branch, so the next phase added inherits the rule.

### A3.2 — the ordering (Finding 2)

- Move the `analyze` dispatch out of the MapScopes block to **before** WIRE; the phase graph becomes
  ORIENT → L1a → analyze → **WIRE** → L1a.5 → map-scopes → L1b. Gate positions and gate meanings are
  unchanged (§1's note on `gates.md:151`).
- `resume-state.mjs`: add `has_spec_tree` (the spec folder's `usecases/` is non-empty) and extend
  `nextPhase()` to the five-phase chain.
- `trace-lint` moves from L1a.5 to L1b, where `gates.md:154` already says it belongs ("ADVISORY at
  L1b"). Today it runs at `:482`, before any spec exists, so both its arms self-skip and
  `seam_coverage` reports on nothing.
- Amend the two prose authorities to match the code: `gates.md` §WIRE step 2 and AGENTS.md's Phase-3
  table both state the position explicitly (*after `analyze`, before `map-scopes`*), so the next
  reader cannot re-derive the old order.

### A3.3 — the diagnostic (`stage-a2-evidence.md` §7.4)

The run returned `shipped`; the ledger read `evaluating`. The `log()` warning that would have said so
goes to the progress narrator, and `claude -p` stdout carries only the final message — so §7.4 could
not tell whether the failure was reported. Carry state-write failures in the **RunReturn** itself
(`state_warnings[]`, optional, registered in `domain.schema.json`). This does not fix the write; it
makes the next probe run able to *establish* whether it was reported. **Diagnostic, not a gate.**

### A3.4 — the rig

`.plan-runs/wf-a3-probe/`, forked from `wf-a2-probe/` with `assert.mjs` and `snapshot.mjs`
**byte-identical** (comparability with Stage A and A2 is the point), plus the piece A2's rig was
missing:

- `seed-project.sh` — scratch project, `intake.md`, `project-profile.md`, `init-run.mjs --slug
  todo-kill --auto-level unattended --gate-answers ci --max-rounds 2`. A2 did this "by hand"
  (`stage-a2-evidence.md` §7), which is why this re-run is a rebuild rather than a repeat.
- `install-candidate.sh` — `npm pack` → local marketplace at its own version (`1.6.3-a3probe`) →
  **sha256-verify every plugin file against the worktree** before launching. Findings #8 and #10 are
  both live and both silently measure the control if skipped: the workspace must be TRUSTED, and
  `npx shapeup-sdlc init` re-clones the marketplace from GitHub over a local install.

### A3.5 — run it, and record what it says

Two legs, byte-identical args, SIGKILL at the same window Stage A2 used (one scope T0-green, one
build order in flight). Then `docs/migration/stage-a3-evidence.md` carrying the machine-readable
status line **first** — `kill-resume-probe: PASS|FAIL` — the four-assertion table, the mutation
transcript, and a *What is NOT demonstrated* section. `README.md` and `workflow_migration_plan.md`
are amended from it, never ahead of it.

---

## 4. File-touch map

Everything outside this map is scope creep.

| file | change |
|---|---|
| `skills/tech-lead/scripts/resume-state.mjs` | `--require <phase>`, `has_spec_tree`, five-phase `nextPhase` |
| `skills/tech-lead/workflows/shapeup-run.js` | post-condition branch per phase; `analyze` moved before WIRE; trace-lint to L1b |
| `skills/tech-lead/schemas/domain.schema.json` | `ResumeState.has_spec_tree`; `RunReturn.state_warnings` (A3.3) |
| `skills/tech-lead/references/gates.md` · `AGENTS.md` | WIRE's position stated explicitly |
| `tests/structural/18-resume-state.mjs` · `16-workflows.mjs` | G1–G4 arms |
| `tools/contract-check.mjs` · `docs/migration/execution-contract.md` | the S2 row that reads the probe's status line, if G6 changes it |
| `.plan-runs/wf-a3-probe/**` | the rig (A3.4) |
| `docs/migration/stage-a3-evidence.md` · `README.md` · `workflow_migration_plan.md` · `remaining-stages-plan.md` | the record, written from the run |

---

## 5. Guardrails

- **`assert.mjs` is not touched.** The A2 evidence already refused this once: *"narrowing an
  assertion so your own change passes is the exact move this branch exists to refuse."* WIRE's
  re-dispatch was **correct** behaviour under a broken pipeline; the fix is upstream, and the
  assertion stays exactly as strict as it was.
- **`completed_phase_orders` stays `orders ∩ results`** (`snapshot.mjs:55`) — artifact-blind on
  purpose. After A3.1 an escalated phase never reaches that set on a *live* run, because the run
  stops; making the instrument artifact-aware would hide the very state it exists to catch.
- No merge, no tag, no publish. Branch pushes only.
- **If the probe fails a third time, stop a third time** — write the evidence, leave the gate shut,
  and do not start Stage B.

---

## 6. Open decisions — PO's call, not the executor's

| # | decision | options | recommendation |
|---|---|---|---|
| **D1** | What does an unmet post-condition **return**? | (a) always `{status:"aborted", aborted_at:<phase>}` · (b) lane-aware: `paused` in interactive, `aborted` in unattended · (c) a new RunReturn member | **(a)**. It is a true statement of what happened, it is a union member that already exists, and it needs no adjudication machinery. (b) reads better but a relaunch after the pause re-dispatches the same order to the same worker, which escalates again — the answer would have to persist somewhere, and that is advisor-protocol, explicitly out of scope for this file (`shapeup-run.js:32-40`) |
| **D2** | How is the ordering contradiction resolved? | (a) move `analyze` before WIRE · (b) keep the order and rewrite solution-architect's contract to wire from the pitch + orient artifacts · (c) skip WIRE when no spec tree exists | **(a)**. It is the reading both the worker contract and gates.md's gate wording already carry, and it is ~15 lines of movement in one file. (b) rewrites a craft contract to accommodate a pipeline bug and makes the wiring map a guess. (c) re-introduces "complete because we decided not to run it" |
| **D3** | Is A3.3 (`state_warnings`) in this stage or deferred? | in · deferred | **in**. It is small, it is the only way the next probe run can answer §7.4, and §7.4 is currently recorded as *unexplained* — a second unexplained recurrence would be worse |
| **D4** | Kill point for the probe | same window as A2 · a new one (mid-EVAL / between rounds) | **same window**. A PASS is only meaningful against A2's FAIL if the two runs are comparable. New windows are Stage B's breadth work, and `stage-a2-evidence.md` §6 already records them as untested |

---

## 7. Cost and sequence

| step | wall clock | external $ |
|---|---|---|
| A3.1 + A3.2 + A3.3 + tests | ~2–3 h | $0 |
| A3.4 rig (seed + install + hash verify) | ~30 min | $0 |
| A3.5 two legs + kill + assert + evidence | ~1–1.5 h | dev-run tokens (2 legs × ~40–50 agents, Sonnet workers) |

No external spend. The A7 benchmark ($40–60) is Stage C's and does not launch here.
