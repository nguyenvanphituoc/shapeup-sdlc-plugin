#!/bin/bash
# Kill/resume probe — install THIS worktree as the plugin the probe runs against, and prove it.
#
# Two measured traps this closes (execution-report.md findings #8 and #10). Both fail SILENTLY, and
# both make the probe measure the published control while reporting on the candidate:
#   #10  `npx shapeup-sdlc init` re-adds the marketplace by `repo` and clones it from GitHub over a
#        local install — a spelling that looks local and resolves remote. So this script never calls
#        it: it packs, unpacks, RENAMES the marketplace, and writes the project settings itself.
#   #8   a freshly-created project is UNTRUSTED, so `permissions.allow` is ignored in full and every
#        pipeline script falls back to the safety classifier. seed-project.sh sets the trust bit.
#
# The candidate carries its own version and its own marketplace name, so it cannot be confused with
# — or overwritten by — the published nvptuoc-marketplace build.
#
# usage: install-candidate.sh
set -euo pipefail

PROBE="$(cd "$(dirname "$0")" && pwd)"
WORKTREE="$(cd "$PROBE/../.." && pwd)"
CANDIDATE="$PROBE/candidate"
VERSION="1.6.3-a3probe"
MARKETPLACE="a3probe-marketplace"

# The plugin CACHE is what `Skill(shapeup-sdlc-plugin:*)` resolves, and `claude plugin install` is a
# no-op when a directory for that version already exists — so a rebuilt candidate installs "fine"
# and the run keeps executing the PREVIOUS build. Measured here on the A3 fix's first re-pack: the
# candidate carried the change, the cache did not, and only seed-project.sh's hash assertion said so.
# Purging the cached version makes the install a copy again.
echo "=== purging the cached install ==="
rm -rf "$HOME/.claude/plugins/cache/$MARKETPLACE"

echo "=== packing $WORKTREE ==="
rm -rf "$CANDIDATE"
mkdir -p "$CANDIDATE"
TARBALL="$(cd "$WORKTREE" && npm pack --silent --pack-destination "$PROBE")"
tar -xzf "$PROBE/$TARBALL" -C "$CANDIDATE" --strip-components=1
rm -f "$PROBE/$TARBALL"

# Stamp identity BEFORE the hash check, and exclude exactly these two files from it.
node -e '
const fs = require("fs");
const [dir, version, marketplace] = process.argv.slice(1);
const plugin = JSON.parse(fs.readFileSync(dir + "/.claude-plugin/plugin.json", "utf8"));
plugin.version = version;
fs.writeFileSync(dir + "/.claude-plugin/plugin.json", JSON.stringify(plugin, null, 2) + "\n");
const mk = JSON.parse(fs.readFileSync(dir + "/.claude-plugin/marketplace.json", "utf8"));
mk.name = marketplace;
fs.writeFileSync(dir + "/.claude-plugin/marketplace.json", JSON.stringify(mk, null, 2) + "\n");
console.log("  stamped " + plugin.name + "@" + marketplace + " " + version);
' "$CANDIDATE" "$VERSION" "$MARKETPLACE"

echo "=== verifying every packed file against the worktree (sha256) ==="
node -e '
const { createHash } = require("crypto");
const { readdirSync, readFileSync, statSync, existsSync } = require("fs");
const { join, relative } = require("path");
const [worktree, candidate] = process.argv.slice(1);
// The two manifests were just re-stamped on purpose; everything else must be byte-identical.
const STAMPED = new Set([".claude-plugin/plugin.json", ".claude-plugin/marketplace.json"]);
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const bad = [];
let checked = 0;
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const abs = join(dir, e);
    if (statSync(abs).isDirectory()) { walk(abs); continue; }
    const rel = relative(candidate, abs);
    if (STAMPED.has(rel) || rel === "package.json") continue;   // package.json carries the version too
    const source = join(worktree, rel);
    if (!existsSync(source)) { bad.push(rel + " — packed but absent from the worktree"); continue; }
    checked++;
    if (sha(abs) !== sha(source)) bad.push(rel + " — differs from the worktree");
  }
})(candidate);
if (bad.length) { console.error("  MISMATCH:\n    " + bad.join("\n    ")); process.exit(1); }
console.log("  " + checked + " files byte-identical to the worktree");
' "$WORKTREE" "$CANDIDATE"

# The one file the probe exists to exercise — named explicitly, so a pack that silently dropped it
# (measured at run 5: shapeup-run.js and resume-state.mjs were ABSENT from the resolved root) is a
# stop rather than a surprise mid-leg.
for f in skills/tech-lead/workflows/shapeup-run.js skills/tech-lead/scripts/resume-state.mjs; do
  test -f "$CANDIDATE/$f" || { echo "  MISSING from the candidate: $f"; exit 1; }
  echo "  present: $f  $(shasum -a 256 "$CANDIDATE/$f" | cut -c1-16)…"
done

echo "=== candidate ready: $CANDIDATE ($VERSION, marketplace $MARKETPLACE) ==="
