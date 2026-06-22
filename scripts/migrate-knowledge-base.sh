#!/usr/bin/env bash
# Migrate an existing Shape Up SDLC install to the team-shared, per-skill knowledge base.
#
# Background (plugin >= 0.2.5 / tech-lead 0.12):
#   OLD: /coach wrote one flat file at  .shapeup-sdlc/knowledge-base.md
#        — gitignored (never reached teammates) and never read back by any skill.
#   NEW: /coach files each rule, by skill, under  docs/shapeup-sdlc/knowledge-base/<skill>.md
#        — committed (shared on `git pull`) and read back at the top of each worker's run.
#        Coachable skills: task-executor, ba-pitch-analyzer, qa-edge-hunter.
#
# What this script does (idempotent, non-destructive):
#   1. Asks which AI CLI(s) you use (Claude Code / Antigravity / Codex) and REPLACES the installed
#      skill files in the right location for each — so the new coach gate + read-back hooks go live.
#   2. Creates docs/shapeup-sdlc/knowledge-base/ (committed) with a README.
#   3. If an old .shapeup-sdlc/knowledge-base.md exists, preserves its rules verbatim into
#      docs/shapeup-sdlc/knowledge-base/_INBOX.md for re-categorization, then retires the old
#      file (renamed to *.migrated). It NEVER auto-assigns rules to a skill — categorization is
#      the PO's call at /coach's GATE COACH-1 (the harness never assumes which skill owns a rule).
#
# CLI selection + skill replacement is handled by the shared lib-harness.sh.

set -e

# -- Shared lib ----------------------------------------------------------------
# Local clone → source the sibling file. Piped (curl | bash) → download it first.
REPO="${REPO:-nguyenvanphituoc/shapeup-sdlc-plugin}"
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

# -- Defaults ------------------------------------------------------------------
TARGET_DIR="."
YES_MODE=false

# -- Help ----------------------------------------------------------------------
print_usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -d, --directory <path>  Target project directory (default: current directory)"
  echo "  -y, --yes               Run unattended (answer yes to all prompts)"
  echo "  -h, --help              Print this help message"
}

# -- Arg parsing ---------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -d|--directory) TARGET_DIR="$2"; shift ;;
    -y|--yes)       YES_MODE=true ;;
    -h|--help)      print_usage; exit 0 ;;
    *) echo "Unknown parameter: $1"; print_usage; exit 1 ;;
  esac
  shift
done

# -- Resolve paths -------------------------------------------------------------
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
OLD_KB="$TARGET_DIR/.shapeup-sdlc/knowledge-base.md"
NEW_KB_DIR="$TARGET_DIR/docs/shapeup-sdlc/knowledge-base"
INBOX="$NEW_KB_DIR/_INBOX.md"
README="$NEW_KB_DIR/README.md"

echo "Migrating Shape Up SDLC knowledge base in: $TARGET_DIR"
echo "  from: .shapeup-sdlc/knowledge-base.md            (old, local, gitignored)"
echo "  to:   docs/shapeup-sdlc/knowledge-base/<skill>.md (new, committed, read-back)"

# -- Confirmation --------------------------------------------------------------
if [ "$YES_MODE" = false ]; then
  if [ -t 0 ]; then
    read -p "Proceed? [y/N] " -n 1 -r
  elif [ -c /dev/tty ]; then
    read -p "Proceed? [y/N] " -n 1 -r < /dev/tty
  else
    echo "Warning: Non-interactive environment detected and no --yes option provided."
    echo "Please run with --yes (-y) to migrate in non-interactive environments."
    exit 1
  fi
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 1
  fi
fi

# -- 1. Replace the installed skill files (per chosen CLI) ---------------------
export HARNESS_YES="$YES_MODE"
harness_resolve_source
if harness_select_clis "$TARGET_DIR"; then
  harness_replace_skills "$TARGET_DIR"
else
  echo "Skipping skill replacement (no CLI selected) — continuing with data migration only."
fi

# -- 2. Scaffold the committed knowledge-base directory ------------------------
mkdir -p "$NEW_KB_DIR"

if [ ! -f "$README" ]; then
  cat > "$README" <<'EOF'
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
  echo "Created $README"
else
  echo "README already present — left as-is"
fi

# -- 3. Migrate the old flat knowledge base (if any) ---------------------------
if [ -f "$OLD_KB" ] && [ -s "$OLD_KB" ]; then
  echo "Found old knowledge base: $OLD_KB"

  # Preserve old rules verbatim into the inbox (append if it already exists — never clobber).
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
    cat "$OLD_KB"
    echo ""
  } >> "$INBOX"
  echo "Preserved old rules into $INBOX (pending /coach categorization — not auto-assigned)"

  # Retire the old file so no one mistakes it for the active source. It lives under the
  # gitignored .shapeup-sdlc/ root, so the .migrated backup stays out of version control.
  mv "$OLD_KB" "$OLD_KB.migrated"
  echo "Retired old file → $OLD_KB.migrated (gitignored backup; safe to delete)"
else
  echo "No old .shapeup-sdlc/knowledge-base.md found — nothing to migrate (fresh-model setup only)."
fi

# -- Done ----------------------------------------------------------------------
echo ""
echo "Migration complete — skills replaced for: ${HARNESS_CLIS[*]:-none}"
echo "Next steps:"
echo "  1. If $INBOX was created, run /coach on its rules to categorize them per skill."
echo "  2. Commit docs/shapeup-sdlc/knowledge-base/ so your team inherits the guidelines on git pull."
