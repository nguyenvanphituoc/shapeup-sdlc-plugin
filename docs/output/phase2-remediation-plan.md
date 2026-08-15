# Phase 2 — remediation plan

## Goal

Close the defects `DIAGNOSIS-phase2.md` left open, in the order that lets each step be validated
before the next one is built. The through-line is D2: **nothing in the system attests which skill
produced an artifact**, so a run against a missing, disabled or wrong-version plugin reports phases
completing while none of the shipped craft was applied.

The deliverable is not "the fixes are written". It is criterion 1 of the phase's own acceptance line
— the baseline feature ships end-to-end on the native tool, interactive *and* headless, with both
traces archived.

## User review required

> [!IMPORTANT]
> Step 0 is a measurement, not a change. Its result decides whether Step 1 is buildable at all, so
> nothing else starts until it has run and its table is filled in below.

## Open questions

One, and it is the whole design's hinge — answered by Step 0, not by discussion:

**Do `PreToolUse` / `PostToolUse` hooks fire for tool calls made by a sub-agent?** Every dispatch in
this pipeline is a `Skill(...)` call made by a Workflow leg, never by the main session. If hooks do
not fire there, a receipt-based attestation cannot be written for exactly the dispatches that need
it, and an ingest that requires one would refuse every result in the run.

---

## Step 0 — measure the hook boundary (go/no-go)

No code. Load the working copy (`claude --plugin-dir .`), open a scratch run
(`harness init run --slug probe-hooks --intake-text "…"`), redirect the ledger
(`SHAPEUP_DECISIONS_PATH=<tmp>/decisions.jsonl`) so the live one stays clean, then have a **sub-agent**
make three `Skill(...) --order <path>` calls and read the ledger after each:

| # | Dispatch state | `PreToolUse` row? | `PostToolUse` row? | Can the row tell success from failure? |
|---|---|---|---|---|
| a | skill resolves, completes | **yes** | **yes** | yes — `tool_response = {success:true, commandName:"shapeup-sdlc-plugin:orient"}` |
| b | skill name unknown (`tool_use_error`) | **no** | **no** | n/a — the host rejects the name before any hook fires, so (b) is (a)'s absence |
| c | order missing → `validate-envelope` denies | **yes** (the deny itself) | **no** | n/a — a denied call never runs, so it never reaches `PostToolUse` |

**RESULT: green branch — build Step 1 as written.** `PostToolUse` fires for a `Skill(...)` call made
by a sub-agent, and every failure state is distinguishable from success. The distinguishing signal is
stronger than the plan assumed: a failed dispatch produces **no `PostToolUse` row at all**, so
"the receipt exists" is already the discriminator and `tool_response.success` is confirmation on top
of it, not the only evidence.

`PostToolUse` is not registered today (`hooks/hooks.json` has `SessionStart`, four `PreToolUse`
matchers and `Stop`), so probing it means adding a throwaway matcher that appends a row and nothing
else. `tests/structural/03-hooks.mjs:27` already lists `PostToolUse` among the valid event names, so
the manifest check accepts it.

**How the answer routes:**

- **`PostToolUse` fires in a sub-agent and (b)/(c) are distinguishable** — build Step 1 as written.
- **`PostToolUse` fires but (b)/(c) look like (a)** — the receipt must carry the outcome out of
  `tool_response`, not merely exist. Step 1 changes shape; the ingest check stays.
- **Neither fires for sub-agent calls** — **stop and re-plan.** Do not ship a receipt gate whose
  receipt can never be written. D2 stays open, recorded as open, and Step 2's canary becomes the
  only attestation available.

### Measured payload facts Step 1 is built on

Taken from the probe's own dump, not from documentation:

| Fact | Value | Why Step 1 needs it |
|---|---|---|
| Skill tool input | `{skill, args}` | the `--order` matcher must read `args`; `skill_args` is not the field name |
| completed dispatch | `tool_response.success === true` | the `dispatch_ok` bit |
| which skill ran | `tool_response.commandName` = `"shapeup-sdlc-plugin:orient"` | `skill_invoked`, **namespaced** — compare the segment after the last `:` against `order.worker` |
| sub-agent origin | `agent_id` + `agent_type` present on the payload; absent on a main-session call | tells an orchestrated leg from an operator's own call |
| denied dispatch | `PreToolUse` deny row, then nothing | no receipt is written, so ingest refuses — the intended wall |
| unknown skill | no row on either event | no receipt is written, so ingest refuses — the exact D2 instance |

