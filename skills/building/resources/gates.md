# Putting a gate to the PO

A gate resolves through the kernel, never through a paragraph of yours. When `gate --resolve` exits 4
it is your job to ask well: print the `block` verbatim, then **one question, the valid decisions, your
recommendation first**. The recommendation is yours; the answer is the PO's.

| Gate | What the PO is deciding | Recommend |
|---|---|---|
| `L1a` Orient Review | the Scout's code-surface map and the spike result, before any board exists | `proceed` unless the spike found the shape does not fit the code; `abort` when it did |
| `L1a.5` Wiring Review | every use case traced to its seam and entry point | `proceed` when each has one; name any that does not |
| `L1b` Board Review | the scope board and its disjointness — where scope is actually decided | read the REQ → AC table in the block's neighbourhood first: a requirement no acceptance criterion grades and no scope claims is **red**. The ways out are an AC carrying `(covers: REQ-…)` or the PO marking the clause `CUT (PO-approved)`. `proceed` only when none is red. |
| `L2` Build Round Complete | whether the round's work goes to evaluation | `proceed`; over unfinished tasks it is a warning, not a block. A board with no tasks at all forces a stop however it is answered |
| `L3` Verdict & Loop | the judge's verdict for the round | on FAIL `loop` while rounds remain, `stop` to cut; on PASS the answer only matters for the next phase |
| `QA` QA Edge Hunt | whether to hunt past what the judge probed | `run` unless the PO is out of time; a hunt discovers and never blocks |
| `H` Decide When to Stop | the census: what ships and what is cut, against the baseline and never the ideal | `accept-cut-list` for `ship-now` or `ship-after-fixes`; `cannot-ship` never reaches this question |
| `L4` Ship Sign-Off | final go/no-go; `ship` is only offered when a census cleared the run | `ship` only after reading the status line the block carries |

An unattended run puts none of these to anyone: its answer set resolves them and the ledger names the
set as the source. A gate with no answer and no human is a fast, attributable abort, not a silent wait.

## What to have read, and printed, before you ask

The `block` is the kernel's facts; the PO decides on more than those, so read what the gate is about first and
print the headline from the artifact — never composed from memory. Guidance may add a question to any of these;
it never answers one.

**L1a — Orient Review.** Read `.shapeup/<slug>/orient/`. Render the area-level Hill from `hill-signal.md` (each
suspected area uphill — open unknowns · crest — approach proven by the spike · downhill). Print the breadboard
source (flag, sibling, shaping dir, shared root, embedded, or none), the code-surface headline, the spiked area
and its result, and the riskiest open unknowns going into mapping. Ask at most two: is the riskiest area the one
that was spiked, and is there an unknown that needs another spike before scopes are mapped?

**L1a.5 — Wiring Review.** Every use case has one declared engine → seam → entry-point call site → affordance in
`wiring-map.md`. Name any that does not.

**L1b — Board Review.** The PO reviews the committed plan — `usecases/_index.md`, `scopes/*.md`,
`scope-summary.md`'s Done-when headlines — never the per-machine task board; task-level detail stays hidden here
by design. Print: use-case count and actors; the scope board (scope id, topology, substrate file count); any spike
blockers; the Done-when headlines; the **Deferred Places** from `ux-behavior.md` — breadboard Places the shape will
not build, each needing the PO's yes, a rejected deferral going back to planning as a screen; and the
`REQ → AC` table, one row per registered requirement (`REQ-12 ← shaping.md R12`, the criterion that grades it,
or the scope that claims it, or `CUT (PO-approved)`), omitted when the run has no registry. The table is printed,
never asked: it decides nothing at this gate.
Read the plan back here yourself, whatever the planning step already checked, because a human may have approved past a
problem and no script lints it for you. A problem is a hard stop: a file in two scopes' substrate without both declaring it
shared, a scope aligned with a directory (PA1), a scope whose use case does not resolve, a `depends_on` naming a scope that is
not there, a requirement no criterion grades and no scope claims, a Place with UI affordances folded into another screen. A scope over
~15 files is a warning. The breadboard problems are planning's to fix — add the screen or defer the Place, never fold it into another
screen. Scopes are released in dependency order: a scope opens the moment the scopes it declares in `depends_on` have settled, up to
`maxParallelScopes`, and contracts declaring none are one wave, every scope eligible at once. Ask at most two: scope cuts? any spike to resolve before build? Frame cuts against
the pitch's appetite, and surface the pitch's rabbit holes — a cut here is cheap, after round 1 it is expensive.

**L2 — Round Close.** The block carries `green_scopes`, `hammer_proposals` and the build gate (`green`, `red —
<failing step>`, or `undeclared`). `red` means the judge is not dispatched this round and the failing step
becomes round r + 1's bugs; `undeclared` means the round goes to evaluation over an unproven build, and the
block says so. Over unfinished tasks it is a warning, not a block.

**L3 — Verdict.** Report progress by hill position per scope (from the committed hill shards), never by "N of M
tasks done" — a 90%-done slice can be stuck uphill on the one unknown that matters. On FAIL, print the bug list
grouped by scope: the failed Done-when criterion and its repro, and **nothing about causes or fixes** — the
orchestrator names the scope; the implementer diagnoses. A round whose build gate was red never reached the
judge: the "bug list" is the gate's failing step. Ask at most one: fix these in round r + 1, cut scope, or waive a
bug? Past the round budget the answer is the census, with the residual bug list.

**QA.** A hunt discovers; the run's verdict stays the judge's PASS. Triage happens at H and L4.

**H — Cut List.** See `resources/stop.md`: the census against the baseline, never the ideal.

**L4 — Ship Sign-Off.** Print the feature as `SHIPPED (deployed)` or `BUILT & VERIFIED — deploy pending (PO)`;
rounds; the verdict with the dimensions evaluated **and** not evaluated, so "shipped" never reads as "verified
for all"; QA findings (all held as `~`) or skipped; and the `Requirements:` line **transcribed** from
the report's Requirements table, which you read off the verdict and `requirements.md`, never composed from memory (it decides nothing: a clause with no PASS
evidence is a fact the census weighs, not a veto). Deploy is outward-facing and the PO's: the loop stops at built and verified, records
`deploy pending (PO)` unless the PO says to run the project's own deploy, and never deploys itself. Ask at most
one: anything to record before closing? Substantive feedback goes to the retro (`resources/retro.md`), which
asks the PO which rule belongs where; the loop never categorises feedback itself.
