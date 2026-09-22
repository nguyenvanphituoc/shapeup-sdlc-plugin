# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Index

Ids are stable handles: a plan, a commit subject and an acceptance pass all name the same row.
Tier comes from `docs/design/plans/which-defect-first.md`; an entry leaves this file when its fix
is pinned by a guard, never when it is merely believed done.

| id | defect | tier |
|---|---|---|
| HD-026 | a `gate_h` exit leaves no terminal close — the close-out covers two of four returns | P1 |
| HD-027 | two harness rules collide and hard-abort planning at L1b — citing the pitch's real source reds `TIER-DIRECTION` | P1 |
| HD-028 | the inner circuit breaker trips on an attempt that was never dispatched | P1 |
| HD-013 | the WorkOrder names no result path | P3 |
| HD-014 | an escalated close keeps fencing (doc half shipped; code half open) | P0 |
| HD-021 | a per-scope "it compiles" fixture proves nothing | P3 |
| HD-022 | work for consumer-measured defects sits on a tag, not on main | decision |
| HD-023 | workspace trust discards the grant in a fresh clone | outside the plugin |
| HD-024 | the auto-mode classifier blocks the courier's calls | outside the plugin |
| HD-025 | two run geometries this checkout cannot reach | process |

## Defects

- **HD-026 · A run that ends at GATE H leaves no terminal close, because the close-out covers two of
  the four returns.** `closeIfTerminal` (`skills/tech-lead/workflows/shapeup-run.js:988`) opens with
  `if (ret.status !== "aborted" && ret.status !== "shipped") return;`, but the RunReturn union has
  four arms: `shipped`, `paused`, `aborted` and **`gate_h`** (the script's own header documents all
  four). `paused` is correctly not terminal — it resumes. `gate_h` is: it is where a tripped
  circuit breaker lands, and `AGENTS.md` makes it the *designed* outcome for a run that cannot pass
  — *"Budget trips route to GATE H — ship what's green, never kill the run from outside."* So the
  most likely non-passing ending is the one arm that records nothing.

  Measured 2026-09-22 in a consumer project installed from the marketplace, plugin 3.6.0: a run
  crossed GATE H and L4, both gates left rows in `gates.jsonl`, `REPORT.md` was written and frozen
  — and the ledger still read `status: building`, `closed_at: ~`, `close_cause: ~`,
  `closed_status: ~`. The same run's earlier launch aborted at L1b and closed correctly, which is
  what makes the gap precise rather than general: the abort path works, the breaker path does not.

  **How it survived its own acceptance.** The fix's acceptance pass drove a forced abort and a
  direct `probe resume --close shipped`, and confirmed both. Neither exercised the `gate_h` return,
  because reaching it needs a build that fails a whole round — which is exactly what a real
  consumer produces and a fixture does not. The propositions tested the two arms someone thought to
  name.

  **Closed when:** A run that ends at `gate_h` leaves a terminal status, a cause and a timestamp,
  and a check asserts the close-out's arms against the RunReturn union rather than against a
  hand-written pair — the same derivation rule the run-argument surface already follows.

- **HD-027 · Two harness rules collide, and the collision hard-aborts a run at L1b.** Promoted from
  a consumer register (`proj-harmony-os-sample`, filed there as `HD-1`, 2026-09-21). `harness init
  run` normalizes the pitch into the **gitignored** run tier at `.shapeup/<slug>/intake.md`, and
  that is the path `ba-pitch-analyzer` is handed and actually reads. `requirements.md` is a
  **committed** artifact, and spec-lint's `TIER-DIRECTION` rule forbids a committed file from
  naming a `.shapeup/` path — correctly, because the path dangles on every other clone. A worker
  that cites its real source produces a registry its own lint reds.

  Measured in run `find-my-todos-20260921T142815Z-b80de580`, unattended lane: ORIENT, ANALYZE,
  WIRE and MAP SCOPES all completed — 25 agent dispatches, ~28 minutes, ~1.17M subagent tokens —
  and the run then aborted at GATE L1b on a single `TIER-DIRECTION` red, over one sentence of
  provenance prose: *"Atomic requirement clauses extracted from `.shapeup/find-my-todos/intake.md`."*
  The abort lands after the whole planning stretch is already paid for, and on the unattended lane
  there is no human present to spend ten seconds fixing a sentence.

  **Why this is not a rule for `ba-pitch-analyzer` alone.** A rule telling the analyzer "never
  write a `.shapeup/` path into a committed file" would suppress this one instance, but the
  analyzer still has no *correct* path to name — it does not necessarily know which committed
  artifact the intake was copied from (`shaping.md`, a `pitch.md`, or a `--breadboard`-named file
  elsewhere). The fix belongs upstream of the worker's prose, not in guidance to it.

  Also measured: the craft docs teach the rule more narrowly than the lint enforces it —
  `skills/ba-pitch-analyzer/references/doc-schemas.md` stated tier-direction purely in wikilink
  terms (`never [[tasks/...]]`), while the lint reds *any* line naming a `.shapeup/` path. A
  worker following only the docs had no way to know a plain provenance sentence would red.

  **Closed when:** the taught rule and the enforced rule state the same constraint — a committed
  doc may not name a `.shapeup/` path in any form, wikilink or bare prose — and a `coverage`
  dispatch over a pitch staged in the run tier produces a `requirements.md` clean of
  `TIER-DIRECTION` findings, driven end to end rather than inferred from the worker's prose.

