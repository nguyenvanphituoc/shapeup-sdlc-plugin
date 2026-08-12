#!/usr/bin/env bash
# Install Shape Up SDLC Harness as Local Scaffolding
# Supports: Claude Code
#
# Remote install downloads the release source archive published by the CI release
# workflow (skills/ sourced from the git archive; no dist/ needed).

set -e

REPO="nguyenvanphituoc/shapeup-sdlc-plugin"

# -- Defaults ------------------------------------------------------------------
TARGET_DIR="."
OVERRIDE=false
YES_MODE=false

# -- Help ----------------------------------------------------------------------
print_usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -d, --directory <path>  Target project directory (default: current directory)"
  echo "  -o, --override          Overwrite existing files in target"
  echo "  -y, --yes               Run unattended (answer yes to all prompts)"
  echo "  -h, --help              Print this help message"
}

# -- Arg parsing ---------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -d|--directory) TARGET_DIR="$2"; shift ;;
    -o|--override)  OVERRIDE=true ;;
    -y|--yes)       YES_MODE=true ;;
    -h|--help)      print_usage; exit 0 ;;
    *) echo "Unknown parameter: $1"; print_usage; exit 1 ;;
  esac
  shift
done

# -- Resolve paths -------------------------------------------------------------
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
echo "Installing Shape Up SDLC Harness into target directory: $TARGET_DIR"

# -- Load the shared lib -------------------------------------------------------
# Local clone → source the sibling file. Piped (curl | bash) → no files on disk,
# so download the lib first. harness_resolve_source then handles the skill source
# (local clone, or download the latest release). Same lib the migrate script uses.
LIB_REF="${LIB_REF:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/shapeup-sdlc/lib/lib-harness.sh" ]; then
  # shellcheck source=shapeup-sdlc/lib/lib-harness.sh
  . "$SCRIPT_DIR/shapeup-sdlc/lib/lib-harness.sh"
else
  LIB_TMP="$(mktemp)"
  curl -fsSL "https://raw.githubusercontent.com/${REPO}/${LIB_REF}/scripts/shapeup-sdlc/lib/lib-harness.sh" -o "$LIB_TMP" \
    || { echo "Error: could not download lib-harness.sh from ${REPO}@${LIB_REF}"; exit 1; }
  . "$LIB_TMP"
  rm -f "$LIB_TMP"
fi

harness_resolve_source
SOURCE_DIR="$HARNESS_SOURCE_DIR"

# -- Confirmation --------------------------------------------------------------
if [ "$YES_MODE" = false ]; then
  if [ -t 0 ]; then
    read -p "Proceed with installation in $TARGET_DIR? [y/N] " -n 1 -r
  elif [ -c /dev/tty ]; then
    read -p "Proceed with installation in $TARGET_DIR? [y/N] " -n 1 -r < /dev/tty
  else
    echo "Warning: Non-interactive environment detected and no --yes option provided."
    echo "Please run with --yes (-y) to install in non-interactive environments."
    exit 1
  fi
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled."
    exit 1
  fi
fi

# -- 0. Install root AGENTS.md (harness instructions) -------------------------
# Clone AGENTS.md to the target project root, or append the harness block if the
# file already exists.
HARNESS_AGENTS_SRC="$SOURCE_DIR/AGENTS.md"
ROOT_AGENTS_MD="$TARGET_DIR/AGENTS.md"

if [ ! -f "$HARNESS_AGENTS_SRC" ]; then
  echo "Warning: AGENTS.md not found in source ($HARNESS_AGENTS_SRC). Skipping root AGENTS.md setup."
else
  if [ ! -f "$ROOT_AGENTS_MD" ]; then
    # File does not exist — clone the whole thing
    cp "$HARNESS_AGENTS_SRC" "$ROOT_AGENTS_MD"
    echo "Created $ROOT_AGENTS_MD from harness template"
  elif grep -qF '<!-- HARNESS_START -->' "$ROOT_AGENTS_MD" 2>/dev/null; then
    # Harness block already present — replace it in-place
    # Use sed to delete the old block and insert the new one
    HARNESS_CONTENT=$(cat "$HARNESS_AGENTS_SRC")
    # Create a temp file with the replaced content
    TEMP_AGENTS=$(mktemp)
    awk '
      /<!-- HARNESS_START -->/ { skip=1; next }
      /<!-- HARNESS_END -->/   { skip=0; next }
      !skip { print }
    ' "$ROOT_AGENTS_MD" > "$TEMP_AGENTS"
    # Prepend the new harness block (harness goes at the top)
    cat "$HARNESS_AGENTS_SRC" "$TEMP_AGENTS" > "$ROOT_AGENTS_MD"
    rm -f "$TEMP_AGENTS"
    if [ "$OVERRIDE" = true ]; then
      echo "Updated harness block in $ROOT_AGENTS_MD (override mode)"
    else
      echo "Updated harness block in $ROOT_AGENTS_MD"
    fi
  else
    # File exists but has no harness block — append
    echo "" >> "$ROOT_AGENTS_MD"
    cat "$HARNESS_AGENTS_SRC" >> "$ROOT_AGENTS_MD"
    echo "Appended harness block to existing $ROOT_AGENTS_MD"
  fi
