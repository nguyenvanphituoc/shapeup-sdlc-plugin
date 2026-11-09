# Plan — the requirements registry

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
