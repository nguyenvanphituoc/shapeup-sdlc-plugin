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

# -- Source resolution ---------------------------------------------------------
# When run from within the cloned repo, use local files directly.
# When run as a standalone script (curl | bash), download release assets from GitHub.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR=""

if [ -d "$SCRIPT_DIR/../skills" ]; then
  # -- Local: running from within the cloned repository ----------------------
  SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  echo "Using local source directory: $SOURCE_DIR"
  ANTIGRAVITY_DIST_DIR="$SOURCE_DIR/dist/antigravity"
else
  # -- Remote: download skills + antigravity-subagents.zip from latest release
  echo "Local source not found. Downloading from latest GitHub Release..."
  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TEMP_DIR"' EXIT

  # Fetch the latest release metadata
  RELEASE_API="https://api.github.com/repos/${REPO}/releases/latest"
  RELEASE_JSON=$(curl -fsSL "$RELEASE_API")

  # Extract the tarball URL (contains skills/, commands/, agents/, etc.)
  TARBALL_URL=$(echo "$RELEASE_JSON" | grep '"tarball_url"' | head -1 | sed 's/.*"tarball_url": *"\([^"]*\)".*/\1/')

  # Extract the antigravity-subagents.zip download URL
  SUBAGENTS_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep 'antigravity-subagents.zip' | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')

  if [ -z "$TARBALL_URL" ]; then
    echo "Error: Could not fetch release tarball URL from $RELEASE_API"
    exit 1
  fi

  # Download and extract source tarball
  echo "Downloading release source archive..."
  curl -fsSL "$TARBALL_URL" | tar -xz -C "$TEMP_DIR" --strip-components=1

  SOURCE_DIR="$TEMP_DIR"

  # Download and extract antigravity-subagents.zip
  ANTIGRAVITY_DIST_DIR="$TEMP_DIR/dist/antigravity"
  if [ -n "$SUBAGENTS_URL" ]; then
    echo "Downloading antigravity-subagents.zip from release..."
    mkdir -p "$ANTIGRAVITY_DIST_DIR"
    curl -fsSL "$SUBAGENTS_URL" -o "$TEMP_DIR/antigravity-subagents.zip"
    # The zip contains dist/antigravity/... -- extract and flatten
    unzip -q "$TEMP_DIR/antigravity-subagents.zip" -d "$TEMP_DIR/antigravity-extract"
    # Copy contents of dist/antigravity/ from zip into our ANTIGRAVITY_DIST_DIR
    EXTRACTED=$(find "$TEMP_DIR/antigravity-extract" -type d -name "antigravity" | head -1)
    if [ -n "$EXTRACTED" ]; then
      cp -R "$EXTRACTED/"* "$ANTIGRAVITY_DIST_DIR/"
    fi
  else
    echo "Warning: antigravity-subagents.zip not found in release assets. Subagent configs will be skipped."
  fi
fi

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

# -- 1. Configure Claude Code local scaffolding --------------------------------
echo "Configuring Claude Code local scaffolding..."
CLAUDE_SKILLS_DIR="$TARGET_DIR/.claude/skills"
mkdir -p "$CLAUDE_SKILLS_DIR"
cp -R "$SOURCE_DIR/skills/"* "$CLAUDE_SKILLS_DIR/"
echo "Claude Code skills installed to $CLAUDE_SKILLS_DIR"

CLAUDE_MD_FILE="$TARGET_DIR/CLAUDE.md"

# -- Auto-append @AGENTS.md import tag (Claude Code supports this) -------------
ensure_agent_import "$CLAUDE_MD_FILE" "CLAUDE.md" "claude"

# -- 2. Configure Antigravity local scaffolding --------------------------------
echo "Configuring Antigravity local scaffolding..."
AGENT_SKILLS_DIR="$TARGET_DIR/.agents/skills"
mkdir -p "$AGENT_SKILLS_DIR"
cp -R "$SOURCE_DIR/skills/"* "$AGENT_SKILLS_DIR/"

AGENT_SUBAGENTS_DIR="$TARGET_DIR/.agents/subagents"
mkdir -p "$AGENT_SUBAGENTS_DIR"

# Copy subagent configs from release asset (or local dist/)
if [ -d "$ANTIGRAVITY_DIST_DIR/subagents" ] && [ -n "$(ls -A "$ANTIGRAVITY_DIST_DIR/subagents" 2>/dev/null)" ]; then
  cp -R "$ANTIGRAVITY_DIST_DIR/subagents/"* "$AGENT_SUBAGENTS_DIR/"
  echo "Antigravity subagent configs installed to $AGENT_SUBAGENTS_DIR"
else
  echo "Warning: Antigravity subagent configs not available. Skills are still installed."
fi

if [ -f "$ANTIGRAVITY_DIST_DIR/subagents.json" ]; then
  cp "$ANTIGRAVITY_DIST_DIR/subagents.json" "$TARGET_DIR/.agents/subagents.json"
fi

echo "Antigravity skills and subagent configurations installed to $TARGET_DIR/.agents/"

AGENTS_MD_FILE="$TARGET_DIR/.agents/AGENTS.md"

# -- Antigravity auto-discovers root AGENTS.md; no import tag needed -----------
ensure_agent_import "$AGENTS_MD_FILE" ".agents/AGENTS.md" "antigravity"

# -- 3. Configure Codex local scaffolding --------------------------------------
echo "Configuring Codex local scaffolding..."
CODEX_SKILLS_DIR="$TARGET_DIR/.codex/skills"
mkdir -p "$CODEX_SKILLS_DIR"
cp -R "$SOURCE_DIR/skills/"* "$CODEX_SKILLS_DIR/"

CODEX_MD_FILE="$TARGET_DIR/.codex/AGENTS.md"

# -- Codex auto-discovers root AGENTS.md; no import tag needed -----------------
ensure_agent_import "$CODEX_MD_FILE" ".codex/AGENTS.md" "codex"

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
