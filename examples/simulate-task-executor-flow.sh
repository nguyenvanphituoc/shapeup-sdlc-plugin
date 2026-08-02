#!/usr/bin/env bash
# Simulate the task-executor data flow locally.
# Sets up a dummy environment, crafts a dummy WorkResult, and feeds it into ingest-result.mjs.

set -euo pipefail

# Find project root (assume this script is in examples/)
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

SLUG="dummy-flow"
LOCAL_DIR=".shapeup/$SLUG"

echo "==> 1. Setting up dummy environment in $LOCAL_DIR..."
mkdir -p "$LOCAL_DIR/tasks"
mkdir -p "$LOCAL_DIR/discovery"
mkdir -p "$LOCAL_DIR/escalates"

# Dummy task index
cat <<EOF > "$LOCAL_DIR/tasks/_index.md"
| ID | Status | Title |
|---|---|---|
| TASK-001 | ⬜ ready | The dummy task |
EOF

# Dummy task file
cat <<EOF > "$LOCAL_DIR/tasks/TASK-001.md"
---
status: ready
---
# TASK-001: The dummy task

## Acceptance Criteria
- [ ] Do the thing
- [ ] Another AC
EOF

# Dummy Ledger
echo "# Discovery Ledger" > "$LOCAL_DIR/discovery/ledger.md"

RESULT_FILE="$LOCAL_DIR/dummy-result.json"
echo "==> 2. Crafting dummy WorkResult ($RESULT_FILE)..."
cat <<EOF > "$RESULT_FILE"
{
  "schema_version": 1,
  "order_id": "$SLUG/r1-a1",
  "worker": "task-executor",
  "status": "partial",
  "task_results": [
    {
      "task_id": "TASK-001",
      "status": "partial",
      "notes": "Did the first thing, but got blocked.",
      "ac_results": [
        {
          "ac": "Do the thing",
          "result": "pass",
          "evidence": "Tested locally."
        }
      ]
    }
  ],
  "discoveries": [
    {
      "marker": "+",
      "line": "Found we need to refactor the dummy database.",
      "lens": "Architecture"
    }
  ],
  "escalates": [
    {
      "kind": "design-decision",
      "question": "Should we use PostgreSQL or SQLite for the dummy DB?",
      "blocked_ac": "Another AC",
      "context": "SQLite is faster for testing but Postgres is prod-like."
    }
  ],
  "files_touched": [
    {
      "path": "dummy-src/dummy.js",
      "change": "created",
      "lines": 10
    }
  ]
}
EOF

echo "==> 3. Running ingest-result.mjs..."
node skills/tech-lead/scripts/ingest-result.mjs "$RESULT_FILE" --cwd "$ROOT_DIR"

echo "==> 4. Verifying outputs:"
echo ""
echo "--- tasks/TASK-001.md ---"
cat "$LOCAL_DIR/tasks/TASK-001.md"
echo ""
echo "--- tasks/_index.md ---"
cat "$LOCAL_DIR/tasks/_index.md"
echo ""
echo "--- discovery/ledger.md ---"
cat "$LOCAL_DIR/discovery/ledger.md"
echo ""
echo "--- escalates/ ---"
ls -la "$LOCAL_DIR/escalates/"
cat "$LOCAL_DIR/escalates/r1-a1.json" || true
echo ""
echo "==> Done. Data flow simulation successful."
