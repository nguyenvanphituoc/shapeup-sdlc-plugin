# v2.0 — what moved, measured

HEAD `b9d044f` · version 2.0.0

| Metric | v1 baseline | v2.0 |
|---|---|---|
| Pipeline entry points | 21 (16 scripts + 5 lib, 3 skills) | 1 (`kernel/harness.mjs`) + 3 libs |
| Permission grant lines written by init | 40 Bash rules, regenerated per script | 2 Bash rules + 1 optional `Workflow` — proven 9/9 by execution |
| Hand-rolled runtime | `run-workflow.mjs`, 400 lines | 0 — the native `Workflow` tool |
| Orchestrator | 911 lines, courier-defended | 771 lines, zero couriers (gained fan-out + refute wave + graph query) |
| Hooks | 10 | 4 walls + 1 blocking Stop hook, in 4 files |
| Scope build | sequential | `pipeline()`, `args.maxParallelScopes` (default 4) |
| Resume | directory re-scan per launch | one bounded graph query |
| tech-lead references | 8 files, 1348 lines | 4 files, 1332 lines |
| CHANGELOG | 1428 lines / 106 KB | 172 lines / 16 KB (v1 history at the tag) |
| Structural checks | 943 | 879 |
| Tracked lines (code + docs) | ~38,300 | ~36,700 |

## Two plan targets not met, and why

**≤ 15,000 lines.** Not met, and it was not reachable: 21,940 of the ~36,700 are `skills/` +
`kernel/`, which is the product itself — worker craft prose and the deterministic code beneath it —
and 6,900 are the test suite. The consolidation mostly RE-HOMED executable code rather than deleting
it (`skills/` fell 21,775 → 13,790 because the scripts moved to `kernel/`). What actually went:
the hand-rolled runtime (−400), the courier defenses (−230), six hooks (−880), the changelog
(−1,250), four references (−16 net, but eight files became four). Reaching 15,000 would mean
deleting the skills or the suite.

**Orchestrator ≤ 600 lines.** 771. It lost every courier defense and gained the fan-out pipeline,
the opt-in refute wave, the graph query and a JSDoc block on each helper. The 600 figure came from a
draft that had none of those.

**Phase 2's own third criterion — "diff is net-negative ≥1,500 LOC". DESCOPED, not met.**

Measured from the commit itself (`4bd9592`, *refactor(orchestrator): run on the native Workflow
runtime and delete the courier layer*): **711 added, 1,241 deleted, net −530** across 12 files.

The reason it is descoped rather than failed: the −1,500 target was written against a Phase 2 that
would *also* delete the 21 pipeline scripts. Phase 1 had already moved them into the kernel, so by
the time Phase 2 ran, its own scope was the runtime and the courier layer — about a third of the
deletion the number was sized for. The target and the work were measured against different phase
boundaries.

**What is deliberately not done here:** re-measuring across Phases 1 and 2 together to reach −1,500.
The two phases did land a deletion of roughly that size between them, and saying so as though it
satisfied *this* criterion would manufacture a measurement to fit a bar — the same move as rescaling
a stale trigger rate to match a count derived later. The criterion asked what Phase 2's diff was. It
was −530. Phase 2 closes with criterion 1 met and criterion 3 recorded as out of scope.

## The orchestrator had never been launched, and did not load

Everything above was measured from the artifacts. Nothing had ever *run* the file the whole rebuild
is about, and when it was finally launched on the `Workflow` tool it was refused before its body
executed:

```
Invalid workflow script: meta must be a pure literal: non-literal node type in meta: BinaryExpression
```

`meta.description` was three string literals joined with `+`. The runtime parses `meta` statically
and rejects the whole script on any node it would have to evaluate, so `shapeup-run.js` could not
start — under any lane, interactive or headless. It shipped that way, tagged 2.0.0, under a green
suite: v2.0's central claim ("runs on the native Workflow runtime") was false for the entire life of
the branch. The defect came in with the draft — `docs/output/shapeuprun.native.js` writes its
description the same way, so neither file was ever runnable — which is the cost of adopting a
companion draft that had also never been executed.

