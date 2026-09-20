# The defect sweep — ten stages, each one accepted by an adversary

**Question:** How do the open defects get fixed, in an order that does not create new ones, with each
stage accepted by evidence rather than by the executor's own report?
**Scope:** HD-010 … HD-025 as indexed in `shapeup/knowledge-base/harness-defects.md`, plus stages S1–S3
of `docs/design/cli-and-orchestrator-split.md`. Excludes S4 (the package split) — NO-GO until one of
its three triggers fires — and excludes HD-013 and HD-021, which are P3.
**Sources:** the register and both plans as they stand on 2026-09-19; the acceptance discipline is
lifted from what this session measured, not invented — see §2.
**Confidence:** High that each stage is separately shippable and separately reversible. Medium on the
stage ordering after Stage 5. Low on duration: one maintainer, and the constraint is wall-clock.
**Status:** Executed 2026-09-20 from baseline HEAD `78d3c6e`. Stages 0-8 are complete and committed
on `plan/defect-sweep`; **Stage 9 has NOT run** and could not be run from this checkout (see below).

*Stage 0, corrected by its own auditor.* The baseline first recorded here paired **1638 checks** with
`78d3c6e`, and that sha does not produce it: a fresh clone prints **1635**, the +3 being doc-drift
checks contributed by then-untracked plan files. The count is not sha-invariant — it carries one
check per unique path cited anywhere under `docs/` — so every comparison below is clone-to-clone at a
named sha. `npm run demo` was proved *executed* rather than replayed: mutating the hook's denial
wording moved the rendered SVG's md5, and flipping its decision to `allow` made the recorder exit 1.

| stage | closes | verdict | commit | checks |
|---|---|---|---|---|
| 1 Docs | HD-014 (doc half), HD-010 (doc half), HD-023, HD-024 | accepted, 2nd pass | `3a335fa` | 1642 |
| 2 Fence | HD-012 | accepted, 1st pass | `0d9e1f5` | 1663 |
| 3 Evidence | HD-022 (evidence only — the call is the PO's) | 3 rejections, then corrected here | `c6b56ef` | 1671 |
| 4 Schemas | — (unblocks 5) | accepted, 1st pass | `8cb684c` | 1671 |
| 5 Seam contract | HD-010 (code half), HD-020 | accepted, 3rd pass | `7fa4968` | 1736 |
| 6 Digester | HD-016 | accepted, 2nd pass | `8c77460` | 1760 |
| 7 Ownership | HD-015 | accepted, 1st pass | `6b99048` | 1774 |
| 8 Thin orchestrator | HD-011, HD-017, HD-018, HD-019 | accepted, 3rd pass | `4caf2ec` | 1838 |

Every stage commit is independently green — verified by checking each one out into a fresh clone, not
asserted — so the per-stage rollback this plan promises is tested. Nine defects left the register
under its own rule (a guard pins the fix), each guard mutation-tested in both directions.

*What the acceptance contract actually bought.* Eleven of nineteen acceptance passes returned
REJECTED, and the rejections were not cosmetic: Stage 5's first fix reproduced HD-020's own defect one
level up (a writer that only prose invoked); Stage 8's first fix left two terminal returns bypassing
close-out while an existing check had been relaxed to tolerate the new shape without requiring it —
both holes green; Stage 8's second fix over-corrected into a guard that broke the relaunch case. None
of those would have been caught by reading a diff, and each was found by executing the behaviour.

*Two corrections this execution owes the plan itself.* §3 Stage 7 instructs the executor to answer
whether `ownErrors()` should widen to shared substrate. **That function does not exist at HEAD** — it
lives only on `archive/lesson-loop-g0-k`, and `score()` here has no "mine"-scoped axis to widen. The
question is contingent on the Stage 3 port decision and was deliberately left unanswered. And §3
Stage 4's exit condition, "green at the Stage 0 count or above", rode on a count that any documentation
edit moves; it is pinned to a number and to a fresh clone above.

*Stage 9 is not done, and saying otherwise would be the failure this plan names.* It requires a
persistent consumer project installed from the marketplace, two consecutive features, `.shapeup/` not
cleaned between them. Nothing run from this checkout can stand in for it: running the repo as its own
plugin puts the plugin root inside the working directory, which is precisely why the two defect
classes HD-025 names are invisible here. So the four propositions Stage 9 exists to test — that a run
reaches EVAL, reaches QA, runs GATE H's census, and runs the close-out path — are **untested outside
this checkout**, and the close-out path is new code from Stage 8 that has never run in a real
consumer.

*Open, and belonging to the PO:* HD-022's port/cherry-pick/abandon call (evidence in
`stranded-tag-evidence.md`), HD-014's code half, HD-013 and HD-021 (P3, still in the register), and
S4 of the architecture split (NO-GO until one of its three triggers fires).

