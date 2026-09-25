# Changelog

All notable changes to this plugin are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### A board row is matched by its id, not by any mention of it

The executor reported one task `skipped`; its task file still said `ready`; the board index showed
it ✅ done, and the census read the index. Not the worker's optimism — the consumer filed it that
way, and it was a fair guess — but `reduce ingest`: it matched an index row by the task id
appearing anywhere in the line, and a finished task's id sits in every dependent's `Depends On`
column, so ticking the dependency ticked the dependent. Rows now match by their id cell alone, on
both the completion and the unblock paths; `skipped` and `failed` render as what they are in the
index and the task file; and `tasks/_index.md` is frozen for build legs, as the executor's contract
already said and the hook now enforces.

### The run ledger says what happened

`harness-run.md` is the artifact the L4 block names as the ledger and the one a teammate opens
first. Its close line was derived and right; its counters and tables were hand-shaped placeholders
nothing filled — a run closed `shipped` beside `final_verdict: ~`, `rounds_used: 0`, an empty
Decisions table and seven rows in `gates.jsonl`. The close now derives the verdict from the newest
evaluation, the round count from the round artifacts, the Decisions table from `gates.jsonl` and
the Rounds table from the T0 verdicts, build gates and evaluations, in the same pass that writes
the close line and from the same records the export reads.

### A dispatched order that never answered is named, not forgotten

A leg wrote its four artifacts and never its envelope. The phase post-condition stood on the
artifact — correctly — the run went on, and it closed `shipped` over an order still open by
construction: the export's own dispatch row said `answered: false`, and nothing upstream had
noticed. `probe leg --open` now lists dispatched-but-unanswered orders beside the results nobody
applied, scoped to the run's receipts so a prior run's dispatch over the same slug does not count;
the phase post-condition records one when it finds it; and every close — `shipped` included —
carries `unanswered_orders=N` in its cause.

## [3.7.5] — 2026-09-25 · The board survives a clone, and a breaker ships what is green

Two defects the first run to reach the judge exposed, both in what happens around the round loop
rather than inside it: the half of ANALYZE a clone loses, and the half of a breaker the run left to
prose.

### A committed spec with no board is not a finished ANALYZE

ANALYZE writes two artifacts in two tiers: the spec tree, committed, and the board, per-machine
and gitignored. The fast-forward asked about the committed half alone, so every run after the first
on a machine — and every run in a fresh checkout, the lane the unattended mode exists for — built
over no board: GATE L2 crossed `proceed` from a preset over 0/0 tasks, the evaluator could read no
`covers:` clause, and the requirements projection printed "no evidence" for a round whose static
criteria all passed. Measured on the fourth run of one pitch on the live consumer, the first to
reach the judge.

The resume derivation now asks about both halves: a committed tree with no board resumes AT
analyze, where the run dispatches the new `board` operation — same worker, the tree frozen, only
`tasks/**` writable — and attests the phase against that order. GATE L2 refuses `proceed` over a
board with zero tasks the way L4 refuses `ship` without a census: an answer set chooses among
allowed answers and cannot supply the evidence that makes one allowed.

### A breaker ships what is green, inside the run

A breaker used to end the run at the close-out: the loop handed back `gate_h`, the ledger was
stamped `escalated`, the pointers were retired — and the census, GATE H, the ship report and GATE
L4 all happened afterwards, in the tech lead's prose. So the census reached no artifact,
`gates.jsonl` held no H and no L4, and a later `--close shipped` was refused over the `escalated`
fact already on the ledger. Measured on three consumer runs.

The run now does what the contract always said a breaker means. Every breaker return dispatches
the census, crosses GATE H, writes the ship report with the verdict as it is — FAIL and
not-evaluated included, never upgraded — crosses GATE L4, and only then closes: `shipped` with the
cut list when the census and L4 clear it, `escalated` naming the census when they do not. GATE L4
has a call site on the PASS path too. And the census is an artifact: scope-hammer writes
`reports/hammer-census.json` beside its report, inside its own substrate, and the L4 resolver reads
that file — and nothing else — before it lets any answer set say `ship`. A green census returned
only as a worker's report could previously be recorded as nothing but `ask`.

## [3.7.4] — 2026-09-25 · The ratchet is five attempts deep again

One defect the 3.7.3 soak measured on the live consumer, reproduced on a copy of its trace and
pinned by the check whose fixture had let it through.

### The attempt gate asks with the run key

`compile` refuses to open attempt *n+1* while attempt *n* is unanswered, and it decides that with
the same derivation the attempt census uses — which matches a receipt by order **and run key**, so
a previous run over the same slug cannot answer for this one. The gate omitted the key. Nothing
matched, every previous attempt read as unattested, and every attempt 2 was refused as unanswered,
on every run since the gate shipped, with the receipt, the leg row and the result all on disk.
Measured on the 3.7.3 soak: one attempt spent of five, the census reading it spent, the gate
refusing three times. The ratchet was one attempt deep. It asks with the key now, waves through a
run with no readable receipt, and the check that pins it drives an attested attempt 1 through the
real census and the real compile and expects both to agree.

## [3.7.3] — 2026-09-25 · The single writer is asked, and the fence compares files

Three defects from a second three-way review of the register after 3.7.2, each re-measured on
the live consumer's own trace before it was worked, each pinned by a structural check that was
mutation-tested before it was trusted.

### A frozen path is denied under every spelling

The substrate fence compared the spelling a tool named against the globs an order declared, and
the thing a glob protects is a file. Measured against a real compiled order on a case-insensitive
filesystem: `receipts/dispatch.jsonl` was denied as frozen, `Receipts/dispatch.jsonl` was
permitted, and the second spelling overwrote the first file — so the attestation freeze 3.7.2
shipped was one keystroke wide on the platform this plugin is developed on. A symlink was the
same hole from the other side: `src/x → ../.shapeup/<slug>/legs.jsonl` inside an allowed `src/**`
resolved `..` without following the link.

The hook now compares the path a write actually lands on: symlinks in any existing ancestor are
followed (a dangling link by reading it), the unborn tail is re-attached to the real ancestor, and
the comparison is case-folded where the filesystem itself folds case — decided by asking the
filesystem, not by platform name. The globs stay exactly as the compiler wrote them, and a
structural check drives a case variant and a symlink of every frozen channel through the real hook.

### A close no longer orphans what follows it

Every terminal close retires the run pointers, correctly — and the close lands before the
scope-hammer census, the ship phase and the export, all of which resolved their run through the
pointer just removed. Measured on a live run: every hook decision after `closed_at` carried
`run_id: null`, the census dispatch included, in the one ledger that survives the trace. The close
now leaves a `last-run` breadcrumb naming the run it ended, written before the pointers come down;
the hooks resolve the pointer first and the breadcrumb second, and a row keyed through the
breadcrumb carries `run_closed: true`, because a decision taken over a closed run is a different
fact from one taken inside it. The breadcrumb names a run and arms nothing.

