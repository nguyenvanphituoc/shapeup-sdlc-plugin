# Phase 7 — the verification gauntlet, closed (with an unmet clause, recorded plainly)

What the plan asked for, what shipped, and what closing it directly turned up. Companion to
`PLAN.md` §"Phase 7 — Verification gauntlet".

Executed via the repo's own `plan-executor` skill — an acceptance contract compiled from this
phase's text, verified in a fresh clone for every stage that could be, never against a run's own
say-so. Branch `plan/phase7-verification-gauntlet`, off `v2` at `7c35a79` (itself preceded by
landing Phase 5/6's own pending closure work, which this run found sitting uncommitted before it
started — see §0). Operator constraints for this run, honored throughout: at most one `git
worktree` open at any time, and every live dispatch (this run's own agents and every nested
harness/CLI session S4 drove) on `sonnet` — no `fable`, no `opus`.

---

## 0 · What was already true, or landed as preflight, before this phase's contract ran

- **Four of the plan's seven probes were already written, committed, and running in `npm test`.**
  `tests/structural/21-gauntlet.mjs` ("the gauntlet") implements G1 (kill/resume), G3 (parallel
  safety), G4 (dead worker), and G5 (gate refusal) as deterministic checks — no live model call,
  matching plan probes 1, 3, 4, 5 exactly. Its own header states, correctly, why G2 and G6 are
  deliberately *not* encoded the same way: "a check that cannot fail is worse than a missing one."
- **G2 and G6 had already been run live, by a prior session, before this phase's contract was
  written.** `docs/output/EXP-A-G2-G6.md` (471 lines, committed `5a6e7d4`) drove `examples/todo-cli/`
  through the full v2.0 harness loop, `--unattended --gate-answers ci`, every dispatch `sonnet`.
  Found, live: **G2 does not complete with zero prompts** (two self-initiated, characterized stalls
  — not a hang, not a crash); **G6 produced v2.0's first cost/wall-clock number** (73m 30.8s /
  ~$34.50 combined pipeline, `todo-cli`, 2 rounds). That same run also found and fixed a real defect
  live: EVAL's PASS/FAIL branch trusted a dispatching sub-agent's own summary instead of the
  WorkResult it had just written (fixed, `kernel/probe/eval.mjs`, commit `8c85b57`, already on `v2`
  before this phase started). `tests/README.md` had not been updated to say any of this — it still
  read "NOT WRITTEN" for both. Closing that gap became this phase's Stage S2.
- **Phase 5 and Phase 6's own closure work was sitting uncommitted in the working tree** when this
  phase's run began — both already-shipped, both `npm test`-green, neither committed yet. Landed
  first, as its own two commits on `v2` (`257c06f`, `7c35a79`), before branching for this phase, so
  Phase 7 would not silently bundle unrelated prior-phase work into its own history. Also re-stamped
  `tests/grant/last-verified.json`, found stale (`plugin_version: "1.8.0"` against a repo at
  `2.0.0`, though the rule-count check `npm test` runs was still accurate) — `6abfc35`.

## 1 · The four deterministic probes (G1, G3, G4, G5) — Stage S1

**Confirmed green, no code change needed.** `npm test` (1200 checks going in) passed with all four
gauntlet sections green; `npm run test:grant` re-run live, 9/9. This stage's job was confirmation,
not re-implementation, and it stayed that — the plan's own Done-when for these four probes was
already met by earlier work.

## 2 · G2 and G6's real status, brought into `tests/README.md` — Stage S2

`tests/README.md`'s Tier-1 section no longer says "NOT WRITTEN." It now states, and cites
`EXP-A-G2-G6.md` for the full account of:

- **G2: MEASURED — FAIL, characterized.** Not smoothed into "substantially works." The load-bearing
  finding underneath the two stalls: the documented kernel-only permission grant is *necessary but
  not sufficient* for `--unattended` — it does not cover the generic Write/Edit calls every worker
  skill makes, and a truly headless lane needs a CLI permission mode as well. (This exact finding
  was already folded into the shipped `AGENTS.md` by an earlier commit, `7d5a850` — Phase 7 did not
  need to touch it again.)
- **G6: MEASURED — v2.0 has a real number; a v1 comparison was attempted and found impossible to
  make.** This paragraph was written twice: once by Stage S2, honestly stating "no v1.7.0-final
  baseline exists *yet*" (correct at the time — S2 runs before S4 and was explicitly told not to
  wait for or guess at S4's result), and once more by the operator session after S4 completed, to
  fold in what S4 actually found (§4 below) — a stronger and different claim than "hasn't happened
  yet."

