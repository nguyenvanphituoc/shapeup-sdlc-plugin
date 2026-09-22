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

  **Observed live 2026-09-22, in its commoner form: a recoverable abort.** A run aborted at L1b on a
  red lint, the orchestrator repaired the offending file, relaunched, and BUILD proceeded — correct
  behaviour throughout, and exactly what a relaunch is for. The ledger afterwards:

  ```
  status:        building
  closed_status: aborted
  close_cause:   L1b: spec-lint reported red findings before BUILD …
  ```

  Both true, and together wrong. A terminal close is once-only by design, so the run that went on to
  build still reads `aborted` as its terminal fact, and any later close — including a ship — meets
  the same refusal this entry describes. The close-on-abort that `HD-026` added is what made an
  ordinary recoverable abort permanent, which is a consequence nobody chose: closing every terminal
  ending was the right fix for endings that are actually terminal, and an abort a relaunch recovers
  from is not one of them.

  This widens the decision rather than changing it. Whatever resolves `gate_h`-then-ship has to
  answer the same question for abort-then-recover: either a close is retired when a relaunch resumes
  the run, or a run that resumes was never terminal and should not have been closed.

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

  **A second, worse face of the same problem, measured 2026-09-22.** Opening a new run is necessary
  and not sufficient. After `claude plugin update` reported `3.7.0 → 3.7.1-rc.1` ("Restart to apply
  changes"), a freshly opened run still recorded
  `pluginRoot: …/shapeup-sdlc-plugin/3.7.0` in its own `run-args.json`, and behaved as 3.7.0
  throughout — `reduce ship` rewrote the committed report with the board ids the candidate exists to
  remove. The installed-plugins record said `3.7.1-rc.1`; the run resolved the previous version
  anyway.

  **The mechanism, characterised 2026-09-22 — it is a per-project version pin, not a cache or a
  restart.** `installed_plugins.json` carries one entry per project that ever installed the plugin
  (26 of them here), each pinning its own version, plus one user-scope entry. `claude plugin update`
  and `install` write to **user** scope by default whatever directory they are run from, so the
  update reports success while the project keeps resolving its own pin. Confirmed against launch
  evidence: at the run's open the project pin read `3.7.0`, and `3.7.0` is exactly what the run used.

  The supported fix is **`--scope project`**, which `--help` does not list and the tool names only
  in its own "already installed" message:

  ```
  claude plugin update <plugin>@<marketplace> --scope project
  ```

  `disable`/`enable` act at project scope but do not re-resolve the version, and `uninstall` targets
  the user entry first, so neither is a substitute.

  **Checking which version a run actually used — and the trap in the obvious check.** Read
  `plugin.version` from the run's own `receipt.json`: the receipt is minted when the run opens and
  carries the plugin identity. `run-args.json` also carries `pluginRoot`, but it is written later,
  at the launch-record step, so between a run opening and that step the file on disk still belongs
  to the PREVIOUS run — it carries a `runId` to prove it. Reading `pluginRoot` without first
  checking `runId` against the receipt's `run_id` reports the last run's version as this one's, and
  measured here it did: a soak on the right version was nearly killed on that reading. A marker
  grepped out of the staged workflow script is weaker still — one that distinguishes 3.6.0 from
  3.7.x says nothing about 3.7.0 versus 3.7.1, and using it to clear the other is a probe answering
  a different question than the one asked.

- **HD-032 · The attested-attempt census counts a PREVIOUS run's work as this run's.** Found by the
  consumer soak on 2026-09-22, in the fix for `HD-028` itself, one release after it shipped.

  `attemptEvidence` matches attestation on `order_id` alone:

  ```
  const hasReceipt = receipts.some((r) => r?.order_id === orderId);
  const hasLeg     = legs.some((r) => r?.order_id === orderId);
  ```

  `AGENTS.md` states the problem with that in as many words: *"`run_id` … is the only key that
  separates two runs of the same feature: everything else (`order_id`, round/attempt) repeats."*
  The module carries **no** `run_id` reference at all, and `receipts/dispatch.jsonl` and
  `legs.jsonl` are per-slug and append-only, so they accumulate across every run of a pitch.

  Measured: a new run (`…T132805Z-7d89f1ed`) compiled `find-my-todos-screen-r1-a1` and dispatched
  **no** worker — `receipts/dispatch.jsonl` carries rows for two *earlier* runs and none for this
  one. Asked about that scope, the census answered:

  ```
  a1 spent  receipt=true leg=true result=true      ← all three from a run two launches ago
  spent: 1  in_flight: 0  unattested: 4  tripped: false
  ```

  So the reader built to stop the breaker counting work nobody did now counts work **another run**
  did. It is `HD-028`'s own failure mode displaced by one level: `HD-028` was an attempt attested by
  channels a scope could write without a worker; this is an attempt attested by a worker that ran in
  a different run. Both answer "was this attempt spent?" with evidence about something else.

  The compile guard inherits it: it asks the same question before opening attempt N, so a stale
  attestation for attempt N−1 lets it through — the exact interleaving the guard exists to refuse.

  **THREE readers, not one — and the third is what actually stopped the run.** The same soak showed
  the stagnation breaker doing it too, and that one is load-bearing: it fired during *compile*,
  before any attempt was dispatched, with `streak=2, no_progress_k=2`. Verified against
  `t0/trials.jsonl` rather than the run's narration — it holds **3 rows, from two earlier runs**
  (`…b80de580`, `…9036e2b6`) and **none from the run that tripped**:

  ```
  2026-09-21T15:05:37Z run=b80de580  r1-a1  0/2 fixtures
  2026-09-22T02:16:23Z run=9036e2b6  r1-a1  0/2 fixtures
  2026-09-22T02:22:50Z run=9036e2b6  r1-a2  0/2 fixtures   ← HD-028's invalid trial
  ```

  Every row carries a `run_id`; the reader ignores it. So two gradings of a half-written tree, one
  of them already documented as invalid, read as a stagnation streak that **every future run of
  this scope trips on** — and the tree they graded was fixed seven hours before the run that
  escalated on them. The breaker escalated on evidence that predates its own fix.

  So the affected readers are: the attempt census, the compile guard that consults it, and the
  stagnation breaker. All three treat per-slug append-only ledgers as if they were per-run.

  **Fix:** filter every attested channel by the run's own `run_id` — receipts, legs and trials all
  carry it — and treat a row with no `run_id` as belonging to no run rather than to this one. A
  `WorkResult` carries none and reaches it through `order_id`, so the result channel needs the join
  rather than a field read. Add a fixture with two runs' rows in one ledger — the case no
  single-run fixture can hold, which is exactly what let this ship.

  **Note what this does NOT license.** Clearing the history to unstick a run discards append-only
  T0 evidence in response to a breaker saying stop, and `init run --force` resets the breaker as a
  side effect of merely lifting the fence. The run that hit this refused to pull that lever and
  said so. Scoping the read to the run is the fix; deleting the evidence is not.

  **FIXED in 3.7.1-rc.2.** All three readers now match on the run key: the census filters receipts
  and legs, and the stagnation breaker filters trials. A row carrying no run key belongs to no run
  rather than to this one, and an unresolvable current run matches nothing — both directions
  under-count rather than over-count, which is the safe way to be wrong: an under-count leaves a
  breaker un-tripped and the round continues, where an over-count stops work that was never done.
  A `WorkResult` still has no run key, so it stays a file check that can only turn an
  already-run-scoped receipt into `spent` — a result left by an earlier run cannot attest an attempt
  this run never dispatched. **That reasoning was incomplete and the soak falsified it the same
  day**: a stale result cannot invent an attempt, but it can close one that is still running. See
  `HD-033`.

  `75-cross-run-attestation.mjs` plants two runs' rows in one set of ledgers — the case no
  single-run fixture can hold — and asserts **both** directions: the prior run's work is invisible,
  and the run's OWN receipt and leg still count, so scoping narrows the read without disarming it.
  Mutation-verified: reverting the fix turns the suite red naming exactly this defect.

  **Three existing fixtures were unfaithful in the way that hid it**, and were corrected rather than
  the code weakened: `s3-attempts`, `73-attested-attempts` §123 and `05-tech-lead`'s stagnation
  check all wrote `run_id: null` rows into hand-built ledgers, exercising evidence no real dispatch
  ever writes. They now open a real run and stamp its key. That unfaithfulness is the direct cause
  of this shipping: a fixture that models a state the pipeline never produces cannot fail on a
  defect the pipeline has.

- **HD-033 · A stale WorkResult closes an attempt that is still running.** Found 2026-09-22 during
  the rc.2 soak, watching the fix for `HD-032` work — this is the half of that defect the fix did
  not reach, and the filing for `HD-032` overstated the mitigation.

  `HD-032` scoped the receipt and leg channels to the run. The **result** channel could not be
  scoped the same way: a `WorkResult` carries no `run_id` and reaches one only through its
  `order_id`, which repeats. The reasoning recorded at the time was that this is harmless because a
  stale result "can only turn an already run-scoped receipt into `spent`". That is true and it is
  not the whole risk: it cannot attest an attempt this run never dispatched, but it **can close one
  this run did dispatch and is still running**.

  Measured live, mid-soak:

  ```
  results/<scope>-r1-a1.json   mtime 09:25:40   ← a different run's, 13 hours old
  this run opened 22:06, dispatched r1-a1 at 22:09, no leg yet
  census → hasReceipt:true  hasLeg:false  hasResult:true  ⇒ state: "spent"
  ```

  The attempt was in flight at the moment the census called it spent.

  **Why it matters more than an off-by-one in a count.** The compile guard asks exactly this
  question before opening attempt N: it refuses while N−1 is not `spent`. A stale result makes N−1
  look finished, so the guard permits attempt 2 against a scope whose first attempt is still
  writing — which is `HD-028`'s original interleaving, reachable through the guard built to prevent
  it.

  **Fix:** a result counts for this run only when it is newer than the run's own `started_at` (the
  receipt carries it). A file written before the run began cannot be this run's, whatever its
  `order_id` says. Dropping the result channel from the `spent` condition entirely is the wrong fix:
  a result on disk pending ingest is a real state the round already handles with a late ingest, and
  calling it `in-flight` would re-dispatch work that is done. The fixture needs a result file
  back-dated before the run's start — the `run_id`-based two-run fixture cannot express this one,
  because the channel that carries the defect has no `run_id` to differ on.