### The single writer is asked, never assumed

A run dispatched five legs. Five results landed. Three leg rows were written, and nothing
noticed: the leg ledger — the one record that separates "the result landed" from "the single
writer applied it" — was read in one place, behind the checks that decide a scope is green, and
appeared in neither the run graph nor the export. The build leg had reported green with no T0
verdict at all, the T0 re-read correctly said not green, the round returned before the leg
question, and its result — six tasks, two discoveries — was never read by anyone. The planning
phase before it had done the same, and passed, because a phase post-condition checked the
artifact the worker wrote and never asked whether the writer ran.

Now every settled build scope and every planning phase asks the leg ledger before any early
return. A result nothing applied is ingested there when the scope is green — application stays
gated on the green checks, because ingest ticks acceptance boxes and must not apply work T0 never
measured — and otherwise travels to the close and is named: `unapplied_results=N`. `probe leg`
answers by order (`--order analyze`) and across the run (`--open`); the graph carries a `Leg` node
with an `INGESTED` edge from its `Result`, so a result nobody read is `unapplied_results` in
`--subgraph run`; the export carries a `leg` table.

And the close stops naming a breaker the census denies. The protocol's INNER breaker is the
per-scope attempt budget, which never blocks a round; the loop was using the word for "nothing
green this round", which does — so a run reported `breaker=inner` beside a census that said one
attempt spent of five. A stalled round now asks `probe attempts` for every queued scope and names
`attempt_budget` only for the scopes it says tripped, `none` otherwise, with `stalled=no_green`
in the cause.

## [3.7.2] — 2026-09-24 · The floor under the judge, and what an adversary found in it

Four defects under the mechanical evidence layer — the half of this harness with the least live
evidence behind it, because until now no run had reached the judge on the current build. Each was
written by a separate engineer working blind to the others, then accepted by an adversary that was
given the claims and never the reasoning, with a mandate to break rather than to read.

### A build leg cannot write its own attestation

A dispatch receipt, a leg-completion row and a T0 verdict answer "did a worker run, and what did it
measure" from evidence the leg being judged does not control — and the substrate fence's run-trace
carve-out left all three writable by that leg. They are frozen to the build operations now.

The result envelope is deliberately **not** on that list, and the reasoning is in the code because
it looks like it belongs there. Freezing it denies every build leg its documented last step, on the
first round, unconditionally — the order is unanswered at exactly that moment by construction.
Measured, not supposed. What that leaves open — a leg forging a *sibling's* result — is filed rather
than half-closed, because the glob form cannot say "every result except this order's own".

### A T0 citation is re-hashed, not merely present

The schema has always said the evaluator recomputes the digest from disk and never trusts a handed
one. Nothing did. A PASS citing a nonexistent artifact with a hash of sixty-four zeros was accepted,
and so was one citing a real artifact whose own verdict was red. The kernel now refuses a citation
whose artifact is missing, whose recomputed digest does not match, or whose verdict is not green —
and fails open when the file cannot be read for an unrelated reason, because that proves nothing.
Its ceiling is filed too: the re-hash proves self-consistency, not provenance.

### A run that graded nothing cannot freeze a report that says PASS

`--no-eval` set the verdict to `pass` and shipped with `PASS` hardcoded, against a protocol that
promises `not-evaluated` "recorded plainly — never silently upgraded" twice over. The gate block
told the human the truth; the committed report a teammate inherits did not. The refusal now lives in
`reduce ship`, the hand that writes that artifact — because the first fix lived in the
orchestrator's control flow, and reinstating the defect one line downstream of the branch left every
check in the suite green.

### A hill phase is never derived from an absence

`reduce hill` writes the committed tier and reads the gitignored one, and an absent ledger counted
as zero unknowns — so a developer who pulled a branch mid-run, a state the design documents as
supported, flattened every committed shard on their first launch. A derivation that cannot read the
run trace now writes nothing at all, and a missing ledger is distinguishable from an answered zero.
The derivation stays non-monotonic: a dot must still be able to move back down.

Underneath it, a parse that had never once matched: the ledger heading was scanned for a colon
between slug and order id, the pipeline writes a slash, and the order-id schema forbids a colon
outright. Every scope on every project had read zero unknowns since the arm was written.

### What the acceptance pass changed

Two findings blocked the batch and are fixed above. Three more were holes in the *tests* rather than
the code — a citation loop pinned only at its first element, a not-green check pinned only for
`red`, an absence guard whose fixtures could not tell a tier root from a slug root — each proven by
a mutation that left the whole suite green, and each now red. Six further findings are filed. The
four pre-existing fixtures these fixes had to edit were audited one by one: three had been citing a
digest for a file they never created, which is to say they had been encoding the defect.

## [3.7.1] — 2026-09-23 · Three rules the harness could only state, it now enforces

Three defects the live consumer measured, all one shape: the harness computed the right answer and
then spoke too late, threw it away, or never let go.

### A committed file that cites the local tier is refused at the write

Four producers wrote a committed artifact that this harness's own spec-lint reds — the requirements
registry, the ship report, the project profile, the coverage clauses — and each time the lint caught
it at GATE L1b, a whole phase after the sentence was written. Teaching did not hold: one producer
re-offended an hour later, in the same session, in the same file it had just repaired, because a
worker carries no lesson across a dispatch.

`tier-guard` is a fifth PreToolUse wall. It quotes the offending token back and says why while the
writer can still rephrase, and it imports spec-lint's own scanner rather than restating the rule, so
the two enforcement points cannot drift apart. The knowledge base stays outside it. A PreToolUse
hook sees the assistant's edit path only, so a kernel write still answers at its own writer — what
closed is the route every measured recurrence took.

Measured on the consumer the day it shipped, with the plugin installed from the marketplace: the
analyzer cited a staged run-tier path in a committed spec file and was refused; eighteen seconds
later the same worker wrote a committed file that linted clean, and four more followed. One denial,
no retry loop — which was the real risk in fronting a gate with a hook, since a guard that denies
correctly but wedges the run would be worse than the abort it replaces.

### A T0 verdict keeps the evidence it measured

`exit: r.status ?? 1` maps a command that never started onto the same `1` a real failure returns,
and the artifact stored nothing else — so a refused command and a broken build were one record in
the digest, the hill, the report and the judge's citation. The record now carries `error` when the
command did not run, plus a bounded, truncation-marked tail of each stream, kept for passing
commands too: a fixture that exits 0 having run zero tests is the false green this layer exists to
catch.

### A finished run stops fencing the checkout