- **HD-028 · The inner circuit breaker trips on an attempt that was never dispatched.** Promoted
  from a consumer register (`proj-harmony-os-sample`, filed there as `HD-2`, 2026-09-22). Measured
  in run `find-my-todos-20260922T020229Z-9036e2b6`, unattended lane, `attempt_budget: 5`: the
  pipeline returned `{"status":"gate_h","breaker":"inner",...}` after **one** attempt, with 4
  attempts and roughly 2.4h of a 3h wall-clock budget still unspent — the documented meaning of
  which is that the scope exhausted its per-scope T0 attempts. It had not.

  | record | `r1-a1` | `r1-a2` |
  |---|---|---|
  | `orders/<id>.json` compiled | 02:10:49Z | 02:21:00Z |
  | `receipts/dispatch.jsonl` | present, `dispatch_ok: true` | **absent** |
  | `legs.jsonl`, `attested: true` | present, 894 341 ms | **absent** |
  | `results/<id>.json` | present | **absent** |
  | `t0/verdicts/` trial | `r1-a1-t1`, `r1-a1-t2` | `r1-a2-t1` at 02:22:50Z |

  `r1-a2` was compiled and T0-verified at 02:21:00Z and 02:22:50Z — **both before `r1-a1`
  ingested at 02:25:46Z**, i.e. while attempt 1 was still in flight. No worker was ever dispatched
  for it. The three channels the harness uses to attest work — the dispatch receipt, the leg, the
  WorkResult — unanimously say attempt 2 never happened, while the two that feed the breaker — the
  order set and the T0 verdict set — say it did. The breaker reads the channels that can be
  written without a worker.

  **What it cost.** The run stopped at GATE H with `green_scopes: []` after one attempt, budget and
  wall-clock both mostly unspent. `scope-hammer`'s own census independently caught the discrepancy
  and declined to treat it as exhaustion, which is the only reason it surfaced at all — a census
  that trusted the breaker's own framing would have reported a scope that fought five times and
  lost.

  **Closed when:** the attempt count is derived from the attested channels — a dispatch receipt, a
  leg, a WorkResult — never from the order set or the T0 verdict set alone, and the loop cannot
  open attempt *n+1* while attempt *n* is still unanswered.

- **HD-013** — The WorkOrder carries no field naming where the WorkResult goes, so each worker derives the path
  from prose while its own `substrate.allowed` names a directory that does not contain it. The
  workflow lane works around this by stating the path in the dispatch prompt and deriving the same
  one from the order; the port itself is unfixed.

- **HD-029 · A run that went through GATE H cannot record a later ship.** Discovered 2026-09-22
  while implementing `HD-026`'s fix, by the stage's own executor rather than by any check — no
  acceptance row covered it, which is the same boundary `HD-026` and `HD-028` sit on.

  `skills/tech-lead/references/gates.md` has GATE L4 call `probe resume --close shipped`
  unconditionally after a GATE H → L4 ship decision. Since the close-out derives its status from
  the RunReturn arm, `gate_h` closes the ledger as `escalated` **immediately**, and `closeRun`
  refuses a *different* terminal status over an existing close — by design, because a terminal
  close is a once-only fact and the first cause must not be destroyed.

  Driven end to end, not reasoned about:

  ```
  1) gate_h close          → ok=true  status=escalated
  2) then --close shipped  → ok=false
     closeRun: this run is already closed as "escalated" … refusing to overwrite it with "shipped".
  3) ledger now says closed_status=escalated
  ```

  So the documented flow — trip a breaker, hand to GATE H, ship what is green at L4 — now leaves a
  ledger reading `escalated` and a refused ship close. Nothing is corrupted and no cause is lost;
  the run's own report still says what shipped. What is wrong is that the ledger's terminal fact
  disagrees with the outcome, and the L4 step believes it closed a run it did not.

  Three ways out, and the choice is the PO's because it is adjacent to `HD-014`'s question of what
  an `escalated` close should release: **(a)** L4 checks for an existing close and reports
  "shipped after escalation" instead of calling `--close shipped`; **(b)** `closeRun` lets
  `shipped` supersede `escalated` — the later, stronger fact — folding the prior cause in the way
  a same-status supersede already does; **(c)** `gate_h` stops closing immediately and leaves the
  close to whoever ends the run, which gives back the gap `HD-026` was filed to close.

  Not scheduled. Filed with the evidence so the decision is made once, with `HD-014`, rather than
  discovered again by the next run that trips a breaker and then ships.

