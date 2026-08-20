# Changelog

All notable changes to this plugin are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [3.0.0] — 2026-08-20 · the tier boundary, enforced

**BREAKING.** Every committed artifact written before this release fails GATE L1b until it is
regenerated. `ScopeContract.tasks` is gone; `SCOPE-ANCHOR` requires a `use_cases[]` anchor no
existing contract has; and the tier lint now scans the whole committed tree instead of two corners
of it — 438 findings across the nine-run trace corpus, all of which previously reported clean. The
fix on a live project is to re-run `map-scopes` and `analyze`, which regenerate the contracts and
the spec docs in the new shape. Nothing auto-migrates, deliberately: a rule that silently rewrote
committed artifacts to make itself pass would be the same class of defect it exists to catch.

**Removing `tasks[]` traded a declared partition for a derived ambiguity.** The contract's task-id
list was wrong about the tier, but it was right about one thing: it assigned each task to exactly
one scope. `use_cases[]` cannot do that job. A use case is routinely implemented by several scopes —
that is what a vertical slice is — so on the corpus's real shape, four scopes over a single use
case, **every scope claimed every task**. It corrupts nothing, because the sandbox denies a scope
writing outside its substrate; the cost lands as three denied writes and a burnt attempt budget per
scope. One field was answering two questions: *what is this scope answerable for* (a spec link,
N:N, correct) and *who builds this* (an assignment, which must be a partition). Dispatch now prefers
an explicit `scope_id:` on the LOCAL task — the same sanctioned local-names-committed direction as
`use_case_refs` — and falls back to the UC join, which is already a partition whenever the cut gives
each scope its own use cases. A half-stamped board still resolves. `SCOPE-PARTITION` reds a
contested task rather than letting the dispatch quietly duplicate.

**Four smaller things found in the same pass.** A `depends_on` cycle was answered by `scopeWaves`
dumping every remaining scope into one unordered wave and reporting nothing — the exact fan-out the
ordering exists to replace, arrived at silently; it is red now. `covers[]` was validated for shape
only, so a scope could claim a requirement that did not exist; it is closure-checked against
`requirements.md` when one is present. The wiring map's migration reader announced nothing, which is
how a temporary fallback becomes a permanent second format — a map read through it now warns to
converge. And `scope-board.md`, which briefly gained a hand-authored `wave` column, is typed as what
it is: a projection of the contracts that restates no derived value, because a hand-written copy of
a Kahn level is the hand-authored-`unlocks` drift `deriveUnlocks` already removed once.

**The tier rule was enforced in two corners of a tree it had to cover whole.** `TIER-DIRECTION`
walked `[[tasks/...]]` wikilinks inside `spec/` and one frontmatter key in `scopes/`. Neither is
the form the violation takes. Measured across nine completed runs, in seven committed artifact
types: 264 board ids in `spec/synthesis.md`, 183 in `spec/scope-summary.md`, 142 in `scopes/*.md`
prose, 136 in `scope-board.md`, plus paths into the gitignored tier in nine more files — every one
a bare id in a table cell or a sentence, and every one reported clean. The template that caused the
largest share stated the rule and then broke it: `synthesis.tmpl.md` said "Record only the count +
status — never task ids" and, 110 lines later, printed a dependency chain, a wave table and a
critical path entirely in board ids. The lint now scans the whole `shapeup/<slug>/` tree and reds
a board id or a local path wherever it appears, with file and line. Naming the tier without a path
is still fine — a committed doc has to be able to explain the storage model — and
`shapeup/knowledge-base/` sits outside the walk by construction, since those files instruct workers
rather than cite artifacts. The build order moved to where it can be expressed in a key that
survives a clone: `synthesis.md` keeps counts and shape (it is written before scopes exist and
cannot name them), and `scope-board.md` gained the per-scope waves, keyed on `scope_id` and
`depends_on`, replacing the board id column that was its own largest leak. `team-handoff.tmpl.md`
was the sharpest case — it coordinated two teams across a committed document using ids from two
independently-numbered boards. A second structural check now asserts no template owning a committed
artifact teaches a board id at all, which is what would have caught `synthesis.tmpl.md` on the day
it was written.