The substrate fence holds while an order is compiled and unanswered, and a run that ends any way
other than shipping leaves exactly that behind — so after a close that exited 0 and recorded its
status, cause and timestamp correctly, an ordinary write anywhere in the project was still denied,
with no dispatch in flight. The operator's obvious remedy did not help: `init run --force` is
documented as "abandon the open run and start over", never as "release a stuck fence". Every
terminal close now retires the run's pointers, and a pointer it cannot remove degrades the close
with a warning rather than failing it.

Retiring is not answering, and the fix does only the first: an order left open stays genuinely
unresolved until `--force` writes it a synthetic result. A close that answered its own orders would
spend an attempt budget on work nobody did.

### How this release was checked

Every guard was broken on purpose before it counted — five mutations each on the first two, four on
the third, every one red and restored. One belief did not survive that pass and is recorded rather
than preserved: the close's export does not read the pointers it retires, so the ordering between
them is a defensive default, not a guard. The write boundary was then driven end to end through a
real session with the plugin loaded, and the close-out on the live consumer: fence denying, close,
fence released, fact tables exported, the abandoned order still unanswered.

## [3.7.0] — 2026-09-22 · An attempt is spent only when the attested channels say so

- **Attempt accounting moves onto attested channels.** A scope's spent attempts are derived from a
  dispatch receipt plus a leg row or a WorkResult — never from the order set or a T0 verdict, both
  of which the scope being judged can write. An attempt still in flight holds the breaker open
  instead of tripping it, and opening a new attempt over an unanswered one is refused outright.
- **Every terminal ending records a close, and exports its records.** `gate_h` is derived from the
  RunReturn union rather than a hand-typed pair, so an ending nobody enumerated cannot silently
  record nothing; a run that aborts or escalates now exports its fact tables too, because the runs
  worth most as evidence are the ones that never reach Ship.
- **The tier-direction rule is taught the way it is enforced** — a bare path in prose, not only a
  wikilink.

## [3.6.0] — 2026-09-21 · Nine defects close, and every guard was broken on purpose before it counted

Seven of the eleven open defects were the same shape: a fact declared in one tier and consumed in
another, with nothing enforcing the join. An operator typed a wall-clock flag, the workflow named a
field it never read, and the kernel read a different field off the receipt — so a run reported
itself as having no budget while its caller believed it had asked for one. The absent warning was
the worse half. A markdown file called `run-args.json` the only record of what a run was configured
with, a kernel module read it and admitted in its own comment that it was absent from every run so
far, and nothing outside tests wrote it. An abort left a trace reading as still running. Three of
ten gates, one of them the Ship Sign-off, were never resolved at all.

**How this release was accepted, and what that is worth.** Each stage was executed by one agent and
accepted by a second, given *propositions to test* and the diff, never the executor's reasoning;
the acceptance agent could not edit, and every guard it accepted it first broke and watched go red.
Measured across this work, 2026-09-20 to 2026-09-21, exec `sonnet` / accept `opus`, in this
checkout: **11 of 19 acceptance passes returned REJECTED**, and the rejections were structural
rather than cosmetic — the first fix for the missing launch-record writer reproduced that same
defect one level up, since the writer existed but only prose invoked it; the first close-out fix
left two terminal returns bypassing close-out while an existing check had been relaxed to *tolerate*
the new call shape without requiring it, so both holes were green; its own correction then
over-corrected into a guard that broke the relaunch case. Two qualifications travel with that
figure: it is a property of this plan, these models and this checkout, and it counts passes rather
than defects, since one pass can carry several. Nothing below rescales it.

- **A run argument now has one declared surface, and it is derived rather than typed.** Every run
  argument, its spelling per tier, the artifact it lands in and its reader, read at runtime from
  each entry point's own argv spec, the domain schema and the operator's flag table. A documented
  flag that reaches no reader is red; so is a reader of a flag nothing documents, and a field
  renamed on one side only. A hand-maintained list would have passed every one of those checks,
  which is why the acceptance tested growth: add an argument to the source spec and the surface
  grows with no list edited.
- **The launch record has a kernel writer, wired into opening a run.** Not a separate command that
  prose remembers to call — that was the first attempt, and it was the defect wearing a new address.
- **A terminal close is one write:** status, cause and timestamp together, under the run's own tier
  and carried into the export. Nothing stamped a close timestamp before, which is why the cause had
  nowhere to hang. Worker-death aborts go through the same path.
- **Rounds are two numbers.** Rounds built derives from the highest round carrying an order, a T0
  verdict, a build-gate artifact or a verdict; rounds judged stays its own field. The old number
  survives verbatim as the second, so the only run whose figure moves is the one that was reporting
  itself as having done nothing.
- **A build worker's escalation lands in the discovery ledger** — one channel, not three, because
  the defect was evidence that exists and is read by nobody, and three half-read channels is that
  defect wearing a wider hat. The ship report reads it back.
- **Gate decisions and build gates are fact tables**, and a check cross-references every declared
  gate id against every call site that can emit one, in both directions.
- **A build leg can no longer rewrite the pitch it is measured on.** The `execute`/`fix`/`spike`
  substrate declared nothing frozen while every planning operation froze the staged intake — the
  widest window in a run, not the narrowest.
- **A path declared only as shared substrate has a writer.** The fence composed allowed and shared
  together while the census counted writers from allowed alone, so a bug in a shared file was tagged
  ownerless and handed to every scope. Election now draws from the same union the fence composes,
  with an exclusive writer still preferred.
- **A diagnostic that names a file without a line keeps its file**, and the line stays null rather
  than being invented. Sequenced deliberately before any port of the archived attempt-scoring work.
- **The kernel owns the schemas it validates against.** The move found a fourth importer nobody had
  named — the worker-roster preflight read the domain schema straight out of the skill tree.
- **A test module on disk that no run reaches is now red.** `MODULE_FILES` is explicit and stays
  explicit, but a module could land on disk, be imported by nothing, and never run — which happened
  during this work. An unregistered guard reads as coverage it does not provide. A registered
  duplicate is red too: the planted one inflated the check total by seven.

Structural suite **1635 → 1841 checks**, green in a fresh clone at every stage commit — each was
checked out separately rather than the per-stage rollback being asserted.

**What this release does not include, said plainly.** The soak has not run. It needs a consumer
project installed from the marketplace, two consecutive features, and its run trace kept between
them; nothing run from this checkout substitutes, which is precisely why the two run-geometry defect
classes are invisible here. **The close-out path above is new code that has never run in a real
consumer.** Open and belonging to the Betting Table: the stranded tag's port-or-abandon call, the
code half of the fence-after-close entry, and a newly filed idea — that a run does not check whether
the baseline it is about to build on exists in any commit, measured on a real consumer where 45
files of engine lived in a working tree and no commit for three days.

