#!/usr/bin/env bash
# Migration 0005 — v1.4.1 enforcement layer.
#
# Sourced by lib-migrate.sh's runner. Must define MIGRATION_DESC + migration_up(); must be
# idempotent (the runner only calls it once per project, but re-running by hand must be safe).
#
# WHAT v1.4.1 CHANGED, AND WHY ANY OF IT NEEDS A MIGRATION AT ALL.
#
# Most of v1.4.1 is code — the `is-main.mjs` entry-point guard fixed across 26 files, three new
# hooks (gate-zerowork, gate-intake, gate-deadline), init-run.mjs, gate-answers.mjs, fit-check.mjs,
# budget-check.mjs. All of that arrives with `harness_replace_skills` in migrate.sh step 1 and
# needs nothing from this file.
#
# Two things do NOT arrive that way, because they are STATE in the target project rather than code
# in the plugin:
#
#   1. THE PIPELINE PERMISSION GRANT. The harness's scripts ship with the plugin, so they live
#      OUTSIDE the project. Under any permission mode short of bypassPermissions, running a script
#      from outside the working directory needs approval — once per session interactively, and
#      NEVER in a headless run, where nobody is there to grant it. `npx shapeup-sdlc init` writes
#      the grant into .claude/settings.json for a FRESH install. An UPGRADING project never runs
#      bin/init.mjs — it runs migrate.sh — so without this step it upgrades to a v1.4.1 that
#      cannot take its own first step. init-run.mjs is GATE L0.1, the mandatory first call that
#      writes the receipt everything else derives from; denied, the run has no receipt, and the new
#      gate-zerowork Stop gate then blocks the session for having done nothing. Measured on the
#      benchmark before the grant existed: 26 approval denials in one session.
#
#   2. THE PRE-1.4.1 `active-scope` POINTER. `.shapeup-sdlc/active-scope` is NOT new — it has
#      existed since v0.3 as the sandbox guard's "which scope is being built right now" pointer,
#      and nothing has ever cleared it, because nothing needed to: sandbox-guard fails OPEN when
#      the pointer names a scope contract that no longer exists.
#
#      v1.4.1 gives the same file a second reader with the opposite disposition. session-rehydrate
#      now runs at SessionStart on `startup` and `clear` (not only compact/resume), and when it
#      finds a pointer it injects "A shapeup-sdlc run is ALREADY OPEN in this workspace and you
#      have no memory of it. Do NOT open a new run, re-run intake, or restart the pipeline from
#      phase 1." A pointer left behind by a run that finished months ago will therefore hijack
#      every new session in that project — including sessions that have nothing to do with the
#      harness. Pre-1.4.1 runs are the worst case: they have no receipt.json (v1.4.1 introduced
#      it), so the resume path the injected text orders the agent onto does not exist for them.
#
# SCOPE, STATED HONESTLY. Step 2 reconciles LEGACY state, once. It is not a fix for the ongoing
# case — a v1.4.1 run that ships today still leaves its pointer behind, and the next cold session
# still reads it as an open run. That is a code defect in session-rehydrate/run-snapshot (nothing
# clears the pointer on ship; deriveSnapshot does not filter on run status) and it has to be fixed
# in the hook, not here. A migration that ran every session would be a hook; this one runs once.
#
# Nothing is deleted. Step 2 parks the pointer beside itself and step 3 only prints.

MIGRATION_DESC="v1.4.1 enforcement layer: grant the pipeline-script permission an upgrade never receives, park a pre-1.4.1 active-scope pointer the new cold-start reflex would read as an open run, flag receipt-less legacy runs"

