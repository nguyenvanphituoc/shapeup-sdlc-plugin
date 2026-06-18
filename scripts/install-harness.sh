#!/usr/bin/env bash
# Install Shape Up SDLC Harness as Local Scaffolding
# Supports: Claude Code, Antigravity, and Codex

set -e

# Default settings
TARGET_DIR="."
OVERRIDE=false
YES_MODE=false

# Print help
print_usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -d, --directory <path>  Target project directory (default: current directory)"
  echo "  -o, --override          Overwrite existing files in target"
  echo "  -y, --yes               Run unattended (answer yes to all prompts)"
  echo "  -h, --help              Print this help message"
}

# Parse args
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -d|--directory) TARGET_DIR="$2"; shift ;;
    -o|--override) OVERRIDE=true ;;
    -y|--yes) YES_MODE=true ;;
    -h|--help) print_usage; exit 0 ;;
    *) echo "Unknown parameter: $1"; print_usage; exit 1 ;;
  esac
  shift
done

# Resolve TARGET_DIR to absolute path
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
echo "Installing Shape Up SDLC Harness into target directory: $TARGET_DIR"

# Find source directory containing the skills and assets
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$SCRIPT_DIR/../skills" ]; then
  # Running from within the cloned repository
  SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  echo "Using local source directory: $SOURCE_DIR"
else
  # Running as a standalone script (e.g. downloaded via curl)
  echo "Local source not found. Cloning source repository from GitHub..."
  TEMP_DIR=$(mktemp -d)
  git clone --depth 1 https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin.git "$TEMP_DIR" >/dev/null 2>&1
  SOURCE_DIR="$TEMP_DIR"
  # Clean up temp dir on exit
  trap 'rm -rf "$TEMP_DIR"' EXIT
fi

# Confirm with user if not in --yes mode
if [ "$YES_MODE" = false ]; then
  read -p "Proceed with installation in $TARGET_DIR? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled."
    exit 1
  fi
fi

# 1. Configure Claude Code local scaffolding
echo "Configuring Claude Code local scaffolding..."
CLAUDE_SKILLS_DIR="$TARGET_DIR/.claude/skills"
mkdir -p "$CLAUDE_SKILLS_DIR"
cp -R "$SOURCE_DIR/skills/"* "$CLAUDE_SKILLS_DIR/"
echo "Claude Code skills installed to $CLAUDE_SKILLS_DIR"

# Update/Create CLAUDE.md
CLAUDE_MD_FILE="$TARGET_DIR/CLAUDE.md"
CLAUDE_INSTRUCTIONS="<!-- HARNESS_START -->
# Shape Up SDLC Local Harness

This project is scaffolded with the Shape Up SDLC Harness for coding agents.

## Installed Skills:
- **shapeup**: Run Shape Up workflows before writing code (S1-S4, B1-B5).
- **ba-pitch-analyzer**: Analyze pitches and generate DDD spec-tree docs and tasks.
- **task-executor**: Implement specific tasks from the spec folder.
- **spec-evaluator**: Evaluate task execution against specifications.
- **qa-edge-hunter**: Exploratory QA hunt.
- **translator**: Bilingual Vietnamese/English gate at intake.
- **tech-lead**: Orchestrate runs.

