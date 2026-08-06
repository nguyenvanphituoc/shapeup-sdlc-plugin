# Execution report — workflow-orchestrator migration run 1 (parked)

**Date:** 2026-08-06 · **Branch:** `feat/workflow-orchestrator` · **Executor:** plan-executor
skill, contract-driven (`docs/migration/execution-contract.md`, compiled verbatim from
`docs/workflow_migration_plan.md`, sha256 `949dab98…`).
**Why parked:** the Stage-2 execute agent hit the session usage limit (resets 7:10pm
Asia/Saigon) 132 tool calls into the stage. This is a usage event, not a plan failure.
**Continuation:** on another machine — see *Resuming* below. The run stopped exactly at a
stage boundary discipline point: everything green is committed and independently verified;
everything not verified is committed as clearly-labelled WIP.

## Where the run stands

| Stage | Status | Commit | Verified how |
|---|---|---|---|
| S0 — kill-switch spike (D1) | **GREEN — Decision: GO** | `bba8a5f` | Workflow verify agent (fresh clone, ledger `S0-a1`) **and** an independent no-agent re-run of all acceptance rows in a fresh `git clone --local` at `1c695fc`: all PASS |
| S1 — `shapeup-build-round` | **GREEN** | `1c695fc` | Same double verification (ledger `S1-a1` + independent fresh-clone re-run): all rows PASS, `npm test` 1117 checks (baseline was 1112) |
| S2 — `shapeup-run` + thin skill | **WIP, unverified** | WIP commit on this branch | Not verified. `npm test` green at 1120 checks *with* the WIP applied, but none of the stage's real verifications (A2 unattended run, A3 interactive pause/relaunch, kill/resume probe) have run, and `stage2-evidence.md` does not exist |
| S3 — cutover, detectors, benchmark | **Not started** | — | — |

All three S0 kill-switch checks passed with real, independently re-read evidence (deny rows
re-read from the scratch project's `decisions.jsonl`, not trusted from the subagent's report).
The migration's D1 gate is crossed: **the workflow lane is viable.**

## What S2's WIP already contains (do not redo blindly — verify instead)

- `skills/tech-lead/workflows/shapeup-run.js` (587 lines) — outer pipeline, written but never
  exercised.
- `skills/tech-lead/SKILL.md` rewritten to the thin shell — **121 lines**, already under the
  ≤ ~150 target (contract ceiling 160).
- `skills/tech-lead/references/hard-rules.md` (new), `round-protocol.md` (+16 lines),
  structural tests 08/14 updated. Suite green at 1120 with all of it.
- Remaining for S2: the three real verifications (A2, A3, kill/resume probe) in a scratch
  project against the worktree tarball, then `docs/migration/stage2-evidence.md`, then the
  fresh-clone acceptance. Treat the WIP as a draft the verifications must earn.

## Measured costs and findings (from the stage evidence files, which are normative)

- One `mech()`-shaped Sonnet agent call: **$0.293** — above the review's inferred ≲ $1/round
  estimate's per-call assumption; flagged in `stage0-evidence.md`, not a gate.
- Same-feature control (prose-lane dispatch): **$1.461** vs workflow-lane run **$2.010**
  (both Sonnet, informational — the A7 benchmark is the real comparison and has not run).
- Run totals: ~1.03M subagent tokens, 513 tool calls, ~2.9 h wall clock, 6 agents.

**Defects surfaced by the run (all documented in the stage evidence files):**
1. `npx shapeup-sdlc init` points the plugin marketplace at GitHub (served a stale 1.3.0
   cache) even when installing from a local tarball — worked around via
   `claude plugin marketplace add <worktree-path> --scope project`. Fixable installer defect
   (the contract's "check 1" carve-out class).
2. A fresh scratch/CI directory silently drops the whole `permissions.allow` grant until
   workspace trust is accepted.
3. Headless Workflow tool availability is conditional: present under
   `--permission-mode auto`; default and `dontAsk` block it with a review gate. Binds how
   Stage-2+ launches must be documented.
4. `t0-verify.mjs` default `--out` landed T0 artifacts in the SHARED (`shapeup/`) tree instead
   of LOCAL (`.shapeup/`) — **fixed in S1** by deriving the LOCAL root from
   `compile-order.mjs` stdout (no new path literal).
5. The Workflow runtime can deliver `args` as a JSON-encoded string, not an object. First
   launch of the executor ran over an empty stage list and reported "complete" — the
   derived-never-claimed defect class in the executor's own plumbing. Both the plan-executor
   script and `shapeup-build-round.js` now normalize defensively and refuse to run over
   nothing. **The plan-executor skill patch lives outside this repo**
   (`.claude/skills/plan-executor/workflows/execute-plan.js` in the main checkout) — re-apply
   on the other machine if resuming via that skill (normalize stringified `args`; throw when
   `repo`/`workdir`/`stages` are missing).

## Executor rules still in force (from the contract)

- **No merge to `main`, no tag** — the cutover merge is the PO's move after S3.
- **The ~$40–60 A7 benchmark does not launch autonomously** — the run pauses for an explicit
  go when S3 reaches it.
- Stage 2 remains the ship gate: S3 must not start until A2 **and** A3 are green.

## Resuming on another machine

1. Clone the repo, check out `feat/workflow-orchestrator`. Baseline: `npm test` must be green
   (1120 checks at the WIP head; 1117 at `1c695fc`).
2. Recreate the executor workspace: `mkdir -p .plan-runs/workflow-migration/{ledger,freeze,clones}`
   and copy `docs/migration/execution-contract.md` → `.plan-runs/workflow-migration/contract.md`
   (it is byte-identical to the contract this run used; `.plan-runs/` is gitignored by design).
3. Run the plan-executor preflight (fresh clone, all acceptance rows). It will re-derive:
   S0 green, S1 green, S2 red-but-partial, S3 red. **Never resume from this report's claims —
   the preflight is the authority.**
4. Resume execution at S2. The scratch-project setup steps (tarball install, marketplace
   re-point, trust acceptance, `--permission-mode auto`) are documented in
   `stage0-evidence.md` and `stage1-evidence.md`.
