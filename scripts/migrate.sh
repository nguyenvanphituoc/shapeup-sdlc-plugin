#!/usr/bin/env bash
# migrate.sh — update an installed Shape Up SDLC harness and run any pending data migrations.
#
# Two distinct operations, by analogy to a database-backed app deploy:
#   1. UPDATE CODE  — replace the installed skill files for each chosen CLI (stateless; always
#                     overwrite to the source version). Like shipping new application code.
#   2. MIGRATE DATA — run every pending versioned migration in scripts/migrations/ against the
#                     project's stateful harness artifacts, recording each in a committed ledger.
#                     Like running pending DB schema migrations after the deploy.
#
# Idempotent: re-running replaces code again (cheap) and applies only migrations not yet in the
# ledger. Use --data-only to run migrations without touching skill files.
#
# Usage: migrate.sh [-d <dir>] [-y] [--data-only] [--dry-run]

set -e

REPO="${REPO:-nguyenvanphituoc/shapeup-sdlc-plugin}"
LIB_REF="${LIB_REF:-main}"

# -- Load shared libs (local clone → sibling files; piped → download) --------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
load_lib() {
  local name="$1"
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/lib/$name" ]; then
    . "$SCRIPT_DIR/lib/$name"
  else
    local tmp; tmp="$(mktemp)"
    curl -fsSL "https://raw.githubusercontent.com/${REPO}/${LIB_REF}/scripts/lib/$name" -o "$tmp" \
      || { echo "Error: could not download $name from ${REPO}@${LIB_REF}"; exit 1; }
    . "$tmp"; rm -f "$tmp"
  fi
}
load_lib lib-harness.sh
load_lib lib-migrate.sh

# -- Defaults / args ---------------------------------------------------------------------------
TARGET_DIR="."
YES_MODE=false
DATA_ONLY=false
DRY_RUN=false
print_usage() {
  echo "Usage: $0 [options]"
  echo "  -d, --directory <path>  Target project (default: current directory)"
  echo "  -y, --yes               Non-interactive (auto-select installed CLIs)"
  echo "      --data-only         Skip skill replacement; run migrations only"
  echo "      --dry-run           List pending migrations without applying them"
  echo "  -h, --help              This help"
}
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -d|--directory) TARGET_DIR="$2"; shift ;;
    -y|--yes)       YES_MODE=true ;;
    --data-only)    DATA_ONLY=true ;;
    --dry-run)      DRY_RUN=true ;;
    -h|--help)      print_usage; exit 0 ;;
    *) echo "Unknown parameter: $1"; print_usage; exit 1 ;;
  esac
  shift
done

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
export HARNESS_YES="$YES_MODE"
export HARNESS_MIGRATE_DRYRUN="$DRY_RUN"

harness_resolve_source
echo "Migrating Shape Up SDLC harness in: $TARGET_DIR"

# -- 1. Update code: replace installed skill files (unless --data-only) ------------------------
if [ "$DATA_ONLY" = true ]; then
  echo "[--data-only] skipping skill replacement."
elif [ "$DRY_RUN" = true ]; then
  echo "[--dry-run] skipping skill replacement."
else
  if harness_select_clis "$TARGET_DIR"; then
    harness_replace_skills "$TARGET_DIR"
  else
    echo "No CLI selected — skipping skill replacement, continuing with data migrations."
  fi
fi

# -- 2. Migrate data: run pending migrations ---------------------------------------------------
harness_run_migrations "$TARGET_DIR"

echo ""
echo "Done. Migration ledger: $TARGET_DIR/$HARNESS_LEDGER_REL"
if [ "$DRY_RUN" != true ]; then
  echo "Next steps:"
  echo "  1. If docs/shapeup-sdlc/knowledge-base/_INBOX.md was created, run /coach to categorize its rules."
  echo "  2. Commit docs/shapeup-sdlc/ (knowledge base + .harness-migrations + .harness-version)."
fi