---

## 1. The shape of a stage

Every stage is the same five parts, and a stage that cannot fill all five is not ready to start:

| part | rule |
|---|---|
| **Goal** | one sentence, naming the HD ids it closes |
| **Executor** | Sonnet. The brief names files and lines; if it cannot, the stage is under-specified |
| **Acceptance** | Opus, a fresh agent, given *propositions to test* and the diff — never the executor's reasoning |
| **Exit** | binary, executable, and failing today |
| **Rollback** | the revert, and what it costs |

Stages 1 and 2 are independent of everything and ship first. Nothing after Stage 5 starts before its
predecessor is accepted.

## 2. The acceptance contract

Six rules. Each one is here because this session or the soak measured what happens without it.

1. **Propositions, not conclusions.** The acceptance brief states what to test, never what the
   executor concluded. *Measured this session:* an adversary briefed with propositions corrected three
   of four framings it was given; an agent handed a conclusion hands it back confirmed.
2. **Execute, don't read.** A fix is accepted when the behaviour changed under execution. Reading the
   diff establishes that the code says something, not that it does it.
3. **Print the raw record before declaring anything missing.** *Measured in the soak:* five separate
   "the product is broken" reports in one session were the probe being wrong — a regex that did not
   match, a lookup in the wrong schema, a key read as `skill` when the field is `skill_invoked`.
   "I cannot verify this here" and "this is wrong" are different findings and must be labelled apart.
4. **Mutation is the acceptance, not the green check.** For every guard a stage adds, the acceptance
   agent must break the fix and watch the guard go red. *Measured in this repo:* a check once passed
   for the wrong reason — after an earlier fix nothing was live, so it could not distinguish "the
   arm is gone" from "nothing left to enforce".
5. **Read-only, and never on the live ledger.** Fixtures under the scratchpad; executing a hook
   requires `SHAPEUP_DECISIONS_PATH` redirected, because a denial appends to `decisions.jsonl` and the
   metrics shard — an instrument that contaminates what it measures is not an instrument.
6. **State the falsifier.** A stage is accepted only when the agent can say what would have made it
   fail. An acceptance that cannot fail did not happen.

**Model policy.** Sonnet executes: the work is specified down to the file, and what matters is
throughput. Opus accepts: the work is refutation under ambiguity, which is the one place this session
measured a difference — the falsification pass found two false claims, one inverted severity, one
false inherited fact and a structural flaw in a ranking that had already been reviewed once. Never
the same agent for both halves of a stage, and the acceptance agent never sees the executor's
transcript.

## 3. The stages

### Stage 0 — Baseline
**Goal:** record what green means today, so every later stage compares against a number rather than a
memory. Closes nothing.
**Executor:** run `npm test` and `npm run demo`; record check count, the demo's regenerated status,
and the HEAD sha into this file's Status line.
**Acceptance — *baseline auditor*:** re-run both from a fresh clone of the working tree and match the
numbers; confirm `npm run demo` actually regenerates the SVG rather than no-opping. Propositions:
*the recorded count is reproducible*; *the demo is executed, not cached*.
**Exit:** two numbers and a sha, written down. **Rollback:** none; nothing changed.
> The check count is **not sha-invariant**: it carries one check per unique path cited anywhere under
> `docs/`, so committing or deleting a plan document moves it on its own. Every later stage must
> therefore compare clone-to-clone at a named sha, or compare only the non-doc-drift checks — a stage
> can otherwise be green and below baseline for reasons that have nothing to do with the code it changed.
> `CLAUDE.md`'s own rule: a suite you have not run is an assumption, not a baseline.

