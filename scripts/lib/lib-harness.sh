#!/usr/bin/env bash
# lib-harness.sh — shared helpers for installing/replacing Shape Up SDLC skills.
#
# Sourceable library. Provides:
#   harness_resolve_source           → sets HARNESS_SOURCE_DIR + HARNESS_ANTIGRAVITY_DIST
#                                       (local clone, or downloads the latest release)
#   harness_detect_clis <target>     → echoes the CLIs already installed in <target>
#   harness_select_clis <target>     → sets HARNESS_CLIS[] (auto-detect under -y, else prompt)
#   harness_replace_skills <target>  → replaces skills for every CLI in HARNESS_CLIS[]
#
# CLI → install locations:
#   claude       .claude/skills/
#   antigravity  .agents/skills/  + .agents/subagents/ (+ subagents.json)
#   codex        .codex/skills/
#
# Callers must set HARNESS_YES=true for non-interactive runs. Designed to be sourced; it does
# not run anything on its own.

REPO="${REPO:-nguyenvanphituoc/shapeup-sdlc-plugin}"

# All CLIs the harness knows how to target.
HARNESS_ALL_CLIS=(claude antigravity codex)

# -- Resolve the skill source (local repo, or download the latest release) -----
# Mirrors install-harness.sh so both paths behave identically.
harness_resolve_source() {
  local lib_dir
  lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # lib lives at <repo>/scripts/lib/ — the repo root is two levels up.
  if [ -d "$lib_dir/../../skills" ]; then
    HARNESS_SOURCE_DIR="$(cd "$lib_dir/../.." && pwd)"
    HARNESS_ANTIGRAVITY_DIST="$HARNESS_SOURCE_DIR/dist/antigravity"
    echo "Using local source directory: $HARNESS_SOURCE_DIR"
    return 0
  fi

  echo "Local source not found. Downloading from latest GitHub Release..."
  local temp_dir
  temp_dir=$(mktemp -d)
  # Caller-independent cleanup.
  trap 'rm -rf "$temp_dir"' EXIT

  local release_api="https://api.github.com/repos/${REPO}/releases/latest"
  local release_json tarball_url subagents_url
  release_json=$(curl -fsSL "$release_api")
  tarball_url=$(echo "$release_json" | grep '"tarball_url"' | head -1 | sed 's/.*"tarball_url": *"\([^"]*\)".*/\1/')
  subagents_url=$(echo "$release_json" | grep '"browser_download_url"' | grep 'antigravity-subagents.zip' | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')

  if [ -z "$tarball_url" ]; then
    echo "Error: Could not fetch release tarball URL from $release_api"
    return 1
  fi

  echo "Downloading release source archive..."
  curl -fsSL "$tarball_url" | tar -xz -C "$temp_dir" --strip-components=1
  HARNESS_SOURCE_DIR="$temp_dir"
  HARNESS_ANTIGRAVITY_DIST="$temp_dir/dist/antigravity"

  if [ -n "$subagents_url" ]; then
    echo "Downloading antigravity-subagents.zip from release..."
    mkdir -p "$HARNESS_ANTIGRAVITY_DIST"
    curl -fsSL "$subagents_url" -o "$temp_dir/antigravity-subagents.zip"
    unzip -q "$temp_dir/antigravity-subagents.zip" -d "$temp_dir/antigravity-extract"
    local extracted
    extracted=$(find "$temp_dir/antigravity-extract" -type d -name "antigravity" | head -1)
    [ -n "$extracted" ] && cp -R "$extracted/"* "$HARNESS_ANTIGRAVITY_DIST/"
  else
    echo "Warning: antigravity-subagents.zip not in release assets — subagent configs will be skipped."
  fi
}

# -- Map a CLI key to its skills directory under a target ----------------------
harness_skills_dir() {
  local target="$1" cli="$2"
  case "$cli" in
    claude)      echo "$target/.claude/skills" ;;
    antigravity) echo "$target/.agents/skills" ;;
    codex)       echo "$target/.codex/skills" ;;
    *)           return 1 ;;
  esac
}

# -- Detect which CLIs are already installed in a target -----------------------
# Echoes a space-separated list (a CLI counts as present if its skills dir exists).
harness_detect_clis() {
  local target="$1" cli dir found=()
  for cli in "${HARNESS_ALL_CLIS[@]}"; do
    dir="$(harness_skills_dir "$target" "$cli")"
    [ -d "$dir" ] && found+=("$cli")
  done
  echo "${found[@]}"
}