**The wiring map had never been read.** `wiring-map.md` is the only artifact stating how each use
case's engine attaches to the entry point, and three independent name mismatches were stacked on
it, each sufficient alone to yield nothing. `solution-architect` was told to write a
`{schema_version, feature, entry_point, entries[]}` **object** and never told the markdown layout,
so every run invented one — a `## Entries` section with a vertical `| Field | Value |` table per
use case — where the reader expected a horizontal table under `## Wiring`. `reduce graph` then
asked for `contract.wiring` where the spec produces `entries`, and for `row.seam`/`row.entry_point`
where `WiringEntry` declares `wiring_seam`/`entry_call_site`. None of the three can fail loudly: an
absent field and an absent wiring map are the same empty array to every reader, and the vertical
layout carries no `use_case` header cell, so the signature detector added for exactly this failure
could not see it either. Measured across every completed run: **9 of 9 committed wiring maps parsed
to zero entries while reporting readable**, `reduce graph` had never emitted a single `Seam` node,
and `trace-lint` certified `🟢 green · 0/0 engines reach bin/envlint.mjs` against a deliverable
whose engines were on disk — the gate whose whole purpose is that no engine ships orphaned,
reporting success for having checked nothing. The horizontal table is now specified in the skill
and stays canonical (regeneration converges on it); a migration reader keeps the already-committed
maps resolving; the projection reads the fields the spec produces; and a map whose sections cannot
be read is loud rather than empty. The same run now reports `0/1 · unreachable [UC-01]`.

**The domain catalog did not resolve.** `x-erd.relationships` named 29 entities of which 9 were not
types — display strings with a parenthetical baked into the identifier, a compound
`CriterionVerdict / Discovery` node that is not an entity, and aliases for types that already
existed. `UseCase`, the anchor the scope↔task join was rebuilt onto, had no definition at all while
three other types referenced it. The projection emitted `Seam` — a node type in no relationship —
and named its nodes Scope/Trial/Order/Result where the schema said ScopeContract/TrialRow/
WorkOrder/WorkResult. Node keys are identifiers again, `UseCase` and `Seam` are typed, externals
and the projection's aliases are declared, and the structural suite now checks all three
expressions against each other — including the tier rule itself, asserted at the catalog level so
no SHARED type can store a LOCAL key again.

**A committed contract's only link to its work pointed into a gitignored directory.** The scope
contract carried `tasks: [TASK-004]`, and task ids live on the LOCAL board — regenerated per machine,
renumbered every time, never cloned. Every committed contract in the trace corpus carried one and
none carried any committed anchor. The rule against it already existed and could not see it:
spec-lint's TIER-DIRECTION reds a committed doc that links the board and says to cite the UC instead,
but it walks wikilinks inside `spec/` while a contract lives in `scopes/` and holds its pointer in
frontmatter. Measured: a contract naming `TASK-004` with no board anywhere in the tree linted 0 red /
0 warn, and `compile` then wrote a build order carrying no tasks and exited 0 — a dispatch with
nothing in it being indistinguishable from a dispatch with nothing to do. Contracts now anchor
`use_cases[]` into the committed spec, optionally `covers[]` REQ-ids, and declare build order in
`depends_on[]`; the scope↔task relation is re-derived through the board's own `use_case_refs` by one
function both `compile` and `reduce board` call. TIER-DIRECTION now reds a task id in a contract,
SCOPE-ANCHOR requires the anchor to exist and resolve, and SCOPE-DEPS reports an order edge naming a
scope that is not in the run. The run graph gained the edges this made drawable: `covers` had had a
reader and no writer since it was added, so a Scope sat in the graph as an isolated node beside the
UseCase nodes it was built from.

**Three things a relaunch after a paused gate lost.** A gate pause is a return, so the PO's answer
is followed by a fresh launch of the same script, and the launch is where all three defects lived.
The visible one was the progress panel: a phase whose artifact is already on disk fast-forwards and
therefore dispatches nothing, so its box rendered `Analyze · 0 agents · Not started yet` — a
completed phase reported as one that never ran, on the screen an operator uses to decide whether a
resumed run came back correctly. ORIENT, WIRE and MAP SCOPES looked right only by accident, because
a gate leg lands in each of their progress groups and earns them a tick, while ANALYZE — reviewed at
L1b, in another group — had nothing at all. A skip now costs one cheap leg that re-asks
`probe resume --require <phase>`, which puts the phase in the record and, more to the point, attests
the skip at the moment it is acted on instead of inheriting it from a state probe taken at the top of
the run. The second was expensive and silent: the round loop opens at `max(eval_rounds_done) + 1` and
skips a scope only when the graph reports it green *for that round*, so a pause at GATE L3, at QA or
at GATE H — each of which happens strictly after `evaluate-r<N>.json` is written — opened round N+1,
found nothing green in it, re-dispatched **every scope** through the attempt ratchet and ran a second
EVAL over a verdict of PASS sitting on disk. It cost a round of `round_budget`, a full build fan-out,
and a judgement free to return FAIL where the first passed; the docs had promised "re-dispatches
nothing already finished" throughout. The last had never failed and could not: the orchestrator
declared `scope_files` as an array of strings against a kernel that emits `{scope_id, path}` objects,
and the courier sub-agent between them coerced one shape into the other on every run — the failure
that shape invites is a coercion that drops the entries instead, which reads as zero scopes and
re-dispatches MAP SCOPES over contracts already on disk. The schema now declares what the kernel
writes, `ResumeState` declares the six fields it had always emitted and never described, and the
structural suite compares the two halves of every resume field rather than trusting that a reader and
a writer of the same record agree. Two instruments came out of the same pass, both closing gaps that
had let a green suite mean less than it read: the orchestrator is now *compiled* the way the runtime
compiles it, so a syntax error in the file is a red row rather than a launch failure no static check
could see; and the payload/override check no longer selects its subject by the literal source text of
the round loop, which had disarmed it silently the moment that loop gained a condition.