The probe also caught a defect in its own first attempt worth keeping: the shipped `PreToolUse` gate
scans the **`Agent` prompt** as well as the `Skill` args, so an unquoted order path in a sub-agent's
prompt that runs into a closing quote is read as part of the path and denies the whole `Agent`
dispatch. Quote the path where a prompt carries one.

---

## Step 1 — make "the skill ran" a fact on disk (D2) — **DONE**

> **Closed.** Built as written, plus the guards. `npm test` green at 947 checks (baseline 924), each
> new guard verified by re-introducing its defect. Closure proven by execution, not by the suite: a
> live sub-agent dispatch left a receipt (`live-d2/orient ran orient, dispatch_ok=true`), ingest
> accepted that result and **refused** the one whose order nothing ever dispatched, and
> `--no-receipt-check` let the refused one through. Two defects the guards caught in the fix itself
> are recorded in `RESULT-v2.md`: the escape hatch was inert (flags arrive camelCased), and the
> fail-open guard was vacuous (asserting `exit === 0`, which `runHook` guarantees unconditionally).
>
> Two deliberate deviations from the design below, both recorded in the code:
> - **The receipt ledger is one append-only JSONL per run** (`receipts/dispatch.jsonl`), not one file
>   per order. Order paths repeat across relaunches and scopes dispatch concurrently, so a per-order
>   file would overwrite the very staleness the reader has to detect. The dedicated directory — the
>   design's actual point, since three readers `readdirSync` `orders/` — is unchanged.
> - **The hook writes only when the tool result names a resolved skill.** The matcher stays
>   `Skill|Agent` to pair with the order gate, but an `Agent` dispatch whose prompt merely mentions
>   `--order` gets no receipt: a prompt is a plan to dispatch, not evidence of one, and attesting
>   from it would forge the exact fact the file exists to establish.

### Why not `PreToolUse` (the earlier draft of this plan)

`PreToolUse` fires *before* the tool runs, so it cannot separate "the Skill returned" from "the Skill
errored and the sub-agent improvised the craft itself" — which is the measured failure
(`DIAGNOSIS-phase2.md:62-87`). It appears to catch the observed instance only by coupling: the plugin
was not loaded, so `hooks/hooks.json` was not registered either, so no receipt. Once the plugin *is*
loaded — Step 4's whole point — a dispatch that errors still gets a `PreToolUse` receipt written
before it fails. The fix would expire exactly when the environment is repaired.
`DIAGNOSIS-phase2.md:151-153` says the same thing; this plan takes that branch.

### [NEW] `hooks/dispatch-receipt.mjs`

A `PostToolUse` hook, not an extension of `kernel/verify/envelope.mjs` — that file's hook mode is the
`PreToolUse` order gate and stays single-purpose, and a separate file can be executed against a
fixture the way `tests/structural/15-hook-receipts.mjs` executes every other hook.

- Parses `--order <path>` from the tool input with the same matcher
  (`kernel/verify/envelope.mjs:251-253`), and defers when there is none — a non-orchestrated Skill
  call is not this hook's business.
- Reads the order for `order_id` and `worker` (both required by `work-order.schema.json`) and the
  tool result for whether the dispatch actually completed.
- Writes `{order_id, worker_declared, skill_invoked, run_id, dispatch_ok, at}`.
- **Every write inside `try/catch`, and the hook never denies.** `hooks/lib/decision.mjs:45-47` is
  explicit that a receipt must never fail a tool call, and an unguarded `writeFileSync` in a hook body
  becomes `verdict:"error"` → exit 0 → the dispatch proceeds *without* a receipt, and the phase then
  dies at ingest instead.

### [MODIFY] `kernel/lib/paths.mjs`

Add `dispatchReceipts(cwd, slug)` → `.shapeup/<slug>/receipts/`. Not a sibling `orders/orient.json.receipt`:
`probe/resume.mjs:213`, `reduce/graph.mjs:117` and `report/export.mjs:102` all `readdirSync` the
orders directory, and today a stray file there is harmless only because all three happen to filter
`.json`. A receipt named `orient.receipt.json` would become a bogus `Order` node in the run graph.
Its own directory means no future reader has to know. (`receipt` is taken by the run receipt —
hence the distinct name.)