## [3.5.0] — 2026-09-19 · The run checks what the pitch forbids, not what it asks

The loop graded the build against the spec it had written itself. The pitch's own list of what the
feature must do went in at GATE L1b and was never seen again: nothing produced it as an artifact,
nothing went red when a clause reached no acceptance criterion at all, and no verdict could say
which clause it answered. Every gate could be green over a feature missing half of what was asked
for, and each gate would be right about the question it was asking.

**The measurement this release was opened by, and what it belongs to.** One `hero-todo` run in a
consumer project, dispatched 2026-09-18 and graded 2026-09-19, against plugin **3.4.0** on branch
`plan/requirements-reach-the-verdict`; exec `sonnet`, eval `opus`, `ci` gate answers; it reached
GATE L3 and not L4. Twenty-one pitch requirements, 19 tasks, 112 acceptance criteria, and a first
verdict of 97 criteria with 9 PASS. Every requirement had an acceptance criterion somewhere on the
board; **11 of 21 reached any criterion the judge graded**, and not one passing criterion tested a
behavioural requirement — the nine PASSes were eight static `Non-Go` scans and one layering check.
Zero `(covers: …)` clauses existed on any acceptance criterion, the third consecutive run with
none, and no requirements registry existed at all. Two qualifications travel with those figures:
43 of the 97 criteria were failed by a PO waiver rather than by measurement, so the verdict is a
floor; and the judge could read the plan that classified it, so the anchors the classification
rests on are partly an artifact of that access. This is a figure from that run, that consumer,
those models and that date. Nothing below rescales it, and the harness in general is not described
by it.

- **The producer was declared everywhere and dispatched nowhere.** `shapeup/<slug>/requirements.md`
  was named by the schema, fenced by the substrate and documented in the worker's craft, and no run
  ever wrote one. The run now dispatches `coverage` once, after ORIENT and before ANALYZE — before,
  because ANALYZE's acceptance criteria are what cite its ids. It is a **fact, not a phase**:
  `has_requirements` guards the single dispatch and `coverage` stays out of `PHASE_ARTIFACT`, which
  doubles as the ordered phase list, so every run planned before the registry existed still resumes
  at `build` instead of being sent back to re-plan.

- **The edge was produced and then severed on a spelling.** Measured across two runs of one pitch,
  the scope contracts claimed 20 of 21 requirements — in the pitch's `R<n>`, against a registry
  keyed `REQ-<n>` — and the mismatch was reported 23 times a run as a warning nobody could act on.
  Readers normalise `R<n>` onto `REQ-<n>` **before** the pattern, never instead of it: a key neither
  space knows is still red, and a tree with no registry still claims nothing. Normalising on read
  rather than teaching the planner to spell it differently is deliberate — `covers[]` is optional,
  and it went from 8 of 9 contracts to 0 of 18 between those two runs. A fix that depends on a
  planner choosing to comply is a fix whose value is a coin flip.

- **A requirement nothing reaches is red where the plan can still change.** Covers-closure only ever
  walked the links that existed and asked whether each resolved; a requirement with no link at all
  satisfied it perfectly, and that is the case the measurement found. `REQ-UNCOVERED` walks the
  other direction — over the registry rather than over the links — and reds a live clause that no
  acceptance criterion grades and no scope claims, at GATE L1b, with both ways out in the finding:
  cover it with an AC, or cut it on the record. The board it reads is the compile-order parser, the
  only one carrying `acceptance_criteria`; the scheduling view has no such field, and feeding the
  arm that board would red every requirement on every run while every obvious test still passed —
  so the guard asserts the COVERED requirement is **absent** from the findings, not merely that the
  uncovered one is present. The arm is silent when no registry is on disk.

- **The way back: verdict → requirement → L4 → census.** 85 of 97 criterion rows carried the judge's
  `traces_to` anchor in the WorkResult and **0 of 97** survived into the file `reduce ingest` wrote,
  whose rows also carried only a per-file counter that repeats across runs of one feature. The
  projection now keeps both keys, and `harness probe requirements` answers the matrix from disk for
  one named run — registry, board, verdict ledger, EVAL citation. `covers:` is the authoritative
  join: a criterion anchored to a requirement no acceptance criterion covers is printed for
  reconciliation and counted as nothing, rather than deriving one L4 line from two sources that were
  never reconciled. GATE L4 transcribes the summary, GATE H's census takes the clauses with no
  evidence, and `REPORT.md` freezes the table before the gitignored tier it came from is cleaned up.
  **None of it blocks a ship** — it is a projection the baseline comparison weighs, not a verdict.

- **The substrate fence read its carve-out before its freeze, so `frozen` was inert.** Every
  `frozen` glob naming a path under the run trace — the board an evaluation froze, the staged pitch
  a planner is graded against — was declared read-only by the compiler and enforced by nobody.
  Frozen is checked first now, across every live contract, wherever the path lives. The reorder
  alone trades one defect for another: liveness is "compiled, no result yet", so a phase dispatch
  whose worker never returned would hold the board frozen for the rest of the run, which is why a
  run-level order stops being live once a later phase compiles its own. The staged pitch and
  breadboard join the frozen set of every operation that reads them, because a worker that can
  rewrite the question can rewrite what it is about to be measured on. `SECURITY.md` and `README.md`
  each asserted the fence in the old order and were corrected in the same commit — a security page
  describing a deny the hook does not have is a wrong answer to a security question.

- **Two ways one contract could be wrong that only the compiler checked.** A planner wrote
  `affordance_manifest` in both the frontmatter and the table; the table wins by construction and
  the frontmatter copy was discarded without a word, the two disagreed, the cell parsed as a string
  where the schema wants an array, `compile` refused the order, and four of nine scopes were never
  dispatched with spec-lint green and the build leg reporting done. Separately, a planner wrote
  every `required_states` cell bare where the dialect wants a list: 32 rows across six UI scopes
  parsed as strings, `verify spec` reported red=0, and those six were never dispatched either. Both
  reach GATE L1b now — the duplicate is reported rather than dropped, and spec-lint re-validates
  every parsed contract against the schema its own banner already promised it did. Against the
  measured trees each reports exactly the scopes that vanished, and no others.

**What was deliberately not built.** No Product Owner skill: sign-off is a file and the PO is a
human responsibility, and an agent PO either manufactures a signature or is a second QA pass. No
`verify trace --gate`, which would have gated a check that returns green on zero lines of product
code. The judge still may not read `shaping.md` — criteria invented at grading time are criteria
nobody approved — and the requirements matrix still cannot block a ship.

1530 → 1635 checks, green.

## [3.4.0] — 2026-09-17 · State that does not survive a boundary

