# Stage A3 evidence — a phase completes when its artifact exists

**Plan:** `docs/migration/stage-a3-plan.md` · **Stage:** closes S2's ship gate, which Stage A opened
and failed, and which Stage A2 fixed one layer down and failed again.
**Executed:** 2026-08-11, branch `feat/workflow-orchestrator`, from `4f2ca09`.
**Hard rule (unchanged):** every stage exit is an artifact on disk, never a claim.

```
kill-resume-probe: PASS
```

**That line is the position, and it is the first time it has read PASS.** All four assertions pass,
on a live ungraceful `SIGKILL` mid-BUILD, graded by an `assert.mjs` **byte-identical** to the one
that returned FAIL for Stage A and again for Stage A2 (§4.2 shows it still returning that FAIL when
fed A2's own snapshots). S2's ship gate is met.

*(This line was committed reading `NOT-RUN` before the run — the instrument's vocabulary carries
that value so "not run" is recorded rather than inferred from a missing file. It was replaced from
the run's output, not ahead of it.)*

| Gate | Status | Verified by |
|---|---|---|
| **G1** — the post-condition is a testable predicate | **MET** | `resume-state.mjs --require <phase>`; exit 6 when the artifact is absent; fixture arms in `tests/structural/18-resume-state.mjs` |
| **G2** — no phase proceeds on an unmet post-condition | **MET** | behavioural: a planted tree with an *escalated* `wire` result and no `wiring-map.md` reads as incomplete; plus a source arm over all four phases |
| **G3** — WIRE runs after the spec tree exists | **MET** | the `analyze` order is compiled before the `wire` order; `nextPhase()` returns `analyze` before `wire` |
| **G4** — the fast-forward knows the phase chain | **MET** | `has_spec_tree` travels in the ResumeState; five-phase `next_phase`; boundary arms for each |
| **G5** — every row is falsifiable | **MET** | mutation transcript, §3 — five rows, five mutations, five reds, tree green afterwards |
| **G6** — **the probe passes** | **MET** — `kill-resume-probe: PASS`, 4/4 assertions | §4 |
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

## 4. The probe — 2026-08-12

**Rig.** `.plan-runs/wf-a3-probe/`, forked from A2's with `assert.mjs` and `snapshot.mjs`
byte-identical. The candidate was packed from this worktree, stamped with its own version
(`1.6.3-a3probe`) and its own marketplace name, **verified file-by-file by sha256 against the
worktree** (136 files), installed for the scratch project only, and the resolved plugin root was
hash-checked against the candidate before either leg ran. One `launch.sh`, called twice, same args.

**Leg 1.** ORIENT → GATE L1a → **ANALYZE** → **WIRE** → GATE L1a.5 → MAP SCOPES (five scope
contracts) → GATE L1b → BUILD. Killed with `SIGKILL` (pid 63470) at the window Stage A2 used:

```
completed phase orders: add-task-foundation-r1-a1, analyze, map-scopes, orient, wire
pending orders:         list-tasks-r1-a1
verdicts:               1 · green: add-task-foundation@r1
status:                 building
active-scope:           list-tasks          ← the scope actually in flight
```

Exit 137, nothing flushed, no `RunReturn`.

**Leg 2.** Fresh session, same script, same args. It fast-forwarded past all four phases, skipped
the scope that was already green, finished the scope whose order was in flight, ran a full fix
round, and returned:

```json
{"status":"gate_h","breaker":"outer",
 "hammer_proposals":["integration-regression","integration-regression"],
 "green_scopes":["add-task-foundation","complete-task","delete-task","list-tasks",
                 "add-task-foundation","complete-task","delete-task","list-tasks"]}
```

Both rounds' EVAL returned a **structural stop**: `spec-evaluator` refused to grade because one of
the five scopes (`integration-regression`) had no green T0 verdict to cite — it read
`t0/trials.jsonl` itself and said so. That scope exhausted its 3-attempt budget in both rounds, so
the round budget ran out and the **outer breaker** returned `gate_h` — ship what is green, which is
the designed ending for exactly this shape, not a failure of the resume.

### 4.1 The four assertions

| # | assertion | outcome |
|---|---|---|
| 1 | no completed PHASE order was re-dispatched (5 completed at kill time) | **PASS** |
| 1b | no result for a completed phase was re-ingested (5 checked) | **PASS** |
| 2 | no scope T0-green at kill time was rebuilt (1 green pair at kill) | **PASS** |
| 3 | every pre-kill T0 verdict survives byte-identical (1 found) | **PASS** |

Reported, not asserted: `status` moved `building → evaluating`; the substrate pointer named
`list-tasks` at the kill and again after; **48 new artifacts** after the resume; 102 files, 20
orders, 20 results, 14 verdicts (8 green) at the end.

**No `state_warnings` in the RunReturn** — every ledger write took on this run. That is the A3.3
channel reporting an absence it can now distinguish from silence.

### 4.2 The instrument, self-tested in the failing direction

A probe that has never been seen to fail is not evidence. The **same file**, unmodified, fed Stage
A2's committed snapshots:

```
kill-resume-probe: FAIL
| 1  | no completed PHASE order was re-dispatched | FAIL — wire.json  46f40cbe… → e924248d…
| 1b | no result for a completed phase was re-ingested | FAIL — wire.json  e79abe34… → b8775d79…
```

It reproduces A2's failure signature exactly. The grader can fail; what changed is the run.

### 4.3 What the PASS actually proves, against A2's FAIL

| Stage A2 behaviour | This run |
|---|---|
| `solution-architect` **escalated**, wrote no `wiring-map.md`, and WIRE was re-dispatched on every relaunch | `status: "done"`, `escalates: []`, `wiring-map.md` written (4058 bytes), `--require wire` exit 0. The only change is that `analyze` now runs first, so the worker was handed the `usecases/` its contract has always said it reads |
| an escalated phase was recorded as complete and the run moved on | every phase is followed by its post-condition; an unmet one aborts naming the phase |
| — | four phases fast-forwarded on the resume, nothing above BUILD re-dispatched |

### 4.4 One defect this run turned up, unfixed and named

`green_scopes` and `hammer_proposals` in the `gate_h` RunReturn **accumulate across rounds without
dedup**: each of the four green scopes appears twice and `integration-regression` is proposed twice.
Cosmetic to the pipeline (GATE H's census reads the board, not this list) but wrong for any consumer
that counts them — and the duplication is exactly what a resumed run's per-round accumulation looks
like, so it is worth a fix before anyone reads a scope count off a RunReturn.

### 4.0 The launches before the kill, recorded because they happened

Leg 1 took four launches to reach BUILD. Three died before the kill window and none of them is the
probe's own result, so they are listed here rather than folded away:

| launch | died of | what it left on disk |
|---|---|---|
| 1a | **the pipeline's own defect** — `ingest:orient` handed a directory (`EISDIR`) | orient artifacts + `results/orient.json` |
| 1b | **the pipeline's own defect** — `results/orient.json` never written (`ENOENT`) | orient artifacts only |
| 1c | **a session usage limit**, mid-ANALYZE — nothing to do with the harness | orient complete, `analyze.json` order in flight |
| 1d | *(the leg that reaches the kill window)* | — |

1a and 1b are Finding 3 / HD-006 and are fixed. **1c is worth one line of its own:** the relaunch
after it derived `has_orient_artifacts: true`, `next_phase: "analyze"`, and skipped ORIENT — the
fast-forward doing its job across a session death, which is the same mechanism the SIGKILL probe
tests, observed for free. It is *not* a substitute for the probe: no `SIGKILL`, no mid-BUILD state,
and no assertion ran over it.

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
  makes the next occurrence visible; it does not explain the last one. This run produced no such
  warning, which is evidence that the writes took here — not an explanation of the earlier failure.
- **No run in this stage reached `shipped`.** Leg 2 ended at `gate_h` because one scope could not go
  T0-green inside its budget in either round. The resume machinery is what the probe grades and it
  passed; "a resumed run can also *ship*" is A2's evidence (§7), not this one's.
- **The `gate_h` RunReturn's duplicated scope lists are unfixed** (§4.4).
