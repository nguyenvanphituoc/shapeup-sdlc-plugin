# Stage A2 — close the gate Stage A opened

**Compiled:** 2026-08-10 at `7046df6`, branch `feat/workflow-orchestrator`.
**Depends on:** Stage A (`2a134cd`) · **Blocks:** Stage B of `docs/migration/remaining-stages-plan.md`.
**Evidence base:** `docs/migration/stage2-evidence.md` §4 — every claim below traces there.
**Model floor (D5, unchanged):** every agent in every phase runs on **Sonnet or higher. No Haiku.**
**Hard rule (unchanged):** every stage exit is an artifact on disk, never a claim.

**Position at compile time.** Stage A is complete: its five items shipped, its six acceptance rows
(R1–R6) are green, `npm test` is green at **1179 checks**, and the contract reads **19 PASS / 4 RED**.
And S2's ship gate is **not met**, because the probe those rows exist to record came back
`kill-resume-probe: FAIL`. Stage A2 exists to close that gap and nothing else.

---

## 1. The problem, in one line

The fast-forward's ORIENT branch is gated on **stored state** (`harness-run.md`'s `status`) that a
silent courier failure left stale — and none of it can be unit-tested, because a Workflow script
cannot be imported.

That second clause is the actual blocker. `skills/tech-lead/workflows/shapeup-run.js` has no
`import`, takes `args` as a runtime global, and is executed by the Workflow runtime — so there is no
seam a fixture can reach. Without solving that, the fix to §2's defect is unverifiable and we are
back to trusting a patch, which is the posture this harness exists to refuse.

### The three findings this stage answers

| # | finding | citation |
|---|---|---|
| 1 | ORIENT is the only phase gated on `status` rather than on its own artifacts; WIRE (`:442`) and MAP SCOPES (`:473-474`) gate on artifacts and fast-forwarded correctly | `shapeup-run.js:411` |
| 2 | `status` never left `orienting` across two complete legs and 46 dispatched agents — `:426`'s `setRunStatus` produced no agent at all, and its result is never inspected | `stage2-evidence.md` §4 |
| 3 | `.shapeup/active-scope` never updated either, so scope 2's builder ran with `sandbox-guard`'s write-whitelist pointed at scope 1's substrate | `shapeup-run.js:540-545`, `hooks/sandbox-guard.mjs:102` |

Findings 2 and 3 are the same defect: the only two `mech()` call sites in the file whose return
value is discarded are the only two whose failure went unnoticed. The comment above finding 1's
branch already describes the artifact-gated design the code does not implement — **the doc is ahead
of the code, in the same file as the arm Stage A landed for exactly that reason.**

---

## 2. Acceptance contract

Every row can fail, and every row is mutation-verified. That discipline is the direct lesson of
Stage A, where three contract rows could not fail and nobody found out by running them.

| # | Criterion | Verified by |
|---|---|---|
| **G1** | The fast-forward derivation is a script, not a string | `test -f skills/tech-lead/scripts/resume-state.mjs` **and** the inline probe blob is gone from `shapeup-run.js` |
| **G2** | ORIENT's skip is artifact-gated | **behavioural**: `resume-state.mjs` against a planted tree carrying `status: orienting` **and** a complete `orient/` reports ORIENT as skippable |
| **G3** | No courier result is discarded | structural check over `workflows/*.js`; `npm test` count **> 1179** |
| **G4** | The resume fixture exists as its own file and covers all four phases | new `tests/structural/NN-resume-state.mjs`; mutation transcript pasted into the evidence |
| **G5** | Every row in this contract is falsifiable | mutation-harness output committed, one line per row, each showing the row red under its mutation |
| **G6** | The probe passes | `kill-resume-probe: PASS` **and** all four assertions PASS, in the amended `stage2-evidence.md` §4 |
| **G7** | `SKILL.md`'s zero-work sentence has exactly one reading | states the predicate (`dispatched ∧ no receipt`), not "neither … NOR …" |

**Ship gate: G1–G6.** G6 is the gate; G1–G5 are what make G6 mean anything. G7 is clerical and does
not block.

---

## 3. Stages

### A2.1 — Make the fast-forward testable

Promote `probe()` from an inline `node --input-type=module -e "…"` blob
(`shapeup-run.js:215-252`) to a real pipeline script, `skills/tech-lead/scripts/resume-state.mjs`,
invoked through `mech()` like every other script the workflow calls.

This is the load-bearing step and it pays three ways:

1. **The derivation becomes unit-testable.** A fixture can plant a tree and assert the derived
   phase. Today the logic is a string inside a file nothing can import, which is why a defect that
   re-runs an entire phase survived three runs and a status review.
2. **It matches the permission grant.** `Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/:*)`
   already covers it, while an inline `node -e` matches no entry and passes only at the classifier's
   discretion — run 3's environment finding #5, closed as a side effect rather than as extra work.
3. **It removes the largest path-literal blob from a workflow script**, which is the discipline
   `tests/structural/16-workflows.mjs` exists to police.

The script's output is the existing probe JSON plus one field, `has_orient_artifacts`. Its contract
belongs in `domain.schema.json` like every other cross-boundary record.

### A2.2 — Fix the two defects

- **ORIENT gates on artifacts.** `:411` reads `has_orient_artifacts` instead of `status`, matching
  WIRE and MAP SCOPES. The comment at `:407` becomes true rather than aspirational.
- **No `mech()` result is discarded.** `setRunStatus` and `writeActiveScope` return an envelope
  carrying `exit_code`; a non-zero is a fact the run acts on. A failed `active-scope` write in
  particular must not be survivable — it points the sandbox guard at the wrong substrate.

