# Execution report — workflow-orchestrator migration (cumulative)

Contract: `docs/migration/execution-contract.md`, compiled verbatim from
`docs/workflow_migration_plan.md` (sha256 `949dab98…`, **re-verified unchanged at run 2 start**).
Branch: `feat/workflow-orchestrator`. Executor: plan-executor skill.

| Run | Machine | Outcome |
|---|---|---|
| 1 (2026-08-06) | `/Users/teo/…` | S0, S1 green. S2 committed WIP/UNVERIFIED at `ff80176`. Parked on session usage limit. |
| 2 (2026-08-07) | `/Volumes/LibertyMobi/…` | Preflight re-derived state independently. Three defects found and fixed in S2's never-executed code (`d7fac48`). **Blocked** on S2's live runs — environment, not plan. |

---

## Where the run stands

| Stage | Status | Commit | Verified how |
|---|---|---|---|
| S0 — kill-switch spike (D1) | **GREEN — Decision: GO** | `bba8a5f` | Re-verified run 2 in a fresh `git clone --local`: 4/4 acceptance rows PASS |
| S1 — `shapeup-build-round` | **GREEN** | `1c695fc` | Re-verified run 2 in a fresh clone: 6/6 rows PASS, `npm test` green |
| S2 — `shapeup-run` + thin skill | **RED (code advanced, verifications not run)** | `ff80176` + `d7fac48` | Code rows PASS (`npm test` 1120, `shapeup-run.js` present, `SKILL.md` 121 ≤ 160). A2/A3/kill-probe **have not run** and `stage2-evidence.md` does not exist → 3 rows RED |
| S3 — cutover, detectors, benchmark | **Not started** | — | Blocked behind S2 by the contract's ship-gate guardrail |

Preflight totals, fresh clone at `d7fac48`: **18 PASS / 7 RED** — identical to run 1's parked
state, because run 2's fixes correct *behaviour the acceptance rows do not measure*. That is worth
stating plainly: the S2 rows are greps for a string in an evidence file, and all three defects
below would have passed every one of them.

---

## Run 2's finding: three defects in code that had never executed

`shapeup-run.js` (587 lines) was committed at `ff80176` labelled UNVERIFIED. Before spending on a
live run, run 2 verified it statically. Each defect was **proven mechanically against the real
scripts, with no agent involved** — not inferred by reading.

**1. Gate decisions were never read.** `gate-answers.mjs` carries cross/pause/abort in its *exit
code*, but the decision itself (`loop`|`stop`|`run`|`skip`|`accept-cut-list`) travels only in the
JSON it prints on stdout. The `mech()` envelope is `{exit_code, stdout, stderr}` and nothing else,
so `qaGate.decision === "run"` read `undefined` and was **always false**:

- **QA could never dispatch**, even under preset `ci`, whose answer set explicitly says
  `QA: {decision: "run"}`.
- `ship-report.mjs` was always handed `--qa skipped`.
- GATE L3's `"stop"` arm was dead code.

Proven: exit 0 is shared by `run`/`loop`/`proceed`/`accept-cut-list`, so the exit code alone
cannot distinguish them (6/6 resolutions against the real script). A2's "green end to end" would
have been reported green *with QA silently never running* — the "looks complete, produces no
diagnostic, is wrong" class this harness exists to make unreachable.

**2. The fast-forward handed `compile-order` a bare filename.** `probe()` returned `scope_files`
as raw `readdir` output (`"SC-x.md"`); both `compile-order.mjs` and `t0-verify.mjs` resolve
`--scope` against cwd. Every resumed run would hit `no scope contract at <cwd>/SC-x.md`, exit 2,
and the attempt loop reads a non-zero compile exit as the **stagnation breaker** — so a relaunch
would hammer-propose every scope instead of continuing. This is precisely the path A3's relaunch
and the kill/resume probe exercise; both would have failed. `probe()` now emits resolved paths
built from `scopesDir()`, with no path literal added (test-#45 discipline, `16-workflows.mjs` (b)
still green). Proven: the probe one-liner executed verbatim against a fixture project, 8/8
assertions, including that the emitted path is absolute and ends in `/scopes/SC-alpha.md`.

**3. An unparsable probe returned `{}`** — which reads downstream as "status null, no scopes, no
wiring map", i.e. a fresh run, and would re-dispatch every phase over a run already in progress.
It now returns a reason and the pipeline aborts on it.

`npm test` green at 1120 checks. **No acceptance command was altered, relaxed, or skipped.**

---

## Why S2 is blocked — environment, not plan

S2's three outstanding verifications (A2 unattended, A3 interactive pause/relaunch, kill/resume)
all require running *the harness under test* as nested headless sessions in a scratch project.
The scratch project was built successfully (worktree tarball installed, `npx shapeup-sdlc init`
run, marketplace re-pointed from GitHub to a **directory source resolving live to this worktree** —
run 1's defect 1 workaround, reapplied and confirmed). Two blockers remain, both environmental:

1. **`claude -p --permission-mode auto` is denied by the auto-mode classifier.** Stage 0 established
   that headless Workflow launches require this flag (default and `dontAsk` block the tool behind a
   review gate). Plain `claude -p` is permitted and works — the flag is the blocker.
2. **The scratch directory is untrusted, and pre-trusting it is denied.** The run reproduced run 1's
   defect 2 verbatim: `Ignoring 6 permissions.allow entries from .claude/settings.json: this
   workspace has not been trusted.` With the grant dropped, every plugin script call stalls for
   approval. The fix is `projects[<dir>].hasTrustDialogAccepted: true` in `~/.claude.json`, a
   machine-level file this run is not permitted to write.

Neither is a defect in the migration, and neither can be worked around from inside the run.
**S3 was deliberately not started**: the contract's guardrail makes S2 the ship gate of the
cutover ("Stage 3 does not begin until both lane types are green"), and the plan's ordering is
load-bearing.

---

## Executor rules still in force

- **No merge to `main`, no tag, no push** — the cutover merge is the PO's move after S3.
- **The ~$40–60 A7 benchmark does not launch autonomously** — the run pauses for an explicit go.
- Stage 2 remains the ship gate: S3 must not start until A2 **and** A3 are green.

## Resuming

1. `npm test` must be green (1120 checks at `d7fac48`).
2. Recreate the workspace: `.plan-runs/workflow-migration/{ledger,freeze,clones}` and copy
   `docs/migration/execution-contract.md` → `.plan-runs/workflow-migration/contract.md`.
3. Run the preflight (fresh clone, all acceptance rows). **Never resume from this report's claims —
   the preflight is the authority.** It re-derives S0/S1 green, S2 partial, S3 red for free.
4. Unblock the two environment items above, then resume at S2's live verifications. Scratch-project
   setup (tarball install, marketplace re-point, trust, `--permission-mode auto`) is documented in
   `stage0-evidence.md` and `stage1-evidence.md`, and was reproduced successfully in run 2 up to
   the trust step.
