#!/usr/bin/env bash
# Migration 0006 — ADR-0001 storage-root rename.
#
# Sourced by lib-migrate.sh's runner. Must define MIGRATION_DESC + migration_up(); must be
# idempotent (the runner only calls it once per project, but re-running by hand must be safe).
#
# WHAT CHANGED, AND WHY IT NEEDS A MIGRATION.
#
#   docs/shapeup-sdlc/  →  shapeup/     (committed deliverable)
#   .shapeup-sdlc/      →  .shapeup/    (gitignored run trace)
#
# The code arrives with `harness_replace_skills` in migrate.sh step 1 and needs nothing from here.
# What does NOT arrive that way is the project's own DATA: an upgrading project has a spec tree,
# scope contracts and a run trace sitting under the old roots. Post-upgrade the harness resolves
# every path through `skills/tech-lead/scripts/lib/paths.mjs`, which now says `shapeup/` — so
# without this step the run's own history becomes invisible to it. Not an error: the guards fail
# open on a missing artifact, so the failure mode is a run that silently starts over.
#
# WHY THE COMMITTED ROOT MOVED OUT OF docs/. Many projects publish `docs/` through a static-site
# generator. The spec tree either got published by accident or broke the site build, and neither
# is something a harness should do to someone's repository.
#
# WHAT THIS DOES NOT DO. It does not `git add`, `git rm` or commit. Moving tracked files is a
# change the PO reviews and commits themselves — a migration that rewrites someone's index is a
# migration people stop running. `git status` after this shows the rename; that is intended.

MIGRATION_DESC="ADR-0001: move docs/shapeup-sdlc/ to shapeup/ and .shapeup-sdlc/ to .shapeup/, and ignore the new local root"

migration_up() {
  local target="$1"

  # -- 1. The committed deliverable ------------------------------------------------------------
  # `git mv` when the tree is a repo and the source is tracked, so history follows the file;
  # plain `mv` otherwise. Either way the PO reviews and commits the result.
  if [ -d "$target/docs/shapeup-sdlc" ]; then
    if [ -e "$target/shapeup" ]; then
      echo "    [skip] both docs/shapeup-sdlc/ and shapeup/ exist — merge them by hand, then re-run"
    else
      if git -C "$target" rev-parse --is-inside-work-tree >/dev/null 2>&1 &&
         [ -n "$(git -C "$target" ls-files docs/shapeup-sdlc 2>/dev/null)" ]; then
        git -C "$target" mv docs/shapeup-sdlc shapeup 2>/dev/null || mv "$target/docs/shapeup-sdlc" "$target/shapeup"
        echo "    moved docs/shapeup-sdlc/ -> shapeup/ (staged; review and commit)"
      else
        mv "$target/docs/shapeup-sdlc" "$target/shapeup"
        echo "    moved docs/shapeup-sdlc/ -> shapeup/"
      fi
      # An empty docs/ left behind by the move is noise the project did not ask for.
      rmdir "$target/docs" 2>/dev/null && echo "    removed the now-empty docs/"
    fi
  else
    echo "    [skip] no docs/shapeup-sdlc/ — nothing to move (fresh install or already migrated)"
  fi

  # -- 2. The run trace ------------------------------------------------------------------------
  # Gitignored, so a plain mv is correct — there is no index entry to preserve.
  if [ -d "$target/.shapeup-sdlc" ]; then
    if [ -e "$target/.shapeup" ]; then
      echo "    [skip] both .shapeup-sdlc/ and .shapeup/ exist — remove the stale one by hand"
    else
      mv "$target/.shapeup-sdlc" "$target/.shapeup"
      echo "    moved .shapeup-sdlc/ -> .shapeup/"
    fi
  else
    echo "    [skip] no .shapeup-sdlc/ — nothing to move"
  fi

  # -- 3. Ignore rules -------------------------------------------------------------------------
  # BOTH roots stay listed. A project may be part-way through this migration, or carry an old
  # trace someone restored from a branch; a run trace committed in that window is exactly what
  # the tier split exists to prevent. Ignoring a directory that does not exist costs nothing.
  local gitignore="$target/.gitignore"
  if [ -f "$gitignore" ]; then
    if ! grep -qE '^\.shapeup/$' "$gitignore"; then
      printf '\n# Shape Up SDLC run workspace (ADR-0001 rename; both roots kept during migration)\n.shapeup/\n' >> "$gitignore"
      echo "    added .shapeup/ to .gitignore"
    else
      echo "    [skip] .shapeup/ already ignored"
    fi
  else
    printf '# Shape Up SDLC run workspace\n.shapeup/\n.shapeup-sdlc/\n' > "$gitignore"
    echo "    created .gitignore with the run-workspace rules"
  fi

  # -- 4. Stale absolute references in the project's own committed prose ------------------------
  # AGENTS.md carries the harness block, which names both roots. Left stale it tells the model to
  # write where nothing reads. Rewritten in place; anything else the project wrote about the old
  # paths is the PO's to update, and `git grep` after this migration finds it.
  local agents="$target/AGENTS.md"
  if [ -f "$agents" ] && grep -q 'shapeup-sdlc' "$agents"; then
    # `scripts/shapeup-sdlc/` is the PLUGIN's own directory and `shapeup-sdlc-plugin` is the
    # package name — neither is a storage root, so both are protected from the rewrite.
    if command -v perl >/dev/null 2>&1; then
      perl -0pi -e '
        s{scripts/shapeup-sdlc}{\x00SCRIPTS\x00}g;
        s{shapeup-sdlc-plugin}{\x00PLUGIN\x00}g;
        s{docs/shapeup-sdlc}{shapeup}g;
        s{\.shapeup-sdlc}{.shapeup}g;
        s{\x00SCRIPTS\x00}{scripts/shapeup-sdlc}g;
        s{\x00PLUGIN\x00}{shapeup-sdlc-plugin}g;
      ' "$agents"
      echo "    rewrote storage-root references in AGENTS.md"
    else
      echo "    [skip] perl not available — update the storage-root paths in AGENTS.md by hand"
    fi
  fi

  echo "    NOTE: the moves are on disk but NOT committed. Review 'git status' and commit the rename."
}
