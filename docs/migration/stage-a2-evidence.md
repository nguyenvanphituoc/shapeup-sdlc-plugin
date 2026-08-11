# Stage A2 evidence — the fast-forward gets a seam, and every courier write gets a reader

**Plan:** `docs/migration/stage-a2-plan.md` · **Stage:** closes S2's ship gate, which Stage A opened
and failed (`stage2-evidence.md` §4, `kill-resume-probe: FAIL`).
**Executed:** 2026-08-11, branch `feat/workflow-orchestrator`, from `5209df7`.
**Hard rule (unchanged):** every stage exit is an artifact on disk, never a claim.

```
kill-resume-probe: NOT-RUN
```

**That line is the position.** A2.1, A2.2 and A2.3 are complete and mutation-verified. **G6 — the
re-run of the probe — has not happened, so S2's ship gate is still NOT MET and Stage B still does
not start.** Nothing below changes that, and the row count in `execution-contract.md` does not
either: `node tools/contract-check.mjs` now prints the gate before the count precisely so this
cannot be misread again.

| Gate | Status | Verified by |
|---|---|---|
| **G1** — the derivation is a script, not a string | **MET** | `skills/tech-lead/scripts/resume-state.mjs` exists; the inline probe blob is gone from `shapeup-run.js` |
| **G2** — ORIENT's skip is artifact-gated | **MET** | behavioural: a planted tree with `status: orienting` **and** a complete `orient/` derives `next_phase: build` (§2, check a) |
| **G3** — no courier result is discarded | **MET** | `16-workflows.mjs` arm (d) over every workflow script; suite 1328 → **1351** |
| **G4** — the resume fixture is its own file, all four phases | **MET** | `tests/structural/18-resume-state.mjs`, 21 checks; mutation transcript §3 |
| **G5** — every contract row is falsifiable | **MET, with its limits named** | `tools/contract-check.mjs --mutate`: **14/14** mutatable rows go red; 9 rows are not generically mutatable and each says why (§4) |
| **G6** — the probe passes | **NOT RUN** | — |
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

## 6. What is NOT demonstrated

Stated plainly rather than left to inference:

- **The kill/resume probe has not been re-run.** `kill-resume-probe: NOT-RUN` at the top of this
  file is the machine-readable form of that. S2's ship gate is not met.
- **No live run has exercised any of this.** Every claim here is from unit fixtures and from
  executing the contract rows. The defect Stage A found was reachable *only* by running the thing —
  that is the entire lesson, and it applies to this stage's fix as much as to the code it fixes.
- **`checkScopeGreen` is still an inline `node -e` blob** in `shapeup-run.js`. It was left there
  deliberately (`stage-a2-plan.md` §6, decision 2): its result is consumed at its call site, so it
  is not the defect class, and absorbing it would have widened the diff on a branch frozen at
  Stage B.
- **Why the runtime produced no agent** for the two fire-and-forget `mech()` calls is still not
  established. Stage A did not invent a mechanism for it and neither does this stage. The finding
  that stands without that answer is the design one, and it is now enforced: a courier write whose
  result nobody reads is indistinguishable from one that succeeded.
