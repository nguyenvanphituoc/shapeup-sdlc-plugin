#!/bin/bash
# Kill/resume probe — the launch, called once per leg with byte-identical args.
#
# The two legs must differ in exactly ONE respect: the state on disk. Same script, same prompt,
# same RunArgs, fresh session each time. `startedAt` is read from the receipt rather than generated,
# so even that is identical across legs.
#
# Unchanged from the Stage A2 rig except the plugin root, which now names the A3 candidate.
#
# usage: launch.sh <leg-name>
set -u

PROBE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$PROBE/project"
# The RESOLVED install path seed-project.sh recorded — the same tree ${CLAUDE_PLUGIN_ROOT} gives the
# skills, so the workflow's pipeline calls and its workers cannot end up reading two different
# builds. seed-project.sh has already asserted it is byte-identical to the candidate.
PLUGIN_ROOT="$(cat "$PROBE/plugin-root.txt" 2>/dev/null || echo "$PROBE/candidate")"
LEG="${1:?usage: launch.sh <leg-name>}"

STARTED_AT="$(node -e 'console.log(require(process.argv[1]).started_at)' "$PROJECT/.shapeup/todo-kill/receipt.json")"

ARGS="$(node -e '
const [pluginRoot, startedAt] = process.argv.slice(1);
console.log(JSON.stringify({
  slug: "todo-kill",
  autoLevel: "unattended",
  answers: "ci",
  models: { exec: "sonnet", eval: "sonnet", qa: "sonnet" },
  budgets: { maxRounds: 2, attemptBudget: 3 },
  pluginRoot,
  startedAt,
}));' "$PLUGIN_ROOT" "$STARTED_AT")"

# The prompt is deliberately minimal and states no prohibitions. A prohibition addressed to the
# orchestrator ("do not re-dispatch work", "do not compile orders yourself") is applied by the
# safety classifier to shapeup-run.js's own internal envelope-port calls, and blocks them —
# measured, run-3 environment finding #2.
PROMPT="Call the Workflow tool exactly once with these two inputs and nothing else:

scriptPath: $PLUGIN_ROOT/skills/tech-lead/workflows/shapeup-run.js
args: $ARGS

Await it in this turn. When it returns, print its return value verbatim as JSON, prefixed with RUNRETURN: on its own line."

echo "=== leg $LEG ===" | tee -a "$PROBE/legs.log"
echo "$PROMPT" > "$PROBE/prompt-$LEG.txt"

cd "$PROJECT" || exit 1
CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 \
  claude -p "$PROMPT" \
  --model opus \
  --permission-mode auto \
  --allowedTools Workflow Bash Read Write Edit Glob Grep Skill Task \
  > "$PROBE/leg-$LEG.out" 2> "$PROBE/leg-$LEG.err"
echo "leg $LEG exited $?" | tee -a "$PROBE/legs.log"
