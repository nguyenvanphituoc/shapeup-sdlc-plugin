# Stage A3 evidence — a phase completes when its artifact exists

**Plan:** `docs/migration/stage-a3-plan.md` · **Stage:** closes S2's ship gate, which Stage A opened
and failed, and which Stage A2 fixed one layer down and failed again.
**Executed:** 2026-08-11, branch `feat/workflow-orchestrator`, from `4f2ca09`.
**Hard rule (unchanged):** every stage exit is an artifact on disk, never a claim.

```
kill-resume-probe: NOT-RUN
```

**That line is the position.** It is written here *before* the probe returns, deliberately: the
instrument's own vocabulary carries `NOT-RUN` so that "not run" is **recorded**, never inferred from
a missing file. It is replaced by `PASS` or `FAIL` when the two legs and the assertions have
actually run — and if this file is ever read with `NOT-RUN` still in it, that is the true statement
of where the stage got to.

| Gate | Status | Verified by |
|---|---|---|
| **G1** — the post-condition is a testable predicate | **MET** | `resume-state.mjs --require <phase>`; exit 6 when the artifact is absent; fixture arms in `tests/structural/18-resume-state.mjs` |
| **G2** — no phase proceeds on an unmet post-condition | **MET** | behavioural: a planted tree with an *escalated* `wire` result and no `wiring-map.md` reads as incomplete; plus a source arm over all four phases |
| **G3** — WIRE runs after the spec tree exists | **MET** | the `analyze` order is compiled before the `wire` order; `nextPhase()` returns `analyze` before `wire` |
| **G4** — the fast-forward knows the phase chain | **MET** | `has_spec_tree` travels in the ResumeState; five-phase `next_phase`; boundary arms for each |
| **G5** — every row is falsifiable | **MET** | mutation transcript, §3 — five rows, five mutations, five reds, tree green afterwards |
| **G6** — **the probe passes** | **PENDING** | §4 |
| **G7** — the rig re-runs as a repeat | **MET** | `.plan-runs/wf-a3-probe/` — `install-candidate.sh` + `seed-project.sh` write every input the run reads |
| **G8** — no ingest is aimed by a worker's reported path | **MET** | structural arm `16-workflows.mjs` (e); found by leg 1a, which died on it |

---

## 1. What shipped

### A3.1 — the post-condition (`resume-state.mjs --require <phase>`)

The completion check and the resume check are now **the same predicate in the same file**, keyed by
one table (`PHASE_ARTIFACT`). `--require` derives the state and exits 6 when the named phase's
artifact is not on disk, printing the whole ResumeState either way. `shapeup-run.js` calls it after
every phase's ingest and returns `{status:"aborted", aborted_at:<PHASE>}` when it refuses (D1).

Two predicates that can disagree about "is this phase done" is the defect class itself, not a
safeguard against it — so there is only one.

### A3.2 — the ordering (ANALYZE before WIRE)

The phase chain is now ORIENT → L1a → **ANALYZE** → **WIRE** → L1a.5 → MAP SCOPES → L1b.
`solution-architect`'s own input contract defines `wire` as *"after `analyze`, before
`map-scopes`"* and writes one wiring-map entry per use case (`SKILL.md:43-44`, `:108`); `analyze`
writes those use cases; `init-run.mjs` scaffolds no spec tree. The pipeline dispatched WIRE first,
so on a greenfield run it was handed an empty spec folder — which is why A2's probe saw
`solution-architect` escalate, write nothing, and be re-dispatched on every relaunch.

`trace-lint` moved with it, to L1b, where `gates.md:154` already said it belonged. At L1a.5 it ran
before any spec existed, so both of its arms self-skipped and the seam-coverage figure reported on
nothing. `gates.md` and `AGENTS.md` now state the position so the two lanes cannot drift.

### A3.3 — `state_warnings[]` on the RunReturn

A lost bookkeeping write now travels on the one channel a headless launch preserves. §7.4 of the A2
evidence could not tell a missing warning from an unread one, because `log()` goes to the progress
narrator and `claude -p` stdout carries only the final message.

