# Execution report — workflow-orchestrator migration (cumulative)

Contract: `docs/migration/execution-contract.md`, compiled verbatim from
`docs/workflow_migration_plan.md` (sha256 `949dab98…`, **re-verified unchanged at run 3 start**).
Branch: `feat/workflow-orchestrator`. Executor: plan-executor skill.

| Run | Machine | Outcome |
|---|---|---|
| 1 (2026-08-06) | `/Users/teo/…` | S0, S1 green. S2 committed WIP/UNVERIFIED at `ff80176`. Parked on session usage limit. |
| 2 (2026-08-07) | `/Volumes/LibertyMobi/…` | Preflight re-derived state. Three defects found and fixed in S2's never-executed code (`d7fac48`). Blocked on S2's live runs — environment. |
| 3 (2026-08-07) | `/Volumes/LibertyMobi/…` | **Both blockers cleared. `shapeup-run.js` executed for the first time.** A2 **GREEN**. A3 substantially green (2/2 gates crossed, final leg stopped by operator). Two further defects found — both only reachable by running it. |
| 5 (2026-08-11) | `/Users/teo/…` | **Stage A2.** The fast-forward became a testable script, ORIENT was artifact-gated, every discarded courier outcome was closed (including every `ingest-result` call, in both workflow scripts), and **the probe was re-run**. Stage A's defect is **fixed and proven on a live ungraceful kill** — but the probe **FAILs again** on a different phase, so the ship gate is still shut. |
| 4 (2026-08-10) | `/Volumes/LibertyMobi/…` | **Stage A of `remaining-stages-plan.md`.** Evidence file written, A5 arm + fixture landed, instrument tightened. The kill/resume probe ran for the first time and **FAILED** — a third execution-only defect, and this one is on the property the migration exists to buy. **S2's ship gate is not met; Stage B did not start.** |
| 7 (2026-08-12) | `/Users/teo/…` | **Stage B — the cutover paperwork.** R7–R11 all green; the acceptance contract reads **23 PASS / 0 RED** for the first time on this branch, and **A6 is PASS** — a fresh clone runs 1221 checks, exit 0, with the 142-check gap against in-tree located to one module reading gitignored run records. `shapeup-build-round.js` deleted with **four** assertions moved, not the three the plan named. Two unfalsifiable instruments found by running them (R7's unescaped dot; `gates.md` naming the wrong home for the build/eval loop) and both fixed. `A7: DEFERRED`. **What it did not buy: the degenerate inner-breaker branch has still never run.** |
| 6 (2026-08-12) | `/Users/teo/…` | **Stage A3.** A phase completes only when its ARTIFACT exists, and `analyze` runs before WIRE. **The probe PASSES** — 4/4 assertions on a live SIGKILL mid-BUILD, graded by a byte-identical `assert.mjs` first self-tested in the failing direction on A2's snapshots. **S2's ship gate is MET; Stage B is unblocked.** Two environment findings (#12, #13) and one defect (HD-006) surfaced by running it. |
| 8 (2026-08-12) | `/Users/teo/…` | **The HD-007/008 fix — and the two claims it killed.** The launcher ships (`skills/tech-lead/scripts/run-workflow.mjs`), HD-008's "work by other means" escape is **deleted** with its test inverted in place, and the benchmark can now tell a lane that ran from one imitated — replayed against the six archived A7 workspaces it rejects candidate reps 2 and 3, which had been **scored**. Then: **HD-007's diagnosis is FALSE** (the `Workflow` tool *is* grantable; the bench's settings never carried the entry), and **`HD-009`** — `init`'s pipeline grant matches **no command at all**, so the full pipeline aborted at dispatch 1 on all three legs. `npm test` **1370**, contract **23/0**. Four commits, nothing pushed. **A7 cannot be re-run until HD-009 closes**; its command is written out and unfired (`hd007-fix-evidence.md` §6). |

---

## Where the run stands

In-tree at `2a134cd` (run 4): **19 PASS / 4 RED** against the *tightened* instrument, `npm test`
green at **1179 checks**. The last fresh-clone derivation remains run 3's — **1120 checks at
`7c1b15e`** — and re-deriving it is Stage B's A6, not run 4's.

**Restated after run 5 (2026-08-11), so the numbers above are not read as current.** `npm test` is
green in-tree at **1351 checks** (1328 before Stage A2; the 1179 → 1328 step was merged day-2 work,
not migration work). The contract is **19 PASS / 4 RED**, and it is no longer read — it is executed:
`node tools/contract-check.mjs` runs every row and prints the **gate before the count**. All four
red rows are Stage B/C work sitting downstream of a shut gate. `docs/migration/README.md` carries
the one-page position.

⟐ **Restated again after run 6 (2026-08-12), at `c4735c0`, both figures re-derived by execution:**
`npm test` green at **1363 checks**; `contract-check.mjs` prints **`GATE MET — S2 ship gate —
kill/resume probe: PASS`** above **19 PASS / 4 RED**. The count is unchanged from run 5 and that is
the instrument behaving: the rows never encoded the probe's verdict. The four reds are S3 rows and
now sit downstream of an **open** gate — Stage B work that has not started, not work that is
blocked.

| Stage | Status | Verified how |
|---|---|---|
| S0 — kill-switch spike (D1) | **GREEN — GO** | Re-derived run 3 in a fresh clone: 4/4 rows PASS |
| S1 — `shapeup-build-round` | **GREEN** | Re-derived run 3 in a fresh clone: 5/5 rows PASS |
| S2 — `shapeup-run` + thin skill | ⟐ **SHIP GATE MET at run 6 (2026-08-12)** — `kill-resume-probe: PASS`, 4/4 assertions on a live SIGKILL. It took three stages: A fixed nothing and found it, A2 fixed ORIENT and failed on WIRE, A3 fixed the class (completion depends on the artifact) and its cause (`analyze` before WIRE). *(Superseded: "NOT MET — an escalated phase is recorded as complete and re-dispatched on every relaunch.")* | `stage-a3-evidence.md` §4 + `contract-check.mjs` |
| S3 — cutover, detectors, benchmark | ⟐ **Stage B GREEN at run 7 (2026-08-12)** — R7–R11 closed, contract 23 PASS / 0 RED, A6 re-derived in a fresh clone at 1221. What remains of S3 is **Stage C**, which is a PO spend decision rather than executor work: `A7: DEFERRED`. *(Superseded: "Unblocked, not started"; and before that, "Blocked by the contract's ship-gate guardrail.")* | `stage3-evidence.md` + `contract-check.mjs` |
| ⟐ Post-S3 — HD-007/008 fix (run 8, 2026-08-12) | **SHIPPED, AND BLOCKED BY WHAT IT FOUND.** The launcher, the closed gate escape and the bench's lane-evidence rule are green at `npm test` **1370** / contract **23 PASS / 0 RED**. Then the premise was refuted (the `Workflow` tool **is** grantable) and **`HD-009`** surfaced: `init`'s pipeline grant matches no command, so the lane cannot start and **A7 cannot be re-run**. Stage C's `A7: FAIL` stands unreplaced | `hd007-fix-evidence.md` |

Run 4 changed what the red rows *mean* twice over. Three S2 rows were greps for sections of
`stage2-evidence.md`, a file that only gets written once its runs are green — those are now green
because the file exists. But **all six S2 rows green is not the ship gate**, and this is the
distinction the whole instrument revision exists to make: the rows prove the evidence was written
and is machine-readable; `stage2-evidence.md` §4 records `kill-resume-probe: FAIL`, and the plan
makes a failing probe a stop. A 19/23 scoreboard above a failed gate is exactly the mis-navigation
run 4 set out to end.

### A1–A7 against the plan's own acceptance contract

Carried forward from `status-review-2026-08-10.md` §2 and **re-derived at `5209df7`** — that review
predates the probe run, so its A3 and A5 verdicts no longer hold and this table replaces them.

| # | Criterion | Verdict | Basis |
|---|---|---|---|
| A1 | Stage-0 kill-switch, all three checks | **GREEN** | `stage0-evidence.md`, `Decision: GO`, ≥2 quoted `deny` rows, cost labelled Sonnet |
| A2 | Unattended run through `shapeup-run`, preset `ci` | **GREEN** | `{"status":"shipped","verdict":"pass",…}`; 9 orders / 9 results; exactly one `evaluate-r1` order |
| A3 | Interactive, ≥2 gates via pause → decision → relaunch, nothing re-dispatched | **GREEN at run 6 (2026-08-12)** — `kill-resume-probe: PASS`, 4/4 assertions on a live SIGKILL; the resumed leg fast-forwarded past all four phases, skipped the already-green scope, finished the in-flight one, and ended at `gate_h/outer` (`stage-a3-evidence.md` §4). Superseded: **RED — cause changed at run 5** | ORIENT now survives a SIGKILL byte-identical, and the resumed leg reached `shipped`. It fails on WIRE: `solution-architect` escalated, wrote no `wiring-map.md`, and the pipeline recorded the phase complete anyway — so the artifact-gated fast-forward correctly re-runs it, forever (`stage-a2-evidence.md` §7.3) |
| A4 | Scoped-lane loop prose deleted; `SKILL.md` ≤ ~150 lines | **GREEN as restated (Rev B)** | `wc -l SKILL.md` = **121**; the `--tiny`/pre-scope-contract lanes keep their prose loop by design and `SKILL.md` names the boundary |
| A5 | `gate-zerowork` treats a `Workflow(shapeup-*)` launch as a dispatch; new fixture | **GREEN** *(was RED at `c469a6c`)* | Arm landed in Stage A; `tests/structural/17-gate-zerowork-workflow.mjs` exists; the contract's behavioural row returns `true` when run |
| A6 | `npm test` green in-tree **and** in a fresh `git clone --local` | **PARTIAL** | In-tree green at **1351**. Last clone-derived count is still **1120 at `7c1b15e`**; re-deriving it is Stage B's job |
| A7 | Benchmark F2, Sonnet-matched, candidate n=3 vs control n=3 | ⟐ **UNSTARTED — not blocked (corrected run 5)** | `sdd-harness-bench` **is present on this machine** (`14e4479`: adapter, runner, `f2-budgets`, 240 result rows). `s3-feasibility.mjs` exits 4 on **C3 only**, which asks about the *day-2 plan's* pre-fix build `a280e86` — not about A7's arms, both of which post-date v1.4.0. Rev B's "unobtainable" reading was true of the machine it was written on and was carried across machines without re-derivation. Gated now by the ship gate and by the PO's ~$40–60 spend decision, not by the instrument |

**A3 is the whole of the difference** between this table and the 2026-08-10 review. Everything the
review called "clerical debt" has been paid; what it could not know is that the one item it insisted
must not be skipped would come back red.

---

## A2 — the unattended lane: **GREEN**

`RunReturn`, verbatim, from a headless `claude -p` session:

```json
{"status":"shipped","verdict":"pass","rounds_used":1,
 "dims_not_evaluated":["security","performance"],
 "qa_findings":6,"report":"shapeup/todo-persist/REPORT.md"}
```

| A2 requirement | Evidence, from artifacts (not narration) |
|---|---|
| completes through `shapeup-run` | `status: "shipped"` — the union's success arm |
| preset `ci`, unattended | `receipt.json`: `auto_level: unattended`, `gate_answers: ci`, `lane: full` |
| verdict recorded | `verdict: pass`, spec-conformance 7/7, 0 bugs |
| EVAL exactly once | exactly one `evaluate-r1.json` in `orders/` |
| zero orchestration prose | 9 orders / 9 results — every phase an envelope |

The evaluation is not a rubber stamp. It **re-hashed its own T0 citation** (`sha256 recomputed
from disk … matches the ledger line in t0/trials.jsonl`), **re-ran the tests itself** ("not taken
on the task file's word"), and **found a contract error case the test suite missed**
(`WRITE_FAILED`, probed with a `chmod 555` directory). It also declined to grade a stale board
counter as out of the judge's scope.

## A3 — the interactive lane: 2/2 gates crossed, final leg stopped by the operator

| leg | outcome | fast-forward check |
|---|---|---|
| 1 | `{"status":"paused","paused_at":"L1a"}` + full `block`; **refused to self-answer** | — |
| 2 | consumed the PO's merged L1a decision; **crashed** on a null courier at MAP SCOPES | ORIENT skipped |
| 3 | classifier block gone after prompt fix; hit the account usage limit | nothing redone |
| 4 | absorbed **4** blocked calls, returned `{"status":"aborted","aborted_at":"L1b"}` with spec-lint's 2 red findings | nothing redone |
| 5 | `{"status":"paused","paused_at":"L1b"}`, scope `task-completion`, spec-lint 0 red | `orient.json`, `wire.json` **skipped**; `analyze.json` (no result) correctly resumed |
| 6 | crossed L1b, entered BUILD, completed one attempt — **stopped by operator request** | 5 orders / 5 results, all ingested |

Both gates the plan names for the interactive lane (**L1a**, **L1b**) were crossed by
pause → PO decision written to `gate-answers.json` → relaunch in a **fresh session**, and across
four relaunches **no completed work was ever redone**.

One correction to my own instrument: the first version of the dispatch check asserted "no order
file may be rewritten", which is stricter than the contract's "re-dispatched nothing *already
done*". It flagged `analyze.json` — an order left with **no result** by leg 4's blocked ingest.
Resuming that is the fast-forward working. The check now separates *redone completed work*
(a real violation, and empty at every leg) from *resumed incomplete work* (correct).

**Not yet demonstrated:** a single interactive run carried all the way to `shipped`. (The
kill/resume probe was the other item on this line until run 4 ran it — see below. It did not pass.)

---

## What run 3 found — two defects reachable only by execution

Run 2 verified `shapeup-run.js` statically and found three defects. Run 3 ran it and found two
more that no amount of reading would have surfaced. Both are committed and `npm test`-green.

### `e4c8fa6` — the courier poisons its own stdout

A2's first execution aborted before ORIENT. The nested session diagnosed "a one-off subagent
formatting slip" and offered to retry. Running the probe command directly refuted that: 636 bytes
of clean JSON, exit 0, nothing appended. The stray `EXIT:0` was **manufactured by the courier** —
asked for an exit code it has no sanctioned way to observe, an agent reaches for
`cmd; echo "EXIT:$?"` and reports the combined text.

Five sites parse a courier's stdout; only one fails loudly:

| site | silent consequence |
|---|---|
| `probe` | aborts the run (the visible one) |
| `checkScopeGreen` | green reads false — redoes T0, and a resumed round loses the pre-kill T0 citation it must present at EVAL |
| gate decision | `null` — **QA never dispatches under preset `ci`**, L3's `stop` arm goes dead |
| T0 verdict (both files) | a **green scope reads red** — burns attempt budget, hammer-proposes a passing scope |

The third is the dangerous one: A2 would have reported *green end to end* with QA silently never
having run. Fixed by hardening the prompt and routing all 8 parse sites through `parseMechJson`
(15/15 unit cases, including the negatives — a command that genuinely printed nothing still
returns `null`). Confirmed live: A2 dispatched `hunt.json` and its ship report reads `qa: run`.

### `7c1b15e` — a dead courier must not be able to kill the run

A3 leg 2 died with `null is not an object (evaluating 'analyzeOrder.stdout')` and
`status: "failed"`. `agent()` returns `null` when a subagent is skipped or dies after retries —
the runtime documents this — and every call site dereferenced it. **`"failed"` is not a member of
the `RunReturn` union**, so `SKILL.md`'s Step 3 branch table has no arm for it: the PO gets a
stack trace where the design guarantees a gate.

Guarded at the boundary in both files, with the policy following the architecture rather than one
blanket rule: ORIENT/WIRE/MAP-SCOPES/EVAL/GATE-H → `aborted` with the phase named; a lost **build**
worker → a spent *attempt* (the budget exists for exactly this); a lost **QA** hunter → logged and
the run ships, because QA is a level-up, not a gate.

**Leg 4 is the proof this fix earns its place**: the same classifier blocked *four* calls, and
instead of crashing, the run reached a real gate and returned
`{"status":"aborted","aborted_at":"L1b","reason":"<spec-lint's 2 red findings>"}`.

---

---

## What run 4 found — the probe the ship gate was resting on

Stage A of `docs/migration/remaining-stages-plan.md`, executed 2026-08-10. Full evidence:
`docs/migration/stage2-evidence.md`. Commit `2a134cd`.

**Delivered:** the evidence file (A.1), the `gate-zerowork` Workflow arm and its own structural
fixture (A.3/A.4, suite 1168 → 1179, mutation-verified in both directions), and the tightened
acceptance instrument (A.5 — four rows replaced, one row's pipes escaped so a table-reading runner
could execute it at all, count re-derived).

**And the probe (A.2), never run before now, FAILED.** Scratch project outside both checkouts, the
plugin installed from this branch via `npm pack` registered as a *local* marketplace —
`shapeup-run.js`, `SKILL.md` and `gate-zerowork.mjs` verified sha256-identical to the worktree, so
this measured the candidate and not the published 1.6.x. Two scopes, one round, `SIGKILL` mid-BUILD
with one scope T0-green and one compiled and in flight. Fresh session, same launch script, same args.

| assertion | outcome |
|---|---|
| no already-green scope was rebuilt | **PASS** |
| every pre-kill T0 verdict survives byte-identical | **PASS** |
| no completed PHASE order was re-dispatched | **FAIL** — `orders/orient.json` `7dd5aef9…` → `359f6650…` |
| no result for a completed phase was re-ingested | **FAIL** — `results/orient.json` `4c0dd59e…` → `6b4107b6…` |

WIRE and MAP SCOPES fast-forwarded correctly. **ORIENT re-ran from scratch** — three orient
artifacts rewritten, a new spike added, `discovery/ledger.md` and two task files mutated.

### `shapeup-run.js:411` — one status-gated branch, and the status never moves

ORIENT is the only phase whose skip is gated on `harness-run.md`'s `status` rather than on its own
artifacts (WIRE reads `has_wiring_map`, MAP SCOPES reads `scope_files` — both correct). That status
**never left `orienting`**: mtime unchanged from `init-run.mjs` across two complete legs and 46
dispatched agents. Leg 1's workflow journal records 28 agents, 28 distinct keys, zero null results,
and its sequence runs `ingest:orient` → `gate-answers --resolve L1a` with nothing in between —
`:426`'s `setRunStatus` produced no agent at all. The comment directly above the branch says it
skips "when `orient/` already produced its four artifacts"; the code never reads them. **The doc is
ahead of the code, in the same file as the arm** — the same class run 4 was closing in
`gate-zerowork.mjs`, found one directory over.

The kill is incidental. Any relaunch re-dispatches ORIENT, including the interactive lane's normal
pause-and-relaunch — which is A3's own lane.

### The same class again, and a check that read green on the failure it watches

- **`.shapeup/active-scope` still names scope 1** although scope 2 was built in both legs.
  `:540-545` writes that pointer before each scope's attempt loop; leg 1 wrote it once, leg 2 never.
  `hooks/sandbox-guard.mjs:102` reads it to decide which substrate a worker may write, so scope 2's
  builder ran with the write-whitelist pointed at the wrong scope — invariant #3 enforcing the wrong
  thing, silently. `setRunStatus` and `writeActiveScope` are the only `mech()` call sites in the file
  whose return value is never inspected. *Why* the runtime produced no agent for them is not
  established, and run 4 did not invent a mechanism for it; the finding that stands without that
  answer is that a courier write nobody reads back is indistinguishable from one that succeeded.
- **The contract's own row for this property passed.** *"`orders/` minus `results/` is empty before
  it proceeds"* was satisfied at kill time, because `compile-order.mjs:328` gives a build order no
  scope id (`r<round>-a<attempt>`), so scope 2's order had overwritten scope 1's, which already had
  a result. The row read green on the exact failure it exists to catch — the same defect class as
  the two false-passing rows A.5 replaced, and the reason `stage2-evidence.md` asserts over T0
  verdict artifacts (immutable, `wx`-created, self-identifying) instead of over order filenames.

### Consequence

**S2's ship gate is not met.** Per the plan's §A.2 — *"If it fails, stop"* — Stage B did not start.
The fix is in `shapeup-run.js` (gate ORIENT on its artifacts as WIRE and MAP SCOPES already are, and
stop discarding those two courier results) plus a regression test. That is inside the migration's own
Appendix touch-map: it is not scope creep, and it is not deferrable, because the property it breaks
is the one the cutover exists to buy.

---

## Findings recorded, deliberately not fixed

Each is outside the plan's Appendix file-touch map, and a diff outside that map is scope creep by
the contract's own guardrail.

> **This list is the register — there is no other copy.** Earlier revisions of this report cited
> `.plan-runs/workflow-migration/ledger/run3-environment-findings.md` as the home of these findings.
> That file was never committed: `.gitignore` ignores `.plan-runs/`, only `day2-rev5` was ever
> force-added, and the ledger is neither on disk in this checkout nor anywhere in history. The nine
> entries below are what survives, and Stage D's D.4 item — "transcribe the ledger into a committed
> register" — is therefore already discharged by this section, not pending against a missing file.

1. **`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` is mandatory for headless runs.** Without it
   `claude -p` terminates the Workflow at 600 s, **exits 0**, and reports a truncated run as a
   clean one. Measured: a run frozen mid-MAP-SCOPES that read as success.
2. **The launching prompt's prohibitions leak onto the workflow's own pipeline calls.** A
   prohibition addressed to the orchestrator ("do not re-dispatch work", "do not compile orders
   yourself") is applied by the safety classifier to `shapeup-run.js`'s *internal* envelope-port
   calls, blocking them. This is a cost the Workflow lane pays that the prose lane did not: the
   prose orchestrator's calls were its own; the workflow's are made by subagents judged against a
   prompt written for someone else. `SKILL.md` Step 2 offers no framing guidance, so any operator
   writing launch prose can re-create it.
3. **`SKILL.md` never says the headless launch must be awaited in-turn.** A session that ends
   while the Workflow runs loses the `RunReturn` entirely and orphans its agents — observed once.
4. **`project-profile.md` is written by the skill and never validated.** Two runs produced
   `library` (valid) and `cli` (**not in the enum**); the invalid value propagated downstream as
   fact — QA hunted on it, and `trace-lint` resolves reachability by it.
5. **`mechNode`'s inline `node --input-type=module -e` calls match no `permissions.allow` entry**,
   so they pass only at the classifier's discretion. *(Run 4: still live, and now with a measured
   consequence — the two `mechNode` writes whose results nobody reads back never produced an agent
   across two full runs, and nothing in the harness noticed. See "What run 4 found".)*
6. **`ship-report.mjs` reports `rounds_used: 0`** for a run whose `RunReturn` and artifacts both
   say 1.
7. **A T0 trial ran with the wrong cwd**, reverting a green trial. `mech()` assumes commands are
   safe to run twice; `t0-verify.mjs` is not idempotent. Survivable (the loop retried and passed),
   but real.
8. **A freshly-installed project is UNTRUSTED, so the permission grant `bin/init.mjs` just wrote is
   ignored in full** *(new, run 4)*. `npx shapeup-sdlc init` completes and reports success; the first
   headless run in that directory then prints `Ignoring 6 permissions.allow entries from
   .claude/settings.json: this workspace has not been trusted`, and every pipeline script falls back
   to the safety classifier. This is the 26-denial class arriving one layer above where the installer
   closed it — the grant exists, is correct, and is inert. The fix is a line in the installer's own
   output (or in `docs/upgrading.md`) naming the one-time trust step; run 4 set
   `projects[<path>].hasTrustDialogAccepted` in `~/.claude.json` by hand to get a clean probe.
9. **A build order's id carries no scope id** *(new, run 4)*. **Closed at Stage A2** — see
   `stage-a2-evidence.md` §5; it was the reason a contract row read green on a failing probe, which
   made it an instrument defect rather than an unrelated one. `compile-order.mjs:328` names it
   `r<round>-a<attempt>`, so in a multi-scope round each scope's order overwrites the previous
   scope's on disk. Harmless to the pipeline — an order is consumed immediately after it is compiled
   — but it means `orders/` is not an audit trail of build dispatches, and it is what let the
   contract's `orders/ minus results/` row read green on a failing run. T0 verdicts do this correctly
   (`t0-verify.mjs:349-358`).

10. **`bin/init.mjs` silently converts a LOCAL marketplace into a GitHub clone** *(new, run 5)*.
   The documented recipe for testing a candidate build is `npm pack` → unpack → register the
   directory as a local marketplace → install, so `${CLAUDE_PLUGIN_ROOT}` resolves to the candidate
   (`execution-contract.md` guardrails: *"Never test against the published 1.6.x — that measures the
   control, not the candidate"*). Running `npx shapeup-sdlc init` afterwards **undoes it**: it
   re-adds the marketplace by `repo`, clones `nguyenvanphituoc/shapeup-sdlc-plugin` from GitHub over
   it, and rewrites the project's `extraKnownMarketplaces` source from `directory` to `github` while
   keeping the local path in the record — a spelling that looks local and resolves remote. Measured
   at run 5: `shapeup-run.js` and `resume-state.mjs` were **absent** from the resolved plugin root
   and `gate-zerowork.mjs` hashed to the published build. A probe run at that moment would have
   measured the control while reporting on the candidate, and only the sha256 check caught it.
   Workaround used: give the candidate its own version, then uninstall → re-add the directory
   marketplace → reinstall, and verify every file by hash before launching.
11. **The archetype enum has no `cli` member** *(new, run 5 — the root of finding #4)*. Finding #4
   recorded that a run emitted `archetype: cli`, which is not in the enum, and that nothing
   validated it at write time. The reason it was reachable: `domain.schema.json`'s enum is
   `client-only-game | web-service | mobile | library | data-pipeline`, and a command-line tool —
   the single most common shape of a small feature — has no honest value. The write-time validator
   finding #4 asks for would have blocked run 5's own profile; the enum needs the member as well as
   the check.
12. **Declaring a marketplace in `.claude/settings.json` is not INSTALLING it** *(new, run 6)*.
   With `extraKnownMarketplaces` + `enabledPlugins` written and nothing else, `claude -p` in the
   scratch project saw **zero** `shapeup-sdlc-plugin` skills — so every `Skill(...)` dispatch the
   workflow makes would have failed mid-leg, for a reason that looks nothing like its cause.
   `claude plugin marketplace add` + `claude plugin install` are what put the plugin in the cache;
   both are now in the probe rig's `seed-project.sh`.
13. **`claude plugin install` is a no-op when the cache already holds that version** *(new, run 6)*.
   A rebuilt candidate installs "successfully" and the session keeps executing the PREVIOUS build.
   Measured on the A3 fix's first re-pack: the candidate carried the change, the cache did not, and
   only the rig's own sha256 assertion said so. `install-candidate.sh` purges the cached version
   before packing. This is finding #10's family — the environment quietly serving the control.
14. **A WorkOrder never names its own result file** *(new, run 6 — filed as HD-006)*. The order
   carries `order_id`, `substrate` and `payload`; where the WorkResult goes lives only in each
   worker's SKILL.md prose, and the operation's `substrate.allowed` does not include it. Two
   consecutive ORIENT dispatches against the same order failed two different ways — one wrote the
   result and reported a **directory** (`EISDIR`), the next wrote its four artifacts and **no result
   at all** (`ENOENT`) — both after doing the craft correctly. Worked around in both workflow
   scripts (the dispatch prompt states the path; the pipeline derives it from the order); the real
   fix is a bet, in `shapeup/knowledge-base/harness-defects.md`.
---

## Executor rules still in force

- **No merge to `main`, no tag, no publish.** The cutover merge is the PO's move after S3.
  *(Run 4 amendment: the feature branch itself was pushed to `origin/feat/workflow-orchestrator` on
  explicit PO instruction, 2026-08-10. That is a branch push for review and backup — no merge, no
  tag, nothing published to npm. The rule's intent, "the release is the PO's decision," is intact.)*
  ⟐ **Run 6 correction, 2026-08-12: that push is 20 commits stale.** `origin/feat/workflow-orchestrator`
  is at `5209df7`; everything Stage A2 and Stage A3 produced is local-only, including both probe rigs
  and the run that met the gate. A reviewer reading the remote sees a branch whose own documents say
  the gate is shut. Pushing is one command and needs no permission the PO has not already given — it
  is listed here rather than done because the standing instruction was for one push on one date, and
  re-deriving that instruction as standing is the error this line now records.
- **The ~$40–60 A7 benchmark does not launch autonomously** — it pauses for an explicit go.
- **S2 was the ship gate and it is MET as of run 6 (2026-08-12)**: `kill-resume-probe: PASS`,
  A2 and A3 both green, `contract-check.mjs` printing GATE MET. Stage B is unblocked; S3's own rows
  stay red until S3 actually runs. *(Superseded: "as of run 4 it is not met — the kill/resume probe
  failed, so A3 is not green and Stage B is blocked".)*

## The one thing to do next

> ⟐ **Run 8, 2026-08-12 — and it is a PO decision, not executor work.** `HD-009`: the grant
> `npx shapeup-sdlc init` writes — `Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/:*)` —
> **matches no command at all.** Bash prefix rules bind on whole-argument boundaries, so a prefix
> ending mid-argument grants nothing; and the *quoted* call-site form every skill uses (adopted so
> spaced install paths would not break) matches no rule in either spelling. The full pipeline was
> attempted three times through the newly shipped launcher and **aborted at dispatch 1 every time**.
>
> `tests/structural/14-invocation-paths.mjs` stayed green throughout because it asserts the grant is
> a **string prefix** of each documented command — a proxy for "the CLI honours this" that diverges
> from the behaviour exactly here. The benchmark's harness scripts ran only because its adapter
> appends a broad `Bash(node:*)`, so the bench has been measuring a permission configuration the
> plugin does not ship.
>
> **Three options, each trading something real** (`shapeup/knowledge-base/harness-defects.md`
> HD-009): enumerate whole-argument rules per script and unquote the call sites (least privilege
> intact, re-opens the spaced-path break); grant `Bash(node:*)` (known to work, broad); or keep the
> tool lane and grant the unscoped `"Workflow"` token (which has the same unscopable problem one
> tool over). **Whichever is chosen, its regression guard must EXECUTE a granted command** — string
> comparison is what let this stand through every green run above.
>
> **Until it closes, A7 cannot be re-run**: the candidate arm would measure denials again. Full
> record, including the two refutations and what remains unproven: `hd007-fix-evidence.md`.

**The defect that stood here is fixed and the gate it shut is open** (run 6): an escalated phase can
no longer be recorded as complete — every dispatched phase is followed by
`resume-state.mjs --require <phase>`, and an unmet post-condition aborts naming the phase. WIRE
stopped escalating for a second reason: `analyze` now runs before it, so `solution-architect` gets
the `usecases/` its contract reads. `kill-resume-probe: PASS`, 4/4 assertions
(`stage-a3-evidence.md` §4).

**What replaces it: Stage B**, whose first item is R10 — `shapeup-build-round.js` is unreachable
(nothing launches it; only a test asserts it *exists*) and must be deleted or documented as a live
second entry point. This stage added the argument for deleting it: the same fix had to be written
into it twice, because a workflow script cannot import.

**All three steps that stood here are done** (run 6), and each is worth one line because each was
the plan's own prescription and each behaved differently from expectation:

1. ~~Make completion depend on the artifact, not on the result record.~~ Done —
   `resume-state.mjs --require <phase>`, deliberately the *same* derivation the fast-forward uses,
   so completion and resume cannot drift apart.
2. ~~Decide what an ESCALATE means to the outer pipeline.~~ Done — it aborts, naming the phase (D1).
   And the run that proved it never had to: WIRE stopped escalating once `analyze` ran first.
   **The escalation was a symptom of a pipeline ordering bug, not a worker's judgement call.**
3. ~~Re-run the probe.~~ Done — `kill-resume-probe: PASS`. It took four launches to reach the kill
   window; two died on a defect the probe itself exposed (HD-006) and one on a session usage limit.

**What was refused, and stays refused:** narrowing assertion 1 so a re-dispatch stops counting.
The assertion never moved; the run changed under it. A gate you widen because your own change
failed it is not a gate.