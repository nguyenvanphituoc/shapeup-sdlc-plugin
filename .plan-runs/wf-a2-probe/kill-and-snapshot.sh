#!/bin/bash
# The kill: SIGKILL to the session process, ungraceful by design. No RunReturn, no pause block, no
# chance to flush state — that is the whole point, and it is what separates this from A3's
# pause-and-relaunch legs.
set -u
PROBE="$(cd "$(dirname "$0")" && pwd)"

echo "=== state at the kill (before) ==="
node "$PROBE/snapshot.mjs" "$PROBE/project" todo-kill "$PROBE/at-kill-live.json"

PIDS=$(pgrep -f "claude -p" || true)
echo "=== killing: ${PIDS:-none} ==="
for p in $PIDS; do kill -9 "$p" 2>/dev/null && echo "  SIGKILL $p"; done

# Anything the workflow spawned dies with it; give the filesystem a moment to settle, then snapshot
# again so the recorded kill state is what the resumed leg actually finds on disk.
sleep 3
node "$PROBE/snapshot.mjs" "$PROBE/project" todo-kill "$PROBE/at-kill.json"
echo "=== recorded $PROBE/at-kill.json ==="
node -e '
const s = require(process.argv[1]);
console.log("  completed phase orders:", s.completed_phase_orders.join(", ") || "(none)");
console.log("  pending orders:        ", s.pending_orders.join(", ") || "(none)");
console.log("  verdicts:              ", s.verdicts.join(", ") || "(none)");
console.log("  green:                 ", s.green_verdicts.map(g=>`${g.scope_id}@r${g.round}`).join(", ") || "(none)");
console.log("  status:                ", s.run_status);
console.log("  active-scope:          ", s.active_scope);
' "$PROBE/at-kill.json"