### Stage 1 — The documentation that is wrong today
**Goal:** HD-014 (doc half), HD-010 (doc half), HD-023, HD-024.
**Executor:** rewrite `AGENTS.md:72` to say the fence outlives a close while orders remain unanswered
and to name `init run --force` as the release; correct the `gates.md` switch table so it stops routing
`--wall-clock-budget` into a dead field; add one paragraph naming workspace trust and the auto-mode
classifier, and the manual BUILD path as the documented fallback.
**Acceptance — *doc-versus-behaviour verifier*:** for each new sentence, drive the behaviour and
confirm it. Propositions to test: *after a **ship** close the fence releases*; *after an **escalated**
close with orders outstanding it does not*; *`init run --force` releases it*; *the flag named in
`gates.md` reaches a reader*. The last one must still fail at this stage — the code half is Stage 5.
**Exit:** every claim in the new prose is executable and was executed. **Rollback:** revert the commit.

### Stage 2 — The staged pitch
**Goal:** HD-012.
**Executor:** add `...FROZEN_INTAKE` to the `execute`/`fix`/`spike` case in `kernel/compile.mjs`, or
lift the two paths out of the run-trace carve-out at the hook level. Add a structural guard asserting
both directions.
**Acceptance — *fence mutation tester*:** revert the one line and confirm the new guard goes red;
restore and confirm green. Then confirm nothing legitimate was newly denied: a scope's own substrate,
`spikes/**`, and the run-trace files a doer must write. Propositions: *the guard fails on reversion*;
*no legitimate write is newly denied*.
**Exit:** the guard discriminates in both directions. **Rollback:** one-line revert.

### Stage 3 — The evidence packet for the stranded tag
**Goal:** HD-022. Produces evidence, not a decision.
**Executor:** for each of the 22 commits on `archive/lesson-loop-g0-k`, state against HEAD: does its
change already exist by another route, does it still apply, and what does it touch that 3.5.0 has
since rewritten. One row per commit.
**Acceptance — *commit-applicability falsifier*:** re-derive every row independently from the code, not
from the executor's table. This is the exact surface where two false claims were already found — that
the tag converts six items from *implement* to *port*, and that `9da0f14` closes the digester item.
Propositions: *each "already on main" row is true by content*; *each "still applies" row survives a
trial cherry-pick into a scratch worktree*; *no doc-touching commit silently reverts 3.5.0 text*.
**Exit:** a verified table. **The choice is the PO's and this plan does not make it.**
**Rollback:** n/a. **Gate:** if the choice is *port*, `a5ce8af` may not land before Stage 6.

### Stage 4 — Schema ownership (split S1)
**Goal:** the inverted dependency. Closes nothing on its own; unblocks Stage 5.
**Executor:** move `work-order`, `work-result`, `domain`, `gate-answers` to a kernel-owned location;
update the three kernel importers and every skill reference.
**Acceptance — *import-graph and fresh-clone verifier*:** assert no import path from `kernel/` reaches
`skills/`; run the suite from a fresh clone; confirm the plugin still validates and loads.
Propositions: *no kernel→skills edge remains*; *nothing else in the kernel depended on that tree*
— and if something did, report it rather than route around it, because that is the finding.
**Exit:** the import assertion holds and the suite is green at **1635 checks (the count at
`78d3c6e`) or above, measured in a fresh clone** — never in the working tree.
**Rollback:** revert; paths only.

### Stage 5 — The seam contract (split S2)
**Goal:** HD-010 (code half), HD-020.
**Executor:** derive — never type — one declared surface listing each run argument, its spelling per
tier, the artifact it lands in, and its reader. Add the drift check. Give `run-args.json` a kernel
writer.
**Acceptance — *contract-drift mutation tester*:** three mutations, each must go red — add a documented
flag with no reader; delete a reader of an existing flag; rename a field on one side only. Then the
decisive one: *is the contract derived or transcribed?* Add an argument to the source spec and confirm
the surface grows without anyone editing a list. Propositions: *each mutation reds*; *the list is
derived*. A transcribed list is the failure this repo has already committed inside its own checker.
**Exit:** all three mutations red, and the derivation proven by growth.
**Rollback:** revert; the check is additive.

