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

## Building a whole scoped feature is not this command

This command builds **one task**. A full BUILD round — every scope, the per-scope attempt loop,
T0 verification, the inner circuit breaker, then the single EVAL — is a workflow-script launch, and
it belongs to the orchestrator:

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" run \
  "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/shapeup-run.js" \
  --args-file .shapeup/<slug>/run-args.json --run-dir .shapeup/<slug>/workflow-run
```

Reach it through `/ship` (or the `tech-lead` skill), which opens the run properly — `harness init run`
first, so the receipt exists. Do not hand-roll the round by calling this command once per task: the
attempt loop, the T0 ratchet and the breakers are branches in that script, not steps a caller can
be trusted to reproduce, and a session that rebuilds them by hand is the prose lane the cutover
replaced. On a `--tiny` run or a spec with no committed `scopes/*.md`, the prose loop in
`skills/tech-lead/references/protocol.md` still applies, unchanged and by design.