### A3.6 — the result path is the order's, not the worker's

Found by running it (§2). Every ingest is now aimed at `results/<suffix>.json` derived from the
order that produced it; the worker's `result_path` remains as a cross-check that logs when it
disagrees. The dispatch prompt also states the path, because the WorkOrder does not — filed as
**HD-006** in the committed defect register.

---

## 2. What running it found, before the probe could even start

Three environment findings and one defect, all measured today, none visible from reading the code.

| # | finding | how it fails |
|---|---|---|
| **12** | **Declaring a marketplace in `.claude/settings.json` is not installing it** | `claude -p` in the seeded project saw **zero** `shapeup-sdlc-plugin` skills. Every `Skill(...)` dispatch the workflow makes would have failed mid-leg, for a reason that looks nothing like its cause. `claude plugin marketplace add` + `claude plugin install` are now in `seed-project.sh` |
| **13** | **`claude plugin install` is a no-op when the cache already holds that version** | A rebuilt candidate installs "successfully" and the run keeps executing the **previous** build. Caught only because `seed-project.sh` hashes the resolved tree against the candidate; `install-candidate.sh` now purges the cached version first |
| **14** | **A WorkOrder never names its result file** (HD-006) | Two consecutive ORIENT dispatches, same order: one wrote the result and reported a *directory*; the next wrote its four artifacts and *no result at all*. Both aborted the run at phase one after doing the craft correctly |

Finding 14 is the one worth reading twice. The failures look unrelated — `EISDIR` then `ENOENT` —
and they are the same missing declaration seen from two angles.

---

## 3. The mutation transcript (G5)

Every acceptance row, mutated at the fact it asserts, must go red. Five did; the tree is green at
**1363 checks** afterwards.

```
G1 | --require always exits 0 (the post-condition cannot refuse)
   | RED: ✗ --require wire accepted an escalated phase with no artifact: exit 0
G2 | WIRE dispatches without checking its post-condition
   | RED: ✗ these phases dispatch without checking that they produced anything: wire
G3 | the two operation strings are swapped, so the wire order is compiled first
   | RED: ✗ the analyze order is not compiled before the wire order (analyze@14349, wire@13343)
G4 | hasSpecTree always true (the spec tree is assumed, not derived)
   | RED: ✗ with orient complete, no spec tree the derivation resumed at "wire", expected "analyze"
G8 | one ingest is aimed by the worker's reported result_path again
   | RED: ✗ a workflow script ingests the path a worker CLAIMED it wrote, rather than the one its
   |      order determines
```

G6 is not mutatable — it is a live run, and §4 is its record.

**One honest note about this transcript's own method.** The G8 mutation was reverted with
`git checkout --`, which also reverted the *uncommitted fix underneath it*, and the next commit
captured the reverted file. `npm test` named it immediately (arm (e) red at 1362/1363) — the arm
doing its job on its first day, against the person who wrote it.

---

## 4. The probe

*(pending — this section is written from the run, never ahead of it)*

---

## 5. What is NOT demonstrated

Stated plainly rather than left to inference:

- **HD-006 is worked around, not fixed.** `result_path` belongs in the WorkOrder, in every
  operation's `substrate.allowed`, read rather than derived. That touches every worker's input
  contract and is filed as a bet.
- **The escalation path itself is unchanged.** An escalated phase now stops the run with its cause
  named; nothing adjudicates it. `advisor-protocol` remains the prose path, exactly as
  `shapeup-run.js`'s banner has always said.
- **One kill point.** A kill during EVAL, during QA, or between rounds is still untested, and so is
  a second consecutive kill — unchanged from A2 §6, and deliberately so (D4: a PASS only means
  something against A2's FAIL if the two runs are comparable).
- **`checkScopeGreen` is still an inline `node -e` blob** in `shapeup-run.js`, for the reason A2
  gave (its result is consumed at its call site, so it is not the defect class).
- **Why the A2 run's final status write did not land is still not established.** `state_warnings[]`
  makes the next occurrence visible; it does not explain the last one.