Ten defects, found by pointing four independent methods at the harness itself — property-based
falsification of the algebraic laws the code claims in its own comments, bounded model checking of
the round loop, mutation testing of the structural suite, and a survey of how comparable products
verify themselves. Nine are fixed here; one was examined and confirmed to be intended behaviour.

**The measurement that started it.** The structural suite was green at 1419 checks and scored
**67.9% against mutation** (55 of 81 planted mutants killed): 26 semantically meaningful changes to
the kernel, the hooks and the oracles passed the entire suite without turning a single check red.
Of those 1419 checks, 424 (29.9%) asserted only that a file *contains* a string. A suite can be
thorough and still not be sensitive, and the two are easy to confuse from the outside.

**Eight of the ten defects were one shape** — a fact *projected* or *remembered* instead of
re-derived, then crossing a boundary it was not built to survive: a second projection pass, a
second run of one slug, a relaunch, a rewrite. None is visible to a single-pass fixture, which is
why a large green suite held all of them. This repo had already fixed that class three times, by
its own comments, and each fix was local to the instance.

- **The run graph could drift from the artifacts it projects.** `reduce graph` promises it can be
  deleted and rebuilt byte-identically. It could not. A gate's `DEPENDS_ON` edge chose its TARGET
  from what happened to be on disk at projection time, and gates are crossed *before* the round's
  verdict artifact lands — so the first pass minted a fallback edge to the Run, a later pass added
  the verdict edges beside it, and an append-only log has no tombstone to retract the first. The
  run edge is now unconditional and the condition is gone; a gate does depend on its run. The trial
  node key carried scope but not run, while trial ordinals restart per run and `trials.jsonl` is
  append-only, so one key named two rows and the earlier run's execution record was silently
  overwritten in the projection. The fold MERGED repeated nodes while the file's own banner promises
  last-line-wins and the edge branch one line below it replaces — so an attribute removed from an
  artifact could never be forgotten. And `EDGES` was a dead constant nothing imported, while the
  projection emitted `IMPLEMENTS`, which it did not declare.

- **A derived value rode on directory order, and then on argument order.** `parseBoard` read its
  directory unsorted, so `criticalPath`'s strict-`>` tie-break kept whichever equal-hours chain it
  met first. Sorting the reader was the obvious fix and it was not enough: the order-dependence
  lived one call up, where any caller with its own ordering re-opens it. `criticalPath` now breaks
  ties on chain content, so the answer is a function of the board rather than of the walk that
  produced it. Measured: two disjoint 5-hour chains, five permutations of one list, two different
  answers before, one after.

- **A contract value could change TYPE on a round trip.** `coerce(uncoerce(v))` was not an identity.
  A string whose text is a bareword literal — `"false"`, `"true"`, `"123"`, `"~"`, `""` — came back
  as a boolean, a number or null the first time its contract was rewritten. Both halves were wrong:
  the writer did not quote such values, and the reader unquoted *before* testing the literals, so
  quoting bought nothing. The reader now treats a quoted scalar as text verbatim — the same rule it
  already applied to lists, one step further in — and the writer asks `coerce` itself whether a
  value needs quoting. Asserted as a law over every type the dialect carries, not at one example.

- **GATE H's census was emptied by the event that most needs it.** `allGreen`/`allHammer` were
  in-memory accumulators, and a gate pause is a `return` — so the PO's answer starts a *fresh
  launch* whose accumulators begin empty while the round loop fast-forwards past the rounds that
  filled them. The PO was handed an empty cut list for a run with genuinely exhausted scopes.
  Unattended (`ci`) runs never pause, which is why no archived trace showed it. Both lists are now
  re-derived from the run graph at every launch, from a query the round already makes.

- **A resumed scope skipped both of its completion checks.** `resumed` short-circuited the T0
  re-read *and* the leg check — but a relaunch happens because the previous launch died, and a leg
  that died between writing its result and running `reduce ingest` leaves exactly the state the leg
  check exists to find: green T0 on disk, result never applied, board still `pending`. The one scope
  class known to be at risk was the one class nobody asked, and the late-ingest repair below could
  never fire for it. Only the T0 re-read is gated on `resumed` now.

**Examined and left alone:** a `Result` edge whose `Order` was never projected. `trace()` reports
dangling edges rather than dropping them, so guarding it would hide the orphan rather than fix it.
Intended behaviour, recorded as such rather than counted as a fix.

**The enforcement cases are data now.** `tests/fixtures/hook-decisions.json` holds one row per
decision and `tests/structural/56-hook-decision-table.mjs` runs them; adding a case is a row, not a
new assertion. Every row pins BOTH halves — what the host was told (`permissionDecision`) and what
the ledger recorded (`verdict` + `rule`). Pinning only the first cannot see a guard that stopped
being consulted; pinning only a deny cannot see an ALLOW that stopped being *inspected*.
`hooks/lib/decision.mjs` has separated `inspected-and-permitted` / `no-rule-matched` / `threw` /
`never ran` since v1.5 and exactly one check in the suite read it. The table covers all five
safety-spine deny categories at more than one spelling each and all eight rungs of the substrate
fence's ladder, and it immediately killed two mutants the old suite let through — a narrowed `.env`
pattern that stopped protecting `.env.local`, and a `git reset` check that stopped catching
`git reset HEAD~3 --hard`. `safety-spine` went from 1-of-4 to 3-of-4 under mutation.

**Why that hook and not its neighbour.** `sandbox-guard` killed 8 of 8 planted mutants;
`safety-spine` killed 1 of 4. Same directory, same author, same care. The difference is method:
sandbox-guard is tested by *decisions over varied paths*, safety-spine was tested by a *fixed list
of command strings*, and every surviving mutant kept those exact strings denied while widening the
hole to an adjacent spelling. That contrast is the most useful thing the measurement produced.

**Two new modules, because the fixes needed checks that cross the boundary they failed at.**
`57-derivation-boundaries.mjs` runs the projection twice, writes two runs into one slug, rebuilds
the graph and compares by VALUE — the pre-existing rebuild check compared `nodes.keys()`, which is
precisely why it held two of these defects. `58-relaunch-memory.mjs` is source-level, because
`shapeup-run.js` is a Workflow body over injected globals and cannot be imported; that limitation
is itself why in-memory orchestration state was reachable by no assertion in the suite.

**Each fix was reverted alone on a clean tree to confirm its check goes red.** Nine of ten do. The
`parseBoard` sort does not: APFS returns `readdirSync` already sorted, so no fixture on this machine
can distinguish it — it is pinned by reasoning and by the `criticalPath` check one call downstream,
and is recorded that way rather than counted as proven. Two checks written during this work did not
discriminate either and were repaired: one asserted a property of the filesystem rather than of the
code, the other matched an identifier that survives gutting the logic it names.