## Setup & Execution:
- Telemetry facts for shipped features are saved to: \`docs/shapeup-sdlc/metrics.jsonl\`
- Ephemeral logs and states are stored in: \`.shapeup-sdlc/\` (Gitignored)
- Local skill evolution history is tracked in: \`docs/repair-memory.md\`
<!-- HARNESS_END -->"

if [ -f "$CLAUDE_MD_FILE" ]; then
  # If already has harness markup, remove it first to avoid duplicates
  if grep -q "<!-- HARNESS_START -->" "$CLAUDE_MD_FILE"; then
    perl -0777 -pe 's/<!-- HARNESS_START -->.*?<!-- HARNESS_END -->\n?//sg' "$CLAUDE_MD_FILE" > "${CLAUDE_MD_FILE}.tmp"
    mv "${CLAUDE_MD_FILE}.tmp" "$CLAUDE_MD_FILE"
  fi
  echo -e "\n$CLAUDE_INSTRUCTIONS" >> "$CLAUDE_MD_FILE"
  echo "Updated existing CLAUDE.md"
else
  echo -e "$CLAUDE_INSTRUCTIONS" > "$CLAUDE_MD_FILE"
  echo "Created new CLAUDE.md"
fi

# 2. Configure Antigravity local scaffolding
echo "Configuring Antigravity local scaffolding..."
AGENT_SKILLS_DIR="$TARGET_DIR/.agents/skills"
mkdir -p "$AGENT_SKILLS_DIR"
cp -R "$SOURCE_DIR/skills/"* "$AGENT_SKILLS_DIR/"

AGENT_SUBAGENTS_DIR="$TARGET_DIR/.agents/subagents"
mkdir -p "$AGENT_SUBAGENTS_DIR"
cp -R "$SOURCE_DIR/dist/antigravity/subagents/"* "$AGENT_SUBAGENTS_DIR/"
cp "$SOURCE_DIR/dist/antigravity/subagents.json" "$TARGET_DIR/.agents/subagents.json"
echo "Antigravity skills and subagent configurations installed to $TARGET_DIR/.agents/"

# Update/Create .agents/AGENTS.md
AGENTS_MD_FILE="$TARGET_DIR/.agents/AGENTS.md"
AGENTS_INSTRUCTIONS="<!-- HARNESS_START -->
# Antigravity Agent Configuration

This directory houses workspace customizations for Antigravity.

## Local Skills:
Located under \`.agents/skills/\`. These are automatically loaded and prioritized over global tools.

## Subagent Definitions:
Located under \`.agents/subagents/\`. Registered in \`.agents/subagents.json\`.

## Local Evolution:
To optimize prompts for this specific repository, use the evolved subagents and log outputs in \`docs/repair-memory.md\`.
<!-- HARNESS_END -->"

if [ -f "$AGENTS_MD_FILE" ]; then
  if grep -q "<!-- HARNESS_START -->" "$AGENTS_MD_FILE"; then
    perl -0777 -pe 's/<!-- HARNESS_START -->.*?<!-- HARNESS_END -->\n?//sg' "$AGENTS_MD_FILE" > "${AGENTS_MD_FILE}.tmp"
    mv "${AGENTS_MD_FILE}.tmp" "$AGENTS_MD_FILE"
  fi
  echo -e "\n$AGENTS_INSTRUCTIONS" >> "$AGENTS_MD_FILE"
  echo "Updated existing .agents/AGENTS.md"
else
  echo -e "$AGENTS_INSTRUCTIONS" > "$AGENTS_MD_FILE"
  echo "Created new .agents/AGENTS.md"
fi

# 3. Configure Codex local scaffolding
echo "Configuring Codex local scaffolding..."
CODEX_SKILLS_DIR="$TARGET_DIR/.codex/skills"
mkdir -p "$CODEX_SKILLS_DIR"
cp -R "$SOURCE_DIR/skills/"* "$CODEX_SKILLS_DIR/"

# Update/Create .codex/AGENTS.md
CODEX_MD_FILE="$TARGET_DIR/.codex/AGENTS.md"
CODEX_INSTRUCTIONS="<!-- HARNESS_START -->
# Codex Agent Configuration

This directory contains workspace-specific skills for Codex.

## Local Skills:
- Located under \`.codex/skills/\`.
- These prompt definitions and workflow rules can be edited directly to tailor the Codex agent for this project's code quality and style guidelines.
<!-- HARNESS_END -->"

if [ -f "$CODEX_MD_FILE" ]; then
  if grep -q "<!-- HARNESS_START -->" "$CODEX_MD_FILE"; then
    perl -0777 -pe 's/<!-- HARNESS_START -->.*?<!-- HARNESS_END -->\n?//sg' "$CODEX_MD_FILE" > "${CODEX_MD_FILE}.tmp"
    mv "${CODEX_MD_FILE}.tmp" "$CODEX_MD_FILE"
  fi
  echo -e "\n$CODEX_INSTRUCTIONS" >> "$CODEX_MD_FILE"
  echo "Updated existing .codex/AGENTS.md"
else
  echo -e "$CODEX_INSTRUCTIONS" > "$CODEX_MD_FILE"
  echo "Created new .codex/AGENTS.md"
fi

# 4. Gitignore Setup
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

# 5. Initialize telemetry and memory files
mkdir -p "$TARGET_DIR/docs/shapeup-sdlc"

METRICS_FILE="$TARGET_DIR/docs/shapeup-sdlc/metrics.jsonl"
if [ ! -f "$METRICS_FILE" ]; then
  touch "$METRICS_FILE"
  echo "Initialized metrics.jsonl"
fi

MEMORY_FILE="$TARGET_DIR/docs/repair-memory.md"
if [ ! -f "$MEMORY_FILE" ]; then
  cat << 'EOF' > "$MEMORY_FILE"
# Shape Up SDLC Repair Memory

This repository tracks historical evaluation failures, prompt modifications, and repair actions taken during local skill evolution runs. It serves as the memory store for HarnessFix diagnosis-driven skill optimization.

---

## Evolution Memory Log

| Date | Target Skill | Symptom / Failure Case | Scoped Repair Operator | Outcome / Delta |
| :--- | :--- | :--- | :--- | :--- |

---

## Repair Operator Guidelines

When fixing a skill's instructions or trigger descriptions:
1. **Trigger Adjustments**: Refine the trigger phrases in frontmatter `description` only. Do not overfit to specific queries.
2. **Instruction Refinements**: If a skill fails functional checks (e.g., evaluator leniency or executor code-bloat), add explicit counter-examples to the `references/` files.
3. **Seesaw Constraint Verification**: Ensure `make eval-gate` is run before committing modifications. Evolved skills must never regress previously passing baseline tests.
EOF
  echo "Initialized docs/repair-memory.md"
fi

echo "Harness installation and scaffolding successfully completed!"