A second one, in the SHIPPED set, from the same cause. `commands/build.md` and `commands/ship.md`
both documented the launch as `node "…/kernel/harness.mjs" run "…/shapeup-run.js" --args-file …`.
The kernel has no `run` verb and never has; the documented front door to a whole feature build exits
2 on `unknown_verb`. `ship.md` contradicted itself three paragraphs later ("**The launch is the
`Workflow` tool**") — the bash block was v1 residue Phase 2 replaced in SKILL.md and left in
`commands/`.

Both are fixed, and both now have a guard that fails on the original defect and passes on the fix
(each verified by re-introducing the defect and watching the suite go red):

- **#16 (f)** — every workflow script's `meta` is a pure literal carrying `name` + `description`.
  The suite checked the orchestrator's SHAPE exhaustively and never whether it LOADS, because that
  property is visible only to a parse.
- **#43** — the invocation census now reads `commands/*.md` as well as `skills/`. Its verb check was
  already correct and derived from `ROUTES`; it was pointed one directory short of the defect.

The general lesson, and the reason both survived a fully green suite: **a static suite cannot tell
you that a thing runs.** Only an execution can, and until this session nothing had executed it.

## What is now proven by execution

Two live launches on the `Workflow` tool, after the fix:

| Probe | Result |
|---|---|
| The shipped `shapeup-run.js` loads and runs on the native runtime | Returned the `aborted` member of `RunReturn` with all six expected arg problems, incl. the model floor rejecting a below-floor tier. 0 agents, 11 ms |
| A native worker leg dispatches, with a real shell and the real kernel | `{ok: true, exit_code: 0}`, schema-validated |
| **A non-zero exit survives the boundary with no courier** | `{ok: false, exit_code: 2}` — the exact fact the deleted courier layer existed to carry |
| A JSON document crosses schema-validated (`query()`) | The `RESUME` doc came back field-for-field identical to the kernel's own stdout |
| `pipeline()` dispatches legs in parallel | 3/3 legs green. **Max 2 ran simultaneously**, not 3: two started 198 ms apart and overlapped, the third began after the second finished. Parallel dispatch is proven; a 3-wide fan-out is not, and the probe that reported it only counted greens — it never measured overlap. |

The smoke script is `scratchpad`-only and not committed: it costs real sub-agents, so it cannot be a
`npm test` check. What is committed is the pair of static guards above.

This closes the *loadability* half of G2 below. It does not close the run half — see G2.

## The dispatch boundary, measured

D2 — *a failed `Skill` dispatch is indistinguishable from a successful one* — is the one defect the
rebuild left open, and every proposed fix for it rested on an assumption nobody had tested: that a
hook fires for a tool call made by a **sub-agent**. Every dispatch in this pipeline is a `Skill(...)`
call made by a workflow leg, never by the main session, so if hooks are blind there, an attestation
cannot be written for exactly the calls that need one.

Measured with a real `claude --plugin-dir .` session that made no dispatch itself and delegated three
`Skill(...) --order` calls to one sub-agent, with probe hooks injected through `--settings` so the
shipped `hooks/hooks.json` was never edited to take the measurement:

| Dispatch state | `PreToolUse` | `PostToolUse` | Outcome legible? |
|---|---|---|---|
| skill resolves and completes | fires | fires | yes — `tool_response = {success:true, commandName:"shapeup-sdlc-plugin:orient"}` |
| skill name unknown | **never fires** | **never fires** | the host rejects the name upstream of the hook layer |
| order missing → `validate-envelope` denies | fires (the deny) | **never fires** | a denied call never runs, so it never reaches the post event |

Both hook events fire inside a sub-agent, and the payload carries `agent_id` / `agent_type` there and
not in a main-session call. The discriminator turns out to be stronger than a status field: **a failed
dispatch produces no `PostToolUse` row at all**, so the mere existence of a receipt separates "the
shipped skill ran" from "the sub-agent improvised the craft" — which is the false green D2 describes.

One incidental defect, caught by the probe's own first attempt: the `PreToolUse` envelope gate scans
the **`Agent` prompt** as well as `Skill` args, so an order path quoted into a sub-agent's prompt
without its own quotes is read together with the trailing quote and denies the entire `Agent`
dispatch. Anything that threads an order path through a prompt must quote it.

## BUILD had never dispatched a scope, and could not have

Criterion 1's first real attempt reached MAP SCOPES cleanly — spec tree, 9 tasks, 6 scope contracts,
wiring map, L1b lint 0 red / 0 warn — and then returned:

```json
{"status":"gate_h","breaker":"inner",
 "hammer_proposals":["foundation","add-todo","list-todos","complete-todo","remove-todo","cli-integration"],
 "green_scopes":[]}
```

Six scopes queued, none green, no source file anywhere in the tree. The workflow journal shows why:
between `verify budget` and `reduce hill` there is **no build agent at all**. The round did not fail;
it never dispatched.

### The cause: `null` means "drop", not "carry on"

The fan-out's first stage answered "is this scope already green from a killed round?" and returned
`null` for no — with the comment `// not green yet → stage 2 builds it`. The runtime reads a null
stage result as **drop this item and skip its remaining stages**. Measured with a probe written to
ask exactly that and nothing else:

```
stage1 → null   ⇒ stage2 ran 0/3 times, settled = [NULL, NULL, NULL]
stage1 → {…}    ⇒ stage2 ran 3/3 times
```

So every scope that was not *already* green was dropped before the builder could run. On a fresh run
that is every scope, which lands as `0 green + N queued` → inner breaker → `gate_h`. **BUILD could
never dispatch a single scope**, on any fresh run, for the life of the branch.

What makes it the most expensive kind of defect: the failure is indistinguishable from success at
doing something hard. `gate_h` with six ship-blocking scopes is exactly what a genuinely difficult
feature looks like, and every artifact up to that point is correct and high quality. Only the absence
of a builder in the journal separates the two, and nothing was reading the journal.

Fixed by returning a sentinel object (`{scope_id, pending: true}`) and branching on it. Guard: a
pipeline stage in a shipped workflow script may not have a bare `null` as its value.

### A second defect underneath it

`worker()` built every leg's step 1 as `compile --operation <op> --slug <slug>`, and `compile`
resolves the worker for that form from `OP_OWNER` — which has no `execute` key, because a build order
is addressed by scope + round + attempt and the slug form cannot express it. So the build leg's
step 1 exits 2 with `could not resolve --worker/--operation`, contradicted one line later by the
`extra` prose telling it the correct `--scope …` form: a prompt arguing with itself. It was masked
entirely by the first defect — the leg never ran to discover it.

Fixed with a `compile:` override on the dispatch that needs one. Guard: any leg taking the generic
form must name an operation `OP_OWNER` resolves, checked per call site so a leg that addresses its
order another way is exempt rather than special-cased.

### A third, underneath both: the T0 verdict was written where nothing reads

With BUILD finally dispatching, the next run wrote 13 source files, ran the attempt ratchet, and
returned `gate_h` again — `0 green`, all six scopes queued. Five of six legs had reported `done`.

The legs had run the verifier. Six verdicts and six trial rows were on disk, `foundation` among them:

```
{"trial":2,"scope_id":"foundation","score":{"fixtures_passed":2,"fixtures_total":2},"status":"kept"}
```

A genuine green. And the round could not see it:

```
verify t0  wrote to   shapeup/<slug>/t0/verdicts/     ← COMMITTED tier
probe t0   reads      .shapeup/<slug>/t0/verdicts/    ← LOCAL tier (verdictsDir)
```

`verify t0` defaulted its output to `dirname(dirname(<contract path>))` — "the parent of `scopes/`",
which was correct while scope contracts and the run trace shared a root. ADR-0001 split the tiers and
moved contracts to COMMITTED `shapeup/<slug>/scopes/`; the default followed them and nobody noticed,
because the only reader is one `probe t0` call inside the build round's confirm stage, and BUILD had
never dispatched far enough to make that call. Two defects hid a third.

**This is the "measured, not claimed" invariant's own seam.** The measurement was taken, was correct,
and was thrown away — which lands as `0 green` and is indistinguishable from six genuinely failing
scopes. It is the same silent disconnect `hooks/lib/decision.mjs` memorializes one directory over
("every hook wrote its receipts to `.shapeup-sdlc/` while the only reader looked in `.shapeup/`"),
recurring because the root was *derived from a moving file* rather than resolved through
`lib/paths.mjs` — the rule AGENTS.md states as "never hard-code a storage root".

Fixed: the default is now the LOCAL run root, with `--out` still winning for callers that know
better. Guard: an **execution of the pair** — run `verify t0` through the CLI with no `--out`, then
assert `probe t0` finds the verdict and that it landed in the LOCAL tier. Both halves passed their
unit checks for the whole life of the branch while the pair was broken, so a guard that tested either
alone would have certified it again.

**It was also silently stripping the run key**, which is the part worth dwelling on. `verify t0`
stamps each trial row with `runIdFromRoot(outDir)`, and the run receipt lives in `.shapeup/<slug>/`.
Pointed at the committed tier, that lookup found no receipt and returned nothing:

```
before the fix (committed tier):  run_id: undefined
after  the fix (local tier):      run_id: "todo-cli-20260815T152011Z-1a6a2efb"
```

Guard #53 exists for exactly this — *"every record carries the run key; `order_id` alone collides
across runs"* — and it passed the whole time, because it checks the writer against a fixture whose
root is correct. One wrong default made every trial row in every real run unattributable to the run
that produced it, and the guard written to prevent that could not see it. A check that supplies the
input it is verifying is testing its own assumption.

### A fourth: the fan-out was scheduled by the alphabet

With BUILD dispatching and T0 readable, the run reached EVAL for the first time and returned a
verdict that was rigorous, cited and **correct**: 17 FAIL / 3 PASS in round 1, diagnosing that
`bin/todo.js` was still a two-line placeholder and every command module was unreachable —
*"`src/commands/list.js:74` has no call site"*, *"`src/store.js:74` has zero production call sites"*.

Five of six scopes went green. The sixth, `cli-integration`, is the one that wires the other five to
the entry point — and it is alphabetically second, so `chunk(scopes, maxParallelScopes)` put it in the
first wave in BOTH rounds, building beside the very scopes it consumes. It burned all three attempts
at 0/2 fixtures in round 1; in round 2 its leg died. One scheduling decision produced 19 FAILs.

The ordering was derivable the whole time: each scope contract names its `tasks`, each task file
carries `depends_on`. `probe resume` now emits `scope_waves`, and for this feature that is:

```
wave 1  foundation
wave 2  add-todo, complete-todo, list-todos, remove-todo    ← concurrency unchanged
wave 3  cli-integration
```

Proven live on the next run: wave 1 dispatched **one** order where the previous run dispatched four,
`foundation` went green 2/2 on its first attempt, and only then did wave 2 release. And
`cli-integration`, finally building last, wrote the real dispatcher it had never managed before —
argv routing, `UNKNOWN_COMMAND` on stderr with exit 1, delegation to each command module.

Concurrency is unchanged within a wave; only dependency edges are forbidden. Every unusable input —
no board, no `tasks`, a cycle — falls back to a single wave, exactly the previous behavior, because
a scheduler that refuses to run is worse than one that runs unscheduled.

### The one that would have let a run succeed: a scope certified having run nothing

`runFixtures` scored `pass: results.every(r => r.pass)`, and `[].every(…)` is `true`. So a scope
with no fixtures came back green:

```
runFixtures(undefined)  ->  pass=true, results=0
computeVerdict(…)       ->  {"overall":"green"}
```

Not hypothetical. An architect wrote perfectly good fixtures — `node --test test/…`, exit-0 test
files, exactly what the contract asks for — as a markdown `## e2e_verification_fixtures` **section**
rather than a frontmatter key. The field reached the scorer as `undefined` and six scopes were about
to be certified T0-green having executed nothing. The substrate list beside it, written as a
frontmatter block list, parsed perfectly: one field vanished silently between the writer and the
reader.

Every other defect in this document blocked the pipeline, so each was found the moment a run reached
it. **This one manufactures success.** It is D2's class — a green run consistent with no work — in
the one layer the evaluator is required to cite, and the only reason it was caught is that the parsed
contract was read rather than the scope count trusted.

Closed at all three doors: `verify t0` reports `ran` and refuses to call an unrun scope green;
`verify spec` fails **red at GATE L1b**, one gate earlier, where the fix is editing a contract rather
than burning a round; and `parseContract` now reports *any* frontmatter field written as a `##`
section through the same UNREADABLE channel that already existed for misplaced tables — so the class
is closed, not the instance.

### The audit that followed, and the rule it produced

Finding a false green by accident is not evidence there are no others, so the kernel was swept for the
shape: any predicate an **absence** can satisfy. Every other one turned out to be honest, and for a
single reason worth stating as a rule:

> **A predicate that an absence can satisfy must report that absence in the same value.**

`stability()` returns `ratio: 1` for an empty ledger — beside `runs: 0, total: 0`. `verify trace`
returns `pass: true` with no engines — beside `engines_total: 0`. `gate --verify` returns `ok` —
beside `required_gates`. In each case a reader can see that nothing was measured. `runFixtures`
returned `pass: true` and nothing else: the absence was unobservable, which is exactly what made it
a lie rather than a limitation. That is why the fix adds `ran` rather than only flipping `pass`.

All five were found the same way everything real in this document was found: by executing the thing.

## What the pipeline did once it could run

With the defects above closed, a run reached EVAL over a build where every scope was genuinely
T0-green — six scopes, first attempt each, on fixtures that actually executed:

```
foundation 2/2 · add-todo 1/1 · complete-todo 1/1 · list-todos 1/1 · remove-todo 1/1 · cli-integration-test 1/1
```

The deliverable works. Driven by hand under its own store convention, `add`/`list`/`done`/`rm` all
exit 0 with correct output and `[x]` state, and a corrupted store exits 1 naming the file **without
destroying user data** — `EXPECTED.md`'s E4, exactly as written.

**And the evaluator failed it anyway: 20/26, threshold 100%.** Three real defects, each cited to
`file:line`, each re-probed and reproduced:

| | |
|---|---|
| BUG-01 | an uncaught `StoreWriteError` prints a full Node stack trace (`bin/todo.js:27`) — the spec's global convention is "never a bare stack trace" |
| BUG-02 | the index is validated AFTER `load()`, so a corrupted store masks `E_MISSING_INDEX` (`bin/todo.js:53`, `:85`); the UC steps require validation before any store access |
| BUG-03 | the error text diverges from the Error Catalog: `E_MISSING_INDEX - index is required` where the spec says `Error: missing index` (`lib/parse-index.js:5,13,21`) |

This is the clearest demonstration in the whole exercise of why T0 and EVAL are separate layers.
**T0 was green on every scope and the feature still did not conform.** T0 runs the tests the workers
wrote; EVAL grades the deliverable against the committed spec. The workers' own tests passed while
the CLI diverged from its specification in three ways — and a human (this session) had already driven
the binary by hand and called it working. It runs correctly. It does not conform. Only the judge
caught the difference.

The report also re-hashed every T0 artifact it cited and printed a "matches `trials.jsonl`" column,
sandboxed `HOME` to drive the real binary rather than reading the code, and recorded that task-file
checklists "were read for traceability only and were not graded against" — the single-judge and
anti-self-grading disciplines holding under live conditions rather than in a fixture.
Each hid the next — the fan-out never dispatched, so the compile line was never reached, so the
verdict was never read, so the scheduling was never exercised — which is why a suite of 900+ static
checks certified every one of them.

The failed run is kept, not discarded — `traces/phase2-criterion1/headless-attempt1-build-never-dispatched/`
holds its whole tree, because a trace of the defect is the only thing that makes "BUILD never
dispatched" checkable by someone who was not here. Traces live outside `docs/` deliberately: the
doc-drift check reads every `.md` under `docs/` and fails on any cited path not on disk, which is
right for living documentation and wrong for a record of a run in a different project, whose paths
are *supposed* to be absent. The suite already carves out that category for changelogs, with the same
reasoning.

## D2 is closed

`hooks/dispatch-receipt.mjs` (PostToolUse) appends `{order_id, run_id, worker_declared,
skill_invoked, dispatch_ok, at}` to `.shapeup/<slug>/receipts/dispatch.jsonl` when — and only when —
a tool result names the skill that ran. `harness reduce ingest` refuses a result whose order declares
`mode: "orchestrated"` and carries no receipt matching on all three of `order_id`,
`skill_invoked === order.worker`, and `at ≥ compiled_at`. Existence alone is not enough: order paths
are reused verbatim on relaunch, so a stale receipt would satisfy a weaker check. Standalone and
fixture ingests are untouched — there was no orchestrated claim to attest — and `--no-receipt-check`
is the documented way through when the channel itself fails.

Proven by execution, in a live session with the shipped hooks and no injected probes, one sub-agent
making one real dispatch:

| Arm | Result |
|---|---|
| a live `Skill(shapeup-sdlc-plugin:orient) --order` dispatch | receipt written: `live-d2/orient ran orient, dispatch_ok=true`, tagged with the sub-agent's `agent_id` |
| ingest of that order's result | **accepted**, `✓ attested: live-d2/orient ran orient` |
| ingest of an order nothing ever dispatched | **refused**, exit 1, naming the missing receipt and what its absence means |
| the same result under `--no-receipt-check` | accepted — the escape is real, not folklore |

Six guards, each verified the only way a check can be — by re-introducing the defect and watching
the suite go red, then restoring the fix:

| Guard | Catches |
|---|---|
| ingest refuses a receipt-less orchestrated order | the D2 false green itself |
| ingest accepts one carrying a valid receipt | a gate that refuses everything |
| a receipt whose `skill_invoked ≠ order.worker` is refused | a dispatch that ran a different skill |
| a receipt older than `compiled_at` is refused | a stale attestation surviving a relaunch |
| a positionally-named result is held to the same gate | opting out by omitting `--order` |
| the hook attests a completed dispatch and nothing else | the hook minting the fact instead of recording it |

## The run refuses to open against a plugin it cannot reach

The receipt catches a bad dispatch at ingest, which is after the worker has been paid for. Two checks
now catch it earlier, and they answer different questions — a distinction worth keeping because
conflating them is how the first draft of this fix would have shipped something that looks complete:

| Check | Question | Where | On failure |
|---|---|---|---|
| `harness verify skills` | are the `SKILL.md` files on disk, at this root, at this version? | GATE L0, inside `init run` | **exit 3**, naming the missing workers, leaving no run root behind |
| `harness verify dispatch` | did **this session** actually resolve one of them? | the orchestrator's first leg | `aborted` at `preflight`, before any worker spend |

The roster comes from `domain.schema.json#/$defs/WorkerName`, never a literal — the two names a
hand-written eight-name list would have omitted (`translator`, `coach`) are exactly the ones a short
run never reaches, so the omission would surface months later on the one run that did. The run
receipt now records `plugin: {name, version, root}`: afterwards it is unrecoverable, because every
artifact a run leaves looks identical whether it came from this version, a stale install, or a
sub-agent improvising past a failed dispatch.

**The file check is honestly incomplete, and saying so is the point.** It proves the files exist. It
cannot prove the session will resolve that copy — and both states the diagnosis names, installed-but-
disabled and wrong-version-loaded, have all ten `SKILL.md` files and pass it green. So the run's first
act is one live canary dispatch, deliberately carrying **no `--order`**: it is testing name
resolution, not doing work, and an order would leave a compiled order with no result in `orders/`,
which three readers enumerate. Its evidence is the hook layer's decision row, not the sub-agent's
account of what happened — a Skill call whose name does not resolve fires no hook at all, so a row
naming a skill is proof the name resolved, and the sub-agent that made the call cannot write it.

The evidence window is required rather than optional. A Workflow script may not call `Date.now()` —
it would break resume — so the kernel does the arithmetic (`--within <seconds>`); without a window,
a checkout that once had the plugin loaded would pass the canary forever.

Proven live: the canary reported `✅ orient resolved in this session — dispatch observed at …`, while
a skill nothing dispatched, and the same skill outside the window, both correctly reported no
evidence.

### The staleness rule, validated by an accident rather than a fixture

The guard that a receipt must satisfy `at ≥ order.compiled_at` was written against a predicted case:
order paths like `orders/wire.json` are re-used verbatim on a relaunch, so a receipt that only has to
*exist* is satisfied by one from an earlier, failed dispatch. During the criterion-1 headless run that
prediction happened for real — WIRE escalated, the phase was re-dispatched against the same path, and
the ledger held both:

```
order compiled_at : 2026-08-15T15:42:26.462Z   (wire, re-compiled)
  receipt 15:33:49  solution-architect  → REJECTED as stale
  receipt 15:42:28  solution-architect  → ACCEPTED
```

A receipt-must-exist gate would have accepted the failed dispatch's receipt and let the re-run's
result through unattested. This is also the case that justifies the append-only JSONL: one file per
order would have overwritten the 15:33 row with the 15:42 one and destroyed the evidence that the
distinction was ever needed.

Two things the writing of these guards caught that the code review had not:

- **`--no-receipt-check` did not work.** `lib/argv.mjs` hands flags to the caller camelCased, and the
  gate read `args["no-receipt-check"]`. The escape hatch was inert on its first run — the guard that
  exists to prove the door opens found it welded shut.
- **One guard was vacuous.** The fail-open check asserted `exit === 0`, which `runHook` guarantees
  unconditionally — it is satisfied by a hook that crashed on every payload. It now asserts the
  distinction the receipt layer exists to make visible: an unreadable order is a reasoned
  `verdict:"allow"` defer, not a `verdict:"error"` throw. Removing the guard around the order read
  now turns it red; asserting the exit code never would have.

## Two probes not run

**G2 — a full unattended run with zero prompts.** The grant half is proven by execution
(`npm run test:grant`, 9/9 real CLI sessions); the "a real `--unattended` run completes" half needs
a live feature, a live model and real money. Unproven.

**G6 — cost and wall-clock against a v1 baseline.** Needs two live runs of the same feature. The
Phase-0 baseline recorded here is structural (line counts, inventories, a green suite), not a run,
so there is nothing to compare against. **No number about v2.0's cost or wall-clock appears anywhere
in this repo** — the fan-out and the warm sub-agents are reasons to expect an improvement, not a
measurement of one.

## Provenance of `skills/tech-lead/workflows/shapeup-run.js`

It is the review's companion draft, `docs/output/shapeuprun.native.js`, adopted in Phase 2 and then
adjusted. **59 of the draft's 73 top-level identifiers carry across** (measured, not estimated; an
earlier revision of this section said "roughly forty" and understated it). Every one of the 14 that
did not is a rename (`R`→`KERNEL`, `QA`→`QA_REPORT`, `VERDICT_REFUTE`→`REFUTATION`, `gx`→`rs`,
`p`→`problems`, `scopeResults`→`settled`) or a deviation below. The carried set is every schema (`CMD`, `ORIENT`,
`PHASE_OK`, `MAPSCOPES`, `SCOPE_RESULT`, `EVAL`, `HAMMER`), the dispatch helpers (`worker`, `cmd`,
`nullFail`), the whole gate layer (`crossGate`, `TITLES`, `gateBlock`, `paused`, `aborted`,
`diedAt`), `validateArgs` and the model floor, `buildScope`, and the refute wave. The draft is why
the courier layer could be deleted in one commit rather than designed.

