# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Index

Ids are stable handles: a plan, a commit subject and an acceptance pass all name the same row.
Tier comes from `docs/design/plans/which-defect-first.md`; an entry leaves this file when its fix
is pinned by a guard, never when it is merely believed done.

| id | defect | tier |
|---|---|---|
| HD-023 | workspace trust discards the grant in a fresh clone | outside the plugin |
| HD-024 | the auto-mode classifier blocks the courier's calls | outside the plugin |
| HD-025 | two run geometries this checkout cannot reach | process |
| HD-071 | a lens-③ finding asserts screen state from one dumpLayout, uncorrected for occlusion or relaunch reseed | P2 |

## Defects

- **HD-071 · A lens-③ (state interruption) finding asserts screen state from one `dumpLayout`,
  uncorrected for what covers the screen or what a relaunch actually resets.** Filed 2026-09-29 from
  two independent hunts on one consumer, both hand-falsified.

  Two lens-③ findings, two different runs, two different pitches, worded almost identically
  ("not merely a screen-navigation refresh gap, but a summary that never resyncs" /
  "the same render-staleness class... still live"), and both wrong on the same axis when reproduced
  by hand on the device:

  - **settle-across-screens' QA-001.** The hunter reported a stale "done" badge that "survives a
    full `aa force-stop` + relaunch of the app." Reproduced: the badge-goes-stale-across-navigation
    half is real. The relaunch half is not — the store is in-memory and reseeds on launch, so the
    count after a relaunch is the correct seeded value, not evidence of anything surviving. The
    hunter never diffed the post-relaunch value against the known seed data before asserting
    persistence.
  - **lists-badge-sync's QA-002.** The hunter reported that adding an item "makes an already-
    rendered done item vanish" and that this "survives a full `aa force-stop` + relaunch." Both
    reproduced false on hand repro: the item never left the tree — the soft keyboard covered it,
    and `dumpLayout` does not distinguish a node genuinely removed from one merely off-screen or
    under an overlay. Dismissing the keyboard (one `back` step) put it straight back.

  The mechanism is the same in both: the hunter reads one layout dump as ground truth for "is this
  on screen" with no occlusion check (keyboard, dialog, any overlay), and asserts cross-relaunch
  persistence with no comparison against the seeded data it could read from the same fixture that
  seeded the app. Neither failure mode is covered anywhere in `skills/qa-edge-hunter/SKILL.md` —
  its only "covered" concept is EVAL-probed territory, unrelated to screen occlusion.

  Both false claims still cost real time: each one drove a full shape-and-repro cycle before the
  actual defect (or non-defect) was found by hand.

  **Closed when:** the hunter's own charter method requires, before a "gone"/"vanished" finding, one
  more step that closes any open overlay (keyboard, dialog) and re-checks; and before a "survives a
  relaunch" finding, a diff against the seed fixture's known value — both asserted in a fixture
  that plants a covered-but-present node and a reseed-to-the-same-looking-value case, and confirms
  the hunter's own report no longer claims either.


This file stays short on purpose. It is a queue, not an archive.
