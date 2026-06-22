#!/usr/bin/env bash
# Install Shape Up SDLC Harness as Local Scaffolding
# Supports: Claude Code, Antigravity, and Codex
#
# Remote install downloads release assets published by the CI release workflow:
#   - skills/        sourced from the git archive (no dist/ needed)
#   - antigravity-subagents.zip  downloaded from the latest GitHub Release asset

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
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/lib/lib-harness.sh" ]; then
  # shellcheck source=lib/lib-harness.sh
  . "$SCRIPT_DIR/lib/lib-harness.sh"
else
  LIB_TMP="$(mktemp)"
  curl -fsSL "https://raw.githubusercontent.com/${REPO}/${LIB_REF}/scripts/lib/lib-harness.sh" -o "$LIB_TMP" \
    || { echo "Error: could not download lib-harness.sh from ${REPO}@${LIB_REF}"; exit 1; }
  . "$LIB_TMP"
  rm -f "$LIB_TMP"
fi

harness_resolve_source
SOURCE_DIR="$HARNESS_SOURCE_DIR"
ANTIGRAVITY_DIST_DIR="$HARNESS_ANTIGRAVITY_DIST"

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

# -- Helper: ensure CLI-specific config files link to root AGENTS.md -----------
# Each CLI has a different mechanism:
#   claude  — supports @AGENTS.md import syntax in CLAUDE.md
#   antigravity — auto-discovers root AGENTS.md; no import tag needed
#   codex   — auto-discovers root AGENTS.md; no import tag needed
ensure_agent_import() {
  local file="$1"
  local label="$2"
  local cli_type="$3"  # "claude" | "antigravity" | "codex"

  # Create the file (and parent dirs) if it does not exist yet
  mkdir -p "$(dirname "$file")"
  touch "$file"

  case "$cli_type" in
    claude)
      # Claude Code supports @-import syntax to include root AGENTS.md
      if ! grep -qF '@AGENTS.md' "$file" 2>/dev/null; then
        echo -e "\n@AGENTS.md" >> "$file"
        echo "Appended @AGENTS.md import tag to $label"
      else
        echo "@AGENTS.md import tag already present in $label"
      fi
      ;;
    antigravity|codex)
      # These CLIs auto-discover the root AGENTS.md; no import tag needed.
      # Just ensure the file exists (already handled above).
      echo "$label ready (root AGENTS.md auto-discovered by $cli_type)"
      ;;
    *)
      echo "Warning: Unknown CLI type '$cli_type' for $label, skipping import setup."
      ;;
  esac
}

# -- 1. Install/replace skills for all CLIs (shared lib) -----------------------
# One implementation, shared with the migrate script: per-skill replace into each CLI's
# skills dir, plus antigravity subagent configs. The installer always targets all three.
HARNESS_CLIS=(claude antigravity codex)
harness_replace_skills "$TARGET_DIR"

# -- 2. Wire each CLI to the root AGENTS.md ------------------------------------
# Claude Code supports @AGENTS.md import; Antigravity and Codex auto-discover the root file.
echo "Configuring Claude Code local scaffolding..."
ensure_agent_import "$TARGET_DIR/CLAUDE.md" "CLAUDE.md" "claude"

echo "Configuring Antigravity local scaffolding..."
ensure_agent_import "$TARGET_DIR/.agents/AGENTS.md" ".agents/AGENTS.md" "antigravity"

echo "Configuring Codex local scaffolding..."
ensure_agent_import "$TARGET_DIR/.codex/AGENTS.md" ".codex/AGENTS.md" "codex"

# -- 4. Gitignore Setup --------------------------------------------------------
GITIGNORE_FILE="$TARGET_DIR/.gitignore"
GITIGNORE_RULE="# Shape Up SDLC run workspace
.shapeup-sdlc/"

if [ -f "$GITIGNORE_FILE" ]; then
  if ! grep -q ".shapeup-sdlc/" "$GITIGNORE_FILE"; then
    echo -e "\n$GITIGNORE_RULE" >> "$GITIGNORE_FILE"
    echo "Added .shapeup-sdlc/ to .gitignore"
  else
    echo ".shapeup-sdlc/ already ignored in .gitignore"
  fi
else
  echo -e "$GITIGNORE_RULE" > "$GITIGNORE_FILE"
  echo "Created .gitignore and added ignore rule"
fi

# -- 5. Initialize telemetry and memory files ----------------------------------
mkdir -p "$TARGET_DIR/docs/shapeup-sdlc"

METRICS_FILE="$TARGET_DIR/docs/shapeup-sdlc/metrics.jsonl"
if [ ! -f "$METRICS_FILE" ]; then
  touch "$METRICS_FILE"
  echo "Initialized metrics.jsonl"
fi


echo "Harness installation and scaffolding successfully completed!"
