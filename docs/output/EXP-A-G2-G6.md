# G2 / G6 — a live, unattended run of `todo-cli`, and what it found

Fixture: `examples/todo-cli/` (idea.md + EXPECTED.md + `todo.contract.json` oracle). Run in this
worktree (`.claude/worktrees/agent-a43804fbf3aaab848`, branch `worktree-agent-a43804fbf3aaab848`)
— its `HEAD` was found ~90 commits behind v2's tip when this experiment started (a pure ancestor,
zero divergent commits) and fast-forwarded onto `b84978e` before any of this began, via `git merge
--ff-only v2`. Every model `sonnet`, `--parallel-scopes 2`, `--gate-answers ci`, `--auto-level
unattended`, driven through the shipped `/shapeup-sdlc-plugin:shape` and `/shapeup-sdlc-plugin:ship`
commands under `claude --plugin-dir .`, one nested `-p` session per phase, resumed across turns.
The permission grant (`bin/lib/grant.mjs`'s two kernel Bash rules + the `Workflow` token) was
applied to this worktree's `.claude/settings.json` directly, mirroring what `npx shapeup-sdlc init`
would write for a consumer project — not run wholesale, since this worktree *is* the plugin
checkout, not a consumer of it. Method throughout: drive the real CLI against a real model, read
what actually happened off disk, never assume from source. All timestamps UTC.

## Headline

**G2 (zero-prompt unattended completion): FAIL**, precisely characterized below — not a hang, not
a crash, two distinct stalls, each with a named cause. **G6 (cost/wall-clock): produced**, the
first number of its kind in this repo, with an explicit account of what could and could not be
measured and why. **One major defect found, fixed, and verified live end to end**: EVAL's
PASS/FAIL verdict was read from a sub-agent's own summary of its work rather than from the
WorkResult it had just written, and a live FAIL was misread as PASS, skipping straight to QA/GATE
H with no fix round. Fixed (`kernel/probe/eval.mjs` + a `shapeup-run.js` branch rewrite, committed
`8c85b57`), and the fix was proven against a live relaunch of the *same* run: round 2 now
dispatches (it never did before), fixes both cited bugs, and its own genuine PASS (7/7 criteria, 0
bugs) was correctly recognized this time — the run went on to a clean, correct **`shipped`**
terminal state, with `shapeup/todo-cli/REPORT.md` frozen at GATE L4 and a genuine
`scope-hammer` **"SHIP now"** verdict. The deliverable itself works: every edge in
`EXPECTED.md`'s block C verified by hand against the built binary.

---

## G2 — did the unattended run complete with zero prompts?

**No — two stalls, neither a permission hang, both self-initiated pauses for a defensible
reason.** Recorded exactly, in the order they happened:

### Stall 1 — a judgment call surfaced despite an explicit "do not stop to ask" instruction

The literal test (grant-only permissions, no `--permission-mode` override, `--unattended
--gate-answers ci`, explicit "typing the flag IS the confirmation — do not stop to ask") got
`harness init run` to succeed (receipt written, `run_id
todo-cli-20260819T074658Z-24cc233a`), then **stopped and asked a question** before ever calling
the `Workflow` tool: `examples/todo-cli/EXPECTED.md` warns against building inside the plugin
tree, and the session, on its own initiative, paused to ask whether to build in place in this
worktree or copy the pitch to `/tmp` first. Cost of this segment: **$1.166, 26 turns, 151 s**,
`is_error: false` — a clean turn, not a crash. This is not one of AGENTS.md's coded ⏸ gates (no
gate block was emitted); it is a judgment call the model chose to surface, correctly reasoned but
still a prompt in a run that was told not to produce one. Resolved by telling it this worktree
*is* the dedicated scratch checkout (true, and consistent with this task's own brief).

**A friction finding alongside it, not a hard block:** 5 `Bash` calls trying to reach
`kernel/harness.mjs` (`--help`, unquoted paths, a relative-without-slash quoted path, a
compound `cd &&` form) were denied by the CLI's own permission layer before one landed on the
exact shape the grant matches (`Bash(node "*/kernel/harness.mjs" *)` — quoted, glob-rooted, a
single non-compound command). The grant is exact-shaped; a model improvising the invocation from
memory easily produces a form outside it. Real, reproducible, cheap (denied calls, not stalls —
the session kept trying until one matched) but worth noting as a second layer under Stall 1.

### Stall 2 — the run correctly refused to compound its own bug into a false ship

After being told to build in place and never ask again ("resolve every judgment call yourself...
if you are tempted to ask a clarifying question, resolve it and note the decision instead"), the
resumed session (`--permission-mode acceptEdits` this time — see "Why acceptEdits" below) drove
cleanly through ORIENT → ANALYZE → WIRE → MAP SCOPES → BUILD → EVAL, hit the EVAL-verdict defect
(next section), and **stopped again** — this time explicitly because it detected the
orchestrator's own control flow disagreeing with its documented invariants, named it "a genuine
control-flow defect... not something I can default my way through", and asked how to proceed
rather than silently shipping (or silently not-shipping) past an inconsistency it could see but
not resolve on its own authority. Cost of this segment: **$22.95, 16 turns, 314.6 s** session
duration (the dispatch ledger's own timestamps span 56.1 minutes of real phase work within it —
see G6). Given the defect it found (below), this was the right call, not a failure of discipline
— but it is still a second prompt in a run configured for zero.

**Verdict:** under the *literal* G2 condition (kernel-only grant, no permission-mode override,
one shot), the run does not complete unattended — it stalls before the `Workflow` tool is ever
called. Under a *corrected* condition (the same grant, plus `--permission-mode acceptEdits` to
cover the generic Write/Edit calls every worker skill makes, which the documented grant never
claimed to cover), it reaches a real terminal state (`aborted`, `verdict: cannot-ship`) but still
surfaces one prompt, for a reason worth surfacing.

### Why `acceptEdits` — and what that says about the documented grant

`npx shapeup-sdlc init`'s grant (`bin/lib/grant.mjs`) covers exactly two things: the kernel's own
Bash invocation, and the `Workflow` token. AGENTS.md's own claim is narrower than it reads: it
prevents the run from stalling **at its first deterministic step** (`harness init run`), not from
needing *any* further permission the whole way through. Measured directly in the Phase-1 shaping
session (before any of the build-phase work): a plain `mkdir`/`Write` to create
`shapeup/todo-cli/shaping/` was denied outright under the grant-only condition — no interactive
channel, no retry-until-match (unlike the kernel-grant friction above, generic Write/Edit has no
matching rule *to* find). `--permission-mode acceptEdits` is the standard Claude Code fix for
that, and it is *not* the harness routing around its own enforcement — the harness's own hooks
(`sandbox-guard`, `safety-spine`, `gate-zerowork`, `gate-intake`, `dispatch-receipt`,
`validate-envelope`) fired on every single tool call throughout, under `acceptEdits`, exactly as
AGENTS.md says they must ("Under every permission mode, including `bypassPermissions`"; confirmed
live — see the sandbox-guard denials below, which fired and held regardless of `acceptEdits`).
What `acceptEdits` bypasses is Claude Code's own generic file-edit approval, which the documented
grant never claimed to cover and which every worker skill needs constantly. **This is the honest
G2 finding: the documented grant is necessary but not sufficient for a truly unattended run; a
real unattended lane needs a CLI permission mode as well, and AGENTS.md doesn't say so.**

---

## G6 — wall-clock and cost, by phase

The harness ships tooling for exactly this (`harness report export`, `harness probe stats
--economics`), keyed off `.shapeup/<slug>/workflow-run/journal.jsonl`. **That file was never
written.** Checked directly: no `workflow-run/` directory exists anywhere under
`.shapeup/todo-cli/` for the whole life of this run, despite `shapeup-run.js` containing zero
references to `"journal"` anywhere in its own source — the file is a read-side assumption
(`kernel/report/facts.mjs`'s `agentCallRow()` reads `row.phase`, which the code comment says the
Workflow *runtime* is supposed to stamp) that nothing on the write side ever satisfies in this
environment. **G6's own instrumentation is silently inert on a real run** — a second, adjacent
finding to the one this whole report is about (a mechanism trusted to produce a fact that it
never actually produces). Filed here rather than fixed: the fix would mean either teaching the
runtime to write the journal or teaching `shapeup-run.js` to write its own, and both are a larger
change than this run's budget affords; the honest thing is to say the number this repo's own
tooling was built to produce could not be produced by that tooling.

**What follows instead is derived from `.shapeup/todo-cli/receipts/dispatch.jsonl`** — the
dispatch-attestation ledger AGENTS.md's "Attested, not assumed" rule describes, written by the
`dispatch-receipt` hook on every real `Skill()` dispatch, independent of the missing journal.
Each row's timestamp is when that worker's **dispatch resolved** (the skill's instructions
loaded and the sub-agent took over the turn — not when its work finished; confirmed by watching
`decisions.jsonl` continue accumulating ordinary Bash/Read/Write rows for minutes after each
receipt fires, before the *next* dispatch-receipt appears). A phase's span below is therefore
"from this worker starting to the next worker starting," which
folds each gate's review + any relaunch overhead into the phase that follows it. This is real,
mechanically-timestamped data, not an estimate — but it is a coarser cut than the journal would
have given, and cost could not be split by phase at all (below).

### Round 1 (Orient → the EVAL-verdict defect → aborted at GATE H)

| Phase | Dispatch → next dispatch | Wall-clock | Notes |
|---|---|---:|---|
| Orient | 07:51:59.798 → 07:54:59.561 | 2m 59.8s | clean |
| Analyze | 07:54:59.561 → 08:10:16.026 | 15m 16.5s | includes the GATE L1a relaunch cycle |
| Wire | 08:10:16.026 → 08:12:49.159 | 2m 33.1s | clean |
| Map Scopes | 08:12:49.159 → 08:25:39.711 | 12m 50.6s | includes GATE L1a.5 + L1b relaunches; scope-architect cut **one** scope (`todo-cli-core`, ICEBERG) — see "Notes for a future v1-vs-v2 comparison" below for why |
| Build (r1, a1) | 08:25:39.711 → 08:32:29.301 | 6m 49.6s | 2 T0 trials (0/1 → 1/1, kept both); T0-green on attempt 1 |
| Eval (r1) | 08:32:29.301 → 08:40:12.756 | 7m 43.5s | genuine **FAIL** (2 bugs); the evaluator's own report documents losing live-CLI-driving ability to the same permission-narrowness noted above |
| QA (r1) | 08:40:12.756 → 08:40:58.603 | 45.8s | not a real hunt — qa-edge-hunter's own Q0 preflight caught the FAIL verdict and escalated cleanly (see defects) |
| Ship / GATE H (r1) | 08:40:58.603 → ~08:48:06 | 7m 7.4s | scope-hammer: **CANNOT SHIP**, correctly recommends round 2; session stops to report the control-flow inconsistency (Stall 2) |
| **Total, Orient→abort** | 07:51:59.798 → 08:48:06 | **56m 6.2s** | |

Cost for this whole segment (one session turn covering GATE-L0-collection-onward through the
abort): **$22.95**, 297 k cache-write + 39.0 M cache-read + 288 k output tokens, **100% sonnet**
(`modelUsage` carries exactly one key: `claude-sonnet-5` — measured, not assumed; the "every
model sonnet, never opus" requirement held for the whole segment). No per-phase cost split is
possible without the journal (above).

### Round 2 (the fix, live, after relaunch — clean, no rate-limit gap folded in)

| Phase | Dispatch → next dispatch | Wall-clock | Notes |
|---|---|---:|---|
| Build (r2, a1) | 12:18:29.355 → 12:28:03.120 | 9m 33.8s | fixes BUG-1 (read/write-failure fixtures) + BUG-2 (`rm 2`); T0-green on attempt 1 |
| Eval (r2) | 12:28:03.120 → 12:32:10.857 | 4m 7.7s | genuine **PASS**, 7/7 criteria, 0 bugs — correctly recognized via the fixed mechanical read |
| QA (r2) | 12:32:10.857 → 12:34:25.337 | 2m 14.5s | escalated again — a *different*, new reason this time (D-A5) |
| Ship / GATE H (r2) | 12:34:25.337 → 12:35:54 (REPORT.md write time) | 1m 28.7s | scope-hammer: **SHIP now** |
| **Total, round 2** | 12:18:29.355 → 12:35:54 | **17m 24.6s** | |

Round 2 **skipped Orient/Analyze/Wire/Map Scopes entirely** — the fast-forward correctly resumed
from `eval_rounds_done: [1]` and picked up exactly at round 2, at zero cost for the ~40 minutes
of already-done upstream work. That resumability worked exactly as documented; worth stating
plainly since it is not something this report had reason to doubt going in.

**Important honesty check on the Build row above, in the session's own words** (worth quoting
rather than smoothing over): *"the natural relaunch did dispatch round 2 (proof the loop no
longer skips it), but the `task-executor` sub-agent hit the same recurring Bash-quoting flakiness
(and separately a session usage-limit) mid-attempt. Rather than keep re-rolling the dice, I took
over that one scope's attempt loop directly — compiled the order and ran `harness verify t0`
myself (my own Bash calls, reliably quoted), dispatched a fresh Agent only for the
`Skill(task-executor)` implementation step."* So round 2's BUILD phase was **not** a clean,
fully-automated `compile → dispatch → ingest` cycle end to end — the driving session
hand-completed part of the envelope-port choreography itself after the automated path proved
unreliable. This does not weaken the EVAL-verdict fix's own proof (`evaluate-r2.json`'s real
`overall: "PASS"` and `probe eval`'s mechanical read of it match exactly, and that comparison is
independent of how the BUILD leg was driven) — but it is a second, distinct robustness finding
under the same root cause as Stall 1's friction: **the standard dispatch shape is fragile enough,
under real Bash-quoting pressure, that even a session explicitly told to keep retrying chose to
bypass it** rather than spend more turns fighting it. Filed as a live-measured fact, not smoothed
into "round 2 just worked."