### A2.3 — The mechanisms that keep it closed

- **`tests/structural/NN-resume-state.mjs`** — plant a tree (`status: orienting`, a complete
  `orient/`, a wiring map, two scope contracts, one green verdict), assert exactly which phases the
  derivation skips. Mutation-verified in both directions, per the repo's own rule for a check that
  must be real rather than merely present.
- **A structural check that no `await mech(…)` / `await mechNode(…)` discards its value**, over every
  file in `workflows/`. Closes the class, not the instance.
- **A contract mutation harness** — run each acceptance row against a tree with the thing it checks
  removed, assert it reds. Three rows in the migration contract could not fail; nothing told us.
- **`gate-status.mjs`** — reads the evidence files' status lines and prints `GATE MET` / `NOT MET`,
  so a row count can never again be read as progress above a failed gate.

### A2.4 — Re-run the probe

Same rig, already documented in `stage2-evidence.md` §4: scratch project outside both checkouts,
plugin installed from `npm pack` as a local marketplace with sha256 verification against the
worktree, `snapshot.mjs`, the four assertions. A repeat, not a rebuild.

Measured cost from the Stage A run: **~70 min** to reach the kill window, **~45 min** for the
resumed leg. Mostly waiting.

> **If it fails again, stop again.** The same rule applies: a failing probe means S2's ship gate is
> not met and Stage B does not start. A second failure is a signal about the design, not about the
> patch, and it should be treated as one.

---

## 4. File-touch map

| Path | A2.1 | A2.2 | A2.3 | A2.4 |
|---|---|---|---|---|
| `skills/tech-lead/scripts/resume-state.mjs` | **create** | — | — | — |
| `skills/tech-lead/workflows/shapeup-run.js` | modify | **modify** | — | — |
| `skills/tech-lead/schemas/domain.schema.json` | modify | — | — | — |
| `tests/structural/NN-resume-state.mjs` | — | — | **create** | — |
| `tests/structural/16-workflows.mjs` | — | — | modify | — |
| `tests/structural.mjs` | — | — | modify | — |
| `skills/tech-lead/scripts/gate-status.mjs` | — | — | **create** | — |
| `skills/tech-lead/SKILL.md` | — | — | one sentence (G7) | — |
| `docs/migration/stage2-evidence.md` | — | — | — | **amend §4** |
| `docs/migration/execution-contract.md` | — | — | amend | amend |

---

## 5. Guardrails

- **No merge, no tag, no publish.** Branch pushes only, as amended on the record in
  `execution-report.md`.
- **Everything outside the touch-map is scope creep.** The branch is auditable after 44 commits
  only because that guardrail has held.
- **The order-id collision, the untrusted-workspace installer gap, and the rest of the environment
  findings stay in the register** as raw ideas for the Betting Table — see open decision 5 for the
  one that has an argument for coming in.
- **Every generated path resolves through `paths.mjs`.** `resume-state.mjs` is a normal pipeline
  script and is bound by structural #45 like the rest.
- **Mutation-verify every new check.** A fixture that has never been seen to fail is not evidence.

---

## 6. Open decisions — PO's call, not the executor's

These are recorded rather than resolved, so that whoever picks this up does not silently re-decide
them. **1 and 2 change the shape of the work; 3–5 change its size.**

1. **Should `status` survive at all?** `AGENTS.md` says *"Progress is derived, never claimed."*
   `status` is stored state — it **is** a claim, and this stage's defect is what happens when the
   claim and the artifacts disagree. If resume is fully artifact-derived, `status` may have no
   remaining reader that justifies it. Deleting it removes the bug class instead of patching an
   instance. **Requires enumerating its readers first** (`init-run.mjs` writes it, `probe()` reads
   it, `run-snapshot`/`ship-report` may) — that enumeration is a prerequisite to the decision, not
   part of it.
2. **How much does `resume-state.mjs` absorb?** Just `probe()`, or also `checkScopeGreen`,
   `setRunStatus` and `writeActiveScope`? Absorbing all four leaves the workflow script nearly free
   of inline node and gives one testable surface for every disk fact the pipeline reads — but it is
   a materially bigger diff on a branch we agreed to freeze at Stage B.
3. **Is the contract mutation harness (G5) worth building, or is it gold-plating?** It is the most
   speculative item here. The argument for it: three rows could not fail, and the only reason we
   know is that someone read them by hand.
4. **Should the re-run probe be harder?** The same two-scope, one-round shape re-proves the fix and
   nothing more. Killing during EVAL, or across two rounds, exercises resume paths that have never
   been run. Roughly +1 h.
5. **Does the order-id change come into this branch after all?** `compile-order.mjs:328` names a
   build order `r<round>-a<attempt>` with no scope id, so scope 2's order overwrites scope 1's. That
   is what let the contract's `orders/ minus results/` row read green on a failing run — which makes
   it arguably an **instrument** defect rather than an unrelated one, and instrument defects are
   this stage's subject.

---

## 7. Cost and sequence

| Stage | Wall clock | External $ | Gate |
|---|---|---|---|
| **A2.1** — testable derivation | ~1–2 h | $0 | G1 |
| **A2.2** — the two fixes | ~1 h | $0 | G2, G3 |
| **A2.3** — the mechanisms | ~2 h | $0 | G4, G5 |
| **A2.4** — re-run the probe | ~2 h, mostly waiting | $0 (dev tokens) | **G6 — or stop** |

Everything here is unblocked on this machine, today, at zero external cost.
