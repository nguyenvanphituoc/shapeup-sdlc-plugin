#!/usr/bin/env bash
# Migration 0009 — v1.6.0. The contract parsers were repaired; find what they now reject.
#
# Sourced by lib-migrate.sh's runner. Must define MIGRATION_DESC + migration_up(); must be
# idempotent (the runner only calls it once per project, but re-running by hand must be safe).
#
# WHY THIS MIGRATION EXISTS, AND WHY IT WRITES NOTHING.
#
# v1.6.0 fixes five defects in one family — the committed contract format failing SILENT — plus one
# schema tightening. Every one of them is a change to a READER. The code arrives with the upgrade;
# what does not arrive is the knowledge of which of YOUR existing files those readers will now treat
# differently, and in two cases the change is from "green" to "red":
#
#   HD-001/HD-005  A committed contract whose table the parser could not see used to read as a
#                  contract that declared NOTHING, and every rule downstream then passed over it.
#                  `trace-lint` printed a green `0/0 engines reach <entry>` for a wiring map holding
#                  six correct rows. From v1.6.0 an unreadable contract is RED and reachability is
#                  not claimed, because none was checked. A file that passed L1a.5 yesterday can
#                  stop passing today — that is the fix working, and you should meet it here rather
#                  than at a gate.
#   HD-002         A quoted list member was split on its own commas, turning one honest note into
#                  several bogus entries on a field `t0-verify` EXECUTES. The split already happened
#                  in any contract written through the old round trip; the data is gone and cannot
#                  be restored by guessing. Suspicious members are named for a human to read.
#   CriterionVerdict  A FAIL now REQUIRES a `file:line` locator. A stored result carrying a FAIL
#                  without one is rejected by `validate-envelope` before ingest sees it, so a run
#                  interrupted mid-round must re-evaluate rather than resume.
#
# It REPORTS and does not rewrite. Two of the three are unrecoverable by machine (HD-002's split
# members, an un-located FAIL), and the third — inserting a heading above a table — is a rewrite of
# a committed design document that a human should make and review. 0008's rule applies: deleting or
# rewriting a teammate's committed analysis on their behalf is not a migration's call.

MIGRATION_DESC="v1.6.0: report the committed contracts, list members and stored results that the repaired parsers now reject (writes nothing)"

migration_up() {
  local target="$1"
  local found=0

  if [ ! -d "$target/shapeup" ] && [ ! -d "$target/.shapeup" ]; then
    echo "    [skip] no shapeup/ or .shapeup/ — nothing this release reads differently"
    return 0
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "    [skip] node not available — cannot scan; re-run after installing node, or run"
    echo "           \`node \"\$CLAUDE_PLUGIN_ROOT/skills/tech-lead/scripts/trace-lint.mjs\" --slug <slug>\`"
    return 0
  fi

  local plugin_root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
  local lib_path="$plugin_root/skills/tech-lead/scripts/lib/contract-md.mjs"
  if [ ! -f "$lib_path" ]; then
    echo "    [skip] contract-md.mjs not found at $lib_path — cannot scan"
    return 0
  fi

  # A temp DIRECTORY, not `mktemp -t ….mjs`: BSD mktemp appends its suffix AFTER the template, so
  # the extension is lost and Node refuses the file with ERR_UNKNOWN_FILE_EXTENSION. (Learned in 0007.)
  local scan_dir scanner
  scan_dir="$(mktemp -d)"
  scanner="$scan_dir/scan.mjs"

  cat > "$scanner" <<'MJS'
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const target = process.env.HARNESS_TARGET;
const { parseContract, unreadableReason, splitFrontmatter, SCOPE_CONTRACT, WIRING_MAP, PROJECT_PROFILE } =
  await import(process.env.HARNESS_CONTRACT_LIB);

const dirs = (p) => (existsSync(p) ? readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()) : []);
const out = [];

