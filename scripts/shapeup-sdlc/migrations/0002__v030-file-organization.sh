#!/usr/bin/env bash
# Migration 0002 — v0.3.0 file-organization addendum: per-machine metrics sharding + Tier C
# per-member config (settings.local.json / .env.shapeup.local).
#
# Sourced by lib-migrate.sh's runner. Must define MIGRATION_DESC + migration_up(); must be
# idempotent (the runner only calls it once per project, but re-running by hand must be safe).
#
# Background (plugin >= 0.3.0 / design spec v1.1 + file-organization addendum, addendum §F.2/Δ3):
#   OLD: one committed, unsharded  docs/shapeup-sdlc/metrics.jsonl  — concurrent machines
#        appending to it merge-conflict on a file with zero semantic conflict (appends never
#        actually contend). No Tier C per-member config existed.
#   NEW: metrics shard per machine — docs/shapeup-sdlc/metrics/<machine-id>.jsonl — plus
#        committed Tier C example templates (.claude/settings.local.example.json,
#        .env.shapeup.example) with matching .gitignore rules for the real per-member files.
# `install-harness.sh` already does all three steps for a FRESH install; this migration brings an
# EXISTING project (installed before 0.3.0) up to the same state via `migrate.sh`.

MIGRATION_DESC="Shard pre-0.3.0 flat metrics.jsonl per machine; add Tier C .gitignore rules + example templates"

migration_up() {
  local target="$1"
  local metrics_dir="$target/docs/shapeup-sdlc/metrics"
  local old_metrics="$target/docs/shapeup-sdlc/metrics.jsonl"
  local gitignore="$target/.gitignore"

  # 1. Shard the old flat metrics.jsonl into metrics/<machine-id>.jsonl (addendum Δ3).
  mkdir -p "$metrics_dir"
  if [ -f "$old_metrics" ] && [ -s "$old_metrics" ]; then
    local machine_id
    machine_id="$( (hostname -s 2>/dev/null || hostname 2>/dev/null || echo unknown-machine) \
      | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' | sed 's/-\{2,\}/-/g; s/^-//; s/-$//')"
    [ -z "$machine_id" ] && machine_id="unknown-machine"
    local shard="$metrics_dir/$machine_id.jsonl"

    if [ -f "$shard" ]; then
      cat "$old_metrics" >> "$shard"
    else
      cp "$old_metrics" "$shard"
    fi
    # Retire the old file so no one mistakes it for the active source (matches migration 0001's
    # "never clobber, never rm" discipline).
    mv "$old_metrics" "$old_metrics.migrated"
    echo "    sharded pre-0.3.0 metrics.jsonl -> metrics/$machine_id.jsonl (old file retired to metrics.jsonl.migrated)"
  else
    echo "    no pre-0.3.0 flat metrics.jsonl found — fresh layout only"
  fi

  # 2. Tier C .gitignore rules (idempotent append; never touch an unrelated .gitignore layout).
  if [ ! -f "$gitignore" ]; then
    echo "    no .gitignore found — skipping Tier C ignore rules (fresh installs get this from install-harness.sh)"
  elif grep -q "settings.local.json" "$gitignore" 2>/dev/null; then
    echo "    Tier C .gitignore rules already present"
  else
    cat >> "$gitignore" <<'EOF'

# Shape Up SDLC Tier C — per-member local config (templates *.example stay committed).
# The env file is SHAPEUP_-namespaced (filename + keys) so it never collides with, or gets
# confused with, this project's own .env / .env.local.
.claude/settings.local.json
.env.shapeup.local
!.env.shapeup.example
!.claude/settings.local.example.json
EOF
    echo "    added Tier C .gitignore rules"
  fi

  # 3. Tier C example templates — copied from the harness source, never overwrite a real file.
  if [ -f "$HARNESS_SOURCE_DIR/.claude/settings.local.example.json" ] && [ ! -f "$target/.claude/settings.local.example.json" ]; then
    mkdir -p "$target/.claude"
    cp "$HARNESS_SOURCE_DIR/.claude/settings.local.example.json" "$target/.claude/settings.local.example.json"
    echo "    installed .claude/settings.local.example.json"
  fi
  if [ -f "$HARNESS_SOURCE_DIR/.env.shapeup.example" ] && [ ! -f "$target/.env.shapeup.example" ]; then
    cp "$HARNESS_SOURCE_DIR/.env.shapeup.example" "$target/.env.shapeup.example"
    echo "    installed .env.shapeup.example"
  fi
}
