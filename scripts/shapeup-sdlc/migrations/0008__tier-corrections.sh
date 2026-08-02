#!/usr/bin/env bash
# Migration 0008 — ADR-0001 tier corrections.
#
# Sourced by lib-migrate.sh's runner. Must define MIGRATION_DESC + migration_up(); must be
# idempotent (the runner only calls it once per project, but re-running by hand must be safe).
#
# THREE ARTIFACTS WERE IN THE WRONG TIER. Each for its own reason:
#
#   shapeup/<slug>/round-ledger.md  ->  .shapeup/<slug>/round-ledger.md
#       Committed, and APPENDED TO DURING a build round — so every run left the working tree dirty
#       in the deliverable tier while it was still building. Its conclusions reach the team in
#       REPORT.md at GATE L4 instead, frozen once rather than churning.
#
#   shapeup/metrics/*.jsonl         ->  .shapeup/metrics/*.jsonl
#       Committed and sharded on `process.env.HOSTNAME`, which put a person's laptop name in the
#       repository, and append-only JSONL in git only grows.
#
#   shapeup/gate-answers.json       ->  DELETED (with a loud notice)
#       This one is a SAFETY correction, not tidying. The committed answer set was AUTO-DISCOVERED
#       with no flag, so a file with `preset: ci` pre-approved GATE L4 ship sign-off for everyone
#       who pulled the repo. Consent is now per-machine by construction: nothing committed can
#       cross a gate on another person's behalf.
#
# The spec working-note split (synthesis.md, assess-report.md, feedback.md, api-feasibility.md,
# integration.md leaving the committed spec/) is NOT done here. Those are regenerated on the next
# analyze/reconcile run into the LOCAL tier, and deleting a teammate's committed analysis on their
# behalf is not a migration's call — it is flagged instead.

MIGRATION_DESC="ADR-0001 tier corrections: round-ledger and metrics move local; a committed gate-answers.json is removed (it pre-approved ship sign-off repo-wide)"

migration_up() {
  local target="$1"
  local shared="$target/shapeup"
  local local_root="$target/.shapeup"

  if [ ! -d "$shared" ]; then
    echo "    [skip] no shapeup/ directory — nothing to correct (run migration 0006 first)"
    return 0
  fi

  # -- 1. round-ledger.md, per slug ------------------------------------------------------------
  local moved_ledgers=0
  for ledger in "$shared"/*/round-ledger.md; do
    [ -e "$ledger" ] || continue
    local slug dest
    slug="$(basename "$(dirname "$ledger")")"
    dest="$local_root/$slug/round-ledger.md"
    if [ -e "$dest" ]; then
      echo "    [skip] $slug: a local round-ledger.md already exists — merge by hand"
      continue
    fi
    mkdir -p "$(dirname "$dest")"
    if git -C "$target" rev-parse --is-inside-work-tree >/dev/null 2>&1 &&
       [ -n "$(git -C "$target" ls-files "shapeup/$slug/round-ledger.md" 2>/dev/null)" ]; then
      # Tracked: remove from the index so the deletion is reviewable, keep the content locally.
      cp "$ledger" "$dest"
      git -C "$target" rm -q --cached "shapeup/$slug/round-ledger.md" 2>/dev/null || true
      rm -f "$ledger"
    else
      mv "$ledger" "$dest"
    fi
    moved_ledgers=$((moved_ledgers + 1))
    echo "    moved shapeup/$slug/round-ledger.md -> .shapeup/$slug/round-ledger.md"
  done
  [ "$moved_ledgers" -eq 0 ] && echo "    [skip] no committed round-ledger.md found"

  # -- 2. metrics shards -----------------------------------------------------------------------
  if [ -d "$shared/metrics" ]; then
    mkdir -p "$local_root/metrics"
    local moved_shards=0
    for shard in "$shared"/metrics/*.jsonl; do
      [ -e "$shard" ] || continue
      local name="$(basename "$shard")"
      if [ -e "$local_root/metrics/$name" ]; then
        cat "$shard" >> "$local_root/metrics/$name"   # append-only: concatenating is correct
      else
        cp "$shard" "$local_root/metrics/$name"
      fi
      moved_shards=$((moved_shards + 1))
    done
    if git -C "$target" rev-parse --is-inside-work-tree >/dev/null 2>&1 &&
       [ -n "$(git -C "$target" ls-files shapeup/metrics 2>/dev/null)" ]; then
      git -C "$target" rm -q -r --cached shapeup/metrics 2>/dev/null || true
    fi
    rm -rf "$shared/metrics"
    echo "    moved $moved_shards metrics shard(s) -> .shapeup/metrics/ (removed from the index)"
  else
    echo "    [skip] no shapeup/metrics/ found"
  fi

  # -- 3. the committed gate answer set --------------------------------------------------------
  if [ -f "$shared/gate-answers.json" ]; then
    mkdir -p "$local_root"
    if [ ! -e "$local_root/gate-answers.json" ]; then
      cp "$shared/gate-answers.json" "$local_root/gate-answers.json"
      echo "    copied the answer set to .shapeup/gate-answers.json (yours alone now)"
    fi
    if git -C "$target" rev-parse --is-inside-work-tree >/dev/null 2>&1 &&
       [ -n "$(git -C "$target" ls-files shapeup/gate-answers.json 2>/dev/null)" ]; then
      git -C "$target" rm -q --cached shapeup/gate-answers.json 2>/dev/null || true
    fi
    rm -f "$shared/gate-answers.json"
    echo "    !! REMOVED the COMMITTED gate-answers.json. It was auto-discovered with no flag, so"
    echo "       every teammate who pulled it crossed gates — including GATE L4 ship sign-off —"
    echo "       on its authority. Each machine now answers its own gates."
  else
    echo "    [skip] no committed gate-answers.json — nothing to remove"
  fi

  # -- 4. flag committed working notes ---------------------------------------------------------
  # `find`, not a glob: an unmatched glob is left literal by bash but is a hard ERROR in zsh, and
  # a migration that aborts because a file was absent is worse than the tidiness it was checking.
  local notes=""
  local hit
  while IFS= read -r hit; do
    [ -n "$hit" ] && notes="$notes\n      ${hit#$target/}"
  done < <(find "$shared" -mindepth 3 -maxdepth 3 -path "*/spec/*" \( \
      -name synthesis.md -o -name assess-report.md -o -name feedback.md \
      -o -name api-feasibility.md -o -name integration.md \) 2>/dev/null | sort)
  if [ -n "$notes" ]; then
    echo "    NOTE: these are working notes, not contract — they belong in .shapeup/<slug>/working/:"
    printf "%b\n" "$notes"
    echo "      They regenerate there on the next analyze/reconcile run. Delete the committed"
    echo "      copies when you are ready; this migration will not remove your analysis for you."
  fi

  echo "    NOTE: index changes are staged but NOT committed. Review 'git status'."
}