# -- Parse a choice string → sets HARNESS_CLIS[] (unit-testable, no I/O) --------
# Args: <reply> <fallback-clis...>   ('1 3', '4'/'all', or empty → fallback).
harness_parse_cli_choice() {
  local reply="$1"; shift
  local fallback=("$@")

  if [ -z "${reply// /}" ]; then
    HARNESS_CLIS=("${fallback[@]}")
    return 0
  fi

  HARNESS_CLIS=()
  local n
  for n in $reply; do
    case "$n" in
      1|claude)      HARNESS_CLIS+=(claude) ;;
      2|antigravity) HARNESS_CLIS+=(antigravity) ;;
      3|codex)       HARNESS_CLIS+=(codex) ;;
      4|all|All|ALL) HARNESS_CLIS=("${HARNESS_ALL_CLIS[@]}"); return 0 ;;
      *) echo "Ignoring unknown choice: $n" >&2 ;;
    esac
  done
}

# -- Choose the CLIs to act on → sets HARNESS_CLIS[] ---------------------------
# Non-interactive (HARNESS_YES=true): use already-installed CLIs; if none, all three.
# Interactive: prompt, defaulting to the detected set (or all three if none detected).
harness_select_clis() {
  local target="$1"
  local detected fallback
  read -ra detected <<< "$(harness_detect_clis "$target")"
  if [ "${#detected[@]}" -gt 0 ]; then
    fallback=("${detected[@]}")
  else
    fallback=("${HARNESS_ALL_CLIS[@]}")
  fi

  if [ "${HARNESS_YES:-false}" = true ]; then
    HARNESS_CLIS=("${fallback[@]}")
    if [ "${#detected[@]}" -gt 0 ]; then
      echo "Auto-selected installed CLIs: ${HARNESS_CLIS[*]}"
    else
      echo "No existing install detected — targeting all CLIs: ${HARNESS_CLIS[*]}"
    fi
    return 0
  fi

  echo ""
  echo "Which AI CLI(s) are you using? Skills will be replaced for the ones you pick."
  echo "  1) Claude Code   (.claude/settings.json — marketplace plugin)"
  echo "  2) Antigravity   (.agents/skills/ + subagents)"
  echo "  3) Codex         (.codex/skills/)"
  echo "  4) All of them"
  echo "Enter numbers separated by spaces (e.g. '1 3'), or press Enter for default [${fallback[*]}]."

  # Prefer an interactive stdin; fall back to /dev/tty (curl|bash) or piped stdin (CI/tests).
  local reply=""
  if [ -t 0 ]; then
    read -r -p "> " reply || reply=""
  elif [ -c /dev/tty ]; then
    read -r -p "> " reply < /dev/tty 2>/dev/null || reply=""
  else
    read -r reply || reply=""
  fi

  harness_parse_cli_choice "$reply" "${fallback[@]}"

  if [ "${#HARNESS_CLIS[@]}" -eq 0 ]; then
    echo "No CLI selected — nothing to replace."
    return 1
  fi
  echo "Selected: ${HARNESS_CLIS[*]}"
}

