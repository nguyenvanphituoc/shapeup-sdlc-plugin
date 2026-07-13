#!/usr/bin/env bash
# Migration 0004 — pure-skill architecture (plugin v1.0.0).
#
# Sourced by lib-migrate.sh's runner. Must define MIGRATION_DESC + migration_up(); must be
# idempotent (the runner only calls it once per project, but re-running by hand must be safe).
#
# Background (docs/plan/pure-skill-architecture.md, CHANGELOG 1.0.0):
#   OLD: workers carried pipeline plumbing — tech-lead hand-assembled markdown briefs
#        (.shapeup-sdlc/<slug>/briefs/), workers wrote shared state themselves (run-state.md,
#        tasks/_index.md, the discovery ledger), ba-pitch-analyzer selected behavior via 15
#        lifecycle flags, and `unlocks` was hand-authored per task (source of the KB-BA-001
#        asymmetric edges).
#   NEW: every dispatch is a WorkOrder/WorkResult envelope (orders/ + results/, created on
#        demand); ingest-result.mjs is the single writer of shared state; scripts ship INSIDE
#        their owning skill (skills/tech-lead/scripts|schemas/, skills/ba-pitch-analyzer/
#        scripts/); `unlocks` is DERIVED (board-derive.mjs --write) and spec-lint hard-reds an
#        asymmetric edge; the new scope-architect skill owns scopes/*.json.
#
# The skill-code half of the upgrade is migrate.sh step 1 (harness_replace_skills — it copies
# the whole skills/ tree, so the bundled scripts/schemas and the new scope-architect skill
# arrive with it). This migration brings the project's STATEFUL artifacts in line:
#   1. Refresh the AGENTS.md harness block (<!-- HARNESS_START/END -->) — the old block
#      documents retired flags (`--tasks-only`, `--brief`, …) an agent would still try to use.
#      migrate.sh itself never touches AGENTS.md; only install-harness.sh did, on install.
#   2. Recompute `unlocks` on every existing LOCAL board (depends_on inverse) so pre-v1.0
#      hand-authored edges don't trip spec-lint's EDGE-SYMMETRY red on the next run.
#   3. Flag (never delete) retired run-trace artifacts: briefs/ and worker-written
#      run-state.md are dead formats — both LOCAL and gitignored, left in place for audit.

MIGRATION_DESC="Pure-skill architecture (v1.0): refresh AGENTS.md harness block, derive unlocks on existing local boards, flag retired briefs/run-state artifacts"

migration_up() {
  local target="$1"

  # -- 1. Refresh the AGENTS.md harness block from the source template -------------------------
  local agents_src="$HARNESS_SOURCE_DIR/AGENTS.md"
  local agents_dst="$target/AGENTS.md"
  if [ ! -f "$agents_src" ]; then
    echo "    [skip] source AGENTS.md not found — harness block not refreshed"
  elif [ ! -f "$agents_dst" ]; then
    echo "    [skip] project has no AGENTS.md (never installed the harness block?)"
  elif grep -qF '<!-- HARNESS_START -->' "$agents_dst" 2>/dev/null; then
    local tmp_rest
    tmp_rest="$(mktemp)"
    # Keep everything OUTSIDE the marked block; the new block goes back on top
    # (same shape install-harness.sh uses).
    awk '
      /<!-- HARNESS_START -->/ { skip=1; next }
      /<!-- HARNESS_END -->/   { skip=0; next }
      !skip { print }
    ' "$agents_dst" > "$tmp_rest"
    # `sed '/./,$!d'` strips the remainder's leading blank lines so re-running is byte-stable
    # (the separator blank line would otherwise accumulate).
    { cat "$agents_src"; echo ""; sed '/./,$!d' "$tmp_rest"; } > "$agents_dst"
    rm -f "$tmp_rest"
    echo "    refreshed AGENTS.md harness block (envelope port, scope-architect, operations)"
  else
    echo "    [skip] AGENTS.md has no <!-- HARNESS_START --> block — leaving user file untouched;"
    echo "           re-run install-harness.sh if you want the v1.0 harness instructions appended"
  fi

  # -- 2. Recompute `unlocks` (depends_on inverse) on every existing LOCAL board ---------------
  local derive="$HARNESS_SOURCE_DIR/skills/ba-pitch-analyzer/scripts/board-derive.mjs"
  local local_root="$target/.shapeup-sdlc"
  local derived=0
  if [ ! -d "$local_root" ]; then
    echo "    no .shapeup-sdlc/ — no local boards to derive"
  elif [ ! -f "$derive" ]; then
    echo "    [skip] board-derive.mjs not found in source — run it manually per slug later:"
    echo "           node skills/ba-pitch-analyzer/scripts/board-derive.mjs --slug <slug> --write"
  elif ! command -v node >/dev/null 2>&1; then
    echo "    [skip] node not available — run board-derive.mjs --write per slug once it is;"
    echo "           until then spec-lint may flag EDGE-SYMMETRY on pre-v1.0 boards"
  else
    shopt -s nullglob
    local slug_dir slug
    for slug_dir in "$local_root"/*/; do
      slug="$(basename "$slug_dir")"
      [ -f "${slug_dir}tasks/_index.md" ] || continue
      if node "$derive" --slug "$slug" --cwd "$target" --write >/dev/null 2>&1; then
        echo "    derived unlocks on .shapeup-sdlc/$slug/tasks/ (depends_on inverse, KB-BA-001)"
        derived=$((derived + 1))
      else
        echo "    [warn] board-derive failed for $slug — inspect with:"
        echo "           node \"$derive\" --slug $slug --cwd \"$target\" --write"
      fi
    done
    shopt -u nullglob
    [ "$derived" -eq 0 ] && echo "    no local boards found — nothing to derive"
  fi

  # -- 3. Flag retired run-trace formats (LOCAL + gitignored; never deleted) -------------------
  if [ -d "$local_root" ]; then
    shopt -s nullglob
    local slug_dir slug flagged=0
    for slug_dir in "$local_root"/*/; do
      slug="$(basename "$slug_dir")"
      if [ -d "${slug_dir}briefs" ]; then
        echo "    NOTE: .shapeup-sdlc/$slug/briefs/ is a retired format (v1.0 compiles WorkOrder"
        echo "          envelopes to orders/ instead) — left in place for audit; safe to delete."
        flagged=$((flagged + 1))
      fi
      if [ -f "${slug_dir}run-state.md" ]; then
        echo "    NOTE: .shapeup-sdlc/$slug/run-state.md is no longer read or written by any"
        echo "          worker (D6 closed) — harness-run.md is the run record; safe to delete."
        flagged=$((flagged + 1))
      fi
    done
    shopt -u nullglob
    [ "$flagged" -eq 0 ] && echo "    no retired briefs/run-state artifacts found"
  fi

  echo "    reminder: orders/ and results/ under .shapeup-sdlc/<slug>/ are created on demand —"
  echo "    no directory scaffolding needed."
}