// A member that reads like prose rather than a path, glob or id is what HD-002's comma split left
// behind. Heuristic on purpose, and reported as one: it names candidates for a human to read, and
// a false positive costs a glance.
const looksLikeProse = (m) =>
  m.includes(" ") && !/[/*]/.test(m) && !/^[A-Za-z]+-[\w.]+$/.test(m) && !/\.\w{1,5}$/.test(m);

for (const slug of dirs(join(target, "shapeup"))) {
  const root = join(target, "shapeup", slug);

  const contracts = [];
  const scopesDir = join(root, "scopes");
  if (existsSync(scopesDir))
    for (const f of readdirSync(scopesDir).filter((f) => f.endsWith(".md")))
      contracts.push([join("shapeup", slug, "scopes", f), join(scopesDir, f), SCOPE_CONTRACT]);
  if (existsSync(join(root, "wiring-map.md")))
    contracts.push([join("shapeup", slug, "wiring-map.md"), join(root, "wiring-map.md"), WIRING_MAP]);
  if (existsSync(join(root, "project-profile.md")))
    contracts.push([join("shapeup", slug, "project-profile.md"), join(root, "project-profile.md"), PROJECT_PROFILE]);

  for (const [rel, abs, spec] of contracts) {
    let md;
    try { md = readFileSync(abs, "utf8"); } catch { continue; }
    let c;
    try { c = parseContract(md, spec); } catch (e) { out.push(["UNREADABLE", rel, String(e.message || e)]); continue; }
    const why = unreadableReason(c);
    if (why) out.push(["UNREADABLE", rel, why]);
    let meta = {};
    try { meta = splitFrontmatter(md).meta || {}; } catch { /* frontmatter unreadable is covered above */ }
    for (const [k, v] of Object.entries(meta)) {
      if (!Array.isArray(v)) continue;
      const odd = v.map(String).filter(looksLikeProse);
      if (odd.length) out.push(["SPLIT?", rel, `${k}: ${odd.map((m) => JSON.stringify(m)).join(", ")}`]);
    }
  }
}

for (const slug of dirs(join(target, ".shapeup"))) {
  const rdir = join(target, ".shapeup", slug, "results");
  if (!existsSync(rdir)) continue;
  for (const f of readdirSync(rdir).filter((f) => f.endsWith(".json"))) {
    let r;
    try { r = JSON.parse(readFileSync(join(rdir, f), "utf8")); } catch { continue; }
    for (const cv of r?.verdict?.criteria || []) {
      if (cv?.verdict !== "FAIL") continue;
      if (!/:\d+/.test(String(cv.evidence ?? ""))) out.push(["NO-LOCATOR", join(".shapeup", slug, "results", f), String(cv.criterion ?? "(unnamed)").slice(0, 70)]);
    }
  }
}

for (const [kind, where, detail] of out) console.log(`${kind}\t${where}\t${detail}`);
console.log(`COUNT ${out.length}`);
MJS

  local report
  report="$(HARNESS_TARGET="$target" HARNESS_CONTRACT_LIB="file://$lib_path" node "$scanner" 2>&1)" || {
    echo "    [skip] scan failed — nothing was changed:"
    echo "$report" | sed 's/^/      /'
    rm -rf "$scan_dir"
    return 0
  }
  rm -rf "$scan_dir"

  while IFS=$'\t' read -r kind where detail; do
    case "$kind" in
      UNREADABLE)
        found=1
        echo "    [RED from v1.6.0] $where"
        echo "        $detail"
        echo "        This parsed as 'declared nothing' before, so every rule over it passed. Give the"
        echo "        table the heading the contract names, then re-run trace-lint / spec-lint."
        ;;
      "SPLIT?")
        found=1
        echo "    [check by hand] $where"
        echo "        $detail"
        echo "        Members that read as prose, which is what HD-002's comma split left behind. If one"
        echo "        sentence was cut into several entries, rewrite it as one quoted member."
        ;;
      NO-LOCATOR)
        found=1
        echo "    [rejected from v1.6.0] $where"
        echo "        FAIL criterion without a file:line locator — \"$detail\""
        echo "        Re-run the evaluation for this round; the stored result can no longer be ingested."
        ;;
    esac
  done <<< "$(echo "$report" | grep -v '^COUNT ')"

  if [ "$found" -eq 0 ]; then
    echo "    nothing to report — every committed contract reads cleanly under the repaired parsers"
  fi

  # The model matrix. The shipped template moved off haiku; a member's own settings.local.json is
  # gitignored and per-machine, so no upgrade reaches it, and changing someone's model choice for
  # them is not a migration's business. Say it, once.
  local local_settings="$target/.claude/settings.local.json"
  if [ -f "$local_settings" ] && grep -q '"haiku"' "$local_settings" 2>/dev/null; then
    echo "    [notice] .claude/settings.local.json still names haiku in the model matrix."
    echo "        The shipped default moved to sonnet in v1.6.0 (QA lane and digester fallback)."
    echo "        Left alone deliberately — it is your machine's choice, not the upgrade's."
  fi

  return 0
}