### [MODIFY] `hooks/hooks.json`

One `PostToolUse` entry, matcher `Skill|Agent`, timeout 10 — same shape as the existing four.

### [MODIFY] `kernel/reduce/ingest.mjs`

Refuse a result whose dispatch has no matching receipt — **scoped to orchestrated orders**:

- `--order` given, or an order file exists at the mirrored path of a positional result → resolve it.
- The order declares `mode: "orchestrated"` → require a receipt where `order_id` matches the result's,
  `skill_invoked === order.worker`, and `at >= order.compiled_at`. All three: a receipt that only has
  to *exist* is satisfied by a stale one from an earlier relaunch, and order paths like `orient.json`
  are stable across relaunches — the exact re-dispatch path `shapeup-run.js:425-434` describes.
- No order on disk, or `mode` is not orchestrated → skip the check. Standalone and fixture ingests
  keep working.
- `--no-receipt-check` as the escape. The receipt channel is best-effort by design; a load-bearing
  gate built on it needs a documented way through when the write fails for an environmental reason.

Note what this scoping buys: the three fixture ingests at `tests/structural/05-tech-lead.mjs:418,445,455`
write results into a temp tree with no `orders/`, so they stay green **without being weakened** — and
`:455-457`'s malformed-result assertion keeps failing for the schema reason it was written for,
rather than passing for a new one.

The earlier draft also made `--order` mandatory. Dropped: guard #16(g) already forbids a workflow
script aiming an ingest any other way, and the mandate would break the fixtures, the positional form
in `ARGV_SPEC.usage` (`kernel/reduce/ingest.mjs:285`), and the documented calls at
`docs/design/03-system-design.md:35` and `docs/design/workflow_architecture_design.md:192`.

### [MODIFY] `skills/tech-lead/workflows/shapeup-run.js`

Keep the prompt instruction, as belt-and-braces only — the receipt is the wall, this is not:

```diff
     `2. Dispatch the worker against that order:\n` +
     `     Skill(shapeup-sdlc-plugin:${skill}) --order <the path from step 1>\n` +
+    `   If the Skill dispatch fails or returns an error, STOP and report the error. Never work ` +
+    `around a failed dispatch by doing the craft yourself.\n` +
     `   ${extra}\n` +
```

### Guards (each verified by re-introducing the defect, then restoring the fix)

| Guard | Module | Catches |
|---|---|---|
| ingest refuses a receipt-less orchestrated order | `05-tech-lead.mjs` §22 | the D2 false green |
| ingest accepts one with a valid receipt | `05-tech-lead.mjs` §22 | a gate that refuses everything |
| a receipt whose `skill_invoked ≠ order.worker` is refused | `05-tech-lead.mjs` §22 | wrong-skill dispatch |
| a receipt older than `order.compiled_at` is refused | `05-tech-lead.mjs` §22 | a stale receipt across relaunch |
| the hook writes a receipt on a completed dispatch, none on a failed one | `03-hooks.mjs` | the hook itself |
| the hook leaves a decision row in all three payload states | `15-hook-receipts.mjs` | an inert hook |

---

## Step 2 — fail fast on an unresolvable worker roster (D2, cheap half) — **DONE**

> **Closed, in both halves.** `npm test` green at **960 checks**; eight new guards, each verified by
> re-introducing its defect. `claude plugin validate --strict` and `npm run demo` green.
>
> - `kernel/verify/skills.mjs` — roster derived from `WorkerName`, root from the module's own
>   location, `--plugin-root` for fixtures, prints the version that answered. Routed as
>   `verify skills`.
> - `kernel/init/run.mjs` — refuses with **exit 3**, naming the missing workers, and leaves no run
>   root behind. `--plugin-root` added so the refusal path is reachable by a test; the receipt now
>   records `plugin: {name, version, root}`, so every run's trace names the copy that produced it.
> - `kernel/compile.mjs` — `OP_OWNER` hoisted to module scope and exported, so the suite can check
>   every routed operation names a worker the enum carries. One table, not two.
> - **The canary, which the plan made conditional on Step 0 being green.** It could not go where the
>   plan put it: `init run` is a kernel process and cannot make a `Skill` call. It is instead the
>   orchestrator's first leg (`phase("Preflight")`) — one dispatch, deliberately with **no
>   `--order`**, since it tests name resolution rather than doing work and an order would leave a
>   compiled order with no result in `orders/`, where three readers enumerate.
> - `kernel/verify/dispatch.mjs` — reads the hook layer's decision rows for the evidence. A Skill
>   call whose name does not resolve fires no hook at all, so a row naming a skill is proof the
>   session resolved it, and **the sub-agent that made the call cannot write that row**. `--within
>   <seconds>` is required rather than optional because a Workflow script may not call `Date.now()`,
>   and without a window a checkout that once had the plugin loaded passes forever.
>
> Live, in a real session: the canary skill reported `✅ orient resolved in this session — dispatch
> observed at …`, while a skill nothing dispatched and the same skill outside the window both
> reported no evidence.
>
> **What this pair can and cannot do, stated plainly.** `verify skills` proves the files exist at a
> root at a version. It cannot prove the session resolves that copy — both states the diagnosis names
> (installed-but-disabled, wrong-version-loaded) have all ten `SKILL.md` files. Only the canary
> answers that, and only for the moment it ran.

