#!/usr/bin/env bash
# migrate.sh — update an installed Shape Up SDLC harness to the current source version.
#
# ONE operation: replace the installed skill files for each chosen CLI. Skill files are stateless,
# so the update is a straight overwrite and re-running is free.
#
# There is deliberately no second, data-migration half any more. Versioned migrations used to run
# here against a project's stateful harness artifacts, recorded by ordinal in a committed ledger.
# That machinery was removed with the artifacts it carried forward: every migration in it existed
# to move a project across a layout change that no supported version is still on. A runner with
# nothing pending is indistinguishable from a runner that silently did nothing, which is the exact
# shape this repo keeps finding and removing.
#
# The path is unchanged on purpose — this URL is published and cannot 404. See FROZEN.md.
#
# Usage: migrate.sh [-d <dir>] [-y]

set -e

REPO="${REPO:-nguyenvanphituoc/shapeup-sdlc-plugin}"
LIB_REF="${LIB_REF:-main}"

# -- Load shared libs (local clone → sibling files; piped → download) --------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
load_lib() {
  local name="$1"
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/shapeup-sdlc/lib/$name" ]; then
    . "$SCRIPT_DIR/shapeup-sdlc/lib/$name"
  else
    local tmp; tmp="$(mktemp)"
    curl -fsSL "https://raw.githubusercontent.com/${REPO}/${LIB_REF}/scripts/shapeup-sdlc/lib/$name" -o "$tmp" \
      || { echo "Error: could not download $name from ${REPO}@${LIB_REF}"; exit 1; }
    . "$tmp"; rm -f "$tmp"
  fi
}
load_lib lib-harness.sh

# -- Defaults / args ---------------------------------------------------------------------------
TARGET_DIR="."
YES_MODE=false
print_usage() {
  echo "Usage: $0 [options]"
  echo "  -d, --directory <path>  Target project (default: current directory)"
  echo "  -y, --yes               Non-interactive (auto-select installed CLIs)"
  echo "  -h, --help              This help"
}
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -d|--directory) TARGET_DIR="$2"; shift ;;
    -y|--yes)       YES_MODE=true ;;
    -h|--help)      print_usage; exit 0 ;;
    # --data-only and --dry-run were the data-migration half's flags. Rejected loudly rather than
    # ignored: a script that accepts a flag it no longer honours reports success for work it did
    # not do, and an upgrade is exactly where that goes unnoticed.
    --data-only|--dry-run)
      echo "Error: $1 was a flag of the data-migration step, which no longer exists."
      echo "       This script now only replaces installed skill files."
      exit 1 ;;
    *) echo "Unknown parameter: $1"; print_usage; exit 1 ;;
  esac
  shift
done

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
export HARNESS_YES="$YES_MODE"

harness_resolve_source
echo "Updating Shape Up SDLC harness in: $TARGET_DIR"

# -- Update code: replace installed skill files ------------------------------------------------
if harness_select_clis "$TARGET_DIR"; then
  harness_replace_skills "$TARGET_DIR"
else
  echo "No CLI selected — nothing to update."
  exit 0
fi

echo ""
echo "Done. Skill files are at the current source version."
