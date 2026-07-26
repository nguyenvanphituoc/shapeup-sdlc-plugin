---
description: Judge the build against the committed spec (skeptical; absence of evidence = FAIL)
---
Use the **spec-evaluator** skill on $ARGUMENTS.

The single judge. Two modes, chosen by the arguments:

- `--task TASK-NNN` — grade one task against its acceptance criteria.
- `--spec <folder> --feature <slug> --single-pass` — the once-per-round verdict on the whole
  board.

Round mode is gated: a PreToolUse hook (GATE L2) will **deny** the dispatch while any task on
the board is unfinished, naming the offenders. If that happens, the correct response is to
route back to `/build` and finish them — do not retry the eval, do not argue with the hook, and
do not use `--task` as a loophole to simulate a round verdict piecemeal.
