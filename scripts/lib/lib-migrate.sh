#!/usr/bin/env bash
# lib-migrate.sh — a versioned migration runner for the harness, modeled on database migration
# tools (Flyway / Rails / Alembic).
#
# Concepts mapped from DB migrations:
#   migration file      = scripts/migrations/NNNN__slug.sh   (ordered by zero-padded id)
#   schema_migrations   = docs/shapeup-sdlc/.harness-migrations  (committed ledger of applied ids)
#   schema version      = docs/shapeup-sdlc/.harness-version      (last plugin version applied)
#
# Each migration file defines:
#   MIGRATION_DESC="..."           # one-line human description
#   migration_up()  { ... }        # idempotent forward transform; receives <target> as $1
# (Down/rollback is intentionally omitted — harness migrations are forward-only, like most DB
#  deploys in practice. A reversible migration may define migration_down() for future use.)
#
# A migration's id + slug are derived from its FILENAME (NNNN__slug.sh), so ids cannot drift from
# the ledger. The runner applies every migration whose id is NOT yet in the ledger, in id order,
# then records it. Re-running is a no-op — that is the idempotency guarantee.
#
# Sourceable. Requires HARNESS_SOURCE_DIR (set by harness_resolve_source in lib-harness.sh).

HARNESS_LEDGER_REL="docs/shapeup-sdlc/.harness-migrations"
HARNESS_VERSION_REL="docs/shapeup-sdlc/.harness-version"

# -- Read the plugin version from the resolved source manifest (no jq dependency) -------------
harness_plugin_version() {
  local manifest="$HARNESS_SOURCE_DIR/.claude-plugin/plugin.json"
  [ -f "$manifest" ] || { echo "unknown"; return; }
  if command -v jq >/dev/null 2>&1; then
    jq -r '.version // "unknown"' "$manifest"
  else
    # grep the "version": "x.y.z" line
    sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" | head -1
  fi
}

# -- UTC timestamp without relying on GNU date flags ------------------------------------------
harness_now_utc() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# -- Ensure the ledger file exists with a header ----------------------------------------------
harness_ensure_ledger() {
  local target="$1"
  local ledger="$target/$HARNESS_LEDGER_REL"
  mkdir -p "$(dirname "$ledger")"
  if [ ! -f "$ledger" ]; then
    {
      echo "# Harness migration ledger — applied migrations (a DB schema_migrations analogue)."
      echo "# Committed on purpose: teammates inherit applied-state on git pull."
      echo "# Columns (tab-separated): id  applied_utc  plugin_version  slug"
    } > "$ledger"
    # Status to stderr — stdout is the function's return value (the ledger path) and must stay clean.
    echo "Initialized migration ledger at $HARNESS_LEDGER_REL" >&2
  fi
  echo "$ledger"
}

# -- Has a migration id already been applied? -------------------------------------------------
harness_migration_applied() {
  local ledger="$1" id="$2"
  # match a data line beginning with the id followed by whitespace (skip comment lines)
  grep -Eq "^${id}[[:space:]]" "$ledger" 2>/dev/null
}

# -- Append an applied migration to the ledger ------------------------------------------------
harness_record_migration() {
  local ledger="$1" id="$2" version="$3" slug="$4"
  printf '%s\t%s\t%s\t%s\n' "$id" "$(harness_now_utc)" "$version" "$slug" >> "$ledger"
}

# -- Run all pending migrations against a target project --------------------------------------
# Returns 0 always (a failing migration aborts with a clear error). Set HARNESS_MIGRATE_DRYRUN=true
# to list pending migrations without applying them.
harness_run_migrations() {
  local target="$1"
  local mig_dir="$HARNESS_SOURCE_DIR/scripts/migrations"
  local version applied=0 pending=0
  version="$(harness_plugin_version)"

  if [ ! -d "$mig_dir" ]; then
    echo "No migrations directory ($mig_dir) — nothing to migrate."
    return 0
  fi

  # A dry run is strictly read-only: don't create the ledger, just compute the path. The
  # applied-check tolerates a missing ledger (grep on a nonexistent file → "not applied").
  local ledger
  if [ "${HARNESS_MIGRATE_DRYRUN:-false}" = true ]; then
    ledger="$target/$HARNESS_LEDGER_REL"
  else
    ledger="$(harness_ensure_ledger "$target")"
  fi

  echo "Running migrations (plugin $version) against $target"
  shopt -s nullglob
  local f base id slug
  for f in "$mig_dir"/[0-9]*__*.sh; do
    base="$(basename "$f" .sh)"           # e.g. 0001__per-skill-knowledge-base
    id="${base%%__*}"                      # 0001
    slug="${base#*__}"                     # per-skill-knowledge-base

    if harness_migration_applied "$ledger" "$id"; then
      echo "  [skip] $id $slug (already applied)"
      continue
    fi

    pending=$((pending + 1))
    if [ "${HARNESS_MIGRATE_DRYRUN:-false}" = true ]; then
      echo "  [pending] $id $slug"
      continue
    fi

    echo "  [apply] $id $slug"
    # Run the migration in a subshell so its vars/functions don't leak between files.
    if ( set -e; . "$f"; migration_up "$target" ); then
      harness_record_migration "$ledger" "$id" "$version" "$slug"
      applied=$((applied + 1))
    else
      echo "  ERROR: migration $id ($slug) failed — aborting before recording it." >&2
      echo "  Fix the cause and re-run; applied migrations are not re-run (idempotent)." >&2
      return 1
    fi
  done
  shopt -u nullglob

  # Stamp the schema version so 'what version is this project at?' is answerable.
  if [ "${HARNESS_MIGRATE_DRYRUN:-false}" != true ]; then
    echo "$version" > "$target/$HARNESS_VERSION_REL"
  fi

  if [ "$pending" -eq 0 ]; then
    echo "Up to date — no pending migrations."
  elif [ "${HARNESS_MIGRATE_DRYRUN:-false}" = true ]; then
    echo "$pending migration(s) pending (dry run — nothing applied)."
  else
    echo "Applied $applied migration(s); project now at harness version $version."
  fi
  return 0
}