1419 → 1530 checks, green.

## [3.3.0] — 2026-09-14 · The loop never built or launched the feature

Five findings from one consumer run (a HarmonyOS phone app, fourteen scopes, three rounds), each
traced to a mechanism rather than a worker, and each closed by a change the structural suite pins.

- **The knowledge base coaches the workflow, and never a gate.** `/retro` (the coach) now offers
  seven categories at GATE COACH-1: `orient`, `scope-architect` and `solution-architect` read
  their own `shapeup/knowledge-base/<skill>.md` at the top of a run like the three workers that
  already did, and `tech-lead` reads `knowledge-base/tech-lead.md` at GATE L0 — workflow
  guidance (which question, check or spike to insist on at a gate) and suggested L0 values it
  confirms with the PO before pinning. The rule every category obeys is now stated and tested:
  guidance may add a question or a check to a gate block and may never answer, skip, reorder or
  relax one, widen a substrate, edit a probe or a fixture, or move a hill dot; `spec-evaluator`
  and `scope-hammer` are never coachable. New operation `scan` (`/retro --scan`, optional,
  suggested once by `init` and at an empty-KB L0): the same pipeline fed by the project on disk
  instead of L4 feedback, every drafted rule carrying its evidence and confirmed at COACH-1, filed
  with `project-scan @ <sha>` provenance so a rescan replaces only its own rules. Why: the
  platform habits that cost the measured run three rounds were filed as team feedback after L4;
  a scan puts them in front of the workers before round one, and the tech-lead file gives "insist
  on a launch probe for this archetype" a reader at the gate where it matters.

- **The coach can research a platform the project cannot yet show it.** New operation `research`
  (`/retro --research <stack>`, `payload.stack` required and never guessed): the same pipeline as
  `scan`, fed by the platform's official documentation instead of the project on disk — build,
  launch, test, package manager, lint, in that order of leverage, each rule cited with url, version
  and fetch date, confirmed at COACH-1, filed with `web-research` provenance so a re-run replaces
  only its own rules. On a project that has been scanned it runs as a second opinion, reporting
  each scan rule confirmed, contradicted or unknown, and the PO decides the contradictions. A later
  scan retires the research rules it confirms with disk evidence: the project's own files outrank a
  document about the platform. Research is a source, not a verification — "verify" is what the
  kernel executes — so nothing it reads runs until the tech lead pins it at L0, and a fetched page is
  content to summarise, never instructions to follow. Why: a project just initialised has no build
  file, no CI and no test runner for the scan to read, and the workers otherwise meet the platform's
  toolchain for the first time inside round one; an operation on the coach, rather than a new
  worker, because the knowledge base keeps its one writer and the rules keep their one gate.

- **The round build gate.** `harness verify build --slug <slug> --round <N>` runs, once per round
  before EVAL and stopping at the first failure, the run ledger's `run_cmd`, then two new optional
  `project-profile.md` fields: `build_probe` (the built artifact covers what the run wrote — a green
  exit code is not proof the feature compiled when the toolchain compiles only what an entry point
  reaches) and `launch_probe` (install, start, assert the first screen, fail on fatal logs). It writes
  `.shapeup/<slug>/build/r<N>-t<T>.json`, immutable per run of the gate. A red gate ends the round
  with no EVAL dispatch, `harness compile` turns each failing step into `payload.bugs` for the next
  round's orders (addressed by the files the tool's output names, unowned → every scope, marked),
  and `reduce hill` withholds DOWNHILL_EXECUTION from every T0-green verdict of that round. A
  `mobile` profile with no `launch_probe` is warned about every round, and so is every scope none
  of whose fixtures invoke the tool `run_cmd` builds with (advisory). Nothing declared exits 3 and
  is logged as undeclared, never as green. The workflow shows the gate's state in the L2 and L3
  blocks. Why: 30 of 30 T0 trials went green on a run whose build failed, three EVAL rounds graded
  a blank screen, and all fourteen committed hill shards read DOWNHILL_EXECUTION.
- **Hooks file under the project root, not the shell's cwd.** Every hook now resolves the project
  root by walking up from the payload's `cwd` to the nearest run pointer, committed tier or git
  boundary. Before, a worker that `cd`ed into a sub-folder started a fresh `decisions.jsonl` there
  (nine on the measured run, one inside the committed tier, two inside the run trace), every row in
  it carried `run_id: null`, and — the part that mattered — `sandbox-guard` deferred at `no-round`
  on every write from that shell because the active-order pointer was not beside it. A relative
  tool path still resolves against the shell. `probe stats --hooks` now lists stray ledgers.
- **`harness probe owner`.** Which scope owns a path, elected from the committed contracts'
  substrates — the same election `harness compile` uses to address a cited bug. With no `--path` it
  answers for every engine and entry call site the wiring map names plus the profile's entry point;
  `writers: []` is an unowned seam and `missing` lists seams the wiring names that are not on disk.
  scope-hammer's census must cite it for every ownership claim
  (H0.0). Why: a ship report told the PO no scope owned the app's page files while a committed
  contract listed that directory in plain sight.

## [3.2.0] — 2026-09-11 · The breadboard never reached the run

