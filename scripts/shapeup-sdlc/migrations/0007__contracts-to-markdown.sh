#!/usr/bin/env bash
# Migration 0007 — ADR-0001, contracts become markdown.
#
# Sourced by lib-migrate.sh's runner. Must define MIGRATION_DESC + migration_up(); must be
# idempotent (the runner only calls it once per project, but re-running by hand must be safe).
#
# WHAT CHANGED.
#
#   shapeup/<slug>/scopes/*.json        →  scopes/*.md
#   shapeup/<slug>/wiring-map.json      →  wiring-map.md
#   shapeup/<slug>/project-profile.json →  project-profile.md
#
# The three committed contracts are LOW-LEVEL DESIGN — which files a slice may touch, which seam
# each use case attaches to, where the app starts. As `.json` they sat unread in the tier meant
# for prose. As markdown they carry frontmatter for the scalars, a table for the one
# array-of-objects field, and a paragraph of rationale a reviewer actually reads.
#
# WHY THIS MIGRATION IS OPTIONAL RATHER THAN URGENT. `lib/contract-md.mjs` reads BOTH forms, and
# markdown wins when both exist. A project that never runs this keeps working; it just keeps
# contracts nobody reviews. Converting is the point, not a prerequisite.
#
# WHAT IT DOES NOT DO. It does not `git add`, `git rm` or commit — see 0006. It also does not
# delete the `.json` unless the `.md` was written successfully, so a failure leaves the project on
# the old form rather than with no contract at all.

MIGRATION_DESC="ADR-0001: convert committed scope contracts, wiring map and project profile from JSON to markdown"

migration_up() {
  local target="$1"

  if ! command -v node >/dev/null 2>&1; then
    echo "    [skip] node not available — contracts stay JSON (still readable; convert later)"
    return 0
  fi

  local plugin_root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
  # A temp DIRECTORY, not `mktemp -t …​.mjs`: BSD mktemp appends its random suffix AFTER the
  # template, so the extension is lost and Node refuses the file with ERR_UNKNOWN_FILE_EXTENSION.
  local converter_dir converter
  converter_dir="$(mktemp -d)"
  converter="$converter_dir/convert.mjs"

  cat > "$converter" <<'MJS'
// Convert every committed contract in a project from JSON to markdown, in place.
import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const target = process.env.HARNESS_TARGET;
const lib = process.env.HARNESS_CONTRACT_LIB;
const { renderContract, SCOPE_CONTRACT, WIRING_MAP, PROJECT_PROFILE } = await import(lib);

const shared = join(target, "shapeup");
if (!existsSync(shared)) { console.log("NOSHARED"); process.exit(0); }

let converted = 0, skipped = 0;

/** Convert one .json contract to .md, then remove the source — never before the write succeeds. */
function convert(jsonPath, spec, title) {
  const mdPath = jsonPath.replace(/\.json$/, ".md");
  if (existsSync(mdPath)) { skipped++; return; }
  let obj;
  try { obj = JSON.parse(readFileSync(jsonPath, "utf8")); }
  catch { console.log(`  ! unparseable, left as-is: ${jsonPath.slice(target.length + 1)}`); skipped++; return; }
  writeFileSync(mdPath, renderContract(obj, spec, { title }));
  rmSync(jsonPath);
  converted++;
  console.log(`  ${jsonPath.slice(target.length + 1)} -> ${mdPath.slice(target.length + 1).split("/").pop()}`);
}

for (const slug of readdirSync(shared)) {
  const slugDir = join(shared, slug);
  if (!statSync(slugDir).isDirectory()) continue;

  const scopesDir = join(slugDir, "scopes");
  if (existsSync(scopesDir)) {
    for (const f of readdirSync(scopesDir).filter((n) => n.endsWith(".json"))) {
      convert(join(scopesDir, f), SCOPE_CONTRACT, `${f.replace(/\.json$/, "")} — scope contract`);
    }
  }
  const wiring = join(slugDir, "wiring-map.json");
  if (existsSync(wiring)) convert(wiring, WIRING_MAP, `${slug} — wiring map`);
  const profile = join(slugDir, "project-profile.json");
  if (existsSync(profile)) convert(profile, PROJECT_PROFILE, `${slug} — project profile`);
}
console.log(`RESULT ${converted} ${skipped}`);
MJS

  local lib_path="$plugin_root/skills/tech-lead/scripts/lib/contract-md.mjs"
  if [ ! -f "$lib_path" ]; then
    echo "    [skip] contract-md.mjs not found at $lib_path — contracts stay JSON"
    rm -rf "$converter_dir"
    return 0
  fi

  local out
  out="$(HARNESS_TARGET="$target" HARNESS_CONTRACT_LIB="file://$lib_path" node "$converter" 2>&1)" || {
    echo "    [skip] conversion failed, contracts left as JSON (still readable):"
    echo "$out" | sed 's/^/      /'
    rm -rf "$converter_dir"
    return 0
  }
  rm -rf "$converter_dir"

  if echo "$out" | grep -q "NOSHARED"; then
    echo "    [skip] no shapeup/ directory — nothing to convert (run migration 0006 first)"
    return 0
  fi

  echo "$out" | grep -v "^RESULT" | sed 's/^/    /'
  local counts
  counts="$(echo "$out" | grep "^RESULT" | awk '{print $2" converted, "$3" skipped"}')"
  echo "    ${counts:-0 converted}"
  echo "    NOTE: review 'git status' — the .json files are gone and .md files are new; commit the pair together."
}