## [2.0.0] — 2026-08-20 · the native runtime

v2 moves the orchestrator onto the native Dynamic Workflow runtime, and then makes it run. The
first half is the strip-down (last section below); the rest is what executing it turned up.

Every defect here was found by running the pipeline, not by reading it, and none was visible to the
structural suite — each guarded a line no run had ever reached. The fan-out never dispatched, so the
compile line was never used, so the verdict was never read, so the ratchet was never scored on a
green tie, so the fix round was never dispatched at all. Each fix ships with a guard, and every
guard was verified by putting its defect back.

### The fan-out, and what measuring it found

The fan-out shipped and nothing could tell you whether it had happened. Its acceptance was three
numbers — two scopes concurrent, shared state uncorrupted, wall-clock down — and no instrument in the
repo could produce any of them; the concurrency claim on record came from a probe that counted green
legs, which three legs run strictly one after another satisfy exactly. Building the instrument is
what turned up everything in this section.

**A leg now has an end.** `reduce ingest` appends a completion row per closed leg, and
`probe concurrency` answers max-concurrency, span and the waves a run *observed* from those records —
refusing to state a speedup it cannot support rather than approximating one, because a ratio of two
lower bounds bounds nothing. The dispatch receipt looks like a completion record and is not one:
`PostToolUse` fires when the skill **resolves**, measured at 1.8–46.8 s after compile on legs that
then ran for minutes.

**A scope's failed attempt destroyed its neighbours' work.** The T0 ratchet reverted a red attempt
with a repo-wide `git restore --worktree -- .`, and a scope's snapshot is a stash of the whole tree.
Executed with two scopes building at once: one scope's revert replaced the other's file with the
baseline while that scope's leg was still working in it. No control could see it — the substrate wall
fences the Edit and Write tools, and the ratchet destroys through a `git` subprocess. Reverts are now
bounded to the scope's own `allowed` globs, never `shared`, and refuse rather than falling back to the
repo when there is nothing to bound them.

**Half the execution records vanished when scopes finished together.** The trial ordinal was
`readTrials().length + 1`, a read-modify-write counter: four concurrent scopes produced `[1,1,1,4]` in
95% of 20 runs, and the run graph folded four trial rows into two nodes. Counted per scope now, with
the scope in the node key.

**The reducer's lock admitted a second writer.** It broke any lock older than 30 s, but `mkdir` stamps
its mtime once and the critical section is synchronous — so "working for 31 s" and "died 31 s ago"
were the same observation. The stale-break now asks whether the owner is still alive.

**A shared surface loses writes, and the scheduler now prevents it.** `substrate.shared` is the
sanctioned escape from the disjointness rule, so the lint passes it and the wall permits that path to
every live order; three concurrent writers to one entry point lost work in 20 of 20 trials. Two
scopes that may write one path never overlap now. On a badly-cut feature — an entry point in five
scopes' substrate — that costs 43% of the makespan and drops concurrency to one scope at a time, and
it is still right: the faster alternative does not finish building the feature. The concurrency the
contracts actually permit is reported before the run spends anything.

**Build scopes are released by dependency edge rather than by wave.** A scope starts when *its own*
dependencies are green instead of when its whole wave finishes, capped by the dial. Measured over 14
workloads on a virtual clock, the window never loses on duration and reaches the critical path
wherever it is reachable — and gains nothing at all on a feature whose waves already match the dial.

**What the fan-out is worth, measured on two live runs of one feature.** Both built the identical
decomposition — same spec, same four scope contracts, same task board, same models and budgets — with
one variable, the dial. On the two scopes that are genuinely independent the span falls from 222.8 s
to **84.6 s, −62%** (−57% after normalising for per-leg drift between the runs). Across the whole
build round the saving is **~21%**, and that ceiling is arithmetic rather than a defect: this feature
has three dependency waves and only one is wide, so at most one leg's duration can ever be hidden
behind another. Sequential also pays the confirm stage once per leg where the fan-out pays it once per
wave — 45 s between two legs, on this run.

**A green T0 is not a finished scope.** A build leg wrote its code, a green verdict, a kept trial row
and its WorkResult, then skipped its own `reduce ingest` step. It reported green, the round
re-verified the T0 artifact, agreed, and walked on — leaving that scope's task `pending` with zero
acceptance criteria ticked while its code sat finished on disk. The round now also asks whether the
result reached the board, evidence written *by* the writer so a leg cannot assert it about itself, and
ingests finished work its leg failed to apply rather than paying a whole attempt again.