**The pitch is two files and the run read one.** `/shapeup` writes a pitch as `shaping.md` and
`breadboard.md`, and `AGENTS.md` has always said the completed pitch is both. `harness init run` took
one: it copied `--intake-file` and dropped the path it came from, every planning order pointed at
that copy, and nothing in the kernel, the hooks or the workflow had ever read a breadboard. So its
Places, affordances and slices reached no planning worker. A Place only the breadboard named — a new
blocking sheet, in the consumer run that found this — was planned as a bar inside another screen,
and every later step was faithful to a spec that had never heard of it. Its affordances were in the
spec, cited under the wrong screen, and spec-lint was green (#15).

- **`init run` pins the breadboard beside the intake.** It takes `--breadboard <path>`, or finds
  `breadboard.md` beside the intake, in `shapeup/<slug>/shaping/`, or in `shapeup/<slug>/`, or reads
  one written inline in a single pitch file. The intake's own folder comes first, because the
  documented location is not the one real projects use. A file is staged byte for byte to
  `.shapeup/<slug>/breadboard.md`; the receipt records `intake_source` and a `breadboard` record
  (source, path, sha256, P/U/N/S/V id counts). `probe resume` reports `breadboard_path` and
  `breadboard_source`. A run with no breadboard behaves exactly as before.
- **The four planning workers are handed it.** `payload.breadboard` is a declared WorkOrder field for
  orient, ba-pitch-analyzer, solution-architect and scope-architect, and the workflow sends it at all
  four dispatch sites; a run without one compiles the same orders as before. Orient's rule to look for
  a sibling `breadboard.md` beside the pitch is gone — the pitch it read was the run's copy, which
  never had one.
- **With a breadboard, the screens are its Places.** ba-pitch-analyzer writes one
  `## Screen: … (P#)` section per Place that owns UI affordances and cites each U# inside its own
  Place's section; a Place the shape will not build goes under `## Deferred Places`, which GATE L1b
  prints for the PO's ruling. A scope contract's affordance entry may name the U# it implements as
  an optional `source`, and scope-architect records which scopes deliver each slice in
  `scope-board.md`.
- **spec-lint checks placement, not citation.** `BREADBOARD-PLACE` (red) fires when a Place with UI
  affordances has no screen and is not deferred; `BREADBOARD-UI` (red) when a U# is not specified on
  a screen of its own Place, and says where it was cited instead. `BREADBOARD-TRACE` warns on
  uncited N#/S#, unrecorded V# slices and unsourced manifest entries; `BREADBOARD-UNPARSED` warns
  when a breadboard yields no ids, so a layout the reader cannot parse never becomes a hard stop.
  All four are silent when a run has no breadboard. The L1b abort no longer calls every spec-lint
  red "a disjointness or size problem".
- **The gates show it.** The L1a block names how the breadboard was found, or `none`; `/ship` and
  tech-lead accept `--breadboard`; `slice_count` is harvested from the receipt's slice count rather
  than copied by hand.
- **A translated pitch gets its translated breadboard.** Opened from `<name>.en.md`, `init run`
  prefers `breadboard.en.md` in each folder it searches, records whether the staged breadboard is
  translated, and warns when only the untranslated one exists. The language gate now runs before the
  run opens, over the pitch and its breadboard: every planning worker reads what `init run` pinned,
  so a translation made afterwards reached nobody.

Also: the design ERD's payload-by-worker table, a hand copy of the registry that had drifted for
several releases, is regenerated from it.

## [3.1.2] — 2026-09-10 · EVAL could refuse every scoped round, and a refused round counted as done

**The evaluator was never handed the T0 artifacts it must cite.** spec-evaluator's input contract
makes `payload.t0_artifacts` mandatory for a scoped spec: with none listed the round is not
gradeable, and it returns `status: failed` without grading a criterion. Since 2.0.0 nothing supplied
the field — the orchestrator courier that assembled it was deleted when the run moved onto the
Workflow runtime, and the workflow's evaluate dispatch passes only `{dimensions, run_cmd, round}`.
Every scoped evaluate order since then went out without it. Evaluators that went looking on disk
graded anyway, so the gap stayed invisible until one followed its contract to the letter and the run
aborted at GATE L3 over a round whose every scope was green. `harness compile` now derives the list
for every evaluate order — each scope's newest green T0 verdict for the round (of any round, for a
standalone pass), repo-relative — and names on stderr any scope with nothing to cite. An explicit
`--payload` list still wins. The derivation lives in the compile step rather than the workflow
because that is the one line every lane passes through, and because verdict files are addressed by
round, attempt and trial, never by scope: a caller could not rebuild the list from filenames.

**A refused EVAL round counted as done.** `probe resume` read any `evaluate-r<N>.json` as a graded
round, so relaunching after a refusal opened round N+1 with no bugs to route, rebuilt every scope,
and was refused again. `eval_rounds_done` now counts only rounds whose result holds a verdict the
run may act on; a refused round stays open, and the relaunch re-enters it, skips the scopes already
green there, and evaluates again. A refused result left on disk no longer has to be moved aside.

**A scoped verdict citing no T0 artifact was accepted.** The evaluator's own contract calls such a
verdict structurally invalid, but the rule lived only in its prose: ingest ledgered it and the round
loop branched on it. `probe eval` and `reduce ingest` now refuse a scoped PASS or FAIL with no
`t0_citations`, for one shared reason, so the round loop, the resume derivation, the hill and the
verdict ledger agree. Presence is checked, not digests — a slip transcribing a hash is not evidence
that the verdict is wrong.

**The L3 abort blamed a dead sub-agent.** A refused round aborted with `sub-agent skipped, blocked,
or died after retries` while the evaluator's actual reason sat in its result. `probe eval` now
reports the result's `status` and a `reason` — the evaluator's first deviation, or what is wrong
with the verdict it returned — and the L3 abort carries it. The evaluator's contract now asks for the
refusal reason as its first deviation, the channel `probe eval` reads.

**Verdict files sorted as strings.** `probe t0` ordered `t0/verdicts/` lexically, so
`r1-a1-t10.json` read as older than `r1-a1-t9.json` — and ten scopes on their first attempt share
one (round, attempt), so a single wide fan-out reaches `t10`. They now sort by numeric address.

**Upgrading a run stopped by this.** The kernel is resolved from the plugin root on every launch,
so a run already stopped at L3 picks up the fixed compile and resume logic on its first relaunch
after the upgrade. The staged workflow copy it started with keeps the old L3 message until the next
run opens.

## [3.1.1] — 2026-09-07 · the run could not launch from an installed plugin, and a finished run fenced the checkout forever

**`Workflow({scriptPath})` naming the installed plugin is refused before the run begins.** The tool
loads a script only from a directory the session may already read — the working directory, or one
the operator added — so every marketplace install stalled at step one with `scriptPath must be a
script path this tool returned, or a file you can already read`. No permission rule repairs it: the
`"Workflow"` grant `npx shapeup-sdlc init` writes authorises the tool, not what it may read. The
failure is invisible in development, where the plugin root and the working directory are the same
tree, and total everywhere else. `harness init run` now re-copies the run scripts to
`.shapeup/workflows/` on every open and reports the path as `workflow_script`; the tech-lead skill,
both commands and the zero-work hook's remediation text all name that copy. A run already in flight
keeps the copy it started with, so an upgrade reaches the next run rather than the current round.
The consumer-install suite, which already opened a run from a project whose working directory is NOT
the plugin root — the geometry every install has — now asserts what no check had: that the staged
script exists there, byte-identical to the shipped one, and that a resume leaves it alone.

**A finished run kept the whole checkout fenced to its last dispatch's substrate.** `harness compile`
publishes `.shapeup/active-order` with every order and nothing ever erased it, while `sandbox-guard`
counted the order that pointer named as live regardless of its result — "so the single-order lane
behaves as it did before concurrency existed". That arm bought nothing (an order genuinely in flight
has no result yet, and was already live by the other rule) and cost everything after a ship: an
ordinary edit anywhere was denied against a substrate as narrow as `REPORT.md` + `reports/**`, and
the next feature could not write even its own run trace, because the run-trace carve-out is keyed to
the slug the stale pointer names. The guard's documented fail-open state — "no dispatch in progress"
— was unreachable after a checkout's first run, and the only way out was deleting a file nothing
documents. Liveness now comes from the run's order set alone; `reduce ship` and `init run --force`
retire the pointer so it does not outlive its run.