fi

# -- Helper: ensure CLAUDE.md links to root AGENTS.md --------------------------
# Claude Code supports @-import syntax to include root AGENTS.md.
ensure_agent_import() {
  local file="$1"
  local label="$2"

  # Create the file (and parent dirs) if it does not exist yet
  mkdir -p "$(dirname "$file")"
  touch "$file"

  if ! grep -qF '@AGENTS.md' "$file" 2>/dev/null; then
    echo -e "\n@AGENTS.md" >> "$file"
    echo "Appended @AGENTS.md import tag to $label"
  else
    echo "@AGENTS.md import tag already present in $label"
  fi
}

# -- 1. Install the Claude Code plugin (shared lib) ----------------------------
# One implementation, shared with the migrate script.
HARNESS_CLIS=(claude)
harness_replace_skills "$TARGET_DIR"

# -- 2. Wire Claude Code to the root AGENTS.md ---------------------------------
echo "Configuring Claude Code local scaffolding..."
ensure_agent_import "$TARGET_DIR/CLAUDE.md" "CLAUDE.md"

# -- 4. Gitignore Setup --------------------------------------------------------
GITIGNORE_FILE="$TARGET_DIR/.gitignore"
GITIGNORE_RULE="# Shape Up SDLC run workspace
.shapeup/

# Shape Up SDLC Tier C — per-member local config (templates *.example stay committed).
# The env file is SHAPEUP_-namespaced (filename + keys) so it never collides with, or gets
# confused with, this project's own .env / .env.local.
.claude/settings.local.json
.env.shapeup.local
!.env.shapeup.example
!.claude/settings.local.example.json"

if [ -f "$GITIGNORE_FILE" ]; then
  if ! grep -q ".shapeup/" "$GITIGNORE_FILE"; then
    echo -e "\n$GITIGNORE_RULE" >> "$GITIGNORE_FILE"
    echo "Added Shape Up SDLC ignore rules to .gitignore"
  else
    echo ".shapeup/ already ignored in .gitignore"
  fi
else
  echo -e "$GITIGNORE_RULE" > "$GITIGNORE_FILE"
  echo "Created .gitignore and added ignore rules"
fi

# -- 5. Initialize telemetry and memory files ----------------------------------
mkdir -p "$TARGET_DIR/shapeup/metrics"

METRICS_FILE="$TARGET_DIR/shapeup/metrics.jsonl"
if [ ! -f "$METRICS_FILE" ] && [ -z "$(ls -A "$TARGET_DIR/shapeup/metrics" 2>/dev/null)" ]; then
  echo "Initialized shapeup/metrics/ (sharded harvest — one file per machine, addendum §F.4-Δ3)"
fi

# -- 6. Tier C templates (design spec addendum §F.2) ---------------------------
# Committed templates so a fresh clone knows exactly what per-member config to fill in;
# GATE L0 validates the merged config against these key sets. Never overwrite a member's
# real .env.shapeup.local / settings.local.json — only drop the *.example templates. The env
# template is SHAPEUP_-namespaced (filename + keys) so it can never collide with, or be
# mistaken for, this project's own .env / .env.local.
if [ -f "$SOURCE_DIR/.claude/settings.local.example.json" ]; then
  mkdir -p "$TARGET_DIR/.claude"
  cp "$SOURCE_DIR/.claude/settings.local.example.json" "$TARGET_DIR/.claude/settings.local.example.json"
  echo "Installed .claude/settings.local.example.json (copy to settings.local.json and edit)"
fi
if [ -f "$SOURCE_DIR/.env.shapeup.example" ]; then
  cp "$SOURCE_DIR/.env.shapeup.example" "$TARGET_DIR/.env.shapeup.example"
  echo "Installed .env.shapeup.example (copy to .env.shapeup.local and edit)"
fi

echo "Harness installation and scaffolding successfully completed!"