**An ingest that ran outside its leg was manufacturing concurrency.** A leg's recorded end is when the
writer ran, which is normally its last act and sometimes not the leg at all. One leg repaired by hand
250.8 s late — against −2.4 s and +29.2 s for its two untouched neighbours — made a run whose dial was
**1** report two legs concurrent. Overlap is measured against the legs' own mid-flight T0 windows as
well now, and where the two disagree the answer is `disputed` rather than either number.

**Per-leg git worktrees are declined, and the recorded reason was wrong** (ADR-0003). The premise held
— a fresh worktree carries none of the run state — and was not the obstacle: the root is reachable
from a worktree three ways, one needing no configuration. What declines it is that a worktree silently
*disarms* the substrate wall, deferring with the same decision row it writes when no run exists
anywhere, and that nothing merges a worktree back — legs would write product code where the evaluator,
the ship report and the oracle do not look.

### Three switches that were accepted and ignored

**`--no-qa`, the concurrency dial and the refute wave never reached the run.** The orchestrator reads
`args.noQa`, `args.maxParallelScopes` and `args.adversarialVerify`; `$defs/RunArgs` declared none of
them, and tech-lead builds the launch record from that definition. `--no-qa` was spelled out in seven
places across the shipped set and did nothing. `--no-eval` worked, which is what shows this was an
oversight rather than a design. Both halves were individually correct — the script defaults a field it
reads, the schema declares a coherent record — so nothing was wrong until you asked what the join
between them said, and nothing was reading the join. A check now asserts it, one direction only: an
arg the script reads that the record omits is a switch the launcher never learns to send, while a
declared arg the script ignores is legitimate. Documenting `--parallel-scopes` immediately turned an
existing check red, because a valued flag missing from the intake gate's list leaves its value to be
read as requirement text.

**A run could not state what it was launched with.** The schema declares `run-args.json`, names
tech-lead as its writer and says it is written fresh on every launch and relaunch. No line of
tech-lead's instructions ever said to write one, so on a live run it was absent — and the flags reach
the workflow as a value in memory, so nothing on disk recorded the models, budgets or fan-out width.
The instrument reported `default (no run-args.json)` for a run launched with `--parallel-scopes 1`:
honest, and unfalsifiable. A check now requires every artifact the schema makes tech-lead responsible
for to be named in tech-lead's own instructions — a registry entry is not an instruction.

### Two things the documentation said that were not true

**`/ship` is not a command.** Measured on both install topologies — a project-scope marketplace install
and a `--plugin-dir` checkout — it answers `Unknown command: /ship`. The name that resolves carries the
plugin's namespace: `/shapeup-sdlc-plugin:ship`. Interactively `/`-completion supplies the prefix; a
script or a `claude -p` invocation must spell it out, and the README called `/ship` the whole
quickstart.

