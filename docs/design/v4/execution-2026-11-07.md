# Execution record — the single-loop plan

| | |
|---|---|
| **Date** | 2026-11-07 |
| **Plan** | [`plan-2026-11-07-single-loop.md`](plan-2026-11-07-single-loop.md) |
| **Branch** | `plan/single-loop`, local commits only; nothing pushed, nothing tagged |
| **Baseline** | 3.18.4 at `16eae5a`; `npm test` green (2392 checks) |
| **Now** | version 4.0.0 in both files; `npm test` green (2491 checks); `npm run demo`, `npm run verify:cross-dir` and `npm run test:grant` pass; the marketplace manifest validates, and `claude plugin validate . --strict` fails on warnings that were there before (a root `CLAUDE.md`, a missing icon, Finder files) |
| **Status** | every activity is done except the three misses listed under "What did not land" |

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
| A3 | done — stop, retro and intake folded; three skills deleted. The Vietnamese-pitch done-when was **not run** | sections 175, 176 |
| A4 | done — `gate-intake` deleted, `gate-zerowork` keyed to the loop, the load echo dropped; 5 hook scripts, 6 entries | `17-gate-zerowork-dispatch` |
| A5 | done — `tech-lead` and its run script deleted, the launch record written by `init run`, the model floor refused there, nothing staged, the `Workflow` grant no longer added and none deleted, `snapshot` merged into `resume`. **Kill-and-resume probe passed** | `traces/v4/kill-resume-2026-11-07/`, sections 63, 127 |
| A6 | done — `probe concurrency` and `reduce verdict` removed, `probe stats` keeps `--hooks`, tokens and cost on the leg row | sections 177, 05 |
| A7 | done — the script-reading tests were ported or retired with a stated reason each; the no-courier, no-relaunch and grant-constant tests added | `tests/structural/`, the A5 ledger in the commit history |
| A8 | **measured, not compared** — a dated final-tree run: one launch, 11 minutes, 8 legs, $4.88 as the host reported it, verdict PASS. It is a different pitch from the archived fan-out arm, so no comparison with it is made | `traces/v4/personal-site-final-2026-11-07/` |
| A9 | **prepared, not shipped** — both version files at 4.0.0 and a changelog entry. No tag, no push. The nested-session check passed: the real runs left the Stop check's row in the decision ledger | the same trace |

## What the real runs found

- A worker's result with a status outside the four the schema allows closed the run with a cause that
  said "returned no result". It is now sent back once with the refusal, then stops naming it.
- A typed `/ship` is recorded in a transcript as a tag-wrapped command, which the Stop check's anchored
  pattern missed. Fixed, still anchored to the start of the message.
- A launch with no answer set exited 2 at its first gate; an unattended launch with none now stops at
  preflight and says so. Found by the scripted drive, section 176.
- Spec-lint at the board gate refused a pitch whose "No-gos" the coverage step had registered as
  requirements. The way out is the PO marking them CUT; the PO approved it for this run.

## What did not land

1. **`resume.mjs` did not shrink** (1161 to 1207 lines). The script-only code went, but `snapshot` merged
   in and what remains is mostly the close and ledger derivation, which the loop needs.
2. **The A3 language-gate done-when** (a Vietnamese pitch yields `<name>.en.md` and a glossary from the
   loop) has no run behind it.
3. **No tag.** The release workflow fires on a tag; that is yours.

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