- **HD-034 · A fixture the sandbox refuses to run is recorded as a fixture that failed.** Promoted
  from the consumer's own register (filed there as `HD-4`, 2026-09-22) by the run that hit it.

  A T0 fixture that shells out to a command the session's permission grant does not cover is
  **denied, not executed**. The harness records that identically to a fixture that ran and failed:
  a non-zero exit and a `0/N` score. Measured on the rc.2 soak, and the trial ledger is what
  separates the two cases:

  ```
  2026-09-21  trial1  digest_len=8   ← a real failure: diagnostics into the project's enforce rules
  2026-09-22  trial4  digest_len=0   ← empty
  2026-09-22  trial5  digest_len=0   ← empty
  ```

  A compile that fails produces diagnostics; an empty digest is what a command that never ran leaves
  behind. The executor confirmed it directly — the toolchain binary returned *"This command requires
  approval"*. Every downstream number was then correct arithmetic over an input that meant something
  other than what it said: `0/2` propagated into the hill phase, the frozen report and GATE H's
  census as a measured verdict on the tree, and two such trials met `no_progress_k`, ending a
  single-scope pitch's run.

  This is rule 3 of the acceptance contract as a **product** defect rather than an authoring habit:
  *"I cannot verify this here" and "this is wrong" are different findings*, and the T0 layer
  currently cannot say the first. It misreports any denied probe on any project, and it is
  structurally invisible from this checkout, where everything the fixtures reach is already
  permitted.

  **The grant is not the blocker — the fixture's SHELL SHAPE is.** Established 2026-09-22 on a
  fresh-state soak with an explicit toolchain grant in place, by direct experiment rather than
  inference. Three shapes were tried in real headless sessions:

  | shape | outcome |
  |---|---|
  | `Bash(…/hvigorw:*)` | denied — the command begins `DEVECO_SDK_HOME=`, so the prefix never matches |
  | `Bash(DEVECO_SDK_HOME=… …/hvigorw:*)` | **runs** |
  | `cd app && DEVECO_SDK_HOME=… hvigorw <target>` | **runs** |
  | `out=$( ( cd app && … ) 2>&1 ); rc=$?; …` — what the contract actually uses | **refused**: a subshell and a command substitution cannot be statically analysed, and that refusal happens *before* any permission is consulted, so no grant reaches it |

  With the grant active, the run's own verdict artifact then recorded:

  ```
  cmd : out=$( ( cd app && … hvigorw assembleHap … ) 2>&1 ); rc=$?; …
  exit: 1   pass: false   — and no build output captured at all
  ```

  `digest_len: 0`, against `8` for the one genuine build failure on record. The command never ran.

  **So the fix has two halves.** (1) The harness must distinguish a denial from a failure at the
  point the fixture runs — a refused command is not evidence about the tree — and surface it as a
  preflight at L0, before a run spends anything. (2) Fixtures must be *expressible in a shape the
  executing environment permits*, which the current contract format does not guarantee: the natural
  way to write one (capture output, check the exit code, grep it for `ERROR:`) is exactly the shape
  that is refused. The clean form is a committed script invoked as a single grantable command —
  `cd app && ./scripts/t0-build.sh` — with the subshell, the capture and the `grep` living inside a
  real shell where they run normally. That keeps every assertion the fixture makes; weakening it to
  a bare exit-code check would trade a refusal for a false green, since the toolchain can exit 0
  over an error.

  Note what is invisible from the plugin's own checkout: there, every command a fixture reaches is
  already permitted, so a fixture format that cannot survive a grant reads as working.