**A headless run is killed ten minutes in.** `claude -p` terminates a session's background tasks after
600 s and the whole pipeline is one background launch, so an unattended run dies mid-phase with no
diagnostic beyond the CLI's own "background tasks still running; terminating" — which reads like a tidy
shutdown. Set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`. Nothing is lost when it happens, because
resume state is on disk; the cost is a relaunch, not the run.

**The run key is not a time boundary.** One `run_id` legitimately spans every launch after a paused
gate or a kill — measured at four launches over 10.3 hours — and each relaunch rewrites
`orders/<id>.json`. Anything measuring elapsed time reads the append-only records, never the span of a
key.

### BUILD had never dispatched a scope

**Fixed — the fan-out dropped every scope it was supposed to build.** BUILD's first pipeline stage
answered "is this scope already green from a killed round?" and returned `null` for no. The runtime
reads a null stage result as *drop this item and skip its remaining stages*, so every scope that was
not already green was discarded before the builder ran — on a fresh run, all of them. The round
landed as `0 green + N queued`, tripped the inner breaker and returned `gate_h` having dispatched no
builder at all. The failure is indistinguishable from a genuinely hard feature: six ship-blocking
scopes, every upstream artifact correct, and only the absence of a build agent in the workflow
journal to tell them apart. Now returns a sentinel object and branches on it; a shipped workflow
script may no longer have a bare `null` as a pipeline stage's value.

**Fixed — the build leg's compile line could not resolve its own worker.** Every leg's step 1 was
`compile --operation <op> --slug <slug>`, whose worker comes from `OP_OWNER`. That table has no
`execute` key, because a build order is addressed by scope + round + attempt and the slug form cannot
express it — so the build leg's step 1 exits 2 (`could not resolve --worker/--operation`),
contradicted one line later by prose telling it the correct `--scope …` form. Masked by the defect
above, which meant the leg never ran to discover it. Dispatches may now override their compile line,
and the check is per call site so a leg addressing its order another way is exempt rather than
special-cased.

### A dispatch has to prove it happened

**The defect.** A `Skill` dispatch against a plugin that is absent, disabled or a different version
returns `<tool_use_error>Unknown skill</tool_use_error>` — and the sub-agent then does the craft
itself, from the prose already in its own prompt. Every downstream check accepts it: the artifacts
land under exactly the path the order's substrate permits, so the order gate passes (the *order* was
well-formed) and the sandbox guard passes (the *writes* were in bounds), the phase post-condition
passes because the artifacts exist, and the run advances. Both walls fired correctly and neither
could help, because nothing attested **which skill produced an artifact**. That is not a failed run;
it is a green one that applied none of the shipped craft.

**New hook — `hooks/dispatch-receipt.mjs` (`PostToolUse` on `Skill|Agent`).** Appends
`{order_id, run_id, worker_declared, skill_invoked, dispatch_ok, at}` to
`.shapeup/<slug>/receipts/dispatch.jsonl` when the tool result names a resolved skill. It has no deny
path and every write is guarded — a receipt that can fail a tool call gets the whole layer disabled,
which is the outcome it exists to prevent. `PostToolUse` and not `PreToolUse` deliberately: the pre
event fires before the tool runs, so it cannot separate "the Skill returned" from "the Skill errored
and the sub-agent improvised", and it would appear to work only until the environment was repaired.

**`harness reduce ingest` refuses an unattested orchestrated result.** The order must declare
`mode: "orchestrated"` and a receipt must match on all three of `order_id`,
`skill_invoked === order.worker`, and `at ≥ compiled_at` — existence alone is satisfied by a stale
receipt from an earlier relaunch, since order paths are reused verbatim on re-dispatch. Standalone
and fixture ingests are unaffected. `--no-receipt-check` is the documented way through when the
channel itself fails.

**Two new verbs, answering two different questions.** `harness verify skills` reads the worker roster
off `domain.schema.json#/$defs/WorkerName` (never a literal list) and `harness init run` now refuses
with **exit 3** when a `SKILL.md` is missing, leaving no run root behind; the run receipt records
`plugin: {name, version, root}`, so every trace names the copy that produced it. That check is
honestly incomplete — both states that actually happen, installed-but-disabled and
wrong-version-loaded, have every `SKILL.md` and pass it green — so the orchestrator now opens with a
**canary**: one live dispatch, deliberately with no `--order`, and `harness verify dispatch` reads
the hook layer's decision rows for the evidence. A Skill call whose name does not resolve fires no
hook at all, so a row naming a skill is proof the session resolved it, and the sub-agent that made
the call cannot write that row.

### Verification could certify a scope that ran nothing

**A scope with no fixtures scored green.** `results.every(...)` on an empty array is `true`, so a
scope whose `e2e_verification_fixtures` failed to parse was declared T0-green having executed
nothing at all — the one failure mode that converts the whole ratchet into decoration. `pass` now
requires at least one result, and `ran` travels beside it: a predicate an absence can satisfy has to
report that absence in the same value. Two L1b lints catch it a gate earlier, where the fix is
editing a contract rather than burning a build round — `T0-UNVERIFIABLE` (red: no parsed fixtures)
and `T0-UNPASSABLE` (warn: a fixture whose own comment declares a non-zero exit).

**T0 verdicts were written where nothing reads them.** `harness verify t0` derived its output
directory from the contract path, landing verdicts in the COMMITTED tier while `harness probe t0`
read the LOCAL one — and the detour stripped the `run_id` on the way. Six green verdicts existed and
the round could see none of them, so it reported zero green scopes over a build that had worked.
Both sides resolve through the shared path resolver now.

**A frontmatter field written as a `## section` vanished silently.** A contract whose author wrote
`## e2e_verification_fixtures` as a body heading parsed as a contract with no fixtures — clean, valid
and empty. It is reported through the existing unreadable-field channel instead.

### The loop that could not close

A FAIL verdict is only worth what the next round does with it. It did nothing, for four independent
reasons, each sufficient on its own — and none reachable until a run got as far as a second round.

**A green tie reverted the fix.** The ratchet kept an attempt only if it scored strictly better. A
spec-conformance fix cannot raise a score that is already at full marks, which is the defining
condition of a fix round, so every fix was scored, found "not better", and thrown away. Measured on
one run's ledger: 6 trials, 0 kept, 6 reverted, the entry point byte-identical before and after. A
tie on a GREEN score now keeps.

**Each round's verdict overwrote the last.** The evaluate dispatch omitted `--round`, so every round
compiled to `evaluate.json`. `eval_rounds_done` could never match, every relaunch restarted the round
counter at 1, and a run kept only its final round's envelope.

**Nothing told the workers what to fix.** `payload.bugs` was defined in the schema, registered for
`task-executor`, and declared in that worker's input contract — three artifacts in agreement, and no
producer anywhere. It is read off the ledgered verdict by `harness compile` now, which is the only
place that works: a build order overrides its compile line, so a caller-supplied payload is
discarded, and an orchestrator variable does not survive the relaunch that separates two rounds.
Ownership is elected by substrate — an entry point is routinely shared, and handing one fix to five
concurrent legs is a write race — and a defect matching no substrate is marked `unowned` and sent to
all of them rather than dropped.

