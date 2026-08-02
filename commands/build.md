---
description: Implement a task's acceptance criteria exactly (minimum code, surgical diffs)
---
Use the **task-executor** skill on $ARGUMENTS.

Standalone build: implements one task (`TASK-NNN`) from a spec folder — assumption scan first,
minimum code, surgical diffs, verified observable outcomes. Inside an orchestrated run the
tech-lead dispatches this skill through the envelope port instead; this command is for picking
up a single task directly.

If no task ID was given, read the board (`.shapeup/<slug>/tasks/_index.md`) and take the
next `ready` task, stating which one you picked. Respect the substrate: if scope contracts
exist, writes outside the active scope's whitelist will be denied by the sandbox hook — that is
the harness working, not an error to route around.