# -- Install Claude Code plugin via marketplace --------------------------------
# Primary path  : use the claude CLI (marketplace add + plugin install --scope project).
#   This registers the marketplace in the live Claude Code session AND writes the
#   project-scoped settings.json, so /plugin install works immediately.
# Fallback path : write settings.json directly when the claude CLI is not in PATH.
#   The plugin auto-enables on the next session that opens this directory, but the
#   user must run /plugin marketplace add first if they want /plugin install manually.
harness_install_claude_plugin() {
  local target="$1"
  local settings_file="$target/.claude/settings.json"
  local marketplace_key="nvptuoc-marketplace"
  local plugin_key="shapeup-sdlc-plugin@nvptuoc-marketplace"

  mkdir -p "$target/.claude"

  if command -v claude >/dev/null 2>&1; then
    echo "  [claude] registering marketplace + installing plugin via claude CLI..."
    if (cd "$target" && \
        claude plugin marketplace add --scope project "nguyenvanphituoc/shapeup-sdlc-plugin" && \
        claude plugin install --scope project "shapeup-sdlc-plugin@nvptuoc-marketplace"); then
      echo "  [claude] plugin installed at project scope — run /reload-plugins to activate in a live session"
      return
    else
      echo "  [claude] Warning: claude CLI failed — falling back to writing settings.json directly"
    fi
  fi

  # Fallback: write settings.json manually (claude CLI absent or failed).
  if [ -f "$settings_file" ]; then
    if command -v jq >/dev/null 2>&1; then
      local tmp
      tmp="$(mktemp)"
      jq --arg mk "$marketplace_key" \
         --argjson mv '{"source":{"source":"github","repo":"nguyenvanphituoc/shapeup-sdlc-plugin"}}' \
         --arg pk "$plugin_key" \
         '.extraKnownMarketplaces[$mk] = $mv | .enabledPlugins[$pk] = true' \
         "$settings_file" > "$tmp" && mv "$tmp" "$settings_file"
      echo "  [claude] merged marketplace + plugin into $settings_file"
    elif command -v python3 >/dev/null 2>&1; then
      python3 - "$settings_file" "$marketplace_key" "$plugin_key" <<'PYEOF'
import json, sys
path, mk, pk = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f:
    data = json.load(f)
data.setdefault('extraKnownMarketplaces', {})[mk] = {
    "source": {"source": "github", "repo": "nguyenvanphituoc/shapeup-sdlc-plugin"}
}
data.setdefault('enabledPlugins', {})[pk] = True
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
PYEOF
      echo "  [claude] merged marketplace + plugin into $settings_file"
    else
      echo "  [claude] Warning: neither jq nor python3 found — cannot merge $settings_file"
      echo "           Add manually: extraKnownMarketplaces.$marketplace_key + enabledPlugins.$plugin_key"
    fi
  else
    cat > "$settings_file" <<'EOF'
{
  "extraKnownMarketplaces": {
    "nvptuoc-marketplace": {
      "source": { "source": "github", "repo": "nguyenvanphituoc/shapeup-sdlc-plugin" }
    }
  },
  "enabledPlugins": {
    "shapeup-sdlc-plugin@nvptuoc-marketplace": true
  }
}
EOF
    echo "  [claude] created $settings_file with marketplace + plugin"
    echo "  [claude] Note: run /plugin marketplace add nguyenvanphituoc/shapeup-sdlc-plugin"
    echo "           then /plugin install shapeup-sdlc-plugin@nvptuoc-marketplace in your session"
  fi
}

# -- Replace harness skills for one CLI ----------------------------------------
# Claude Code: configures the marketplace plugin in .claude/settings.json.
# Antigravity / Codex: per-skill replacement — each harness skill dir is removed
# then re-copied so upstream deletions don't linger while unrelated user skills stay.
harness_replace_skills_for_cli() {
  local target="$1" cli="$2"

  if [ "$cli" = "claude" ]; then
    harness_install_claude_plugin "$target"
    return
  fi

  local src="$HARNESS_SOURCE_DIR/skills"
  local dest
  dest="$(harness_skills_dir "$target" "$cli")"

  mkdir -p "$dest"
  local skill_path skill_name
  for skill_path in "$src"/*/; do
    [ -d "$skill_path" ] || continue
    # A valid skill has a SKILL.md; skip empty stubs (e.g. skill-evolver).
    [ -f "$skill_path/SKILL.md" ] || continue
    skill_name="$(basename "$skill_path")"
    rm -rf "${dest:?}/$skill_name"
    cp -R "$skill_path" "$dest/$skill_name"
  done
  echo "  [$cli] skills replaced in $dest"

  # Antigravity also carries compiled subagent configs.
  if [ "$cli" = antigravity ] && [ -d "$HARNESS_ANTIGRAVITY_DIST/subagents" ]; then
    local sub_dest="$target/.agents/subagents"
    mkdir -p "$sub_dest"
    cp -R "$HARNESS_ANTIGRAVITY_DIST/subagents/"* "$sub_dest/" 2>/dev/null || true
    [ -f "$HARNESS_ANTIGRAVITY_DIST/subagents.json" ] && cp "$HARNESS_ANTIGRAVITY_DIST/subagents.json" "$target/.agents/subagents.json"
    echo "  [antigravity] subagent configs replaced in $sub_dest"
  fi
}

# -- Replace skills for every selected CLI -------------------------------------
harness_replace_skills() {
  local target="$1" cli
  echo "Replacing skills for: ${HARNESS_CLIS[*]}"
  for cli in "${HARNESS_CLIS[@]}"; do
    harness_replace_skills_for_cli "$target" "$cli"
  done
}