**And the round arrived under the wrong operation.** `payload.bugs` is the one field
`task-executor`'s contract binds to a specific operation, and a fix round was dispatched as
`execute`. A round carrying cited defects now compiles as `fix`, with a byte-identical write
contract.

### The gates a human answers, and the reader underneath them

Found by the first run driven interactively end to end — the one lane where a person actually
answers every gate, which is the only way these three surface.

**Fixed — a gate decision was read out of prose, so QA never ran and `stop` did nothing.** The
control plane branches on gate decisions by token equality (`decision === "run"`). That value was
taken from the free-text field a sub-agent fills, which came back as a sentence — "Command exited 0;
gate QA resolved decision=run from …" — so every such comparison was false on every run that has
ever executed. The post-PASS edge hunt was skipped silently, with no log line, no warning and no
artifact whose absence would show; and a PO answering `stop` at the verdict gate was ignored, leaving
the round budget as the only way out of the loop. The kernel already prints the decision as a
top-level JSON key; it is now copied verbatim into its own field and checked against the gate's valid
set, and a decision that cannot be read **aborts** instead of defaulting to `proceed` — the default
is what made the original silence look like health.

**Fixed — the edge hunt was unreachable for anything without a URL.** `payload.app_url` was a
non-nullable string, so a CLI, a library or a batch job could not compile a QA order at all: the
payload carries null, the order fails its own schema, and the phase is skipped for a reason that
looks nothing like "this deliverable has no URL". It is now nullable, and the Hunter's contract says
what to do with it — drive the built entry point, exactly as the Test Surface's process rows do.

**Fixed — the contract reader silently ate a character from any value ending in a quote.** Scalars
were unquoted by stripping a leading *or* trailing quote independently, with no check that the two
paired. A verification fixture written as `export STORE="$T/s.json"` therefore reached the shell
missing its final quote and died as a syntax error. Nothing reports that as a parse failure: the
scope simply scores red, attempt after attempt, against an implementation that was correct the whole
time — and a lossy reader is indistinguishable from a builder that cannot make progress. Quotes are
now removed only in matching pairs, a JSON-escaped scalar is read as JSON, and a value that is not
valid JSON is unwrapped but **not** unescaped, because a backslash there belongs to the shell that
will run it. The test corpus previously contained no quote character anywhere, which is how a reader
this central shipped; it now carries the shapes that broke.

### Scheduling, identity, and the rest

**The fan-out was ordered by the alphabet.** BUILD chunked scopes by directory listing, which put an
entry-point scope in the first wave alongside the command scopes its own contract says it consumes.
Scopes are now grouped into dependency waves derived from each contract's `tasks` and each task's
`depends_on` — nothing new is authored, and any missing input falls back to one wave containing
everything.


**A result could claim an order it was not answering.** `order_id` is the only join in the record
set, so a result echoing the wrong id is detached from its run rather than mislabelled. `harness
reduce ingest` refuses it, rather than normalising: silently rewriting a worker's output is how
drift becomes permanent.

**A worker escalated on a type its own schema contradicted.** `AegisTriple` typed `file`/`line` as
required strings while its description told the judge to use `null` when a criterion has no single
site — so a conforming evaluator produced a non-conforming envelope, and **zero verdicts were
recorded across two full rounds**. The fields are nullable unions now.

**Smaller, same class.** ORIENT was never told the filenames its own phase-completion check reads.
The canonical example pitch never stated the store convention its acceptance oracle grades by.

### The strip-down

**v1.x owned a runtime it was supposed to stand on, and most of its cleverness existed to survive
that decision.** `run-workflow.mjs` was a 400-line hand re-implementation of the native Dynamic
Workflow runtime; because the orchestrator ran as a script with no shell of its own, it executed
every command by asking a sub-agent to run it and report stdout back — and then defended against
that sub-agent being a model rather than a pipe: a balanced-brace JSON scavenger, a dead-courier
envelope, prompt engineering asking the courier not to append `; echo EXIT:$?`, and path guessing
for where a worker "probably" wrote its result. None of that class of bug exists in a script whose
every branch reads a schema-validated object.

*Stamped at release: `package.json`, `.claude-plugin/plugin.json` and the tag all read **2.0.0**.
Pin target for a rollback is **1.7.0-final**, the last release of the script-runtime line.*

