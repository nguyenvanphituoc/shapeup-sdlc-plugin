---
type: run-state
feature: FEATURE_SLUG
last_run: YYYY-MM-DD
skill_version: "2.8"
lens: lite | standard
pitch_hash: HASH
assess_done: false
assess_l0_score: 0
assess_confidence: 0
phases_completed: []
phases_skipped: []
files_generated: []
human_edited_files: []
discovered_rounds: 0
upgrade_available: standard | cross-context | none
upgrade_adds: []
---

# Run State: FEATURE TITLE

> Internal file — do not edit manually.
> Used by skill to enable incremental upgrades and Phase 0 cache reuse.

## Phases

| Phase | Status | Skipped Reason |
|-------|--------|---------------|
| 0 Assess | ✅ done / ⬜ skipped | — |
| 1 Ingest | ✅ done / ♻️ cached | cached from Phase 0 |
| 1b API Feasibility | ✅ done / ⬜ skipped | no third-party detected |
| 2 DDD Analysis | ✅ done | — |
| 2b Contracts | ✅ done / ⬜ skipped | lite mode |
| 3 UX Behavior | ✅ done | — |
| 4 Use Cases | ✅ done | — |
| 5 Integration | ✅ done / ⬜ skipped | lite mode |
| 6 Tasks | ✅ done | — |
| 7a Audit | ✅ done | — |
| 7b Scope Summary | ✅ done | — |
| 7c Synthesis | ✅ done | — |
| 8 Index | ✅ done | — |

## Files Generated

<!-- Auto-populated after run — one entry per file -->
- path/to/file.md

## Human-Edited Files

<!-- Populated when upgrade detects mtime > generation timestamp -->
<!-- These files will NOT be overwritten on upgrade -->
- path/to/file.md — edited YYYY-MM-DD

## Upgrade Available

```bash
# Check current upgrade options
/ba-pitch-analyzer --status docs/shapeup-sdlc/FEATURE_SLUG/spec/

# Upgrade to standard lens (adds contracts + integration + full synthesis)
/ba-pitch-analyzer --upgrade standard docs/shapeup-sdlc/FEATURE_SLUG/spec/

# Upgrade specific module only
/ba-pitch-analyzer --upgrade contracts docs/shapeup-sdlc/FEATURE_SLUG/spec/
/ba-pitch-analyzer --upgrade synthesis docs/shapeup-sdlc/FEATURE_SLUG/spec/
```

## Metrics

```
assess_tokens_est  : N–N
actual_tokens      : N        (filled post-run)
assess_ucs_est     : N
actual_ucs         : N        (filled post-run)
assess_tasks_est   : N–N
actual_tasks       : N        (filled post-run)
```