**Combined, clean pipeline wall-clock (round 1's Orient→abort + round 2's Build→Ship, excluding
the human-intervention gap and the rate-limit wait between them): 56m 6.2s + 17m 24.6s = 73m
30.8s** across two rounds, one scope, to a genuine PASS and a genuine ship.

**A minor, separate discrepancy noticed in passing, not chased further:** both `harness-run.md`
and the frozen `shapeup/todo-cli/REPORT.md` record `rounds_used: 0`, despite two real rounds
having run (round 1's BUILD+EVAL, round 2's BUILD+EVAL). Filed here as an observed fact — the
harvest field is wrong — not diagnosed to a root cause; it did not affect the ship decision
(scope-hammer's own H1/H2 reasoning reads the actual verdict artifacts, not this field).

### The relaunch tax (Preflight canary)

Every gate crossed under `--unattended` still returns a coded `paused` from `shapeup-run.js` (the
gate machinery is not silently skipped even headless — confirmed live: `harness-run.md`'s
`status` field and the dispatch ledger both show real gate-answer cycles happening), and the
calling session answers from the `ci` set and **relaunches the whole `Workflow` call**. Every
relaunch re-runs the script's own cheap "Preflight" canary dispatch (`phase: "Preflight"`, low
effort, no order) as its first act — this is `harness verify dispatch`'s live-canary check,
working as designed (RESULT-v2.md's own G2 note), just paying its cost once per gate rather than
once per run. Counted directly from `.shapeup/decisions.jsonl`: **6 canary dispatches** across
the two live segments (1 true first-launch + 5 gate-crossing relaunches in round 1's arc, +1 more
opening round 2). Cheap individually (low-effort sonnet, no work) but a real, measured,
previously-undocumented per-gate tax under `--unattended` — folded into the following phase's
span in the tables above, not isolated, because the missing journal is what would have isolated
it.

---

## Defects found, fixed, and their evidence

### D-A1 (major) — EVAL's verdict was read from a summary, not the artifact it summarized

**Symptom, measured:** `results/evaluate-r1.json` — the actual WorkResult `harness reduce ingest`
validated and applied — carries `"verdict": {"overall": "FAIL", ...}` (2 cited bugs, SC-ERR
failing: `E_STORE_READ_FAILED`/`E_STORE_WRITE_FAILED` implemented but never exercised by any
fixture). The very next dispatch was `qa-edge-hunter`, then `scope-hammer` — **no round-2 BUILD
ever happened.** Checked the complete decision log for the whole window: exactly those two
dispatches, nothing else. This is a direct violation of two invariants AGENTS.md states as
architectural: *"EVAL exactly once per round — QA sits after PASS, outside the loop"* and (from
`protocol.md`) *"QA never runs on a FAIL round."*

**Root cause, read from the code** (`skills/tech-lead/workflows/shapeup-run.js`, pre-fix):
```js
const e = await worker({ skill: "spec-evaluator", operation: "evaluate", schema: EVAL, ... });
if (e.__failed) return diedAt("L3", e);
verdict = e.overall === "PASS" ? "pass" : "fail";
```
`worker()` dispatches a fresh `Agent` whose prompt is: compile the order, dispatch
`Skill(spec-evaluator)`, run `reduce ingest`, then *"report ONLY the fields the schema names"* —
i.e. the dispatching sub-agent composes its own end-of-turn summary of what just happened,
schema-checked for **shape** only (`overall` must be the string `"PASS"` or `"FAIL"` — nothing
checks it against what was actually ingested). Given the real WorkResult says FAIL and the run
behaved exactly as `verdict === "pass"` predicts, the sub-agent's own summary drifted from the
artifact it was supposed to be summarizing. This is the identical failure shape the same file's
own comment says was already fixed once, for **gate decisions** specifically (*"IT USED TO BE
READ OUT OF `detail`, which is free prose a sub-agent writes... An unreadable decision now ABORTS
rather than defaulting"*) — never extended to the EVAL verdict, arguably the single
highest-stakes branch in the script.

**Confirmed systemic, not one-off:** `probe resume`'s `RESUME` schema tracks
`eval_rounds_done` (which rounds *ran*) but has no field for what a round's verdict *was* — so
even a resumed run has no mechanical way to recover "did round 1 pass" without re-trusting a
fresh sub-agent's summary all over again.

**Independently corroborated**, unprompted, by the very session running the pipeline: it
diagnosed the same gap on its own, via `receipts/dispatch.jsonl`, and named it "a genuine
control-flow defect... not something I can default my way through" before I told it my own
diagnosis (Stall 2, above).

**Fix** (`kernel/probe/eval.mjs`, new; `kernel/harness.mjs` router; `shapeup-run.js`'s EVAL
branch — committed `8c85b57`): a new `harness probe eval --slug <slug> --round N` reads
`results/evaluate-r<N>.json` straight off disk and prints `{ok, overall, bug_count,
report_path}` — the same "transcribe this JSON verbatim" pattern `probe t0`/`probe resume`
already use everywhere else a fact has to cross the Workflow script's no-filesystem boundary.
`shapeup-run.js`'s EVAL branch now calls it via the existing `query()` helper instead of trusting
`e.overall`.

**Verified twice, live:**
1. Against round 1's real, already-on-disk FAIL data: `probe eval --slug todo-cli --round 1` →
   `{"ok":true,"overall":"FAIL","bug_count":2,...}` — byte-correct against the artifact.
2. Against a live relaunch of the same run: round 2 **now dispatches at all** (it never did
   before), fixes the two cited bugs, and EVAL round 2 genuinely PASSES (7/7 criteria, 0 bugs,
   `results/evaluate-r2.json`). The fixed code correctly reads that PASS and the orchestrator
   correctly proceeds to QA only after it — the exact behavior the bug prevented.

`npm test`: 1194/1194 structural checks green with the fix in place (I did not capture an
isolated pre-fix count in this session — `npm test` was first run after `kernel/probe/eval.mjs`
already existed; stated plainly rather than implying a clean delta I did not measure).

### D-A2 — the individual worker skills' own defense-in-depth held, even though the orchestrator's didn't

Two independent downstream checks caught the same inconsistency the orchestrator missed, and
**neither silently proceeded**:

- **`qa-edge-hunter`'s own Q0 preflight** re-checked `EVAL-FEATURE-todo-cli.md` itself, found
  FAIL, and refused to hunt: `results/hunt.json` — `"status": "escalated"`, `deviations: ["GATE
  Q0 preflight hard check failed: EVAL-FEATURE-todo-cli.md exists but verdict is FAIL... Per the
  hard rule 'never run on FAIL — conformance first, edges after,' the hunt was not executed."]`.
  This is why round 1's "QA" phase in the table above took 45.8 s, not minutes: there was no
  hunt, by QA's own design.
- **`scope-hammer`'s own H0 trigger check** independently re-derived the same facts (`round_budget
  not exhausted`, `scope not FINISHED`, `EVAL FAIL routes to round r+1, not GATE H`, `QA never
  ran — Q0 refused`) and wrote, in its own report (`reports/hammer-r1.md`): *"This dispatch is
  therefore premature by the harness's own stop-condition rule... the recommendation is to
  return to the build loop rather than treat this as a ship decision."* It still had to issue a
  formal verdict — **CANNOT SHIP**, citing BUG-1 as the real, non-cuttable blocker — rather than
  silently accepting the premature dispatch.

**No false "shipped" occurred.** `shapeup/todo-cli/REPORT.md` (the committed, frozen ship report)
was never written — confirmed by its absence. The top-level bug wasted one QA dispatch and one
GATE H census on a path that should never have been taken, but every downstream check held, and
the run correctly refused to ship a broken feature. This is worth stating as plainly as the bug
itself: the redundant "measured, not claimed" checks this codebase is built around worked exactly
as intended, one level below where the actual defect lived.

A related, secondary gap in the same code, **not separately fixed** (out of the live evidence
this run produced — `--adversarial-verify` was never enabled, so this path was never exercised):
the QA phase's own handling of an `escalated` WorkResult (`if (q.__failed) ... else qaFindings =
q.findings_count`) only recognizes `__failed` when `worker()`'s own agent call returns a
non-object — a well-formed `{ok:false, findings_count:0}` self-report of an escalation would
silently read as "QA ran clean, found nothing" rather than "QA refused to run." Recorded for a
future pass; the live evidence here shows QA's *own* refusal working correctly, but the
orchestrator's *interpretation* of that refusal is the same class of shape-not-content gap as
D-A1, just further from the money.

### D-A3 — sandbox-guard held against real, live substrate-escape attempts

Four denials this run, all correctly enforced, none defeated:

| # | At | Attempted write | Denied because |
|---|---|---|---|
| 1 | 08:05:06Z | `.claude/settings.json` (self-edit) | outside every live order's substrate |
| 2 | 08:16:01Z | `../../../../../../../tmp/run_verify.sh` | path traversal out of the worktree |
| 3 | 08:21:03Z | `runverify.sh` (same idea, retried) | still outside `todo-cli-core`'s declared substrate |
| 4 | 12:28:38Z | `tmp_hash.mjs` (spec-evaluator's own scratch hashing script) | outside substrate |

\#1 reads as an agent, blocked on some earlier need, reaching for its own permission file to
self-unblock — exactly the privilege-escalation shape a sandbox exists to prevent, and it did.
\#2/\#3 read as a worker wanting an ad hoc verification script the scope contract's
`allowed_file_substrate` (`["bin/todo.js","package.json","src/commands/*.js",
"src/todo-repository.js","test/todo-cli.e2e.test.js"]`) never granted — and never needed to,
since the fixture command (`node --test test/todo-cli.e2e.test.js`) was already in-substrate and
sufficient; the worker recovered without it. \#4 is the same friction D-A4 documents, showing up
as a hook denial instead of a CLI permission wall. `git diff .claude/settings.json` after the run
confirms \#1 never actually landed — the only change present is the grant I applied at setup.

### D-A4 — the evaluator lost its own anti-self-grading discipline to the same permission gap

`EVAL-FEATURE-todo-cli.md`'s round-1 report documents this itself, transparently, rather than
silently degrading: *"This dispatch's Bash tool auto-approves only `node "<abs path>/kernel/
harness.mjs" *` plus a short list of built-in safe read-only commands... every other invocation —
including `shasum`, `openssl dgst`, `python3`, `node -e`, and running `bin/todo.js` itself —
returned 'This command requires approval'... So this pass could not spawn the CLI live; it graded
from (a) the round's own T0 artifact... and (b) direct reads..."* RESULT-v2.md's own methodology
for this exact evaluator step is *"sandboxed HOME to drive the real binary rather than reading the
code"* — the live run could not do that, for the same reason Stall 1's friction finding exists
(the kernel grant's exact shape, plus no grant at all for the evaluator's own scratch/verification
needs). The evaluator's own honesty about the gap (rather than silently upgrading its confidence)
is itself evidence the "absence must report itself" rule elsewhere in this codebase is being
followed here too.

### D-A5 (new, round 2) — QA never once performed a real hunt, for two different reasons across two rounds

Round 1's QA escalated because Q0 correctly caught the FAIL verdict (D-A2). Round 2's EVAL was a
genuine PASS, so Q0's FAIL-verdict check passed — and QA escalated anyway, for a **different**
reason: `results/hunt.json` (round 2) — `"status": "escalated"`, *"GATE Q0 preflight hard check
failed: could not reach the deliverable. todo-cli has no `app_url` (it is a CLI)... the hard check
requires one real invocation of the entry point (`bin/todo.js`) — but this run's Bash sandbox only
permits `node "*/kernel/harness.mjs" *`... every attempt to invoke `node bin/todo.js list` (a pure
read, no writes) was rejected with 'This command requires approval'."* `scope-hammer`'s own round-2
report reads this correctly and ships anyway, exactly per "QA is a level-up, not a gate": *"The one
gap on record is that QA's exploratory hunt could not execute in this sandbox — noted for the ship
report, not a reason to withhold shipping a spec-conformant, evaluator-passed build."*

**Net effect across the whole experiment: the QA Edge Hunt this codebase is built around never
once ran for real**, on either round, for two independent, both-legitimate reasons — and the
architecture held both times (no fabricated findings, no false confidence, a correct SHIP decision
in spite of a real gap in this run's own evidence). This is the same permission-narrowness theme
as D-A4, now shown to reach a *third* worker (qa-edge-hunter, after the outer session and
spec-evaluator) and to block something more consequential than a hash re-check: an entire
architectural level ("QA is a level-up") never got exercised in this whole experiment because the
documented grant covers the kernel and nothing built by it.

### D-A6 — two small, honestly-disclosed gaps at the very end, neither functional

The session's own closing summary, quoted rather than paraphrased: *"`bin/todo.js`'s execute bit
never got set (`chmod +x` is blocked here for everyone, including me, just now) — functionally
harmless since it's invoked as `node bin/todo.js` everywhere, never executed directly."* And:
*"TASK-001/002/006 still read `status: in-progress` in the local task board even though every one
of their AC boxes is checked and T0/EVAL both confirm the criteria pass — a stale status-flip in
`ingest`'s bookkeeping, not a functional gap."* Neither blocked the ship; both are filed here as
observed facts, not investigated further given this run's own time budget.

### D-A7 — building "in place" pollutes the plugin's own manifest, exactly as warned

`examples/todo-cli/EXPECTED.md` warns: *"a run started inside the plugin tree leaves an unrelated
CLI sitting in the repo and invites a worker's writes near the plugin's own files."* This task's
own brief asked for a dedicated worktree (satisfied — this worktree is not the main checkout),
but a worktree still shares the plugin's own root-level files. Measured: `task-executor`,
correctly following its scope contract's `allowed_file_substrate` (which legitimately includes
`package.json`, since a real consumer project needs its own manifest), added `"todo": "./bin/
todo.js"` to **this plugin's own `package.json`** `bin` block — there being only one
`package.json` in a worktree built in place. Reverted before committing the actual fix (`git
checkout -- package.json`); flagged here as a concrete, measured instance of the exact risk
EXPECTED.md names, not a harness defect — a fixture built in-place will always do this, by
design, given a scope contract that legitimately needs to touch the manifest.

### D-A8 — a bare command name is rejected upstream of the hook layer, exactly as AGENTS.md warns

First action of this whole run: `/shape examples/todo-cli/idea.md` → `"Unknown command: /shape.
Did you mean /shapeup?"`, `duration_ms: 10`, zero cost. AGENTS.md's own text: *"A bare name is not
a typo you get a warning for: an unknown skill name is rejected upstream of the hook layer, so the
dispatch fires no hook, leaves no decision row, and is answered by improvisation."* Confirmed
exactly: `/shapeup-sdlc-plugin:shape` (the fully-namespaced form) worked immediately after.
Filed as confirmation of an existing, accurate warning, not a new defect.

---

## The deliverable itself

Hand-driven directly (not through T0, not through EVAL — a third, independent check), against the
built `bin/todo.js` after round 2's fix:

| Edge | Command | Result |
|---|---|---|
| E1 empty list | `todo list` (fresh store) | `no todos`, exit 0 |
| E5 missing store | first run, no file | store created, exit 0 |
| happy path | `add` ×2 → `list` → `done 1` → `list` | numbered `[ ]`/`[x]` output, correct |
| E2 bad index | `done 99` | `error: no item 99`, exit 1 |
| E3 non-numeric | `done abc` | `error: "abc" is not a valid item number`, exit 1 |
| E4 corrupted store | store = `{garbage` | `error: store ... is corrupted (...); refusing to touch it`, exit 1, **store bytes unchanged** (`{garbage` preserved) |
| E6 idempotent done | `done 1` twice | `already done: buy milk`, exit 0, no crash |
| rm + renumber | `rm 1` on a 2-item store | `removed: buy milk`, remaining item renumbers to `1` |

Every edge in `EXPECTED.md`'s block C, and every command in the pitch, works exactly as specified.
This matches T0's own 12/12 and EVAL round 2's 7/7 — three independent checks (mechanical
fixtures, the LLM judge, and a human/agent driving the binary by hand) agree.

---

## What's not settled

- **A live session-limit hit** (`api_error_status: 429`, "session limit · resets 7pm
  (Asia/Saigon)") interrupted the first fix-verification attempt after ~96s of real work and
  $3.04 spent with nothing to show for it. Not a harness defect — an account-level constraint,
  disclosed rather than routed around. The retry after the reset is what produced the live proof
  in this report (round 2 dispatching, EVAL genuinely PASSing, the run reaching a real `shipped`
  RunReturn).
- **journal.jsonl** (D-A section, G6): the tooling this repo built for cost/wall-clock-by-phase
  measurement is not populated by a real run in this environment. This report's numbers come from
  the dispatch-receipt ledger instead — real, but coarser, and cost could not be split by phase
  at all.
- **Round 2's BUILD leg was not a clean automated dispatch** (see the note under the round-2
  table): the driving session hand-completed part of the envelope-port choreography after hitting
  the same Bash-quoting flakiness documented elsewhere in this report. The EVAL-verdict fix itself
  is proven regardless (the comparison that matters — `evaluate-r2.json`'s real content vs. what
  `probe eval` mechanically reads vs. what the orchestrator's `verdict` variable ended up as — all
  three agree), but a fully "hands-off, one relaunch, no session intervention" reproduction of
  round 2 was not achieved in this run.
- **`rounds_used: 0`** in both `harness-run.md` and the frozen `REPORT.md`, despite two real
  rounds having run — noted (D-A6 area) but not root-caused.

## Final outcome

`shapeup/todo-cli/REPORT.md` is frozen: **verdict PASS, 2 rounds, `shipped` (deploy pending PO)**,
0 QA findings (QA never executed for real either round — D-A5 — logged honestly by scope-hammer
as a run-environment gap, not carried as a ship blocker). Hand-verified independently against the
built `bin/todo.js`: every edge in `EXPECTED.md`'s block C passes. Three independent checks (T0's
12/12 fixtures, the evaluator's 7/7 criteria, and a human/agent driving the binary by hand) agree
the deliverable is correct.

## Notes for a future v1-vs-v2 comparison

This is the first live number of any kind for v2.0's cost/wall-clock. Two rounds, one scope,
clean builds (T0-green on attempt 1 both rounds): **56m 6.2s / ~$22.95** from Orient through an
(incorrectly) aborted GATE H, plus **17m 24.6s / ~$11.55** for the fix round once the defect
above was corrected and re-verified live — **73m 30.8s combined pipeline wall-clock, ~$34.50
combined pipeline cost**, excluding the Phase-1 shaping session (~$1.80, ~6.3 min), the literal-
condition G2 probe that stalled before launch (~$1.17, 151s), and the rate-limited dead attempt
(~$3.04, wasted). **Grand total across the whole experiment: ~$40.52.** `--parallel-scopes 2` was
never exercised — scope-architect cut this feature into **one** scope (`todo-cli-core`), reasoned
explicitly in its own contract as the right call (the four use cases share one composition root
and one repository module; splitting would force `shared_substrate` across scopes for zero real
parallelism, since scopes sharing a write path never build concurrently anyway). A future
concurrency comparison needs a fixture whose scope-architect output actually produces ≥2
independently-buildable scopes — this one, correctly cut, does not.