**One entry point.** Twenty-one pipeline scripts across three skills became subcommands of
`kernel/harness.mjs` — `verify | reduce | gate | probe | init | report | compile` — with three
libraries beneath them. The point is the grant: a permission rule matches a command string, so N
entry points meant 2N rules regenerated on every add, rename or removal, and a rule that silently
matches nothing is indistinguishable from one that works until the first dispatch fails. The whole
grant is now two Bash lines plus the optional `Workflow` token, and `npm run test:grant` proves them
by execution — nine real CLI sessions, each decided by whether the target's side effect landed on
disk. 9/9: allowed under a marketplace layout with and without arguments, a `--plugin-dir` checkout
and an install path containing a space; denied for a script outside `kernel/`, an unrelated
destructive command, the superseded mid-argument prefix rule, a literal `${CLAUDE_PLUGIN_ROOT}` call
site, and a project-scoped grant in an untrusted workspace.

**The orchestrator runs on the native runtime and owns no I/O.** 911 lines became 682 while gaining
an opt-in refute wave, because the courier defenses were the bulk of them. Every step is either an
`agent()` returning a validated object or a kernel subcommand a sub-agent runs in its own shell and
reports back as typed fields. Nothing in the file parses a model's prose.

**Scopes fan out.** BUILD is `pipeline(scopes, check, build, confirm)` behind
`args.maxParallelScopes` (default 4). The fence had to change first: `sandbox-guard` followed one
`active-order` pointer, and with scopes building side by side the last compile wins that pointer, so
a write from scope A is judged against scope B's contract. It now reads every LIVE order — compiled,
no result on disk yet — which needs no shared mutable state at all. The third pipeline stage is not
about speed: the worker reports green, and the T0 verdict artifact has to be on disk before the
round believes it.

**Provenance is a query.** `.shapeup/<slug>/graph.jsonl` is the run's own facts as one append-only
edge list, with work lineage (Run, Order, Result, Verdict, Trial) and domain (Scope, UseCase,
Requirement, Seam) deliberately un-collapsed. It is derived from artifacts and never authored, so it
can be deleted and rebuilt, and a v1 tree backfills through the same code path that maintains a
current one. From a verdict node, one query reaches the objective, the plan, the source and the
bounded execution record — asserted, not asserted-about.

**Ten hooks became four, and the diet is stated honestly.** What remains is what nothing in the
runtime can substitute for: `gate-intake`, `harness verify envelope`, `sandbox-guard`,
`safety-spine`, plus `gate-zerowork`, the one blocking Stop hook. The six that went moved layer
rather than losing their work — the L2 signal into the gate block, the deadline into
`verify budget`'s round-boundary check, rehydration into `reduce graph --subgraph run`, the
leftovers scan into the ship report. README's enforcement table now says which guarantees are walls,
which are runtime and which are advisory, including the one real coverage change: a single build leg
that runs long is no longer interrupted mid-flight, only prevented from being followed by another
round.

**Breaking.** Re-run `npx shapeup-sdlc init` — the per-script grants an older install wrote are
removed and replaced. `node …/skills/<owner>/scripts/<name>.mjs` becomes
`node …/kernel/harness.mjs <verb> [<action>]`. The tech lead launches with the `Workflow` tool
rather than a Bash launcher; `--no-native-workflow` declines that grant and keeps the interactive
lane. `probe resume --set-active-scope` is gone with the shared pointer it wrote. The eight
tech-lead references are four. See [docs/upgrading.md](docs/upgrading.md).

---

## [1.8.0] — 2026-08-13 · the run key, and the records that were already there

**The harness has been writing a complete dataset since v1.0 and throwing it away.** Orders and
results are a dispatch's input and output; `run-workflow.mjs` journals every agent call with its
model, wall time and `cost_usd`; every hook appends a decision row; `t0-verify` appends a trial row
carrying a genuine parent edge. All JSON, all schema-registered, all in the LOCAL tier — and **none
of it joinable**. The nearest thing to a key was `order_id` (`<slug>/r<N>-a<M>`), which identifies a
dispatch *within* a run and is byte-identical across every run of the same slug. So the two
questions you would ask this data first — *compare this run to the last one*, and *what did this run
cost* — were both unanswerable from records that were entirely present. Those are exactly the two
rows `docs/design/05` lists as having no instrument.

*Stamped at release: `package.json`, `.claude-plugin/plugin.json` and the tag all read **1.8.0**.
Pin target for a rollback is the previous release, **1.7.0**.*

**The key is derived, not drawn.** `lib/run-id.mjs` mints `<slug>-<YYYYMMDDTHHMMSSZ>-<8 hex>` as a
pure function of three fields the receipt already holds (slug, `started_at`, `intake_sha256`).
`randomUUID()` would have been one line and would have cost the property this repo pays for
everywhere else: a random key exists only where it was first written, so any record that missed the
stamp is unjoinable forever. Derived means every writer holding the receipt computes the same id
without being handed it, and **a pre-1.8 receipt backfills to the id it would have been given** — so
history the harness never stamped is still keyable.

