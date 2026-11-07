# Plan — turn the pitch into a spec a machine can build and a judge can grade

Planning is one activity, done by you in this context — no sub-agent. `probe next` hands it out one
substep at a time (`kind: plan`); the kernel keeps the fence and the post-conditions. **Invent nothing.**
You are the planner in a planner → doer → judge loop: you write what the substep produces, the kernel
derives and lints, the judge judges. You never grade your own output, and you hold no state of your own —
the same files in, the same files out.

## How a substep runs

The step names `open`, `produces`, `checks` and `close`; this section is the rest.

1. **`open`** (unless `order_open` says the fence is already up). It compiles a `plan` order that
   stamps the substep's write contract; nothing is dispatched. From here to `close`, a write outside
   what the order allows is denied by the substrate guard, and the staged pitch and breadboard
   (`.shapeup/<slug>/intake.md`, `breadboard.md`), `project-profile.md`, the receipts, the leg ledger, the
   T0 verdicts, and the order and result files are frozen for every substep.
2. **Read** the step's `guidance` (steering, never spec and never a gate — a rule may add a question or a
   check, never an answer, a skip or a wider substrate), then its `inputs`. The Scout's
   `code-surface.md` IS the codebase map: do not re-scan the code.
3. **Write only what `produces` names**, in the format this resource and its sibling files give. Never
   write between `open` and `close` outside the substep's substrate; if the work genuinely needs a file
   outside it, stop and ask the PO — never widen it.
4. **`checks`**, in order. A non-advisory check that fails is fixed and run again; you never stand in for
   a kernel check with a hand-walked checklist.
5. **`close`**. The kernel answers the order from the files on disk (a leg row is the proof). A close
   over no artifact is recorded as failed and the run's next step names what is missing — it is not a
   thing to retry blindly.

Escalation is a question to the PO in this conversation, one specific and answerable, with the context
needed to answer it. It is never a guess and never a silent widening: a new actor or action with no use
case is the PO's call (spawning a use case mid-cycle is re-shaping); a missing project profile is a
`need` the loop already stops on.

## Requirements — `shapeup/<slug>/requirements.md`

Extract **atomic** customer requirement clauses from the pitch (or the source the step's `inputs` names;
absent → the pitch, and say so) into the SHARED registry: one
`| REQ-id | clause (verbatim) | source | status | note |` row per clause. Split compound sentences into
one testable clause each — a clause lost *inside* a bigger sentence is a requirement nothing can be traced
to.

- **The `source` cell, and every other word of this file, cites the committed pitch or shaping doc** —
  never a path into the run's gitignored trace (`.shapeup/…` in any form, a bare path in a sentence as
  much as a wikilink). It dangles on every other clone and the spec lint reds it. With no committed
  original to name, describe the run tier without a path ("the pitch staged for this run").
- **Assign REQ-ids once and freeze them**, as a scope id is frozen, never a task id: every `covers:` link
  rots otherwise. Re-running, append new clauses with fresh ids; mark a removed clause
  `CUT (PO-approved)`, never renumber or delete. Status starts `covered` (a live requirement); only the PO
  sets `CUT`.
- **Numbering.** A source clause already carrying an `R<n>` keeps its number — `R12` → `REQ-12` — and its
  `source` cell records where it came from verbatim (`shaping.md R12`), because that cell is the only
  thing that survives a re-run. A clause with no R-id takes the next free number ABOVE the highest `R<n>`
  in the source, so it cannot collide with one added later. Splitting a compound clause keeps `REQ-12` for
  the first atomic part and records `shaping.md R12 (split 2/3)` for the rest. On a re-run, match an
  existing id by its frozen `source` cell and clause text, **never** by re-deriving the number from the
  source's current order.
- Never: edit the source, renumber existing ids, delete a dropped clause instead of marking it CUT, invent
  a requirement the source does not state, re-point an existing id because the source's numbers shifted.

## The other three substeps

| Substep | Craft | Writes |
|---|---|---|
| spec tree and board | `plan-spec.md` | `shapeup/<slug>/spec/**` (committed) and the board `.shapeup/<slug>/tasks/` (per-machine); a mode scopes it |
| wiring map | `plan-wire.md` | `shapeup/<slug>/wiring-map.md` |
| scope contracts | `plan-scopes.md` | `shapeup/<slug>/scopes/*.md` and `scope-board.md` |

Between them the kernel crosses GATE L1a.5 (after the wiring map, before the scopes) and, after the
scopes, spec-lint and GATE L1b, where the plan is still cheap to change.

## Reasons not to cut a corner

| Excuse | Reality |
|---|---|
| "This test idea is obviously worth a row" | No source, no row. Raise the gap; inventing rows is how the judge ends up grading fiction. |
| "My output looks complete, score it 92" | You do not grade yourself. The lint reports facts; the judge judges. |
| "Re-scanning the codebase is safer than trusting orient" | `code-surface.md` IS the map. Re-scanning burns tokens and forks the truth. |
| "unlocks is quick to fill in by hand" | Hand-authored `unlocks` drifts asymmetric. `reduce board --write` computes it. |
| "The appetite overflow is small, I will drop a nice-to-have" | Overflow is a cut-list question for the PO at the stop gate. Report the fact and the candidates. |
| "I will also slice the scopes (or wire, or write the spec) while I am here" | Each substep has its own fence and its own artifact. Cross-substep writes are denied, and a defect when they are not. |

## Mid-run: discovered items and older specs

Two spec-substep modes exist for work after the first plan, each with its own fence (`open` carries
`payload.mode`):

- **reconcile** — fold the discovered ledger's raw `[+]`/`~` lines into the board and the use cases.
  Verify the ledger's feature is this feature (mismatch → stop). Map each `[+]` Keep item to its owning use
  case; a new task continues the numbering (never renumber); a `~`/Cut item becomes a "Hammered Out" row
  in `synthesis.md`, no file. A Keep item that asserts a new invariant is APPENDED to that use case as
  `[INV-NN]` plus a `TS-INV-NN` Test Surface row (append-only sections). A new actor/action with no use
  case is the PO's call, not yours. Finish with `reduce board --write` (appetite overflow is reported) and
  `verify spec`. Never re-run the analysis, edit use-case Steps, or resolve an appetite overflow yourself.
- **retrofit-surface** — append `## Test Surface` (derived rows only, after Error Cases) to each use case
  of a spec that predates it; a use case whose sources are all empty gets the explicit empty-sources line.
  Touch nothing else.

Neither is offered by `probe next`; the loop opens one by hand when the PO asks for it:
`compile --operation plan --slug <slug> --payload '{"step":"spec","mode":"reconcile"}'`, then the same
`close` as any substep.