- **HD-030 · A run that ships makes the next run of the same pitch un-plannable.** Measured
  2026-09-22 in the consumer, on a real launch that hard-aborted at L1b.

  `reduce ship` freezes `REPORT.md` into the COMMITTED tier at GATE L4, and the report cites board
  ids (`TASK-001`, `TASK-004`, …). The committed-tier lint reds a `TASK-` id anywhere in that tree,
  correctly — boards live in the gitignored tier and renumber per machine. So the artifact a
  successful run writes is the thing that stops its successor:

  ```
  close_cause: L1b: spec-lint reported red findings before BUILD
               (23 red TIER-DIRECTION findings about board ids cited in a committed file)
  ```

  All 23 findings are in `shapeup/<slug>/REPORT.md`. The run reached L1b with every planning
  artifact committed and complete, and stopped there with `rounds_used: 0`.

  **Same class as `HD-027`, different producer and different half of the rule.** `HD-027` was
  `ba-pitch-analyzer` writing a `.shapeup/` path into `requirements.md`; this is `reduce ship`
  writing board ids into `REPORT.md`. The fix for `HD-027` taught one producer a rule; it did not
  enumerate the others, and the enumeration is what the class needs — which is the same lesson
  `HD-026` carried about the close-out.

  It also falsifies a claim the 3.7.0 work recorded: that "no committed artifact any worker writes
  cites a forbidden reference" was structurally guaranteed because the lint scans the whole tree.
  The lint's reach and the producers' compliance are different properties, and only the first was
  ever checked.

  **FIXED in 3.7.1-rc.1.** `reduce ship` now sanitises at the write boundary rather than at the
  column: every board id destined for the committed report is replaced by that task's
  `use_case_refs` — the tier-direction rule's own sanctioned anchor — and an id with no resolvable
  use case becomes a neutral phrase instead. The boundary, not the column, is the point: a board id
  also reached the report **inside acceptance-criterion prose** a planner wrote ("given the seeded
  todos (TASK-006)"), which no per-column fix touches.

  The unfinished-task callout now reads `**N task(s) did not finish** — use cases: …` rather than a
  list of ids; the caveat survives the sanitising, which is asserted separately, because trading the
  disclosure for tier-cleanliness would swap one silent failure for another.

  `47-ship-report.mjs` asserted the report must NAME the board id. That expectation was not merely
  outdated, it was the defect, so it was re-pointed at the substance — disclosure plus the committed
  anchor, and the id now forbidden — and is strictly stronger than before. `74-ship-report-tier.mjs`
  drives the real `reduce ship` and lints the file it wrote, because a clean renderer and a clean
  committed file are different claims.

- **HD-031 · A resumed run cannot soak a plugin upgrade, and nothing says so at launch.** Measured
  2026-09-22 while attempting exactly that.

  A run stages its own copy of the workflow script into the LOCAL tier when it is **opened**, and
  keeps it for the run's life — documented, deliberate, and the right call for a run in flight.
  The consequence is not documented anywhere a person about to soak an upgrade would look: relaunching
  an existing run after installing a new version executes the **old** orchestrator. Measured: the
  staged copy carried `0` occurrences of a call the new version makes `3` times, and was written at
  the run's open time, hours before the new version existed.

  Nothing in the relaunch path notices. The run reports normally, closes normally, and every
  observation made of it is an observation of the previous release — which is worse than a failed
  soak, because it produces confident evidence about the wrong artifact.

  Candidate fix: at launch, compare the staged script against the installed plugin's and warn when
  they differ, naming both versions — a warning, never a block, since a run in flight keeping its
  copy is the correct behaviour. A soak of an upgrade must open a new run.

### Filed 2026-09-19 — measured in the consumer soak, never filed here

Nine findings came out of the HarmonyOS soak (2026-09-15→17, two consecutive features on a project
installed from the marketplace). Six were fixed on a branch that was archived rather than merged —
see the stranded-branch entry below — and these carried no fix at all. Every one re-checked against
3.5.0 on the date of this filing, from the artifact rather than from the soak's own notes.

- **HD-014 · A run closed as `escalated` keeps fencing the consumer's checkout, and the shipped doc says it
  does not.** `liveOrders()` (`hooks/sandbox-guard.mjs:187`) derives liveness from the orders/results
  diff alone; neither it nor `kernel/lib/paths.mjs` consults `closed_at` or the ledger's status. An
  order abandoned in flight never gets a result, so a run closed through the documented sequence
  still returns the same live dispatches and the hook still denies. Measured in both directions
  during the soak and again 2026-09-19 on a fresh fixture — in-substrate permit, `README.md` deny —
  after `probe resume --set-status escalated` had exited 0. **`AGENTS.md:72` promises the opposite**:
  *"a finished run fences nothing"*. That is true of a **ship** close only
  (`kernel/reduce/ship.mjs:396` retires the pointer, and a shipped run has no unanswered orders by
  construction); for an escalated or aborted close it is false.

  Two corrections to the first filing of this entry, both from a falsification pass, both narrowing
  it. **Nothing stamps `closed_at`** — `setRunStatus` (`kernel/probe/resume.mjs:444`) replaces the
  `status:` line and nothing else, and `closed_at` is written once as the literal `~` by `init run`
  (`kernel/init/run.mjs:226`) and read by `facts.mjs:89`. So a closed run is not merely still fenced;
  it carries no close timestamp for anything to key off — which rules out the obvious first fix and
  is why the fence entry below is sequenced after the close-out one. And the fence stops **the
  agent's edit path**, not the project: `sandbox-guard.mjs:231` fences `Edit`, `Write` and
  `MultiEdit` only, so `Bash`, `git` and any editor still write. "A project that cannot be edited"
  was too strong; "the assistant cannot edit this project and the documented remedy does not say so"
  is the accurate claim, and it is still the sharpest operational finding here. A remedy already ships —
  `resolveAbandonedOrders()` (`kernel/init/run.mjs:270`) writes synthetic abandoned results, reachable
  via `init run --force` — but it is documented as "abandon the open run and start over", never as
  "release a stuck fence". Operationally this is the sharpest one: a killed session leaves a project
  that cannot be edited, and the operator's obvious remedy does nothing. The doc correction is owed
  whichever way the code bet lands.

  **Closed when:** `AGENTS.md` states the post-close behaviour and names the release (doc half), and the hook permits an out-of-substrate write after a close that retired its orders (code half). The two halves ship separately.

- **HD-021 · A per-scope "it compiles" fixture can be green while the scope's code is unreachable.** Measured
  on a stack whose build compiles only what the entry point reaches: three scopes were T0-green on an
  `assembleHap` fixture while their own files did not compile, and the errors surfaced only when a
  fourth scope wired the screens in — a scope that may not write those files. The round build gate
  (3.3.0) is what caught it, which is the design working; what is missing is attribution, and that
  lands on the same two entries above. Filed as craft, not mechanism: a scope's build fixture proves
  nothing until the scope's code is reachable, and the knowledge base is where that rule belongs.

- **HD-022 · ⚠ Work for defects measured on a real consumer sits on a tag, not on main.**
  `archive/lesson-loop-g0-k` carries 22 commits; `git cherry main archive/lesson-loop-g0-k` marks
  every one `+`. **It is a tag, not a branch** — the local branch `plan/lesson-loop-g0-k` points at
  `e511b7e` (3.3.0) and is an ancestor of main, so anyone reaching for the branch name finds nothing
  stranded. Checked by content rather than by commit id: the scope-contract schema lint re-landed on
  main as `9a8641e` and the permission-grant correction arrived by another route, while
  `report harvest`/`closeOut`, the own-substrate attempt scoring, the hvigor/ArkTS digester, the YAML
  block-scalar reader, the `gate`/`build_gate` export tables, the EVAL all-scopes-green precondition
  and the dependency hold did not. 3.4.0 and 3.5.0 shipped from two other workstreams meanwhile.

  **What a port actually buys, checked per entry rather than assumed** — the first filing of this
  entry claimed six and that was not measured: `01aea8f`+`6301eca` resolve the abort-trace entry in
  full; `29cf0be` resolves half of the gate-records entry (the tables, not the missing rows);
  `9da0f14` resolves the unrecognised-output half of the digester entry and not the weld; and
  **`rounds_used` gets no fix at all** — the branch's `harvest.mjs` calls the same `roundsUsed()` with
  the same fallback, so porting the close-out adds a second consumer of that defect. `a5ce8af`,
  `5574f0c` and `8673baa` are improvements whose premises need re-checking first: 3.4.0 rewrote
  round-loop state derivation underneath them, and `a5ce8af` introduces the axis the digester entry
  above would weld. Any doc-touching commit there (`01aea8f`, `0ffc133`, `12a38ef`) predates 3.5.0's
  requirements work and would revert shipped text.

  So the call is real but smaller than it looked: **one entry closed, two halves, one made worse.**
  Cherry-pick what still applies, or declare the tag abandoned and keep each finding filed here.
  Leaving it as it stands is the one option that costs on both sides — the fix exists, the defect is
  open, and neither fact is visible from the other.
- ~~**Cost/wall-clock instrumentation is dead.** `harness report export` and `harness probe stats
  --economics` are both keyed off a per-agent-call journal the Workflow runtime is supposed to
  stamp. Measured live 2026-08-19, twice, in two independent worktrees: it is never written — the
  journal's own directory does not exist after a real run either time.~~ **FIXED 2026-08-21** — the
  Betting Table call landed on this entry's second option: delete the reporting commands that
  assumed the journal existed, rather than wire a runtime this repo does not own to write one.
  `agentCallRow` and `economics` are gone from `kernel/report/facts.mjs`; `harness report export`
  no longer emits an `agent_call` table or an `economics` block, and `harness probe stats
  --economics` no longer exists as a flag. The other tables `report export` derives from real
  records (dispatch, results, T0 verdicts, trials, hook decisions) are untouched. Pinned by
  `tests/structural/19-run-records.mjs` §54(c), which asserts both exports stay undefined and
  `TABLES` stays without `agent_call`.

Cleared once already, 2026-08-14, to start the v2.0 work from a clean slate:

- ~~The installer writes a permission prefix that ends mid-argument, so it grants nothing and the
  pipeline stops at its first dispatch.~~ **FIXED 2026-08-14** — see below. The half of this entry
  claiming the call-site spelling is doomed was **wrong, and measurement is what showed it**; the
  correction is recorded because acting on the claim would have caused a needless rewrite of every
  call site in the plugin.

### Raw idea, not yet a pitch — a run does not check whether its baseline exists in any commit

Not a defect in shipped behaviour: a gap nothing looks for, measured on a real consumer 2026-09-20.

A run was about to be shaped and built on top of a previous feature's output — an engine, a UI kit,
a route map and two resource bundles, 45 files. **None of it was in any commit.** The previous run
built it and stopped before it landed, so the working tree held a working engine and a clone of the
same repository held a template. Three days passed and nothing noticed: the build gate was green
because the tree compiles, the spec artifacts were consistent because they describe the tree, and
the pitch's own baseline section was accurate *about the tree*.

The harm is not that the code is uncommitted. It is that **there is nothing to roll back to.** A
round that breaks the baseline has no prior state to compare against or return to, the per-scope
ratchet's notion of "worse than before" has no before, and a `probe resume` after a kill resumes
against whatever the tree happens to hold.

Worth noting this is the same shape as an error made *inside* this project on the same day: a
recorded check count paired with a sha that does not produce it, because the number was a property
of the working tree. One instance is a mistake; two instances in two repositories in one day is a
class nothing in either project detects.

The bet, if it becomes one: L0 already pins the run's config and digests the intake. It could also
report whether the paths the profile and wiring map name are tracked and clean, and say so in the
gate block — a line, not a veto. A PO who knowingly builds on an uncommitted tree should be able to
say yes; a PO who did not know should not find out at the first revert.

### Raw idea, not yet a pitch — QA lens fan-out

Not a defect: a real, measured opportunity, filed here per this file's own "raw ideas for the
Betting Table" charter rather than through a coach retro — no Ship-Gate ran; this came from a direct
real-execution experiment, 2026-08-19.

QA Edge Hunt's wall-clock variance (reproduced independently on two fixtures, ~160–670s per hunt)
is per-turn model latency noise, not a scheduling bug — QA has no lens-level dispatch today, so
there is nothing to schedule badly. A prototype fanning its 6 lenses out via `parallel()` measured a
real but modest ~18–31% win (n=2), at roughly 6x one hunt's own setup-phase token cost. If bet, it
needs a `lens` field on `qa-edge-hunter`'s WorkOrder payload, a lens-aware order-suffix
discriminator, and a merge step for the per-lens reports — none of which exist yet. Should ship
opt-in only: QA's findings are advisory by design, and the sample size here is thin.

### Raw idea, not yet a pitch — what a rebuilt trigger-eval layer must have

Not a defect: a correction plus two proven requirements, from a direct real-execution experiment,
2026-08-20. Filed here because the decision it needs — whether an activation-measurement layer comes
back at all after `9236559`/`fda81c4` removed it — is a Betting Table call, not a maintenance one.

`solution-architect` measures **TPR 1.0 / FPR 0 / precision 1.0** with its `description:`
byte-for-byte unchanged. The only variable was the probe's working directory: 0.333 in the plugin's
own repo, 1.0 in a workspace holding the artifacts the queries presuppose (11 cases, Sonnet, named
explicitly, concurrency 1, detection logic lifted verbatim from the deleted harness so scoring
matches the baseline).

**The claim this corrects** — GH#12 held that this skill's low score could not be the missing-
artifact confound because it had "0/6 deictic positives", and concluded a description rewrite was
the fix. Measured: **6/6 presuppose artifacts**, one literally deictic. The hand classification
counted only file-path referents like `TASK-007` and missed that "each use case" or "main.js" is
just as unsupplied. Acting on it would have tuned the prose until the skill activated where its
inputs do not exist — violating its own "profile absent ⇒ ESCALATE, do not invent an entry point"
rule, and spending the one clean result the baseline had to do it. Recorded for the same reason as
the permission-grant correction below: the wrong claim was the actionable-looking one.

Two requirements, now proven rather than hypothesised, for any successor layer:

1. Probes run against a workspace containing what the queries presuppose. Without it a correct
   refusal is scored as a description defect, and the metric is unstable besides — the same prose,
   model and dataset read 0.0 on 2026-07-26 and 0.167 on 2026-08-12.
2. The scorer records **what activated instead**, not just fired/not-fired. Every miss here
   activated *nothing*; no sibling ever stole a query. That silence is what distinguishes a
   sensible refusal from a real description defect, and the old harness could not see it.

### The permission grant — fixed, and one claim above corrected

Measured 2026-08-14 against Claude Code 2.1.232, every verdict decided by whether the target
script's marker file landed on disk rather than by what a model reported.

**There are two rule syntaxes.** `Bash(<prefix>:*)` is a prefix match at complete argument
boundaries, where a `*` is a literal asterisk. `Bash(<pattern> *)` is an anchored **glob**, where
`*` expands and crosses `/`. Only the first was ever tried, which is why the fix looked like a
trade between least privilege and quoted call sites. It is not one:

| rule | command | result |
|---|---|---|
| `Bash(node "<abs>.mjs":*)` — closing quote **inside** the rule | quoted | ALLOWED |
| `Bash(node "*/skills/<owner>/scripts/<n>.mjs" *)` | quoted abs path **+ args** | ALLOWED |
| same | quoted abs path, **zero args** | DENIED — hence two rules per script |
| `Bash(node "*/skills/<owner>/scripts/<n>.mjs")` | quoted, zero args | ALLOWED |

**The correction.** The claim that a call site carrying `${CLAUDE_PLUGIN_ROOT}` is denied under
every grant conflates two different things:

- A **skill's** `${CLAUDE_PLUGIN_ROOT}` **is** expanded, at skill-load time, before the model reads
  the prose. Verified with a throwaway single-skill plugin: a documented
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/hello.mjs"` reaches the model as an absolute quoted path. So
  the `${…}` refusal never fires on the plugin's real path, and the shipped call-site spelling is
  fine exactly as `14-invocation-paths.mjs` mandates it. No call site needed rewriting.
- A **rule's** `${CLAUDE_PLUGIN_ROOT}` is **not** expanded — rules live in the user's project
  settings, where the token means nothing. That, plus the mid-argument prefix, is the whole defect.

The `${…}` refusal is real (it blocks even `${HOME}`), but it only reaches a command a *user* types
by hand out of the docs — worth a README note, not an architecture change.

**Shipped.** `bin/lib/grant.mjs` enumerates entry points from the filesystem and emits two rules
each (20 → 40; a kernel would take it to 2). `mergePipelinePermissions` purges the dead v1.5–v1.8
rules on upgrade instead of accumulating them, and leaves unrelated user rules alone.
**Anyone who installed before this fix must re-run `npx shapeup-sdlc init`** — the old rules never
granted anything.

**The guard executes, as this register demanded.** `npm run test:grant`
(`tests/grant/executing-grant.mjs`) starts a real session per case and decides on the marker file:
8 cases covering a marketplace layout with and without arguments, a `--plugin-dir` checkout under an
arbitrary directory name, an install path containing a space, two negative controls that must be
DENIED, and pins for both halves of this defect. Tier-0 keeps only what is checkable offline and
says in its own banner that it is bookkeeping, not evidence.

**One claim this invalidates.** `harness run`'s provenance paragraph asserted a headless run
through a granted Bash prefix with zero denials. With no working grant that cannot have been what it
claims; the banner now says so rather than carrying it as evidence.

### ⚠ STILL OPEN — a third layer, above the grant: workspace trust

Correct rules are not sufficient. Measured 2026-08-14: in an **untrusted workspace** the CLI prints
`Ignoring 40 permissions.allow entries from .claude/settings.json: this workspace has not been
trusted` and discards the entire allow-list before any rule is consulted.

`.claude/settings.json` is precisely where `npx shapeup-sdlc init` writes, and **a fresh clone is
untrusted by definition** — so in CI, the case the grant exists for, the grant is dropped whole.
`-p` skips the trust *dialog*; it does not confer trust.

This is why the executing guard's other cases pass: they deliver rules via `--settings`, from
outside the project, which is not trust-gated. That route proves the rules are well-formed; it says
nothing about the configuration a user actually gets. `PIN project-scoped rules are ignored in an
untrusted workspace` now covers the difference, and it asserts DENIED — a fail-closed pin, so if the
platform ever relaxes this the guard turns red and tells us.

**Shipped mitigation, deliberately partial:** `bin/init.mjs` now detects the condition and prints
what to do about it. It **reports rather than repairs** — trusting a directory authorises executing
code from it, which is the user's decision, not one for a package running under `npx`.

**The open question for the Betting Table:** what a headless/CI install should do. Candidates: bake
`hasTrustDialogAccepted` into the CI image; ship the grant to *user* scope instead of project scope
(untested — user scope may not be trust-gated); or document `--settings` pointing outside the
project as the supported CI route. Until one is chosen, **Phase 7's headless probe cannot pass**,
and no plan should claim it can.

### ⚠ STILL OPEN — a fourth layer, above workspace trust: Claude Code's auto-mode classifier

Confirmed independently in two sessions, 2026-08-21, each running this plugin's `/ship` pipeline
(`shapeup-run.js`) against real pitches. Both hit the same wall: the mechanical courier's
`probe resume --require <phase>` / `--set-status <status>` Bash calls (C2, dispatched from inside
the Workflow) were denied by Claude Code's own auto-mode classifier — "Blocked by classifier" —
with `.shapeup/<slug>/decisions.jsonl` carrying zero matching rows, which rules out both this
plugin's hooks and a `permissions.allow` gap: the broad `Bash(node "*/kernel/harness.mjs" *)`
grant `bin/lib/grant.mjs` already writes covers these calls by pattern, and did not help. One
session reported the block as persistent across retries within the session — not transient —
and speculated a fresh session may not carry the same classifier state; that is a lead, not a
measurement, and is untested.

**Not fixable from inside this plugin.** The classifier sits above both the permission grant and
this plugin's hooks — the same relationship workspace trust has to the grant above, one layer
further out. Nothing in `bin/lib/grant.mjs` or `hooks/` can see it, let alone suppress it.

**What WAS fixed, 2026-08-21.** `requirePhase`/`fastForward` in `shapeup-run.js` treated ANY
non-zero `exit_code` from the courier as `probe resume --require`'s own exit-6 predicate
("artifact genuinely absent"), asserting a fixed "the worker most likely escalated" diagnosis
regardless of cause and discarding the courier's own `detail`. A classifier denial and a real
predicate failure produced the identical false narrative — measured live in the first session:
ORIENT's four artifacts existed on disk and the run still aborted claiming they didn't. Now only
exit 6 gets that message; the courier's `cmd()` prompt was also taught to report `-1` rather than
fabricate a code when its Bash call is refused outright, and any non-6 exit gets an honest "the
check itself did not run" message quoting the courier's `detail` and naming the classifier as the
likely cause (`protocol.md` §3b.1).

**What is still open.** The abort is now honest, but it is still an abort — the automated `/ship`
run stops exactly where it did before. Both sessions shipped by driving BUILD manually
(`harness compile` → `Agent` dispatch to the worker skill → `harness reduce ingest` →
`harness verify t0`, mirroring what the workflow does internally) instead of through the Workflow.
That manual path is the only mitigation today; it is a workaround this repo can document, not a
defect this repo can patch shut. Betting Table question: whether the manual path is worth
formalizing as a documented fallback mode, or stays an operator-driven escape hatch invoked only
when the classifier is observed to block.

### ⚠ STILL OPEN — two states the development checkout cannot reach

Both 3.1.1 defects — the launch refused on a marketplace install, and a shipped run fencing the
checkout to its last dispatch's substrate — lived for three weeks in geometries this repo never has
when it runs itself. Under `--plugin-dir .` the plugin root and the working directory are one tree,
so the Workflow tool's read gate never fired; and every experiment ran in a worktree or had its run
trace deleted afterwards, which removed the order file the stale pointer named and, with it, the
wedge. This checkout's own decision ledger holds no sandbox-guard row at all. The second defect was
even observed once, on 2026-08-19, and attributed to the abandoned-order cause — real, and fixed —
whose check then passed for the wrong reason: after that fix nothing was live, so it could not tell
"the pointer arm is gone" from "nothing left to enforce".

Neither state is reachable from the structural suite: one is a Claude Code tool's own read gate,
the other is what happens *after* a run, and every fixture is deleted in its cleanup. What would
have caught both is the live soak the release process now names in `CLAUDE.md`: a persistent
consumer project installed from the marketplace rather than `--plugin-dir`, carried across two
consecutive features without cleaning `.shapeup/` between them.

**Open for the Betting Table:** whether that soak can be made mechanical — a fixture project kept
across suite runs, or a CI job that installs the packed tarball into a scratch project and drives
one `init run` → launch through the real CLI — or stays a documented manual gate before each tag.

---

**Where a closed defect goes.** Its fix is pinned by a regression guard, and that guard is the
durable record — a defect whose test fires on reversion cannot come back silently, which is more
than a paragraph in this file could ever promise.

Nine entries left this file on 2026-09-20 under that rule, in a sweep where every stage was accepted
by a fresh adversary that drove the behaviour rather than read the diff, and where every guard below
was mutation-tested in both directions — broken until it reddened, restored until it greened. The
guard is the record; what each defect cost is recoverable from the test that now fails on reversion.

| was | pinned by |
|---|---|
| the staged pitch writable by every build leg | `61-execute-leg-frozen-pitch.mjs` — calls the real substrate resolver rather than restating it, so a revert reds instead of passing beside it |
| a run argument named by one tier and read by none | `62-run-args-surface.mjs` — the surface is DERIVED from each entry point's own argv spec, the domain schema and the operator's flag table, so a flag added to one tier reds on its own |
| the launch record with no writer | `63-run-args-writer.mjs` — driven end to end from opening a run, with the fan-out dial read back off exactly what the writer emitted |
| a locationless diagnostic losing its file | `65-digest-locationless.mjs` — plus a non-regression corpus diffed against the pre-fix module, because the risk was never the new case |
| a shared-only path reported ownerless, its bugs fanned to every scope | `66-shared-ownership.mjs` — pinned in BOTH directions: an exclusive writer still wins, and a path nobody declares is still unowned |
| an abort leaving a trace that reads as still running | `67-terminal-closeout.mjs` |
| a run reporting zero rounds having built two | `67-terminal-closeout.mjs` — two fields, and the old number survives verbatim as the second |
| a worker's ESCALATE reaching nothing | `67-terminal-closeout.mjs` — one channel, written by ingest and read back by the ship report |
| three gates never resolved, no gate data exported | `68-gate-coverage.mjs` — cross-references every declared gate id against every call site that can emit one, both directions |

One guard in that set exists because of the sweep rather than because of a defect in the product:
`69-terminal-wrapping.mjs` asserts that every top-level terminal return in the orchestrator passes
through the close-out path. It was written after an acceptance pass found two returns that bypassed
close-out entirely while an existing check had been relaxed to tolerate the new call shape without
ever requiring it — both holes green. A check that tolerates is not a check.

Two entries left this file on 2026-09-19 under that rule, both verified fixed against 3.5.0 before
deletion. **A scope contract passing L1b and then being undispatchable**: `lintContractSchema`
validates every parsed contract against the `$defs/ScopeContract` the compiler applies, with the
same validator and no second implementation, pinned by `46-contract-md.mjs` (a bare list cell is one
`CONTRACT-SCHEMA` red; a well-formed contract produces none) and by the `unreadableReason` arms that
report a table field also written into frontmatter. **The requirement edge reported only as a
warning**: `reqId` folds every spelling onto one key space before the pattern test, the `coverage`
operation produces the registry the edge resolves against, and `REQ-UNCOVERED` is red at L1b — pinned
by `59-requirements-registry.mjs` §93(a)–(j), which asserts both directions, the absent-artifact skip
and the gate's exit codes.

The guards standing today also cover the committed
contract format failing silent (structural §46(f)(g)(h)(i) for the parser, §23 for the two call
sites §46 does not reach) and `gate-zerowork`'s work-by-other-means fail-open (the assertion that
used to license it is inverted in place in `tests/structural/10-run-receipt.mjs`, with the
Bash-launch dispatch arm the deletion depends on pinned in `17-gate-zerowork-workflow.mjs`) — every
one mutation-verified in both directions. Those guards are the whole write-up that still matters:
what a closed defect cost is recoverable from the tests that now fail on reversion, and nothing
else needs to survive for the fix to hold.

This file stays short on purpose. It is a queue, not an archive.
