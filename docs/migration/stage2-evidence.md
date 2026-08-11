# Stage 2 evidence — `shapeup-run` + the thin skill + the pause protocol

**Stage:** S2 of `docs/migration/execution-contract.md` — **the ship gate of the cutover**. Stage 3
does not begin until both lane types are green (`execution-contract.md` guardrails, "Stage 2 is the
ship gate").
**Written:** 2026-08-10, Stage A of `docs/migration/remaining-stages-plan.md`.
**Provenance:** the A2/A3 runs and both defect write-ups were produced on **2026-08-07 at
`7c1b15e`** and quoted in `docs/migration/execution-report.md:32-125`; this file transcribes them
with citations rather than re-deriving them. The kill/resume probe in §4 was run on **2026-08-10**
at the Stage A working commit and is new evidence, not a transcription.

Everything below is an artifact or a verbatim return value. Where a claim is *not* backed by an
artifact, §5 says so by name.

---

## 1. A2 — the unattended lane: **GREEN**

`RunReturn`, verbatim, from a headless `claude -p` session (`execution-report.md:37-39`):

```json
{"status":"shipped","verdict":"pass","rounds_used":1,
 "dims_not_evaluated":["security","performance"],
 "qa_findings":6,"report":"shapeup/todo-persist/REPORT.md"}
```

| A2 requirement | Evidence, from artifacts (not narration) |
|---|---|
| completes through `shapeup-run` | `status: "shipped"` — the success arm of the `RunReturn` union |
| preset `ci`, unattended | `receipt.json`: `auto_level: unattended`, `gate_answers: ci`, `lane: full` |
| verdict recorded | `verdict: pass`, spec-conformance 7/7, 0 bugs |
| EVAL exactly once | exactly one `evaluate-r1.json` in `orders/` |
| zero orchestration prose | 9 orders / 9 results — every phase crossed the envelope port |

**The evaluation was not a rubber stamp**, and this is worth two lines because it is the difference
between a judge and a formality. The evaluator **re-hashed its own T0 citation** ("sha256 recomputed
from disk … matches the ledger line in `t0/trials.jsonl`"), **re-ran the tests itself** ("not taken
on the task file's word"), and **found a contract error case the test suite had missed** —
`WRITE_FAILED`, probed with a `chmod 555` directory. It also declined to grade a stale board counter
as out of the judge's scope. A judge that only confirms is not evidence that the thing under
judgement is correct; this one dissented, in both directions.

## 2. A3 — the interactive lane: both named gates crossed, nothing completed was redone

Six legs, each a **fresh session** (`execution-report.md:58-69`):

| leg | outcome | fast-forward check |
|---|---|---|
| 1 | `{"status":"paused","paused_at":"L1a"}` + full `block`; **refused to self-answer** | — |
| 2 | consumed the PO's merged **L1a** decision; **crashed** on a null courier at MAP SCOPES | ORIENT skipped |
| 3 | classifier block gone after the prompt fix; hit the account usage limit | nothing redone |
| 4 | absorbed **4** blocked calls, returned `{"status":"aborted","aborted_at":"L1b"}` carrying spec-lint's 2 red findings | nothing redone |
| 5 | `{"status":"paused","paused_at":"L1b"}`, scope `task-completion`, spec-lint 0 red | `orient.json`, `wire.json` **skipped**; `analyze.json` (no result) correctly resumed |
| 6 | crossed **L1b**, entered BUILD, completed one attempt — **stopped by operator request** | 5 orders / 5 results, all ingested |

Both gates the plan names for the interactive lane — **L1a** and **L1b** — were crossed by
pause → PO decision written to `gate-answers.json` → relaunch in a fresh session. Across four
relaunches the set of **redone** completed work was empty at every leg.

**The instrument needed a correction, and this is it.** The first version of the dispatch check
asserted *"no order file may be rewritten"*, which is stricter than the contract's *"re-dispatched
nothing already done"*. It flagged `analyze.json` — an order left with **no result** by leg 4's
blocked ingest. Resuming that order **is** the fast-forward working, not a violation of it. The
check now separates two things the earlier version conflated:

- **redone completed work** — an order that already had a result being dispatched again. A real
  violation. Empty at every leg.
- **resumed incomplete work** — an order with no result being picked up. Correct behaviour, and
  the mechanism the whole migration exists to buy.

That distinction is load-bearing for §4 below, where the same two sets are the probe's assertions.

## 3. Two defects reachable only by execution

Run 2 verified `shapeup-run.js` statically and found three defects. Run 3 **ran** it and found two
more that no amount of reading would have surfaced. Both are committed and `npm test`-green.

### `e4c8fa6` — the courier poisons its own stdout

A2's first execution aborted before ORIENT. The nested session diagnosed "a one-off subagent
formatting slip" and offered to retry. Running the probe command directly refuted that: 636 bytes of
clean JSON, exit 0, nothing appended. The stray `EXIT:0` was **manufactured by the courier** — asked
for an exit code it has no sanctioned way to observe, an agent reaches for `cmd; echo "EXIT:$?"` and
reports the combined text as stdout.

Five sites parse a courier's stdout. Only one of them fails loudly:

| site | silent consequence |
|---|---|
| `probe` | aborts the run (the visible one) |
| `checkScopeGreen` | green reads false — redoes T0, and **a resumed round loses the pre-kill T0 citation it must present at EVAL** |
| gate decision | `null` — **QA never dispatches under preset `ci`**, and L3's `stop` arm goes dead |
| T0 verdict (both files) | a **green scope reads red** — burns attempt budget, hammer-proposes a passing scope |

**The third row is the one that matters.** A null gate decision meant QA never dispatched under
preset `ci`, and A2 would have reported *green end to end* with QA silently skipped — a clean-looking
run missing a whole phase. Fixed by hardening the courier's prompt and routing all 8 parse sites
through `parseMechJson` (15/15 unit cases, including the negatives — a command that genuinely
printed nothing still returns `null`). Confirmed live: A2 dispatched `hunt.json` and its ship report
reads `qa: run`.

The second row is why this defect and §4's probe are the same story: `checkScopeGreen` is the exact
function a resumed round uses to decide it may skip a scope.

### `7c1b15e` — a dead courier must not be able to kill the run

A3 leg 2 died with `null is not an object (evaluating 'analyzeOrder.stdout')` and `status: "failed"`.
`agent()` returns `null` when a subagent is skipped or dies after retries — the runtime documents
this — and every call site dereferenced it. **`"failed"` is not a member of the `RunReturn` union**,
so `SKILL.md`'s Step 3 branch table has no arm for it: the PO gets a stack trace where the design
guarantees a gate.

Guarded at the boundary in both workflow files, with the policy following the architecture rather
than one blanket rule:

| lost worker | policy | why |
|---|---|---|
| ORIENT / WIRE / MAP-SCOPES / EVAL / GATE-H | `aborted`, phase named | no artifact, no downstream phase |
| a **build** worker | a spent *attempt* | the attempt budget exists for exactly this |
| a **QA** hunter | logged, the run ships | QA is a level-up, not a gate (`AGENTS.md`) |

**Leg 4 is the proof this fix earns its place:** the same classifier blocked *four* calls, and
instead of crashing, the run reached a real gate and returned
`{"status":"aborted","aborted_at":"L1b","reason":"<spec-lint's 2 red findings>"}`.
## 4. The kill/resume probe

**What it tests, and why it is not a formality.** This is the one test of the failure class the
whole migration was built to retire: the 82–120-turn handoff loss, where a session that dies
mid-BUILD takes the run's memory with it and the next session rebuilds what was already built. A3's
legs 2 and 5 demonstrate the mechanism incidentally — a *paused* run resumed without re-work — but a
pause is a graceful exit that returns a `RunReturn`. The probe asks the harder question: does the
fast-forward hold when nothing returns anything, because the process was killed where it stood?

**Method** (plan §3 verification step 4; `remaining-stages-plan.md` §A.2):

| step | what was done |
|---|---|
| plugin under test | `npm pack` of this branch → unpacked → registered as a **local** marketplace and installed, so `${CLAUDE_PLUGIN_ROOT}` resolves to the candidate build. `shapeup-run.js`, `SKILL.md` and `gate-zerowork.mjs` verified sha256-identical to the worktree — never the published 1.6.x, which would measure the control |
| project | a throwaway scratch project outside both checkouts, `npx shapeup-sdlc init`, workspace trusted so the pipeline permission grant is **active** rather than classifier-mediated |
| L0 | performed by hand — `init-run.mjs --slug todo-kill --auto-level unattended --gate-answers ci --max-rounds 2`, plus `project-profile.md`. **Deliberate:** it makes the two legs differ in exactly one respect, the state on disk |
| launch | one script, `launch.sh`, called twice. Both legs emit the byte-identical `Workflow({scriptPath, args})` call, `--model opus --permission-mode auto`, `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` |
| leg 1 | run until BUILD had at least one scope T0-green and at least one order in flight |
| the kill | `SIGKILL` to the session process — ungraceful by design. No `RunReturn`, no pause block, no chance to flush state |
| leg 2 | fresh session, the same `launch.sh`, the same args |

**Instrument.** `snapshot.mjs` hashes every file under `.shapeup/<slug>/` and `shapeup/<slug>/` at
the moment of the kill and again after the resumed leg. The assertions are then set operations over
those two snapshots, and they encode §2's correction rather than the contract's looser wording:

1. **No completed PHASE was re-dispatched.** For every phase order that already had a matching
   result at kill time (`orient`, `wire`, `analyze`, `map-scopes`), the order file and its result
   must be byte-identical and un-rewritten afterwards.
2. **No already-green SCOPE was rebuilt.** For every scope with a green T0 verdict for round *R* at
   kill time, no *new* verdict artifact for that (scope, round) may appear afterwards.
3. **The pre-kill T0 citation survives.** Every `t0/verdicts/*.json` present at kill time is still
   there, byte-identical, so a resumed round can still cite at EVAL the artifact its pre-kill self
   produced. (This is the property `e4c8fa6`'s `checkScopeGreen` row would have silently destroyed —
   see §3.)

Orders **without** a result at kill time are reported, not asserted on: resuming one of those is the
fast-forward working, exactly as §2 establishes.

**Why assertion 2 is phrased over verdicts rather than over order files, and why that matters.**
`compile-order.mjs:328` builds a build order's id as `r<round>-a<attempt>` with **no scope id in
it**. In a round with two scopes the second scope's attempt-1 order therefore *overwrites the
first's* — inside a single uninterrupted leg, before any kill. So `orders/` is not an audit trail of
build dispatches, and a byte-identity assertion over `r1-a1.json` would fail on a run that did
nothing wrong. T0 verdicts carry the claim instead: `t0-verify.mjs:349-358` writes
`r<R>-a<A>-t<trial>.json` with `wx` and a trial ordinal derived from the directory, so verdict
artifacts are immutable and each one names its own `scope_id` and `round`.

This has a direct consequence for the contract. The acceptance row as originally written — *"orders/
minus results/ is empty before it proceeds"* — **passed on this run**: `pending_orders_at_kill` was
`[]`, because scope 2's order had overwritten scope 1's, which already had a result. It passed while
the run was re-dispatching a completed phase. A check that reads green on the exact failure it
exists to catch is the same defect class as the two false-passing rows Stage A's §A.5 replaced.

### Result

```
kill-resume-probe: FAIL
```

> **⟐ Re-run 2026-08-11 after Stage A2 (`docs/migration/stage-a2-evidence.md` §7): still FAIL, and
> the cause has moved.** The defect recorded below — ORIENT re-dispatched because its skip was gated
> on stored `status` — is **fixed and proven fixed**: on the re-run, `orders/orient.json` and
> `results/orient.json` are byte-identical across an ungraceful kill, `status` moves through
> `orienting → building → evaluating`, the substrate pointer names the scope actually in flight, and
> the resumed leg carried the run to `{"status":"shipped","verdict":"pass","rounds_used":2}`.
> What fails now is **WIRE**, whose worker escalated and never wrote `wiring-map.md` — so the
> artifact-gated fast-forward correctly re-dispatches it, and the real defect is that an escalated
> phase is recorded as complete. The status line stays FAIL because the assertion as written does
> not pass, and narrowing it to fit would be the move this branch exists to refuse.

| # | assertion | outcome |
|---|---|---|
| 1 | no completed PHASE order was re-dispatched (4 completed at kill time) | **FAIL** — `orders/orient.json` rewritten, sha `7dd5aef9…` → `359f6650…` |
| 1b | no result for a completed phase was re-ingested (4 checked) | **FAIL** — `results/orient.json` rewritten, sha `4c0dd59e…` → `6b4107b6…` |
| 2 | no scope that was T0-green at kill time was rebuilt (1 green: `todo-cli-flow@r1`) | **PASS** |
| 3 | every pre-kill T0 verdict artifact survives byte-identical (1 found) | **PASS** |

State at the kill: scope `todo-cli-flow` T0-green (`t0/verdicts/r1-a1-t1.json`), scope
`verification-surface` compiled and dispatched with no result — exactly the "one green, one in
flight" the plan asks for. Leg 2 correctly skipped **WIRE** and **MAP SCOPES**, correctly skipped
the green scope, built `verification-surface` to a second green verdict (`r1-a1-t2.json`), and
**re-ran ORIENT from scratch**.

The re-dispatch was not merely wasted tokens. Leg 2's ORIENT worker rewrote `orient/code-surface.md`,
`orient/hill-signal.md` and `orient/discovered-seed.md`, added a new spike
(`orient/spike-2-post-build-integrity.md`), and changed `discovery/ledger.md` plus two task files.

### Why it failed — the fast-forward's one status-gated branch

Three facts on disk, and they compose into the defect:

1. **`harness-run.md` still reads `status: orienting`, with the mtime `init-run.mjs` gave it.** It
   never changed through two complete legs — 46 dispatched agents.
2. **ORIENT is the one phase whose skip is gated on that status, not on its artifacts.**
   `shapeup-run.js:411` reads `if (facts.status === null || facts.status === "orienting")` and
   dispatches. WIRE (`:442`, `!facts.has_wiring_map`) and MAP SCOPES (`:473-474`, `scope_files`)
   are gated on artifacts, and both skipped correctly. The comment directly above the ORIENT branch
   says it is *"skipped when `orient/` already produced its four artifacts"* — the code does not
   read those artifacts at all. **The doc is ahead of the code, in the same file the arm is in.**
3. **`setRunStatus` never ran.** Leg 1's workflow journal records **28 agents, 28 distinct keys,
   zero null results**, and its sequence goes `ingest:orient` → `gate-answers --resolve L1a` with
   nothing between — `shapeup-run.js:426`'s `await setRunStatus(slug, "mapping")` produced no agent.
   Leg 2: 18 agents, same absence.

So the run's status is pinned at `orienting` forever, and **every relaunch of a scoped run
re-dispatches ORIENT**. The kill is incidental — an interactive run that pauses at a gate and
relaunches (A3's own lane) hits this on every leg. A3's legs 2 and 5 recorded "ORIENT skipped", so
this is a regression *or* those legs' status writes landed; either way, nothing in the harness would
notice, which is the point below.

**A second instance of the same class, found by the same probe.** `.shapeup/active-scope` still
names `todo-cli-flow` — scope 1 — even though `verification-surface` was built twice (once per leg).
`shapeup-run.js:540-545` writes that pointer before each scope's attempt loop; leg 1 wrote it for
scope 1 (journal agent #21) and never for scope 2, and leg 2 never wrote it at all. `active-scope`
is what `hooks/sandbox-guard.mjs:102` reads to decide which substrate a worker may write, so
**scope 2's builder ran with the write-whitelist pointed at scope 1's substrate** — invariant #3
("parallel work cannot corrupt shared state", per-scope write-whitelists, hook-enforced) enforcing
the wrong scope, silently.

**What the two have in common, stated as an observation rather than a mechanism.** `setRunStatus`
and `writeActiveScope` are the only `mech()` call sites in `shapeup-run.js` whose return value is
never inspected. Every courier call whose result is consumed — `probe`, `checkScopeGreen`,
`compile`, `ingest`, `t0-verify`, the gate resolutions — appears in both journals and behaved
correctly. I did not establish *why* the runtime produced no agent for the fire-and-forget calls,
and I am not going to invent a mechanism for it. The finding that stands without that answer is the
design one: **a courier write whose result nobody reads is indistinguishable from one that
succeeded**, and here two such writes failed for two entire runs while the run reported normal
progress at every gate. That is the harness's own organising idea failing on its own terms —
`AGENTS.md`: *"Progress is derived, never claimed."* `status` is claimed.

## 5. What is NOT demonstrated

Stated plainly rather than left to inference:

- **The kill/resume probe FAILS** (§4). The fast-forward preserves scope-level work and the T0
  citation, and re-dispatches a completed phase.
- **No single interactive run has reached `shipped`.** A3 crossed L1a and L1b across six legs; leg 6
  was stopped by the operator inside BUILD. The unattended lane reached `shipped` (§1); the
  interactive lane has not been carried end to end in one run.
- **A2 and A3 were not re-run for this file.** They are transcribed from `execution-report.md`,
  produced 2026-08-07 at `7c1b15e`; 29 commits have landed since. §4's probe is the only part of
  this document measured at the Stage A working commit.
- **The probe used two scopes, one round, one attempt each.** Multi-round resume, an in-flight EVAL,
  and a kill during QA are untested.
- **L0 was performed by hand** for the probe (`init-run.mjs` + `project-profile.md`), so the probe
  exercises `shapeup-run.js`'s fast-forward, not `SKILL.md`'s L0 conversation.

## 6. Consequence for the ship gate

`docs/migration/remaining-stages-plan.md` §A.2 is explicit: *"If it fails, stop. A3 is not green,
S2's ship gate is not met, and every Stage B item unwinds."*

That is the position. **S2's ship gate is NOT met.** Stage A's own deliverables are complete — this
file, the `gate-zerowork` Workflow arm, its fixture, and the tightened contract rows — and Stage B
does not start. The defect in §4 is a code fix in `shapeup-run.js` plus a regression test, and it is
squarely inside the migration's own touch-map; it is not scope creep and it is not deferrable, because
the property it breaks is the single property the cutover exists to buy.