### Stage 6 — The digester
**Goal:** HD-016. **Must precede any port of `a5ce8af`.**
**Executor:** extract a location when a diagnostic names a file without a line number; keep the line
null rather than inventing one.
**Acceptance — *digest fidelity adversary*:** feed real red logs and assert the triples; then confirm
no regression on the existing JS/TS/TAP samples. Propositions: *a locationless diagnostic yields a
triple carrying its file*; *no previously-extracted location changed*; *nothing invents a line number*
— the module's own banner forbids it.
**Exit:** both assertions, on real logs. **Rollback:** revert; patterns only.

### Stage 7 — Ownership and the shared substrate
**Goal:** HD-015, and the `own_errors` question it is coupled to.
**Executor:** elect an owner from `allowed ∪ shared` with exclusive writers preferred, or lint at L1b
— pick one and say why. Then answer the coupled question explicitly: does `ownErrors()` widen to
shared substrate, breaking its deliberate symmetry with `restore()`, or does it stay and the limit
get documented?
**Acceptance — *ownership semantics adversary*:** propositions: *the JSON and the rendered table agree
on one contract*; *a shared-only path reports a writer*; *a bug in a shared file reaches the declaring
scope rather than every scope*; *whichever way the `ownErrors()` question went, scoring and `restore()`
still mean the same thing by "mine", or the divergence is deliberate and written down.* The last one
is the trap: widening the score without widening the revert banks credit for work that is then
discarded — a sawtooth wearing a ratchet's shape.
**Exit:** all four. **Rollback:** revert; contained to two modules.

### Stage 8 — The thin orchestrator (split S3)
**Goal:** HD-011, HD-017, HD-018, HD-019. The largest stage; do not merge it with another.
**Executor:** move close-out, gate emission and the run-args write into the kernel; emit L0, L4 and
COACH-1 rows; derive `rounds_used` from the highest round carrying a build order, T0 verdict or
build-gate artifact, keeping judged rounds as its own field; route an ESCALATE deviation to exactly
one named channel.
**Acceptance — *state-across-boundary adversary*:** this stage touches the round loop 3.4.0 has just
rewritten, so the acceptance targets that defect class directly. Propositions: *a forced abort leaves
a terminal status, a cause, and an export row*; *a run with two build rounds and no EVAL reports
two*; *a run crossing L4 records an L4 row*; *an ESCALATE deviation is read by the channel that
receives it*; *and a kill mid-run followed by a relaunch loses none of the above* — the fact held in a
variable is the one that does not survive a boundary.
**Exit:** all five, each executed. **Rollback:** revert; but this is the stage most likely to need a
second attempt, so land it alone.

### Stage 9 — The soak
**Goal:** HD-025, and the only evidence that any of the above holds outside this checkout.
**Executor:** a persistent consumer project installed from the marketplace — not `--plugin-dir` — two
consecutive features, `.shapeup/` not cleaned between them.
**Acceptance — *soak evidence auditor*:** the specialty here is refusing to summarise. Propositions:
*the run reached EVAL*; *it reached QA*; *GATE H's census ran*; *the close-out path ran*. Two
consecutive soaks have stopped before the judge, so a soak that stops early must be reported as *not
having exercised the thing it exists to exercise* rather than as a run with findings.
**Exit:** all four reached at least once, or an honest statement that they were not.
**Rollback:** n/a.

## 4. What an acceptance agent may never do

- **Edit anything.** It reports; the executor fixes. A reviewer that patches its own findings has
  destroyed the evidence that the finding was real.
- **Accept on a reading.** See rule 2.
- **Summarise instead of judging.** "The change looks reasonable" is not an acceptance.
- **Resolve the stage's open question.** Stage 3's choice and Stage 7's `ownErrors()` question belong
  to the PO; an agent that answers them has exceeded its brief.
- **Report a defect it has not separated from its own instrument.** See rule 3.

## 5. Not in this plan

HD-013 (the WorkOrder result path) and HD-021 (the per-scope build fixture) are P3 and stay in the
register. S4 of the architecture split is NO-GO until a second consumer exists, a soak fails on run
geometry, or the runtime supports an external binary dependency. And the ordering after Stage 5 is
judgement: the only evidence that would reorder it is a run that fails because of one of these.