### Original design

The earlier draft checked `existsSync(<root>/skills/<name>/SKILL.md)` for eight hard-coded names.
Two problems, both fatal to its purpose:

- It answers *"are the files on disk"*, but D2's failure is *"can this session resolve
  `Skill(shapeup-sdlc-plugin:orient)`"*. In the session that produced D2 the files were sitting right
  there in the repo. It also passes green on the two states the diagnosis names — installed-but-disabled,
  and wrong-version-loaded: v1.6.3 has all eight `SKILL.md` files.
- Eight names hard-coded beside a ten-member enum (`domain.schema.json#/$defs/WorkerName`, which
  includes `translator` and `coach`) is the drift CLAUDE.md exists to prevent — a list that reads
  perfectly and is wrong.

### [NEW] `kernel/verify/skills.mjs`

- **Roster derived, never spelled**: read `WorkerName` from `domain.schema.json`, narrowed to the
  workers this run will actually dispatch via the operation→worker table `kernel/compile.mjs:461`
  already owns (export it so there is one table, not two).
- **Root derived from the module's own location** — `resolve(HERE, "../..")`, the precedent at
  `kernel/verify/envelope.mjs:31` — with `--plugin-root <dir>` for fixtures. Not
  `process.env.CLAUDE_PLUGIN_ROOT`: env is not reliably exported into a sub-agent's Bash shell, and
  the kernel that is executing is already inside the plugin root.
- **Prints the resolved root and the version it found** (`<root>/.claude-plugin/plugin.json`), so a
  wrong-version run is visible in the trace instead of silently green.
- Exits non-zero naming the missing worker(s).

### [MODIFY] `kernel/harness.mjs`

Add `skills: "./verify/skills.mjs"` to the `verify` routes table (`kernel/harness.mjs:49-52`).

### [MODIFY] `kernel/init/run.mjs`

Call it there, refusing with **exit 3** (`init run` refused to open). That is what GATE L0 actually
executes, it covers both lanes rather than only the workflow one, and it is genuinely before any
spend — the earlier draft's call site in `shapeup-run.js` runs through `cmd()`, which spawns a Sonnet
sub-agent first, and names a gate (`L0`) that script does not have (its gates start at L1a;
`shapeup-run.js:91` aborts under `"args"`).

Record the resolved plugin root and version in the run receipt while it is in hand, so every run's
trace says which copy of the plugin produced it.

**Say plainly what this check can and cannot do.** It proves *these files exist at this root at this
version*. It cannot prove the session will resolve that copy — only a live dispatch does that, which
is Step 1's mechanism used as a preflight. If Step 0 comes back green, add a canary: L0 dispatches one
trivial `Skill(...) --order` call and requires its receipt. Then Steps 1 and 2 are one mechanism
instead of two.

### Guards

| Guard | Module | Catches |
|---|---|---|
| `verify skills` is routed and runs | `13-argv-contract.mjs` / `14-invocation-paths.mjs` | an unrouted verb |
| exits non-zero against a fixture root with a worker removed | new checks in `03-hooks.mjs` or §22 | the check being inert |
| its roster matches `WorkerName`, not a literal list | `50-payload-contract-parity.mjs` | roster drift |

Fixture-based, with `--plugin-root <tmpdir>`. The earlier draft's "rename a skill folder by hand"
mutates the plugin under test and is not repeatable.

---

