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