migration_up() {
  local target="$1"

  # -- 1. The pipeline permission grant --------------------------------------------------------
  # Same three prefixes bin/init.mjs merges for a fresh install, kept deliberately narrow: the
  # harness's own deterministic, dependency-free, network-free scripts and nothing else. NOT a
  # general Bash(node:*), which is a much larger ask for a much smaller reason.
  local settings_dir="$target/.claude"
  local settings_file="$settings_dir/settings.json"

  if ! command -v node >/dev/null 2>&1; then
    echo "    [skip] node not available — add the pipeline grant to .claude/settings.json by hand:"
    echo "           permissions.allow += Bash(node \${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/:*)"
    echo "           (and the same for ba-pitch-analyzer and spec-evaluator)"
  else
    mkdir -p "$settings_dir"
    local merge_script
    merge_script="$(mktemp -t harness-mig-0005-XXXXXX.cjs)"
    # Quoted heredoc: ${CLAUDE_PLUGIN_ROOT} must reach the JSON LITERALLY, not expanded by bash.
    cat > "$merge_script" <<'CJS'
const { readFileSync, writeFileSync, existsSync } = require("node:fs");

const file = process.env.HARNESS_SETTINGS_FILE;
const PREFIXES = [
  "node ${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/",
  "node ${CLAUDE_PLUGIN_ROOT}/skills/ba-pitch-analyzer/scripts/",
  "node ${CLAUDE_PLUGIN_ROOT}/skills/spec-evaluator/scripts/",
];

let settings = {};
if (existsSync(file)) {
  const raw = readFileSync(file, "utf8").trim();
  if (raw) {
    try {
      settings = JSON.parse(raw);
    } catch {
      // A settings.json we cannot parse is a user file we must not rewrite. Refuse, loudly.
      console.log("UNPARSABLE");
      process.exit(3);
    }
  }
}

settings.permissions = settings.permissions || {};
const allow = new Set(settings.permissions.allow || []);
const before = allow.size;
for (const p of PREFIXES) allow.add(`Bash(${p}:*)`);
if (allow.size === before) {
  console.log("ALREADY");
  process.exit(0);
}
settings.permissions.allow = [...allow];
writeFileSync(file, JSON.stringify(settings, null, 2) + "\n", "utf8");
console.log("MERGED " + (allow.size - before));
CJS

    # NB: `rc`, not `status` — `status` is a read-only special in zsh, and a migration that is
    # only ever correct under bash is a migration that dies half-applied the one time someone
    # sources it by hand.
    local out rc
    # The runner invokes us as `( set -e; . "$f"; migration_up "$target" )`, so a bare
    # `out="$(node …)"` would ABORT THE WHOLE MIGRATION the moment node exits non-zero — and
    # exit 3 is a case we deliberately tolerate (an unparsable user settings.json we refuse to
    # rewrite). Aborting there would strand steps 2-4 and report the upgrade as failed. The `if`
    # condition suspends errexit, which is the only reason this reads the way it does.
    if out="$(HARNESS_SETTINGS_FILE="$settings_file" node "$merge_script" 2>&1)"; then rc=0; else rc=$?; fi
    rm -f "$merge_script"

    case "$rc:$out" in
      0:ALREADY)
        echo "    .claude/settings.json already grants the pipeline scripts — nothing to merge" ;;
      0:MERGED*)
        echo "    granted the pipeline scripts in .claude/settings.json (${out#MERGED } prefix(es) added)"
        echo "      tech-lead, ba-pitch-analyzer and spec-evaluator scripts only — not Bash(node:*)" ;;
      3:UNPARSABLE)
        echo "    [warn] .claude/settings.json is not valid JSON — left untouched. Add by hand:"
        echo "           \"permissions\": { \"allow\": [\"Bash(node \${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/:*)\", …] }"
        echo "           See .claude/settings.local.example.json for the full block." ;;
      *)
        echo "    [warn] could not merge the permission grant (node exit $status): $out" ;;
    esac
  fi

  # -- 2. Reconcile a pre-1.4.1 active-scope pointer -------------------------------------------
  # Only a pointer whose run has NO receipt.json is pre-1.4.1 and therefore not resumable by the
  # new machinery. A pointer with a receipt belongs to a v1.4.1 run and is left alone — it may be
  # genuinely mid-flight, and stealing it would break the resume this version exists to enable.
  local local_root="$target/.shapeup-sdlc"
  local pointer="$local_root/active-scope"

  if [ ! -f "$pointer" ]; then
    echo "    no .shapeup-sdlc/active-scope — nothing for the cold-start reflex to misread"
  else
    local slug=""
    if command -v node >/dev/null 2>&1; then
      slug="$(HARNESS_POINTER="$pointer" node -e '
        const { readFileSync } = require("node:fs");
        try { process.stdout.write(String(JSON.parse(readFileSync(process.env.HARNESS_POINTER, "utf8")).slug || "")); }
        catch { process.stdout.write(""); }
      ' 2>/dev/null)"
    fi

    if [ -z "$slug" ]; then
      echo "    [warn] .shapeup-sdlc/active-scope is unreadable or names no slug — left in place."
      echo "           session-rehydrate fails open on an unparsable pointer, so this is inert."
    elif [ -f "$local_root/$slug/receipt.json" ]; then
      echo "    active-scope points at \"$slug\", which HAS a receipt — a v1.4.1 run, left in place"
      echo "      (if that run is finished, delete .shapeup-sdlc/active-scope by hand)"
    else
      mv "$pointer" "$pointer.pre-1.4.1"
      echo "    parked .shapeup-sdlc/active-scope → active-scope.pre-1.4.1 (pointed at \"$slug\","
      echo "      which has no receipt.json, so it predates v1.4.1 and cannot be resumed). Left in"
      echo "      place it would have made every new session in this project open with \"a run is"
      echo "      ALREADY OPEN … do NOT open a new run\". Restore with: mv it back."
    fi
  fi

  # -- 3. Flag receipt-less legacy runs (never delete) -----------------------------------------
  if [ ! -d "$local_root" ]; then
    echo "    no .shapeup-sdlc/ — no legacy runs to flag"
  else
    shopt -s nullglob
    local slug_dir legacy=0
    for slug_dir in "$local_root"/*/; do
      [ -f "${slug_dir}harness-run.md" ] || continue
      if [ ! -f "${slug_dir}receipt.json" ]; then
        echo "    NOTE: .shapeup-sdlc/$(basename "$slug_dir")/ has no receipt.json — a pre-v1.4.1 run."
        echo "          It is LOCAL and gitignored; left in place for audit, safe to delete. The new"
        echo "          resume path (init-run.mjs exit 3) derives from the receipt, so this run"
        echo "          cannot be resumed — re-open it with a fresh /ship if you still want it."
        legacy=$((legacy + 1))
      fi
    done
    shopt -u nullglob
    [ "$legacy" -eq 0 ] && echo "    no receipt-less legacy runs found"
  fi

  # -- 4. The example settings template gained the permissions block ---------------------------
  # Tier C, user-owned: 0002 installs it only when absent and we do not overwrite an edited copy.
  local example="$target/.claude/settings.local.example.json"
  if [ -f "$example" ] && ! grep -q '"permissions"' "$example" 2>/dev/null; then
    echo "    NOTE: .claude/settings.local.example.json predates the v1.4.1 permissions block."
    echo "          Yours is a user-owned template so it was not overwritten; copy the block from"
    echo "          the plugin's .claude/settings.local.example.json if you want it documented there."
  fi
}