## Step 3 — the baseline feature (already in the repo) — **DONE**

> `examples/todo-cli` promoted to the acceptance contract. Both tasks the plan named are closed:
> the dead citation is gone (the sentence now states the non-UI gap directly instead of pointing at
> a document that is not in this repo, and the two "Stage G" references — a migration stage name
> meaningless to any reader — are replaced by what the mechanism actually is), and `EXPECTED.md` now
> states **where the run executes**: a scratch checkout outside the plugin tree, because `.shapeup/`
> is gitignored but the CLI the workers build is not. Its launch block was still v1-era prose
> (`/shapeup <file>`, "use the tech-lead skill"); it now names `harness init run` first and the
> `Workflow` launch after, with the headless variant.
>
> Validated by executing the oracle both ways, since this file is now a release criterion:
> the reference implementation **PASSes 6/6, exit 0**; a deliberately broken happy-path-only
> implementation **FAILs 4/6, exit 1** — including E4, where the stack-trace detector fires. An
> oracle that has only ever been seen pass is not known to discriminate.

### Original note

The earlier draft proposed a new `examples/it-jobs-researcher` — a CLI researching Vietnamese IT jobs
and real estate. Dropped: it needs live network access, in a repo whose load-bearing rule is zero
network, and it would have shipped without the expected outcome the diagnosis asks for
(`DIAGNOSIS-phase2.md:160-163`), leaving Phase 7's G6 comparison with nothing to compare against.

**Use `examples/todo-cli`.** It already is the thing being asked for:

| File | Role |
|---|---|
| `idea.md` | the committed pitch — non-UI, explicitly one short round |
| `EXPECTED.md` | the expected outcome, as checkable assertions (doc tree + Test Surface, cited-evidence verdict, edge cases) |
| `todo.contract.json` + `reference/todo.js` | an oracle that grades the built result, with a reference impl that must PASS and a broken one that must FAIL |

It is also already the worked example in `docs/quickstart.md:4,31,139`, so the baseline and the
front-door tutorial stay the same artifact.

Two small tasks, since this promotes `EXPECTED.md` to the acceptance contract:

- `EXPECTED.md:7` cites an independent-audit-and-evolution plan under an audit directory, and a
  "Stage G" inside it. Neither the directory nor the document is in this repo. Repoint or trim — an
  acceptance contract citing a dead path is the same defect class this phase is closing.
- State where the run executes. `.shapeup/` is gitignored repo-wide, but the *implementation* the
  workers write is not; run it in a scratch checkout, not in the plugin tree.

---

## Step 4 — stand up a real lane — **DONE**

> The diagnosis's blocker #2 ("no environment has the v2 plugin loaded") is cleared, and by a
> cheaper route than the plan assumed: `claude --plugin-dir <repo>` resolves
> `Skill(shapeup-sdlc-plugin:orient)` from a spawned session, so no marketplace install was needed.
> Confirmed by execution before any run was spent on it — first in the Step 0 probe, then again by
> the live D2 and canary probes.
>
> Two scratch checkouts, outside the plugin tree per Step 3, each git-initialised with the pitch
> committed as a pre-run baseline so the diff a run produces is legible:
>
> | Lane | Path | `auto_level` | Fit |
> |---|---|---|---|
> | headless | `phase2-todo-cli-headless` | `unattended`, answers `ci` | lane `full`, confidence **clear** |
> | interactive | `phase2-todo-cli-interactive` | `interactive` | lane `full`, confidence **clear** |
>
> Both runs opened through `harness init run` (the receipt mints the `run_id`; without it every
> `setRunStatus` fails with exit 3), both passed GATE L0's new roster check for real, and both
> receipts carry `plugin: {shapeup-sdlc-plugin, 2.0.0, <repo>}`.
>
> Model matrix `exec=sonnet, eval=opus, qa=sonnet` — the single-judge invariant means the
> evaluator's verdict IS the run's result, so the judge gets the stronger model and the build legs
> stay cheap. Budgets `maxRounds 2, attemptBudget 3`: the pitch's own appetite is one short round,
> and the second exists so a single FAIL can be answered rather than ending the run.
>
> **No changes to `commands/build.md` or `commands/ship.md`**, as the plan requires — they already
> carry the `Workflow` launch and the "`harness init run` first" note from the D5 fix.

### Original note

