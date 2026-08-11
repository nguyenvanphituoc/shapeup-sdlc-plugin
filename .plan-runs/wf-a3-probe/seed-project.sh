#!/bin/bash
# Kill/resume probe — leg 0: the scratch project, seeded from a script rather than by hand.
#
# Stage A2 did this by hand (stage-a2-evidence.md §7, "L0 by hand"), which is why re-running its
# probe was a rebuild rather than a repeat: the intake, the profile and the settings were gone with
# the project directory, and only the launch was committed. Everything the run reads is written
# here, so the next re-run differs from this one in NOTHING except the code under test.
#
# What this writes, and why each piece has to exist before the workflow can start:
#   package.json + src/server.js   a real (empty) composition root, so the profile's entry_point
#                                  resolves and trace-lint's reachability arm is not vacuous
#   .claude/settings.json          the pipeline permission grant + the CANDIDATE marketplace only
#   ~/.claude.json trust bit       finding #8: an untrusted workspace ignores permissions.allow
#   project-profile.md             tech-lead writes this at GATE L0; the probe launches the
#                                  workflow directly, so the probe writes it (archetype from the
#                                  enum — finding #11 records that `cli` is not in it)
#   init-run.mjs                   GATE L0.1: the receipt + ledger the workflow requires
#
# usage: seed-project.sh          (run install-candidate.sh first)
set -euo pipefail

PROBE="$(cd "$(dirname "$0")" && pwd)"
CANDIDATE="$PROBE/candidate"
PROJECT="$PROBE/project"
SLUG="todo-kill"
MARKETPLACE="a3probe-marketplace"

test -d "$CANDIDATE" || { echo "no candidate build — run install-candidate.sh first"; exit 1; }

echo "=== seeding $PROJECT ==="
rm -rf "$PROJECT"
mkdir -p "$PROJECT/src" "$PROJECT/.claude" "$PROJECT/shapeup/$SLUG"

cat > "$PROJECT/package.json" <<'JSON'
{
  "name": "todo-kill",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "A tiny todo service. Scratch project for the kill/resume probe.",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test"
  }
}
JSON

cat > "$PROJECT/src/server.js" <<'JS'
// The composition root. Empty on purpose: the build attaches every use case's engine here, and
// the wiring map declares that seam before a single scope is sliced.
import { createServer } from "node:http";

const server = createServer((req, res) => {
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found", path: req.url }));
});

if (process.env.NODE_ENV !== "test") {
  server.listen(process.env.PORT || 3000);
}

export { server };
JS

cat > "$PROJECT/README.md" <<'MD'
# todo-kill

Scratch project for the workflow-orchestrator kill/resume probe
(`docs/migration/stage-a3-plan.md`). Not shipped, not published — it exists to be built by the
harness, killed mid-BUILD, and resumed.
MD

cat > "$PROJECT/intake.md" <<'MD'
# Pitch — a todo service you can actually call

## Problem

Notes about what to do next live in three places and none of them are addressable. We want one
small HTTP service that holds a list of tasks, so anything else (a script, a cron, a UI later) can
read and change it over the network instead of parsing someone's markdown.

## Appetite

One small batch. If it does not fit, cut scope, not quality.

## Solution

A JSON-over-HTTP service on top of a single JSON file, with four things you can do:

- **Add a task** — POST a title, get back the task with an id and `done: false`.
- **List tasks** — GET the list, newest first, optionally filtered to the ones still open.
- **Complete a task** — mark one done by id; completing an already-done task is not an error.
- **Delete a task** — remove one by id; deleting a task that is not there answers 404, not 500.

Tasks persist across restarts in a JSON file next to the service. Concurrent writes must not lose a
task — the file is rewritten atomically, never appended to in place.

## Rabbit holes

- No auth, no users, no multi-tenancy. One list, one caller.
- No database. A JSON file is the storage decision, and it is deliberate.
- No UI. The affordance is the HTTP endpoint.

## No-gos

- No task scheduling, reminders, or recurrence.
- No search beyond the open/closed filter.
MD

cat > "$PROJECT/shapeup/$SLUG/project-profile.md" <<'MD'
---
schema_version: 1
archetype: web-service
entry_point: src/server.js
---

# Project profile — todo-kill

`src/server.js` is the composition root: every use case's engine attaches to it as a route
registration, and reachability is resolved from it through the import graph.

`archetype` is `web-service` from the declared enum (`client-only-game | web-service | mobile |
library | data-pipeline`). Recorded because it was nearly wrong: this is the shape of tool a run
would naturally call a CLI, and the enum has no `cli` member — execution-report.md finding #11.
MD