- **HD-035 · `reduce ship` does not retire the run pointer on a no-verdict close.** Promoted from
  the consumer's register (filed there as `HD-5`, 2026-09-22).

  `AGENTS.md` states that retiring the pointer "is the one lever every close needs pulled, and
  `reduce ship` pulls it for you". Measured on a run that closed `escalated` with no verdict: the
  ship report was frozen and `.shapeup/active-scope` was **still on disk** afterwards, so the next
  `init run` on that slug exits 3 and needs `--force` — which the register already notes is not a
  clean reset, because it also resets the stagnation breaker as a side effect of lifting the fence.

  The documented behaviour and the observed behaviour disagree, and the doc is the one making the
  stronger claim. Either `reduce ship` retires the pointer on every close it writes a report for,
  or `AGENTS.md` stops promising it does; deciding which is a design call, not a doc fix.

- **HD-036 · A THIRD producer writes a committed artifact its own lint reds — and the pattern of
  fixing them one at a time is the defect.** Measured 2026-09-22 on a deliberately fresh-state soak,
  which is what surfaced it.

  `tech-lead` writes `project-profile.md` at GATE L0. This run's L0 re-derived the profile from
  scratch (the run tier had been deleted, so nothing was carried forward) and recorded two toolchain
  defects it had just found, citing its evidence:

  ```
  project-profile.md:74   `.shapeup/find-my-todos/discovery/ledger.md` for the full evidence
  ```

  Fifteen minutes later its own L1b refused the run:

  ```
  close_cause: L1b: spec-lint reported red findings before BUILD … red=1 TIER-DIRECTION
               (project-profile.md:74 points into gitignored .shapeup/ from a committed file)
  ```

  The orchestrator wrote a file at L0 that its own gate rejected at L1b. `rounds_used: 0`.

  **This is the third instance of one class, and the third is the finding.** `HD-027` was
  `ba-pitch-analyzer` citing a `.shapeup/` path in `requirements.md`, fixed by teaching the docs what
  the lint enforces. `HD-030` was `reduce ship` citing board ids in `REPORT.md`, fixed by sanitising
  at that producer's write boundary. Each fix closed its own instance and left the class open, and
  each time the closing argument was that the lint scans the whole committed tree so nothing else
  could be producing violations. **That argument confuses the lint's reach with the producers'
  compliance**, it was recorded as settled in the 3.7 work, and the consumer has now falsified it
  twice.

  There is no reason to expect `tech-lead` is the last one. Every worker that writes into the
  committed tier is a candidate, and nothing structurally prevents the next.

  **Fix shape — stop teaching producers and make the violation unwritable.** One sanitiser at the
  committed-tier write path, the way `reduce ship` now does it for board ids, applied to every
  committed write regardless of which worker made it: a local-tier reference resolves to a durable
  anchor, or to prose naming the tier without a path. A pre-write guard that refuses the write
  outright is the stronger form and is closer to this repo's own hook discipline — a violation that
  cannot be written cannot red a gate fifteen minutes later. Either way the rule belongs at one
  choke point, not in N sets of worker instructions.

  **What the fresh state bought.** Earlier soaks carried a `project-profile.md` forward on disk and
  never re-derived it, so this never fired. Deleting the run tier made L0 do real work, and the
  defect appeared immediately — a reminder that state carried between runs hides defects as readily
  as it causes them.

  **DETERMINISTIC, not a one-off: 2 of 2 fresh runs, an hour apart.** The next fresh-state run wrote
  the same class of violation at a different line (`project-profile.md:92`) and aborted at L1b the
  same way — *after* the same session had already repaired the first occurrence and seen its own
  lint go green. An L0 that re-derives the profile reliably cites the run tier as its evidence,
  because that is genuinely where the evidence lives; the committed file is simply not allowed to
  say so.

  That settles the fix's shape. Teaching the producer does not hold: this producer was taught by its
  own gate, complied, and then a fresh instance of it did the same thing an hour later — a worker
  cannot carry a lesson across runs, and prose in a skill file is the only place the lesson could
  live. **The enforcement has to be mechanical and at the write boundary.** `reduce ship`'s
  sanitiser is not reusable here, because the orchestrator writes `project-profile.md` directly
  rather than through a kernel function, so the choke point is a PreToolUse hook refusing a write
  into the committed tier whose content carries a local-tier path — the shape `sandbox-guard`
  already implements for substrate. A hook can also do what a taught rule never can: say *why* at
  the moment of the write, while the writer still has the context to rephrase.

  Cost per occurrence, measured: roughly 12 minutes and a full L0 pass, twice, before BUILD.