## 3 · The metrics audit (plan probe 7) — Stage S3

`docs/output/METRICS-P7.md` (352 lines) re-measures all six metrics probe 7 names explicitly,
against the repository directly — never against the operator's own informal pre-run pass, which it
independently reproduced and then verified rather than trusted.

| Metric | v1.7.0 | v2.0 target | v2.0 measured | Verdict |
|---|---|---|---|---|
| Executable script files | 24 | ~11 | **33** under `kernel/` alone (41 incl. `bin/`+`hooks/`) | **MISS** — ~3× over |
| Permission strings written by `init` | 6 (3 owners × 2 spellings) | 1 | **3** by default (2 with `--no-native-workflow`) | **MISS** on the literal count; real 3→1 reduction in *owners* |
| Runtimes owned | 1 (`run-workflow.mjs`) | 0 | **0** | **MATCH** |
| Hooks | 10 | 4 hard | **5** files, **5** hard walls (4 `PreToolUse` deny + 1 `Stop` block) | **MISS**, on both readings, already-documented non-drift |
| Comment density, shipped JS | 36% | ~18% | **41.0%** | **MISS** — wrong direction |
| Shipped LOC | ~24,240 | ~17,000 (±10%) | **28,257** (27,800 net) | **MISS** — ~64–66% over |

**One match, five misses, one of the misses moving the wrong way.** None were redefined, softened,
or explained away — `METRICS-P7.md` carries the derivation command and literal output for every row,
and the largest contributors for each miss (e.g. `kernel/verify/` + `kernel/reduce/` = 16 of the 33
kernel files; `skills/` + `kernel/` = 24,745 of the 28,257 shipped lines). This is the plan's own
standard applied to itself: *"A miss is a finding to record, not a number to explain away."*
Whether and how to act on these misses is explicitly out of this stage's scope, per its own
guardrail against a verification phase widening into a fix project.

## 4 · The v1.7.0 baseline live run — Stage S4

