---
description: Judge the build against the committed spec (skeptical; absence of evidence = FAIL)
---
Use the **spec-evaluator** skill on $ARGUMENTS.

The single judge. Two modes, chosen by the arguments:

- `--task TASK-NNN` — grade one task against its acceptance criteria.
- `--spec <folder> --feature <slug> --single-pass` — the once-per-round verdict on the whole
  board.

Round mode is watched: a PreToolUse hook (GATE L2) **warns** while any task on the board is
unfinished, naming the offenders — advisory since ADR-0001, so the call proceeds, but a verdict
taken now grades a partial board and the warning is recorded. The correct response is to route
back to `/build` and finish them — do not shrug the warning off, and do not use `--task` as a
loophole to simulate a round verdict piecemeal.