**Six writers stamp it; one deliberately does not.** `init-run` mints it into `receipt.json`;
`compile-order` stamps `run_id` + `compiled_at` onto the WorkOrder at the one point every lane
passes through; `t0-verify` stamps the verdict artifact and the trial row; `run-workflow` resolves
it once at launch and stamps every journal row; `hooks/lib/decision.mjs` resolves it best-effort
(and records `null` outside a run, which is the true answer); SHIP S.6 copies it into the harvest
row. **`WorkResult` gets no stamp** — it is worker-written, and a field a worker must remember to
copy goes missing under exactly the conditions you most want the record. Results reach the key
through `order_id`, a join `validate-envelope` already enforces.

**`export-run.mjs` freezes a run's records as ten fact tables** (JSONL) under
`.shapeup/exports/<run_id>/`, plus a manifest with row counts, a skipped-record count and the
economics block. The grain is the dispatch: one row per compiled order, joined to its result on
`order_id` and to its agent call through the `result_path` the workflow's dispatch prompt already
requires. Read-only over the trace, re-runnable, keyed by run id so a second run of a feature is a
second dataset rather than an overwrite. It exists because the LOCAL tier is *regenerable* — the
`TrialRow` contract says it plainly: a measurement left there "answers the question exactly once and
then deletes itself".

**`stats.mjs --economics` closes measurement-table row 4** — cost, wall clock, retries, and
turns-to-first-write in both agent calls and seconds — computed from records already on disk.
**Nothing is measured yet and the doc says so:** the instrument is unfed until a full pipeline run
produces a trace, and the launcher defect blocking one is still open in the register. An instrument
that exists is not a measurement, and this release does not claim otherwise.

**Two things it refuses to do**, both load-bearing rather than tidy:

- **It never fabricates a join.** The journal exists only on the workflow lane, so a `--tiny` or
  prose-lane dispatch has no cost row. Those rows carry `cost_usd: null` and `agent_join: null`,
  never `0`, and `--economics` reports attributed and unattributed cost separately. An absent value
  and a measured zero must not share a signature — the same defect `hooks/lib/decision.mjs` exists
  to close, one layer up. §54 pins it: making `sumOrNull` return `0` on an all-absent list turns the
  suite red.
- **It never crosses a machine boundary on its own.** The default destination is LOCAL and
  gitignored, because a SHARED one would put per-run structured data and a hostname back into git —
  precisely what ADR-0001 moved the metrics shards out to prevent. `--out <dir>` is a human
  decision. The export makes the evidence durable and portable; where it travels stays the
  operator's call.

**Run economics is not velocity, and the harvest row still rejects it.** `MetricsRow` gains `run_id`
and nothing else: its "Rejected fields" rule against `time_spent` stands, because a signal feed
carrying a duration becomes a velocity feed on the next person who reads it. Cost and wall clock are
*derived on demand* from the exported trace instead. Nothing in the read plane grades — every column
is an id, a count, a duration or a copied enum, and a computed "run quality" figure would be a
second judge behind `spec-evaluator`.

**§55 — every shipped source file must be text a line-oriented tool can read.** Found by the
pre-release audit, when its own sweep could not complete. `lib/run-id.mjs` was written with *literal
NUL bytes* in a template literal — the hash's field separator, typed as raw control characters
instead of `\u0000` escapes. Node parsed it, every test passed, the module was correct. But `file(1)`
reported `data`, and a NUL makes grep treat a file as binary, so `grep -rn` over the shipped tree
**skipped it in silence** — and the repo's non-delivered-content sweep runs on exactly that grep.
The unreadable file was hiding a real leak: a citation into a `docs/` path a user does not receive.
One unreadable file turns every grep-based guarantee about the tree into a claim about an unknown
subset, so the check is general rather than a fix for the instance. The escape produces the same
bytes at runtime; minted ids are byte-identical either way, verified against a fixed fixture.

⟐ **The check was first written to cover only the shipped roots, and so could not see itself.** The
same keystroke put a NUL in the test module's own comment and in the changelog entry describing the
defect; nothing caught either, because neither file ships — only `git` noticed, printing
`Bin 2484 -> 5746 bytes` in the commit stat. A guard scoped more narrowly than the mistake it guards
against is the shape of every defect above it, so §55 now covers the whole tree: `docs/` and
`tests/` do not ship, but a doc or a test no grep can read defeats an audit just as completely.

Structural suite **940 checks** (was 903), green in a fresh clone; `npm run demo` reproduces the SVG
byte-identically. All three new sections were negative-controlled: dropping the `compile-order`
stamp, turning an absent cost total into `0`, and planting a NUL in a shipped file each turn the
suite red. Floor in `docs/design/06` raised 880 → 930, on the record.

## Earlier releases

v1.x is the script-runtime line and is maintenance-only. Its full history — 1.0.0 through 1.8.0,
every measured defect and the mechanism that closed it — is on the **`v1.7.0-final`** tag:

```bash
git show v1.7.0-final:CHANGELOG.md
```

Kept here rather than deleted because the rationale in those entries is why several v2.0 mechanisms
exist at all; kept *there* rather than inline because a 100 KB changelog is one nobody opens.