- **HD-037 · `coverage` registers the pitch's NO-GOS as requirements, marked `covered`, and L1b
  reds every one of them.** Measured 2026-09-23 on the rc.2 soak, third abort of the same run.

  The committed registry held `REQ-1`…`REQ-22`. This run's `coverage` dispatch appended seven more,
  every one lifted from the pitch's **No-gos** section, every one with status `covered`:

  ```
  + | REQ-24 | "No persistence. The in-memory repository is the repository" | intake.md § No-gos | covered |
  + | REQ-25 | "No sort, no filter-by-done, no sections. Insertion order is the order" | … | covered |
  + | REQ-27 | "No debounce or async search. …" | … | covered |
  ```

  L1b then refused the run with seven `REQ-UNCOVERED` findings — *"graded by no acceptance criterion
  and claimed by no scope"* — which is exactly right and unavoidable: **a no-go is a constraint, not
  a deliverable.** Nothing can grade "do not build a settings screen", so marking it `covered`
  asserts something that cannot be true, and the gate is correct to red it.

  The registry's own header names the vocabulary that should have been used: *"a removed clause is
  marked `CUT (PO-approved)`, never renumbered or deleted."* A no-go belongs in that family — a
  clause deliberately not built — not in the covered family.

  **There is a second defect in the same diff.** `AGENTS.md` says a registry already on disk is not
  re-dispatched, and that ids are *"assigned once and frozen"*. This registry was committed and
  complete at 22 rows; a later run extended it mid-flight, which moves the run's own measuring stick
  after planning was fast-forwarded past the phase that owns it. Whatever is decided about no-gos,
  appending to a frozen registry is its own bug.

  **Fix shape:** `coverage` must not extract the No-gos section as coverable clauses. Either skip
  that section, or register its clauses with a status the coverage lint exempts — the `CUT` family
  already exists and already means "deliberately not built". And the registry-on-disk check needs to
  cover extension, not only regeneration.

  Third distinct producer/artifact defect this soak surfaced, after `HD-034` (fixture shape) and
  `HD-036` (committed file citing the local tier). All three share a shape: **a worker writing a
  committed artifact that the harness's own gate then refuses**, and none of them is reachable from
  the plugin's own checkout, where no pitch, no registry and no toolchain exist to disagree.

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
