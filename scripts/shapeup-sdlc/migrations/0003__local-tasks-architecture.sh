#!/usr/bin/env bash
# Migration 0003 — local tasks architecture: tasks/ moves from the committed SHARED spec dir
# to the LOCAL gitignored root.
#
# Sourced by lib-migrate.sh's runner. Must define MIGRATION_DESC + migration_up(); must be
# idempotent (the runner only calls it once per project, but re-running by hand must be safe).
#
# Background (docs/plan/local-tasks-architecture.md):
#   OLD: ba-pitch-analyzer Phase 6 wrote docs/shapeup-sdlc/<slug>/spec/tasks/
#        {TASK-NNN*.md,_index.md} — committed alongside usecases/, domain-model.md, etc.
#        spec-evaluator graded against a task file's own AC checkboxes; tech-lead's GATE L1b
#        reviewed the committed board directly.
#   NEW: tasks/ is a LOCAL, gitignored, per-machine execution-planning artifact at
#        .shapeup-sdlc/<slug>/tasks/ — regenerable from the committed usecases/domain-model.md
#        via `ba-pitch-analyzer --tasks-only`. The SHARED spec now carries only usecases/,
#        domain-model.md, contracts/, scopes/, scope-summary.md. spec-evaluator grades against
#        usecases/domain-model.md (see its v0.9); GATE L1b reviews usecases/+scopes/
#        scope-summary instead of the raw board (see tech-lead v0.15).
# `ba-pitch-analyzer` Phase 6 already writes to the LOCAL root for a FRESH generation on
# plugin >= 3.2; this migration brings an EXISTING project's already-committed tasks/
# directories in line — one per feature slug found under docs/shapeup-sdlc/. `.shapeup-sdlc/`
# is already blanket-gitignored by every install (install-harness.sh) — no gitignore edit needed.

MIGRATION_DESC="Move pre-v3.2 committed docs/shapeup-sdlc/<slug>/spec/tasks/ to the LOCAL gitignored .shapeup-sdlc/<slug>/tasks/ root, per feature slug"

migration_up() {
  local target="$1"
  local shared_root="$target/docs/shapeup-sdlc"
  local moved=0 skipped=0

  if [ ! -d "$shared_root" ]; then
    echo "    no docs/shapeup-sdlc/ — nothing to migrate"
    return 0
  fi

  shopt -s nullglob
  local slug_dir slug old_tasks new_tasks_parent new_tasks
  for slug_dir in "$shared_root"/*/; do
    slug="$(basename "$slug_dir")"
    # Non-feature dirs living at this same root level (not a <slug>/ per SKILL.md convention).
    case "$slug" in
      metrics|knowledge-base) continue ;;
    esac

    old_tasks="${slug_dir}spec/tasks"
    [ -d "$old_tasks" ] || continue

    new_tasks_parent="$target/.shapeup-sdlc/$slug"
    new_tasks="$new_tasks_parent/tasks"

    if [ -d "$new_tasks" ]; then
      echo "    [skip] $slug — .shapeup-sdlc/$slug/tasks/ already exists (never overwrite);" \
           "leaving docs/shapeup-sdlc/$slug/spec/tasks/ in place for manual reconciliation"
      skipped=$((skipped + 1))
      continue
    fi

    mkdir -p "$new_tasks_parent"
    mv "$old_tasks" "$new_tasks"
    echo "    moved docs/shapeup-sdlc/$slug/spec/tasks/ -> .shapeup-sdlc/$slug/tasks/"
    moved=$((moved + 1))
  done
  shopt -u nullglob

  if [ "$moved" -eq 0 ] && [ "$skipped" -eq 0 ]; then
    echo "    no pre-v3.2 committed tasks/ directories found — fresh layout only"
  else
    echo "    $moved slug(s) migrated, $skipped skipped (destination already existed)"
  fi
  if [ "$moved" -gt 0 ]; then
    echo "    NOTE: the old docs/shapeup-sdlc/<slug>/spec/tasks/ paths are removed from the" \
         "working tree but still tracked by git until you 'git add -A docs/shapeup-sdlc/'" \
         "and commit the deletion."
  fi
}
