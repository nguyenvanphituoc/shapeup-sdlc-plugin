# Execution record — the single-loop plan

| | |
|---|---|
| **Date** | 2026-11-07 |
| **Plan** | [`plan-2026-11-07-single-loop.md`](plan-2026-11-07-single-loop.md) |
| **Branch** | `plan/single-loop`, local commits only; nothing pushed, nothing tagged |
| **Baseline** | 3.18.4 at `16eae5a`; `npm test` green (2392 checks) |
| **Now** | version 4.0.0 in both files; `npm test` green (2495 checks); `npm run demo`, `npm run verify:cross-dir` and `npm run test:grant` pass; `claude plugin validate . --strict` passes (the repo's `CLAUDE.md` moved to `.claude/CLAUDE.md` because a plugin-root `CLAUDE.md` is not loaded as context, which was its only blocking warning; the missing-icon note remains and does not change the result) |
| **Status** | every activity is done; the one thing left is yours: pushing the tag (a local tag `v4.0.0` exists) |

## The gate, and how it was met

The plan forbids deleting anything until a real run has shipped through `building`. A real run needs
a consumer folder Claude Code trusts, and trust is the user's to give; a first attempt in a scratch
folder was refused for exactly that reason. The PO then set up a trusted consumer project, the plugin
was copied into its `.claude/` folder, and the loop was driven there by real nested `claude -p`
sessions. Every real-run claim below is backed by a record under `traces/v4/`.

## Activity by activity

| # | State | Evidence |
|---|---|---|
| A0b | done — ADR-0004, accepted by the PO | `docs/design/adr/0004-single-loop.md` |
| A0 | done — README, citations repaired rather than invented, the drift check follows relative links | `tests/structural/08-docs.mjs` |
| A1 | done — `probe next`, the `building` skill; **a real run shipped through it** | `traces/v4/one-page-site-2026-11-07/` (3 launches, 2 aborted at real defects, both fixed), `traces/v4/one-page-site-fold-2026-11-07/` |
| A2 | done — planning folded into a fence-only `plan` activity; three skills deleted; a real run shipped after it, in one launch | `traces/v4/one-page-site-fold-2026-11-07/`, section 178 |
| A3 | done — stop, retro and intake folded; three skills deleted. **The Vietnamese-pitch done-when was run and met**: the loop wrote `pitch.en.md` and a glossary, the run opened on the English copy and shipped | `traces/v4/vietnamese-pitch-2026-11-07/`, sections 175, 176 |
| A4 | done — `gate-intake` deleted, `gate-zerowork` keyed to the loop, the load echo dropped; 5 hook scripts, 6 entries | `17-gate-zerowork-dispatch` |
| A5 | done — `tech-lead` and its run script deleted, the launch record written by `init run`, the model floor refused there, nothing staged, the `Workflow` grant no longer added and none deleted, `snapshot` merged into `resume`. **Kill-and-resume probe passed** | `traces/v4/kill-resume-2026-11-07/`, sections 63, 127 |
| A6 | done — `probe concurrency` and `reduce verdict` removed, `probe stats` keeps `--hooks`, tokens and cost on the leg row | sections 177, 05 |
| A7 | done — the script-reading tests were ported or retired with a stated reason each; the no-courier, no-relaunch and grant-constant tests added | `tests/structural/`, the A5 ledger in the commit history |
| A8 | done — the archived `envlint` pitch, same `--parallel-scopes 4`, run on the final tree: one launch, 15.9 minutes receipt to ship, 11 leg rows (the arm: 11 legs, 34.1 minutes in its first launch, then 21 more after a transport failure), verdict PASS, 39 deliverable tests, $8.03 as the host reported it. See "The comparison, and what it is not" | `traces/v4/envlint-final-2026-11-07/`, beside `traces/phase3/fanout-arm-shipped/`; a second dated run of another pitch in `traces/v4/personal-site-final-2026-11-07/` |
| A9 | done to the edge of the push — both version files at 4.0.0, a changelog entry, a local tag `v4.0.0`, nothing pushed (the release workflow fires on a pushed tag). The nested-session check passed: real `claude -p --plugin-dir` runs left the Stop check's row (`gate-zerowork`) and the sandbox rows in the decision ledger, and `verify:cross-dir` passes | `traces/v4/personal-site-final-2026-11-07/SUMMARY.json` (`hook_rows`) |

## What the real runs found

- A worker's result with a status outside the four the schema allows closed the run with a cause that
  said "returned no result". It is now sent back once with the refusal, then stops naming it.
- A typed `/ship` is recorded in a transcript as a tag-wrapped command, which the Stop check's anchored
  pattern missed. Fixed, still anchored to the start of the message.
- A launch with no answer set exited 2 at its first gate; an unattended launch with none now stops at
  preflight and says so. Found by the scripted drive, section 176.
- On the multi-scope pitch the loop released a dependent scope over a dependency that had returned red
  with attempt budget left (a sub-agent's Bash had been denied, so that scope escalated). A scope is now
  settled only when green or out of budget; a red scope with budget left is released again at its next
  attempt, and a dependent waits for it. The first `envlint` launch stopped on this ($5.66, not counted
  below); the rerun is the measurement.
- Spec-lint at the board gate refused a pitch whose "No-gos" the coverage step had registered as
  requirements. The way out is the PO marking them CUT; the PO approved it for this run.

## The comparison, and what it is not

Same pitch and the same dial as the archived fan-out arm; one run each side. The arm cut four scopes and
this run three, the plugin version and the model differ, the arm recorded neither a model nor a cost, and
neither side was repeated. So: 11 leg rows in about 16 minutes against 11 legs in 34, one launch against
two. That is one run set beside one run, not a rate, and it supports no claim about cost.

## What did not land as the plan wrote it

1. **`resume.mjs` is not smaller than it was alone** (1161 to 1207 lines). Measured against what the plan
   merges into it, it is: `resume.mjs` and `snapshot.mjs` were 1452 lines together and are 1207 now. What
   remains is mostly the close and ledger derivation, which the loop needs.
2. **The tag is local.** Pushing it fires the release workflow, which is yours to start.

## Deviations from the plan, each deliberate

1. `Operation` ends at 7, not 6: the plan's own fence-only `plan` operation is the seventh.
2. A missing project profile is a `need` step, not an abort: the script aborted because it could not
   ask; the loop can.
3. `--adversarial-verify` is recorded and reported as not carried.
4. Scopes release per ask rather than per edge; a loop that launches them in the background recovers the
   overlap.
5. `tokens_total` sits beside the in/out split, because the host reports one figure.
6. `closeRun` now exports on `shipped` too, because the ship phase that used to export for it went.
7. `--close-arm paused` and `ok` now exit 3: `RunReturn` and its non-terminal arms are gone.

## What to do with it

The working record in this folder is retired by the release commit (ADR-0002, and ADR-0004 names the
files). It is left in place because retiring it before the tag would delete the plan this record is
about. To release: merge `plan/single-loop`, tag `v4.0.0`, and remove this folder in that commit.