This is an **environment** action, not a docs edit — blocker #2 of `DIAGNOSIS-phase2.md:129-131`.
Nothing in Steps 1–3 can be validated without it.

- Load the working copy (`claude --plugin-dir .`) or install 2.0.0 from the marketplace; confirm
  `Skill(shapeup-sdlc-plugin:orient)` resolves before spending a run on it.
- Drive it the way `SKILL.md` does: `harness init run` first (the receipt mints the `run_id`; without
  it every `setRunStatus` fails with exit 3), then the `Workflow` launch.

**No changes to `commands/build.md` or `commands/ship.md`.** The earlier draft proposed replacing
their launch block with `harness init run` + `Skill(…:tech-lead)`. Those files were already fixed
under D5 (guard #43): `build.md:22-27` carries the `Workflow({scriptPath…})` launch and `build.md:29`
already says "`harness init run` first, so the receipt exists". The proposed edit would delete the
Workflow launch from the shipped docs — undoing the v2 cutover in the one place a user reads it.

---

## Findings from the criterion-1 runs (discovered, not fixed here)

Recorded rather than acted on, which is the discipline the harness itself insists on: a thing found
mid-run becomes a ledger entry and a raw idea for the Betting Table, not an unplanned code change in
the middle of a phase that is being validated.

**F1 — the launcher's background ceiling, not a harness defect.** The `Workflow` tool runs in the
BACKGROUND of the launching session, and `claude -p` terminates background tasks after 600 s. The
first headless attempt was *killed* mid-ANALYZE — spec tree written, result un-ingested — which looks
exactly like an abort and is not one. Any future automation that drives a run headlessly needs
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, and this is worth a sentence in the docs wherever a
headless launch is described.

**F2 — a raw `Workflow` launch skips GATE L0, and WIRE is where you find out.** `project-profile.md`
is written by the **tech-lead skill**, at L0 Step 2 — "the only artifact this skill writes directly;
`shapeup-run.js` has no filesystem of its own". Launching `Workflow` directly therefore produces a
run with no profile, and `solution-architect` escalates by contract: it resolves every wiring seam
against the profile's declared `entry_point` and is forbidden to guess one. The run then aborts at
WIRE with an empty artifact list.

Three things went RIGHT here and are worth keeping on the record, because each is a behavior this
project has previously failed to have:

- the worker **escalated rather than inventing** an entry point — the anti-fabrication rule holding
  under pressure, on a live run, unprompted;
- the phase post-condition **caught the empty artifact list** instead of advancing on a phase that
  produced nothing;
- the abort message correctly predicted that the failure would repeat on every relaunch, and said why.

**The shipped docs are not at fault, and were checked rather than assumed.** `commands/build.md:29`
routes through `/ship` or the tech-lead skill, and `commands/ship.md:17-18` states the sequence in as
many words: "`tech-lead` holds the L0 intake conversation, **writes `project-profile.md`**, then hands
the whole pipeline to a single background launch". Nothing in the shipped set tells a caller to reach
`Workflow` directly; the launcher written for this phase did, and that was the defect.

Candidate raw idea for the Betting Table, not acted on here: have the orchestrator check its own
spine preconditions at Preflight and abort naming the missing artifact, the way the canary aborts on
an unresolvable skill. It would convert a correct-but-late escalation three phases in into a refusal
before any spend — the same move Step 2 made for the worker roster. Deliberately not built during a
phase whose whole purpose is validating what is already there.

**F3 — the fast-forward works, measured rather than asserted.** The relaunch after F1 skipped ORIENT
and ANALYZE from the artifacts on disk and re-dispatched neither. That is the kill/resume property
Phase 4 claims, observed here as a side effect of a real failure rather than in a probe built to
show it.

**F6 — the fan-out ignores the dependencies the scope contracts declare.** BUILD chunks scopes as
`chunk(scopes, maxParallelScopes)` over whatever order `scope_files` yields — alphabetical — so the
first wave of four was `add-todo, cli-integration, complete-todo, foundation`. `cli-integration`'s own
contract says it "replaces `foundation`'s `bin/todo.js` placeholder" and "routes to each command
scope's module", and `foundation`'s says "every command scope calls the same two modules … it ships
first". It was nevertheless built simultaneously with all of them, and escalated:

```
todo-cli/foundation-r1-a1        status=done       TASK-001:done, TASK-002:done, TASK-003:done
todo-cli/add-todo-r1-a1          status=done       TASK-004:done
todo-cli/complete-todo-r1-a1     status=done       TASK-006:done
todo-cli/cli-integration-r1-a1   status=escalated  TASK-008:failed, TASK-009:failed
```

The information needed to sequence this is already on disk and already authored — task-level
`depends_on` in the board, and the scope contracts' own prose — so the fan-out is discarding an
ordering its inputs give it for free. The cost is not correctness (the escalation is honest, the
ratchet gets another attempt, and the substrate walls held throughout) but spend: a scope is built,
fails for a reason nothing about it caused, and is paid for again.

Worth stating plainly because Phase 3's "done when" was *"a 3-scope feature builds with ≥2 scopes
concurrently, board/ledger uncorrupted"* — and by that bar this run passes. Concurrency works and
nothing corrupted. What the bar did not ask is whether the concurrency was *scheduled*, and it is
not. Candidate raw idea: topologically order scopes by declared dependency before chunking, so a wave
never contains a scope that depends on one still in flight.

**F5 — a killed phase leaves a live order, and a live order is a live substrate.** After F1's kill,
`probe resume` reported `pending_orders: ["analyze.json"]` for the rest of the run: an order compiled,
never answered by a result, and therefore still LIVE by `sandbox-guard`'s definition — which permits a
write when *some* live contract covers it. The analyze substrate includes the spec folder, so for the
whole of BUILD the spec tree stayed writable by any worker, widening the sandbox beyond what the
build orders alone authorise.

Nothing exploited it here, and the widening is small. It is worth recording because it is a property
nobody chose: the fence's breadth is a function of how a previous phase *ended*, so an interrupted
run is permanently less fenced than a clean one, and the difference is invisible unless someone reads
`pending_orders`. Candidate raw idea: have the fast-forward retire orders for phases it has just
determined are complete-by-artifact, so a resumed run's live set matches its actual work.

**F4 — the archetype vocabulary cannot name a CLI.** `domain.schema.json#/$defs/ProjectProfile`
types `archetype` as an enum of exactly five values:

```
client-only-game · web-service · mobile · library · data-pipeline
```

There is no `cli`. Dispatched to write the profile for a command-line deliverable, the tech-lead
picked `web-service` and wrote its own reasoning into the note: *"Node CLI, not an HTTP service …
The archetype enum has no native 'cli' value; web-service is the closest structural fit for
reachability tracing (entry_point → import graph → engines)."*

That is the right behavior — declare the mismatch rather than silently mislabel — and the gap
underneath it is real. The archetype exists for one load-bearing reason: reachability must resolve
`entry_point`, and the correct entry point is archetype-specific. A CLI's composition root is an argv
dispatcher, which is structurally unlike a web service's request router even though both fan out from
one module. Calling it `web-service` works today only because the reachability walk cares about the
import graph rather than the protocol.

It is worth fixing because of where it bites: the plugin's stated purpose is *build anything*, and
`examples/todo-cli` is its canonical **non-UI** example — chosen precisely to prove the harness is not
a web-app tool. The one vocabulary that classifies deliverables has no word for it. Adding `cli` is a
schema change with a compile-and-ingest blast radius, so it is recorded here as a raw idea for the
Betting Table rather than made during the phase that is validating the current behavior.

## Step 5 — run criterion 1 twice, keep both traces — **IN PROGRESS**

> Headless lane: three launches. What each one bought, and what it cost, because a run that fails for
> a diagnosable reason is not a wasted run — it is the only instrument that has ever found these:
>
> | Launch | Reached | Ended | Bought |
> |---|---|---|---|
> | 1 | mid-ANALYZE | killed by the launcher's 600 s background ceiling | F1 |
> | 2 | WIRE | `aborted` — no `project-profile.md` | F2, and F3 (the fast-forward skipped ORIENT+ANALYZE) |
> | 3 | GATE H | `gate_h`, `breaker: inner`, 6 scopes queued, 0 green, **no builder ever dispatched** | the two shipped defects below |
> | 4 | GATE H | `gate_h`, 0 green — but **13 source files written**, 6 scopes built, the ratchet ran | the first BUILD dispatch this project has ever made, and the third defect |
>
> Launch 4 is the one worth reading twice. BUILD dispatched four legs inside 900 ms, wrote a real
> CLI, ran the attempt ratchet (cli-integration burned all three attempts and queued a GATE H
> proposal, exactly as designed) — and reported **zero green scopes**, because `verify t0` wrote its
> verdicts to the COMMITTED tier while `probe t0` reads the LOCAL one. Six verdicts existed,
> `foundation` among them at 2/2 fixtures `kept`, and the round could not see any of them.
> Three defects, each hiding the next: the fan-out never dispatched, so the compile line was never
> reached, so the verdict was never read.
>
> **Two shipped defects, both severe, both fixed and guarded** — see `RESULT-v2.md` for the full
> account:
>
> - **A `null` pipeline stage means "drop this item", not "carry on".** BUILD's first stage returned
>   `null` for "not green yet — build it", so every scope not already green was discarded before the
>   builder ran. On a fresh run that is every scope. **BUILD could never dispatch, ever.** Measured
>   with a probe written to ask only that: `stage1 → null ⇒ stage2 ran 0/3`; `stage1 → {…} ⇒ 3/3`.
> - **The build leg's compile line could not resolve its own worker** — `--operation execute --slug`
>   exits 2 because `OP_OWNER` has no `execute` key, contradicted one line later by the leg's own
>   `extra`. Masked entirely by the first defect.
>
> After the fix, the first wave dispatched four `task-executor` legs inside 900 ms, wrote nine source
> files, and ingested four results — three scopes `done`, one escalated (F6).
>
> What is proven by execution as of this writing: the orchestrator loads and runs; every dispatch is
> attested to its correct worker; a stale receipt is rejected on a real relaunch; the fast-forward
> resumes on artifacts; scopes fan out in parallel; the single-writer reducer holds under concurrent
> ingest; `sandbox-guard` denies an out-of-substrate write under load; the WorkOrder gate refuses a
> leg that pasted `"<the path from step 1>"` literally; a declared `shared_substrate` overlap is
> honored; and workers escalate rather than fabricate.
>
> **Not yet proven: T0 verification, EVAL, QA, ship, and the interactive lane.** Criterion 1 is not
> met until those land, and this section says so rather than counting the parts that did.

### Original note

Interactive (gates pause and are answered) **and** headless (`--unattended`, `preset:ci`). Archive
both `.shapeup/` trees. One lane is not the criterion — the earlier draft ran headless only and would
have left Phase 2 open while reading as complete.

---

## Step 6 — record the LOC descope — **DONE**

> Written into `RESULT-v2.md`. The figure was re-measured from `4bd9592` rather than copied
> (711 added, 1,241 deleted, net **−530**, 12 files), and the record states explicitly what was NOT
> done: re-measuring across Phases 1–2 together to reach −1,500. The two phases did delete roughly
> that much between them; presenting it as satisfying *this* criterion would manufacture a
> measurement to fit a bar.

### Original note

Criterion 3 (net-negative ≥1,500 LOC) is descoped, not met: the target was written against a Phase 2
that would also delete the scripts, and Phase 1 had already moved them; the phase-2 commit measures
−530. Write that down, with the reason, in `RESULT-v2.md`. "Considered resolved without code changes"
is not a record, and re-measuring across Phases 1–2 to reach the number would be manufacturing a
measurement to fit a bar.

---

## Verification plan

### Automated

`npm test` (→ `node tests/structural.mjs` — that is the runner; the suite has no per-directory one),
green, with the new guards from Steps 1 and 2 included and each verified by re-introducing its
defect. Plus
`claude plugin validate . --strict` and `npm run demo`, run *before* editing as well as after — a
suite that has not been run is an assumption, not a baseline.

### Manual

1. Step 0's table, filled in from executed probes.
2. A run on `examples/todo-cli` with a worker skill removed from a fixture plugin root → `init run`
   refuses with exit 3, naming the worker.
3. A run where a dispatch is made to fail (unknown skill, or the Skill call denied) → the leg produces
   no receipt and `reduce ingest` refuses the result, instead of the phase reading as complete. **This
   is the only test that closes D2**; everything else in Step 1 is machinery for it.
4. Criterion 1, both lanes, both `.shapeup/` trees archived, graded against
   `examples/todo-cli/EXPECTED.md`.

### Done when

Steps 0–6 complete, `npm test` green, and criterion 1 demonstrated in both lanes with the traces
kept. Criterion 2 is already met. Criterion 3 is recorded as descoped, not claimed.