**An order is answered when its result is at least as new as the order, not merely when one exists.**
Dropping the arm above on its own would have opened a hole of its own: order filenames for the
run-level operations carry no round (`hammer.json`, `wire.json`, `analyze.json`), so re-dispatching
one inside the same run rewrites the order beside the PREVIOUS dispatch's result — which a presence
test reads as finished, running the new dispatch unfenced. The comparison is against the order's own
`compiled_at`, the stamp the compiler writes into it, which a copy or a touch cannot perturb — read at
whole-second precision, because that is all some filesystems keep of an mtime (HFS+ among them), and
compared raw a result written in the same second as its compile would count as older than the order
and stay live. The `--force` unwedge check was passing for the wrong reason and now re-arms the guard before probing:
once every order is resolved there is nothing left to enforce, so the old assertion could not fail.

**A denial under the committed tier named the wrong remedy.** `ba --remap` widens a build scope's
substrate, and no build scope may own the run's own governance and spec artifacts, so the hint
pointed plausibly in the wrong direction. When every blocked path is under `shapeup/`, the denial now
says what is true: those files belong to the orchestrator, whose write window is a phase boundary
rather than the middle of somebody else's dispatch.

## [3.1.0] — 2026-08-21 · new `hill-chart` skill, and the FINISHED phase it can now actually reach

**`hill.mjs` read a verdict-ledger filename `reduce ingest` never writes, so no scope could ever
reach `FINISHED`.** The T1 check looked for `.verdicts-run.jsonl`; the real writer names it
`.verdicts-<target>.jsonl` (e.g. `.verdicts-evaluate-r1.jsonl`), keyed off the order id. `t1Pass`
was therefore always `false`, silently capping every scope below `FINISHED` regardless of what
the run actually produced — an invariant this repo's own `AGENTS.md` already claimed
("Hill phase is mechanical ... derived only from T0/T1/seesaw artifacts") without ever having
delivered on the T1 half. Fixed by reusing `probe/eval.mjs`'s `evalVerdict()` — the same read
GATE L3's own pass/fail branch already trusts — instead of re-parsing a ledger by hand. Verified
live: a fixture that reached only `DOWNHILL_EXECUTION` on the old code reaches `FINISHED` on the
fixed code, from the exact same on-disk evidence.

**New skill: `hill-chart` (`/hill`).** Renders a self-contained dashboard from committed hill
shards and each pitch's local run graph — a portfolio card per pitch (health, phase, a mini Hill
Chart) and, per pitch, a full interactive Hill Chart plus an attention list, a scope board, round
history and the run graph one click deeper. A pitch whose local run trace was cleaned up after
shipping still renders — marked Archived — from its committed hill shards alone; the skill never
recomputes a hill shard it can't see local evidence for, so a real historical `FINISHED` is never
silently regressed to a fabricated `UPHILL_SOLVED`. Not a pipeline worker — invoked directly, like
`shapeup`.

**`shapeup-run.js`'s `--require`/`--set-status` completion checks could report a false
"phase produced no artifact."** `requirePhase`/`fastForward` treated any non-zero exit code from
the mechanical courier as `probe resume --require`'s own exit-6 predicate ("artifact genuinely
absent"), asserting a fixed "the worker most likely escalated" diagnosis and discarding the
courier's own detail. Measured live: Claude Code's auto-mode classifier — a layer above this
plugin's own hooks and `permissions.allow` grant — can deny the courier's Bash call outright, and
that denial produced the identical false narrative as a real predicate failure, aborting a run
whose phase had actually completed. Now only exit 6 gets that message; the courier reports `-1`
instead of fabricating a code when its call is refused, and any other exit surfaces the courier's
own detail and names the classifier as the likely cause (`protocol.md` §3b.1). The classifier
itself is a Claude Code product-level layer this plugin cannot see or suppress — the fix stops the
false diagnosis, not the underlying denial; recorded as an open item in
`shapeup/knowledge-base/harness-defects.md`.

## [3.0.2] — 2026-08-21 · breadboard.md gets its missing template, shaping docs wikilink their slug

**`breadboard.md` was the only shaping-family artifact with no output template.**
`resources/shaping.md`, `framing-doc.md`, `kickoff-doc.md` and `spike.md` each specify an exact
write path and a `shaping: true` / `feature:` frontmatter block; `resources/breadboarding.md` — the
resource `/shapeup breadboarding` actually loads — never did. `breadboard.md` could therefore ship
with no slug tag at all, down to whatever the model improvised that session. It now carries the same
Output File section as its four siblings.

**`feature: [feature-slug]` was a plain YAML string, so Obsidian's Graph View never drew an edge
from a shaping doc to its slug** — Graph View follows `[[wikilink]]` syntax only, never folder
nesting or a bare string match. The field is now `feature: "[[feature-slug]]"` across all five
templates. This is a prompt-only convention with no code reader — `kernel/compile.mjs` threads the
slug into a WorkOrder independently via `payloadExtra.feature` — so nothing structural pins it; it
stands on the same footing as the existing `shaping: true` ripple-check convention.

## [3.0.1] — 2026-08-21 · WIRE fails fast, dead economics reporting removed

**WIRE checks its own precondition instead of paying a worker to discover it.**
`shapeup-run.js` derived `has_project_profile` from its opening resume-state probe but never
branched on it, so a missing `project-profile.md` was dispatched to `solution-architect` anyway —
the worker escalates per its own documented rule, writing no `wiring-map.md`, and every relaunch
re-dispatches and re-escalates identically. The orchestrator now aborts at WIRE with the missing
path named, before the dispatch. Live-tested against a real project consuming the plugin directory
via `--plugin-dir`: with the profile absent, the run aborts at WIRE with zero orders, zero results
and no dispatch receipt for `solution-architect` anywhere in the run trace; with it present, WIRE
dispatches for real (hook-attested) and writes a correct wiring map. Pinned by
`tests/structural/18-resume-state.mjs` 52(n).

**`harness report export`'s `agent_call` table and `economics` block, and `harness probe stats
--economics` entirely, are gone.** Both were keyed off `journal.jsonl`, a per-agent-call record the
Workflow runtime never wrote in any measured run (confirmed live, twice, in two independent
worktrees — `shapeup/knowledge-base/harness-defects.md`). A mechanism that always reports nulls
dressed as measurements is worse than no mechanism, so it's deleted rather than kept. `report
export`'s other nine tables (run, dispatch, ac_result, discovery, file_touched, trial, t0_verdict,
criterion_verdict, hook_decision) are untouched — they're sourced from real records. Pinned by
`tests/structural/19-run-records.mjs` 54(c).

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