# The project's own settings: the pipeline grant, and the CANDIDATE marketplace ONLY. The published
# build must not be enabled here — it would resolve the same Skill(shapeup-sdlc-plugin:*) names and
# the probe would measure the control.
write_settings() {
  # $1 = the resolved plugin root to also grant by literal path, or "" for none yet.
  node -e '
const fs = require("fs");
const [file, candidate, marketplace, resolved] = process.argv.slice(1);
const WORKERS = ["tech-lead", "ba-pitch-analyzer", "spec-evaluator"];
const allow = [];
for (const w of WORKERS) allow.push("Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/" + w + "/scripts/:*)");
// The same grant spelled with the RESOLVED path too: shapeup-run.js roots every pipeline call at
// args.pluginRoot, and a ${CLAUDE_PLUGIN_ROOT} pattern does not match a spelled-out path.
if (resolved) for (const w of WORKERS) allow.push("Bash(node " + resolved + "/skills/" + w + "/scripts/:*)");
fs.writeFileSync(file, JSON.stringify({
  extraKnownMarketplaces: { [marketplace]: { source: { source: "directory", path: candidate } } },
  enabledPlugins: { ["shapeup-sdlc-plugin@" + marketplace]: true },
  permissions: { allow },
}, null, 2) + "\n");
' "$PROJECT/.claude/settings.json" "$CANDIDATE" "$MARKETPLACE" "${1:-}"
}
write_settings ""

# Finding #8: a fresh workspace is UNTRUSTED and the grant above is ignored in full — silently.
node -e '
const fs = require("fs");
const os = require("os");
const p = os.homedir() + "/.claude.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
const key = process.argv[1];
j.projects = j.projects || {};
j.projects[key] = { ...(j.projects[key] || {}), hasTrustDialogAccepted: true };
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
console.log("  trusted: " + key);
' "$PROJECT"

# DECLARING the marketplace in settings.json is not INSTALLING it — measured here, 2026-08-11:
# with the declaration alone, `claude -p` in this project saw zero shapeup-sdlc-plugin skills, so
# every Skill(shapeup-sdlc-plugin:*) dispatch the workflow makes would have failed. The two CLI
# calls below are what put the plugin in the cache and enable it for this project.
echo "=== installing the candidate plugin for this project ==="
(cd "$PROJECT" && claude plugin marketplace add "$CANDIDATE" --scope project 2>&1 | tail -1)
(cd "$PROJECT" && claude plugin install "shapeup-sdlc-plugin@$MARKETPLACE" --scope project 2>&1 | tail -1)

RESOLVED="$(node -e '
const fs = require("fs"), os = require("os");
const j = JSON.parse(fs.readFileSync(os.homedir() + "/.claude/plugins/installed_plugins.json", "utf8"));
const want = process.argv[1];
for (const [k, entries] of Object.entries(j.plugins)) {
  for (const e of entries) if (e.projectPath === want) { console.log(e.installPath); process.exit(0); }
}
process.exit(1);
' "$PROJECT")" || { echo "the plugin did not install for $PROJECT"; exit 1; }
echo "  resolved plugin root: $RESOLVED"

# The probe is worthless if the resolved tree is not the candidate (finding #10). Assert it on the
# one file the whole stage is about, then grant the pipeline scripts by their resolved path.
CAND_SHA="$(shasum -a 256 "$CANDIDATE/skills/tech-lead/workflows/shapeup-run.js" | cut -d' ' -f1)"
RES_SHA="$(shasum -a 256 "$RESOLVED/skills/tech-lead/workflows/shapeup-run.js" | cut -d' ' -f1)"
test "$CAND_SHA" = "$RES_SHA" || { echo "  RESOLVED TREE IS NOT THE CANDIDATE: $RES_SHA != $CAND_SHA"; exit 1; }
echo "  shapeup-run.js matches the candidate: ${CAND_SHA:0:16}…"
write_settings "$RESOLVED"
echo "$RESOLVED" > "$PROBE/plugin-root.txt"

echo "=== git init (the harness diffs against a tree, not a void) ==="
git -C "$PROJECT" init -q
git -C "$PROJECT" add -A
git -C "$PROJECT" -c user.email=probe@local -c user.name=probe commit -qm "todo-kill: scratch project for the kill/resume probe"

echo "=== GATE L0.1 — init-run.mjs ==="
node "$CANDIDATE/skills/tech-lead/scripts/init-run.mjs" \
  --intake-file "$PROJECT/intake.md" \
  --slug "$SLUG" \
  --auto-level unattended \
  --gate-answers ci \
  --max-rounds 2 \
  --attempts 3 \
  --cwd "$PROJECT"

echo "=== seeded. receipt: ==="
cat "$PROJECT/.shapeup/$SLUG/receipt.json"