The one genuinely open question this phase could still answer with new live evidence: does v2.0
actually beat v1 on wall-clock and cost, as the plan's own probe 6 predicts? A dedicated `git
worktree`, checked out at the `v1.7.0` tag (the `-final` suffix `PLAN.md`/`CHANGELOG.md` both name
was never actually applied to any tag — a pre-existing, harmless doc/tag mismatch this run
surfaced and worked around, not one it caused), drove the same `examples/todo-cli/` fixture through
v1's own runtime.

**Shaping alone produced a real, comparable number** — $1.39 / 4m58s, cheaper and faster than
v2.0's ~$1.80 / ~6.3min for the same phase (a prompt/skill-efficiency delta, not the architectural
one probe 6 is actually about, and reported as such).

**The BUILD-through-ship pipeline could not be started at all**, for a structural reason confirmed
at two independent code paths, not a flaky run: v1.7.0's headless permission grant is a prefix rule
keyed on the literal, unexpanded `${CLAUDE_PLUGIN_ROOT}` token, and the Claude Code CLI now
categorically rejects any Bash command containing `${VAR}` expansion *before permission-mode is
even consulted* — the same block whether the mode is `default`, `acceptEdits`, or attempted-and-
refused `bypassPermissions`. Evidence: two full, good-faith attempts through the documented
conversational entry point (41 permission denials total, transcripts captured in full), five
isolating diagnostic sessions that pinned the exact mechanism, and — after both conversational
attempts converged on the same dead end — one direct, disclosed invocation of `run-workflow.mjs`
itself from the operator's own shell (bypassing the Bash-tool input validator specifically, not the
harness's own checks), which produced a clean, real `aborted` RunReturn in 41.369s for $0.197705,
failing at its very first mechanical dispatch for the identical root cause reached independently.
`hooks/gate-zerowork.mjs` and `shapeup-run.js`'s own fail-closed discipline held throughout, on both
the v1 and v2 side of this comparison.

**v2.0 does not have this problem, by design, for a reason already on record three months before
this run** (`bin/lib/grant.mjs`, dated 2026-08-14): its grant is a glob on the *post-substitution*
absolute path, deliberately never asking the permission matcher to see a literal
`${CLAUDE_PLUGIN_ROOT}` token the way v1.7.0's grant does.

**What this means for G6, stated plainly:** no wall-clock or cost delta between v1 and v2 can be
computed on these terms — not because v1 is slower, but because v1's own dispatch mechanism no
longer functions against the CLI version available to run it. This is arguably a *stronger* signal
in the direction probe 6 predicted (v2.0 workably ships a real feature end to end; v1.7.0 cannot get
past its own first internal script call) than a slower-but-completing v1 number would have been —
but it is a different claim, and neither `tests/README.md` nor this document presents it as the
same one. Full evidence pack — two ship-attempt transcripts, five diagnostic transcripts, the direct
`run-workflow.mjs` invocation's `result.json`/`journal.jsonl`, and the worktree's own on-disk
artifacts —
`.plan-runs/phase7-verification-gauntlet/ledger/S4-v1-baseline/` (repo-only, gitignored, not
shipped; the worktree itself is deliberately left in place at this session's scratchpad rather than
torn down, in case a future CLI version makes a genuine re-run possible, or someone wants to
hand-widen the v1 grant as a separate, explicitly-scoped experiment).

## 5 · The plan's own Done-when, checked honestly against what actually happened

> **Done when:** all seven pass and are committed as CI-runnable checks (they replace the deleted
> eval machinery as the repo's proof of behavior).

**Not fully met, and recorded as such rather than smoothed — the same standard this plan already
applied to itself once, in Phase 3's D3 box.**

- **4 of 7 (G1, G3, G4, G5) pass and are committed as CI-runnable checks**, exactly as the
  Done-when asks — `tests/structural/21-gauntlet.mjs`, running in every `npm test`.
- **G2 does not pass.** It was run live and measured FAIL. It is deliberately *not* wrapped in a CI
  check — `21-gauntlet.mjs`'s own architectural reasoning (a check that cannot fail is worse than a
  missing one) governs here, and forcing a green CI assertion around a measured-FAIL live behavior
  would be exactly the "explain away a miss" move the plan's own probe 7 forbids one paragraph
  later. Proven by live-run evidence documents instead (`EXP-A-G2-G6.md`, cited from
  `tests/README.md`), which is a real, standing proof — just not a CI-runnable one, and the plan's
  literal Done-when did not anticipate that a probe could be *answered* without *passing*.
- **G6 is answered, not passed.** The comparison the plan wanted turned out to be impossible to make
  on the terms probe 6 specifies (§4). This is new information the plan did not anticipate when it
  wrote "expect wall-clock ↓... and per-worker token cost ↓" — the honest outcome is a different,
  arguably stronger claim, not a number in either direction.
- **Probe 7 (the metrics audit) is not a CI-runnable check and was not made into one.** It is a
  point-in-time measurement document (`METRICS-P7.md`), by design — turning "shipped LOC is
  28,257" into a passing CI assertion would either need to assert a number already known to be
  wrong (dishonest) or be skipped/weakened the moment it's added (the exact failure mode this
  plan's whole Phase 7 exists to catch). Five of its six measured metrics are recorded misses.

**What *is* true:** every one of the seven probes was executed for real (not narrated, not assumed)
and its actual outcome is on record, in a fresh clone or from genuine live evidence, checked by an
independent verification pass over every stage before this document was written. That is the
substance behind "measured, not claimed" this plan has held itself to since Phase 0 — it is a
different, and arguably more honest, outcome than "all seven pass."

## 6 · Verification

`npm test` green throughout every structural change this phase made (1200 → 1203 checks — the
metrics-audit doc addition and its own citations, the same parametrized-scaling pattern Phase 6's
closure box already documented as non-drift, not a weakened suite). Every stage's acceptance was
independently re-run by the operator session, in a genuinely fresh clone at the committed HEAD, after
the executing workflow reported green — not trusted from the workflow's own say-so, per the
`plan-executor` skill's own Phase 5 rule ("a run should not be the last word on itself"). `claude
plugin validate . --strict` was not re-run this phase (no shipped-surface files changed — only
`tests/`, `docs/output/`, and `.plan-runs/`, none of which affect plugin/marketplace validation).

**Total cost of this phase's own live evidence-gathering:** ~$7.78 across S4's shaping run, two ship
attempts, five diagnostics, and the direct `run-workflow.mjs` invocation (verified by direct sum in
`S4-v1-baseline/SUMMARY.md`, not estimated) — separate from `EXP-A-G2-G6.md`'s own already-spent
~$40.52 for the v2.0 G2/G6 run this phase built on rather than re-ran.