Six deliberate deviations, and the first two are the ones that matter:

| # | Draft | Shipped | Why |
|---|---|---|---|
| 1 | A phase is complete when the worker's report says `artifact_written: true` (lines 314, 336, 351, 371) | `requirePhase()` — the artifact is on disk, or the run aborts | The draft trusts a worker's own boolean. A WorkResult may legitimately report `escalated` with an empty artifacts list, which satisfies ingest; the run then walks to the next gate as though the phase landed, and every relaunch re-dispatches it. That loop is unbounded and was measured once already. Adopting the draft verbatim would have re-introduced it. |
| 2 | Drops `setRunStatus` and the state warnings entirely | Both kept, and the warning travels in the `RunReturn` | Those two writes failed silently for two entire runs — 46 dispatched agents with the ledger pinned at `orienting`. A headless stdout carries only the final message, so a diagnostic that only reaches `log()` is a diagnostic nobody can read. |
| 3 | `graphProbe()` is the fast-forward from the start, needing new `graph-query.mjs` + `graph-reduce.mjs` (`[ADD]`) | `probe resume` stays the fast-forward; the graph is additive, and answers the round's green-scope set | The plan sequences the graph into Phase 4, and Phase 2 was one change class. `probe resume` also has a 370-line structural fixture behind it that a wholesale replacement would have discarded. Both `[ADD]` scripts exist, folded into one `kernel/reduce/graph.mjs` — a reducer and its query, single-writer by file placement. |
| 4 | The per-phase graph append is FATAL | `advisory()` — it logs and the run continues | The graph is a projection of the artifacts. Making a projection fatal inverts which of the two is authoritative; `requirePhase` is the fatal check, and it reads the artifact. |
| 5 | `isolation: 'worktree'` on build legs (`[REQ]`, and the draft's own closing note says it is not actually wired) | Not used; disjoint substrates plus a pointer-free `sandbox-guard` are the isolation | A fresh worktree does not carry the gitignored `.shapeup/` run state every leg reads and writes, so it would break the legs it was meant to isolate. Stated in the Phase 3 commit rather than left as a `[REQ]`. |
| 6 | Two pipeline stages: build, then reduce | Three: check, build, **confirm** | The worker reports green; `probe t0` has to find the verdict artifact before the round believes it. Measured, not claimed — and it is the artifact the evaluator is required to cite. |

Plus: every script path re-routed through the kernel (Phase 1 postdates the draft), and
`args.maxParallelScopes` added, which the draft leaves to the runtime's own cap.

### Four defects in the draft the adoption fixed without recording it

The six above are choices. These are cases where the draft is simply wrong against the shipped
contract, found by comparing the two files field by field rather than by re-reading this section:

| Draft | Consequence had it been adopted verbatim |
|---|---|
| No reference to `args.noQa` anywhere (0 occurrences) — the QA gate branches only on `qaG.decision` | `--no-qa` is documented in AGENTS.md as the switch that skips the Hunt ("QA is a level-up, not a gate"). It would have been accepted and ignored. |
| GATE H payload is `{ feature: slug }` | `scope-hammer`'s census is "QA findings + discovered ledger + attempt-budget proposals". Two of its three inputs never reach it, so the cut list is drawn from a census that cannot see them. |
| No `report export` step | SHIP S.7 exports the run's records as fact tables under `.shapeup/exports/<run_id>/` before the trace is superseded. The run would ship without them. |
| Resume filter is `eval_rounds_done.includes(round) ? green_scope_ids : []` | `green_scope_ids` is not round-keyed, so a scope green in round 1 reads as green in round 2 and is skipped. The shipped file asks the graph for `green_scopes_by_round[round]`. |

### One thing the draft did that the shipped file deliberately does not

The draft appends the graph **per scope, inside the pipeline** (line 420), where the shipped file
appends once per round. That looks like lost resume fidelity and is not: `harness reduce graph` calls
`appendGraph` unconditionally before answering any query (`kernel/reduce/graph.mjs:368`), so the
round-opening `--subgraph run` re-derives from the T0 verdict artifacts on disk first. A kill
mid-BUILD is still recovered, and the round boundary is the only writer — which is what keeps
parallel legs from contending for one append-only file. The graph is derived, never authored; that
property is what makes the cheaper cadence safe.
