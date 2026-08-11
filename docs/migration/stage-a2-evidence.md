# Stage A2 evidence — the fast-forward gets a seam, and every courier write gets a reader

**Plan:** `docs/migration/stage-a2-plan.md` · **Stage:** closes S2's ship gate, which Stage A opened
and failed (`stage2-evidence.md` §4, `kill-resume-probe: FAIL`).
**Executed:** 2026-08-11, branch `feat/workflow-orchestrator`, from `5209df7`.
**Hard rule (unchanged):** every stage exit is an artifact on disk, never a claim.

```
kill-resume-probe: FAIL
```

**That line is the position, and it is a stop.** A2.1, A2.2 and A2.3 are complete and
mutation-verified, and the probe was re-run on 2026-08-11 (§7). **The defect Stage A found is
fixed and proven fixed on a live ungraceful kill — ORIENT survived byte-identical.** But a
*different* completed phase was re-dispatched, for a cause outside the resume logic, and the
assertion as written does not pass. Per the plan's own rule — *"If it fails again, stop again"* —
**S2's ship gate is NOT MET and Stage B does not start.**

The rule is worth more than the patch here. The assertion could be narrowed to make this run green
(WIRE's re-dispatch is arguably correct behaviour, §7.3), and narrowing an assertion so your own
change passes is the exact move this branch exists to refuse. The status line stays `FAIL`, the
gate stays shut, and the next stage fixes the cause.

| Gate | Status | Verified by |
|---|---|---|
| **G1** — the derivation is a script, not a string | **MET** | `skills/tech-lead/scripts/resume-state.mjs` exists; the inline probe blob is gone from `shapeup-run.js` |
| **G2** — ORIENT's skip is artifact-gated | **MET** | behavioural: a planted tree with `status: orienting` **and** a complete `orient/` derives `next_phase: build` (§2, check a) |
| **G3** — no courier result is discarded | **MET** | `16-workflows.mjs` arm (d) over every workflow script; suite 1328 → **1351** |
| **G4** — the resume fixture is its own file, all four phases | **MET** | `tests/structural/18-resume-state.mjs`, 21 checks; mutation transcript §3 |
| **G5** — every contract row is falsifiable | **MET, with its limits named** | `tools/contract-check.mjs --mutate`: **14/14** mutatable rows go red; 9 rows are not generically mutatable and each says why (§4) |
| **G6** — the probe passes | **NOT MET** — re-run 2026-08-11, `kill-resume-probe: FAIL` | §7. 2 of 4 assertions PASS; the 2 that fail do so on WIRE, whose worker escalated and wrote no artifact |
| **G7** — the zero-work sentence has one reading | **MET** | `SKILL.md` now states the predicate (*reached the orchestrator ∧ no receipt*) rather than "neither … NOR …" |

---

## 1. What shipped

### A2.1 — `skills/tech-lead/scripts/resume-state.mjs`

The fast-forward derivation, promoted out of a `node --input-type=module -e "…"` blob inside
`shapeup-run.js`. It emits the facts the inline probe already produced, plus **`has_orient_artifacts`**
(ORIENT's four artifacts, per `skills/orient/SKILL.md` §Outputs) and a derived `next_phase`. Its
contract is registered centrally as `$defs/ResumeState` in `domain.schema.json`, like every other
cross-boundary record.

It also owns the two writes that had no reader — `--set-status` and `--set-active-scope` — and both
read their own result back before reporting success. Three consequences, all of them the point:

1. **The derivation is testable.** A Workflow script has no `import` and takes `args` as a runtime
   global; while the logic lived there, no fixture could reach it, which is why a defect that
   re-ran an entire phase survived three runs and a status review.
2. **It matches the permission grant.** `Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/:*)`
   covers it; an inline `node -e` matched no entry and passed only at the classifier's discretion
   (run-3 environment finding #5, closed as a side effect).
3. **It removes the largest path-literal blob from a workflow script**, which is the discipline
   `tests/structural/16-workflows.mjs` exists to police.

### A2.2 — the two defects

- **ORIENT gates on artifacts.** `shapeup-run.js` reads `facts.has_orient_artifacts`, matching WIRE
  (`has_wiring_map`) and MAP SCOPES (`scope_files`). The comment above that branch has described
  this since it was written; the code now does it.
- **`status` survives, and stops deciding anything.** The enumeration the plan asked for
  (§6 decision 1) came back with live readers: `run-snapshot.mjs` and `hooks/anti-rationalization.mjs`
  both hold a `MID_RUN` set over its values to tell a run in flight from a finished one. So the
  field stays — as bookkeeping. **No phase decision reads it**, and `18-resume-state.mjs` asserts
  that all six ledger statuses derive the same phase from the same artifacts.
- **No courier write is discarded.** `setRunStatus` and `writeActiveScope` now report their own
  outcome. The policy follows the architecture rather than one blanket rule: a failed **status**
  write is logged and the run continues (resume no longer depends on it); a failed **substrate
  pointer** write aborts the run, because it fails toward guarding the *wrong* scope rather than
  toward guarding none — `hooks/sandbox-guard.mjs` reads that pointer.

### The class the audit found on the way — and it was bigger than the two instances

Auditing "which courier results are dropped" turned up a third case that no plan named: **every
`ingest-result.mjs` call in both workflow scripts discarded its outcome.** That is the SINGLE WRITER
of the board, the discovery ledger and the verdict record. A failed ingest left shared state
describing work that never landed while the pipeline proceeded as though it had — a green board
over an unapplied result.

Closed at every call site, with the same architecture-shaped policy the dead-worker rule already
uses: a PHASE ingest aborts with the phase named; a BUILD-attempt ingest is a spent attempt (the
attempt budget is the instrument for exactly that); a QA ingest is logged and the run ships, because
QA is a level-up, not a gate. `git checkout` for branch-per-scope aborts, for the same reason the
pointer does.

### A2.3 — the mechanisms

- **`tests/structural/18-resume-state.mjs`** — 21 checks over a planted tree: the stale-status case
  that is G2, every phase boundary in order, the partial-`orient/` cases, all six statuses deriving
  the same phase, resolved scope paths, and both writes' success *and* refusal arms.
- **`tests/structural/16-workflows.mjs` arm (d)** — no `mech`/`mechNode`/`ingest`/`compile`/
  `writeActiveScope` call may discard its value, in any workflow script. Closes the class, not the
  instance.
- **`tools/contract-check.mjs`** — executes the acceptance rows, prints **the gate first and the
  count second**, and exits non-zero when the gate is unmet however many rows are green. `--mutate`
  is G5.
- **A build order's id now carries its scope** (`compile-order.mjs`), with a regression check in
  `05-tech-lead.mjs`. See §5 — this was an instrument defect, not an unrelated one.

---

## 2. G2, as a single assertion

The old predicate was `facts.status === null || facts.status === "orienting"`. The tree below is the
one the kill/resume probe produced: a ledger pinned at `orienting`, and a complete `orient/`.

```
.shapeup/<slug>/harness-run.md      status: orienting
.shapeup/<slug>/orient/             code-surface.md · discovered-seed.md · hill-signal.md · spike-*.md
shapeup/<slug>/wiring-map.md        present
shapeup/<slug>/scopes/              SC-1.md · SC-2.md
```

```json
{"status":"orienting","has_orient_artifacts":true,"has_wiring_map":true,"next_phase":"build"}
```

Old predicate: re-dispatch ORIENT. New predicate: resume at BUILD. That difference is the whole of
Stage A2's correctness claim, and it is one line of a fixture that goes red the moment either half
regresses.

---

## 3. Mutation transcript — the fixtures, proven able to fail

Every check was run against a deliberately broken tree. Two mutations **survived**, which is the
most useful thing in this section: both were checks that only ever exercised a happy path, and both
caused a code change rather than a note.

| # | Mutation | Result |
|---|---|---|
| A | `shapeup-run.js` gates ORIENT on stored status again (the original defect) | **RED** — 2 checks |
| B | `nextPhase()` stops testing ORIENT's artifacts | **RED** — 4 checks |
| C | `--set-status` stops refusing a run with no ledger (the silent no-op) | **RED** |
| D | `hasOrientArtifacts()` no longer requires a spike file | **RED** |
| E | the substrate pointer stops reading itself back | **SURVIVED** → fixture rewritten, see below |
| E′ | the pointer write throws instead of reporting failure as data | **RED** |
| F | scope contracts report bare ids instead of resolved paths | **RED** |
| G | the ledger write stops reporting a write it could not perform | **SURVIVED** → fixture rewritten |
| G′ | the ledger write reports success for a write it could not perform | **RED** |
| H | one `ingest` goes back to discarding its outcome | **RED** — arm (d) names the file and line |
| I | the substrate pointer write goes back to fire-and-forget | **RED** — arm (d) |
| J | a build order's id drops its scope | **RED** |

**What E and G cost, stated plainly.** The first version of the two write checks asserted only that
a successful write succeeds. Deleting the read-back and deleting the failure branch both left every
assertion green — so the checks were, at that moment, exactly the kind of row this stage exists to
abolish. The fix was not to reword them. Both writes now report an unwritable target as an outcome
record (exit 3 + `reason`) instead of throwing, and the fixture drives real unwritable trees: a
regular file where the local root's directory must go, and a `chmod 444` ledger. The read-only case
reports itself as skipped if the filesystem or user does not enforce the mode bit, rather than
passing on a mutation that never happened.

---

## 4. G5 — the contract's own rows, and what cannot be mutated generically

`node tools/contract-check.mjs --mutate`, 2026-08-11:

```
GATE NOT MET — S2 ship gate — kill/resume probe: FAIL
19 PASS / 4 RED
Falsifiability (G5) — 14/14 mutatable rows went red under mutation
```

The harness caught its own first version. It began with one mutation — *empty the file this row
cites* — and reported four `test -f` rows as "cannot fail", which was **the harness being wrong, not
the rows**: emptying a file whose existence is all a row checks proves nothing. It now applies three
(empty / remove / grow past a line-count threshold) and names which one killed each row.

Nine rows are not generically mutatable, and each says why rather than being skipped silently:

| Rows | Why |
|---|---|
| 3 × `npm test` | runs the whole suite; breaking one file proves nothing about the row |
| 2 × negative rows (`! grep …`) | breaking their file makes them pass *harder*. Falsifying them means inserting the text they forbid, which takes each row's own intent |
| 4 × S3 rows | currently RED — there is no pass to falsify. They become mutatable when Stage B lands the work |

---

## 5. The order-id change, and why it belongs to this stage

`compile-order.mjs` named a build order `r<round>-a<attempt>` with no scope id, so in a multi-scope
round each scope's order overwrote the previous one on disk. That is why the migration contract's
own row — *"`orders/` minus `results/` is empty before it proceeds"* — **passed on the failing
probe**: scope 2's order had overwritten scope 1's, which already had a result.

A row that reads green on the exact failure it exists to catch is an instrument defect, and
instrument defects are this stage's subject — which is what makes this in-scope rather than scope
creep (`stage-a2-plan.md` §6, decision 5, taken 2026-08-11). Build orders are now addressed
`<scope>-r<round>-a<attempt>.json`, matching what `t0-verify.mjs`'s verdict artifacts have always
done. The id keeps its `<slug>/<suffix>` shape — every consumer splits on the first `/` — and the
scope segment is lowercased and stripped to the character class `work-order.schema.json` allows, so
a naming improvement can never produce an order that fails its own schema.

---

## 7. The probe, re-run — 2026-08-11

**Rig.** Same shape as Stage A (`stage2-evidence.md` §4), rebuilt because its scripts lived on the
other machine. Scratch project outside the checkout; the plugin installed from `npm pack` of this
branch as a local marketplace and **verified by sha256 against the worktree, file by file**, before
anything ran. L0 by hand (`init-run.mjs --slug todo-kill --auto-level unattended --gate-answers ci
--max-rounds 2` + `project-profile.md`), so the two legs differ in exactly one respect: the state on
disk. One `launch.sh`, called twice, same args both times.

**The instrument was self-tested first, in three directions**: a clean resume must PASS, Stage A's
recorded failure must FAIL, and a rebuilt green scope with a rewritten citation must FAIL. Fed
Stage A's own numbers it reproduces that run's signature exactly (`7dd5aef9…` → `359f6650…`). A
probe that has never been seen to fail is not evidence.

**Leg 1.** Ran ORIENT → WIRE → MAP SCOPES → L1b → BUILD. `map-scopes` produced **five** scope
contracts rather than the two the plan sketched — the assertions are set operations, so this makes
the probe harder, not different. Killed with `SIGKILL` at the specified window: **one scope
T0-green (`SC-task-creation@r1`), one order in flight (`sc-task-listing-r1-a1.json`, no result)**.
Exit 137, nothing survived, no `RunReturn`, no chance to flush state.

**Leg 2.** Fresh session, same script, same args. It **shipped**:

```json
{"status":"shipped","verdict":"pass","rounds_used":2,
 "dims_not_evaluated":["security","performance"],
 "qa_findings":7,"report":"shapeup/todo-kill/REPORT.md"}
```

Round 1's EVAL returned **FAIL**; the run looped into a fix round, rebuilt all five scopes, and
round 2's EVAL returned **PASS**. 18 orders / 18 results, 10 T0 verdicts, all green. A run killed
mid-BUILD carried itself to a shipped feature.

### 7.1 The four assertions

| # | assertion | outcome |
|---|---|---|
| 1 | no completed PHASE order was re-dispatched (5 completed at kill time) | **FAIL** — `wire.json` `46f40cbe…` → `e924248d…` |
| 1b | no result for a completed phase was re-ingested (5 checked) | **FAIL** — `wire.json` `e79abe34…` → `b8775d79…` |
| 2 | no scope T0-green at kill time was rebuilt (1 green pair at kill) | **PASS** |
| 3 | every pre-kill T0 verdict survives byte-identical (1 found) | **PASS** |

**Four of the five completed phases survived untouched**, and the fifth is the subject of §7.3:

```
analyze.json                  order IDENTICAL · result IDENTICAL
map-scopes.json               order IDENTICAL · result IDENTICAL
orient.json                   order IDENTICAL · result IDENTICAL      <- the Stage A defect
sc-task-creation-r1-a1.json   order IDENTICAL · result IDENTICAL
wire.json                     order REWRITTEN · result REWRITTEN
```

### 7.2 What this proves about A2's three fixes

All three are confirmed on a live ungraceful kill, against the Stage A run's own failures:

| Stage A behaviour | This run |
|---|---|
| **ORIENT re-ran from scratch** — three artifacts rewritten, a spike added, the ledger and two task files mutated | **`orient.json` and `results/orient.json` byte-identical.** The phase was not re-dispatched |
| **`status` never left `orienting`** across two legs and 46 agents | **Moved: `orienting` → `building` → `evaluating`** |
| **`.shapeup/active-scope` still named scope 1** while scope 2 was built, pointing `sandbox-guard` at the wrong substrate | **Named `SC-task-listing` — the scope actually in flight — at the moment of the kill** |
| **Build orders collided** (`r1-a1.json` overwritten per scope), so `orders/` was not an audit trail and the contract row read green on a failing run | **10 distinct scope-named build orders** (5 scopes × 2 rounds), no collisions |

### 7.3 Why WIRE was re-dispatched, and why that is not the resume logic failing

`results/wire.json` reads `status: "escalated"`, `artifacts: []`, and
**`shapeup/todo-kill/wiring-map.md` does not exist** — not after leg 1, not after leg 2.
`solution-architect` escalated instead of writing the wiring map, and reported that honestly.

So the fast-forward read `has_wiring_map: false`, found no artifact, and re-dispatched the phase.
**That is the artifact-gated rule working — the same rule that now protects ORIENT.** By the
harness's own doctrine (*"progress is derived, never claimed"*) WIRE was never complete: the result
record was a claim, the artifact is the truth, and the artifact was absent.

The defect is one layer up, and it is new:

> **A phase whose worker ESCALATES is recorded as complete.** `shapeup-run.js` ingests the result
> and moves to the next gate without inspecting `status`. The workflow documents that it does not
> adjudicate mid-round ESCALATE (advisor-protocol is the prose path) — but not adjudicating is not
> the same as not noticing. Because the escalated phase writes no artifact, it is then
> **re-dispatched on every subsequent launch, forever**, and each relaunch escalates again. It is
> invisible inside a single leg and only appears across a resume, which is why three runs and a
> status review never saw it.

This also explains why it did not appear in Stage A: there, ORIENT's status-gated branch swallowed
the whole resume, and the run never got far enough for WIRE's own predicate to matter.

### 7.4 One anomaly, unresolved and not explained away

The run returned `shipped`, and the ledger's final status reads **`evaluating`**, not `shipped`.
The last `setRunStatus(slug, "shipped")` did not land. Two things must be said precisely:

- It is **not** the Stage A failure recurring wholesale — the field moved three times in this run,
  which it never did there.
- I **cannot tell from this rig whether the failure was reported.** The A2.2 code logs a loud
  `RUN STATE —` line when a status write does not take, but a Workflow's `log()` output goes to the
  progress narrator, and `claude -p` stdout carries only the final message: `leg-2.out` is 8 lines
  long. So the absence of a warning here is **not evidence that no warning was emitted**, and I am
  not going to record it as either. What stands is the artifact fact: the write did not take, at
  one call site, on a run whose other status writes did.

## 6. What is NOT demonstrated

Stated plainly rather than left to inference:

- **The probe FAILS.** `kill-resume-probe: FAIL`. S2's ship gate is not met and Stage B does not
  start, even though the cause is not the defect this stage fixed.
- **The escalated-phase defect (§7.3) is diagnosed, not fixed.** It needs its own stage.
- **Why the final status write did not land is not established** (§7.4), and the rig cannot see the
  workflow's own log channel.
- **The probe used one kill point.** A kill during EVAL, during QA, or between rounds is still
  untested; so is a second consecutive kill.
- **`checkScopeGreen` is still an inline `node -e` blob** in `shapeup-run.js`. It was left there
  deliberately (`stage-a2-plan.md` §6, decision 2): its result is consumed at its call site, so it
  is not the defect class, and absorbing it would have widened the diff on a branch frozen at
  Stage B.
- **Why the runtime produced no agent** for the two fire-and-forget `mech()` calls is still not
  established. Stage A did not invent a mechanism for it and neither does this stage. The finding
  that stands without that answer is the design one, and it is now enforced: a courier write whose
  result nobody reads is indistinguishable from one that succeeded.
