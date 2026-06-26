#!/usr/bin/env bash
# Migration 0001 — flat knowledge base → committed per-skill knowledge base.
#
# Sourced by lib-migrate.sh's runner. Must define MIGRATION_DESC + migration_up(); must be
# idempotent (the runner only calls it once per project, but re-running by hand must be safe).
#
# Background (plugin >= 0.2.5 / tech-lead 0.12):
#   OLD: /coach wrote one flat, gitignored file at  .shapeup-sdlc/knowledge-base.md
#        — never reached teammates, never read back by any skill.
#   NEW: /coach files each rule, by skill, under  docs/shapeup-sdlc/knowledge-base/<skill>.md
#        — committed (shared on git pull) and read back at the top of each worker's run.

MIGRATION_DESC="Move pre-0.12 flat .shapeup-sdlc/knowledge-base.md to committed per-skill docs/shapeup-sdlc/knowledge-base/<skill>.md"

migration_up() {
  local target="$1"
  local old_kb="$target/.shapeup-sdlc/knowledge-base.md"
  local new_kb_dir="$target/docs/shapeup-sdlc/knowledge-base"
  local inbox="$new_kb_dir/_INBOX.md"
  local readme="$new_kb_dir/README.md"

  # 1. Scaffold the committed knowledge-base directory (idempotent).
  mkdir -p "$new_kb_dir"
  if [ ! -f "$readme" ]; then
    cat > "$readme" <<'EOF'
# Knowledge Base — team-shared harness guidelines

`/coach` distills PO/TL feedback from the Ship Gate (L4) into durable guidelines and files
each one under the **one skill that acts on it**, in this directory. These files are
**committed on purpose** — a teammate inherits the harness's accumulated judgment on `git pull`.

| File | Read by | At |
|------|---------|----|
| `task-executor.md`     | `task-executor`     | Phase 1 (Context Load) |
| `ba-pitch-analyzer.md` | `ba-pitch-analyzer` | Phase 1 (Ingest & Scan) |
| `qa-edge-hunter.md`    | `qa-edge-hunter`    | Phase Q1 (Charter Map) |

These are **guidelines, not invariants** — they steer a worker's approach; they never override a
spec or change the `spec-evaluator` verdict (single-judge rule). `spec-evaluator` is deliberately
not coachable.

`_INBOX.md`, if present, holds rules migrated from a pre-0.12 flat knowledge base that have not yet
been categorized. Run `/coach` on its contents to sort each rule into the right skill file, then
delete `_INBOX.md`.
EOF
    echo "    created $new_kb_dir/README.md"
  fi

  # 2. Migrate the old flat knowledge base, if one exists and is non-empty.
  if [ -f "$old_kb" ] && [ -s "$old_kb" ]; then
    {
      echo "# _INBOX — rules pending categorization (migrated from pre-0.12 flat knowledge base)"
      echo ""
      echo "> These rules were NOT auto-assigned to a skill — the harness never assumes which skill"
      echo "> owns a rule. Run \`/coach\` on the contents below: it will run GATE COACH-1 to have you"
      echo "> assign each rule to task-executor, ba-pitch-analyzer, or qa-edge-hunter, then file it"
      echo "> into the right \`<skill>.md\` here. Delete this file once the inbox is empty."
      echo ""
      echo "---"
      echo ""
      echo "<!-- migrated from .shapeup-sdlc/knowledge-base.md -->"
      echo ""
      cat "$old_kb"
      echo ""
    } >> "$inbox"
    echo "    preserved old rules into $inbox (pending /coach categorization)"

    # Retire the old file so no one mistakes it for the active source (gitignored backup).
    mv "$old_kb" "$old_kb.migrated"
    echo "    retired old file → $old_kb.migrated"
  else
    echo "    no pre-0.12 flat knowledge base found — fresh layout only"
  fi
}
