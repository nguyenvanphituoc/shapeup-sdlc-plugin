---
description: Implement a task's acceptance criteria exactly (minimum code, surgical diffs)
---
Use the **task-executor** skill on $ARGUMENTS.

Standalone build: implements one task (`TASK-NNN`) from a spec folder — assumption scan first,
minimum code, surgical diffs, verified observable outcomes. Inside a run the `building` loop
dispatches this skill through the envelope port instead; this command is for picking
up a single task directly.

If no task ID was given, read the board (`.shapeup/<slug>/tasks/_index.md`) and take the
next `ready` task, stating which one you picked. Respect the substrate: if scope contracts
exist, writes outside the active scope's whitelist will be denied by the sandbox hook — that is
the harness working, not an error to route around.

## Building a whole scoped feature is not this command

This command builds **one task**. A full BUILD round — every scope, the per-scope attempt loop,
T0 verification, the inner circuit breaker, then the single EVAL — belongs to the loop:

```
/ship <pitch>
```

`/ship` opens the run properly — `harness init run` first, so the receipt and the launch record
exist — and then follows the loop's phase table over the run's files. Do not hand-roll the
round by calling this command once per task: the attempt loop, the T0 ratchet and the breakers are
the loop's discipline, not steps a caller can be trusted to reproduce, and a session that
rebuilds them by hand is the prose lane the loop replaced.
