# v4 working record

This folder is the working record for the v4 change: what was asked, what was read, what was
decided. It is not shipped. When the change ships, this folder is retired.

## Files

| File | Role |
|---|---|
| [`requirements.md`](requirements.md) | the registry v4 is planned and judged against |
| [`analysis/`](analysis/) | one file per question, written from the template; each ends in candidate requirements or none |
| [`review-2026-11-07-single-loop.md`](review-2026-11-07-single-loop.md) | what a run is made of today, and the cut |
| [`proposal-2026-11-07-activity-layout.md`](proposal-2026-11-07-activity-layout.md) | skills, hooks and agents after the cut |
| [`constraints-2026-11-07.md`](constraints-2026-11-07.md) | what in the repo bites the plan |
| [`plan-2026-11-07-single-loop.md`](plan-2026-11-07-single-loop.md) | the plan: activities A0 to A9, with their done-when checks |
| [`execution-2026-11-07.md`](execution-2026-11-07.md) | how far the plan got, what stopped it, and what each done-when stands at |
| [`plan-2026-11-07-native-first.md`](plan-2026-11-07-native-first.md) | the second plan: minimal scripts and tests, the host's harness for the rest — stages S1 to S4, each gated on a real run |
| [`execution-native-first-2026-11-08.md`](execution-native-first-2026-11-08.md) | how far that plan got: S1 and S2 gated on real runs, S3 measured against the engine, and the engine removed afterwards on the PO's instruction |
| [`report-v4-2026-11-08.md`](report-v4-2026-11-08.md) | the whole of v4 in one place: the cuts, the numbers, the measured runs, what the PO still has to decide |
| [`plan-2026-11-09-building-anatomy.md`](plan-2026-11-09-building-anatomy.md) | the third plan, with S0 to S4 executed on 2026-11-09 and the rest proposed: the `building` skill regrouped as one router and one file per activity, with the structure checked by the suite (stages S0 to S5), and the eight command files that are second names removed (stages R0 to R3) |

## Method and rules

1. **A requirement comes from an analysis file.** An analysis answers one question, from artifacts
   (the filesystem, a schema, an executed hook), never from prose. It ends with candidate
   requirements, which enter the registry as `proposed`.
2. **The PO moves a row out of `proposed`.** The registry records the date and who. A row accepted on
   architectural grounds before it is measured says so in its Status, so that a bet is not read as a
   measurement.
3. **A measurement carries a model and a date.** When the data it rests on changes, the figure is
   marked as predating the change, never rescaled.
4. **Every analysis names what would change its answer**, so a reader knows what to go and look for.
5. **No citation without a file.** A link to a file that does not exist is a defect; the structural
   suite fails on one.
6. **Nothing here ships.** The shipped set may not cite a path into this folder.

## V4-REQ-2 — low level

**Requirement.** Every agent a run spawns carries a recorded reason to exist: it reads far more than
it returns, it does independent or parallel work, or it needs a tool the loop cannot hold. Work with
none of the three stays in the run loop's own window.

**Decided.** 2026-11-07, by the PO, by setting the implementation goal. Status
`accepted (narrowed: coverage + analyze)`.

**The narrowing.** The requirement was accepted for two planning operations only: `coverage` (the
requirements registry) and `analyze` (the spec tree and the board). Both read the pitch and write
the artifacts the later steps read, in sequence, with no independent judge and no parallel work, so
none of the three reasons applies to them.

**What it does not cover.** `wire` and `map-scopes` stay outside the narrowing. `V4-REQ-11` records
folding them as a `could`, to be decided after a trace of what the planning handoffs lose. The
workers that do meet a reason (`orient`, `task-executor`, `spec-evaluator`, `qa-edge-hunter`) stay
sub-agents.

**Open tension, for the PO.** The plan dated 2026-11-07 lists "all four planning steps fold at once"
among its decisions already taken. That is wider than this narrowing and, read with `V4-REQ-11`, it
is taken before the handoff trace the narrowing was waiting for. The registry is left as the PO
recorded it; the plan's activity A2 is the place the wider scope is exercised, and its risk table
carries the check (`verify spec` between steps, the requirements-to-criteria table on the measured
run).
