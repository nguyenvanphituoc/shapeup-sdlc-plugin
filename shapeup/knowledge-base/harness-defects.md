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
| HD-069 | an orchestrated EVAL grades one dimension, whatever the spec carries | P1 |
| HD-051 | a build leg can forge a CONCURRENTLY-LIVE sibling's WorkResult — narrowed, and the guard cannot see who writes | P2 |
| HD-023 | workspace trust discards the grant in a fresh clone | outside the plugin |
| HD-024 | the auto-mode classifier blocks the courier's calls | outside the plugin |
| HD-025 | two run geometries this checkout cannot reach | process |
| HD-070 | a relaunched closed run re-signs its planning gates before it reopens | P3 |

## Defects

- **HD-069 · An orchestrated EVAL grades one dimension, whatever the spec carries.** Filed
  2026-09-29 from the consumer's run trace, then confirmed in the source.

  Every run ledger is opened with `eval_dimensions: [spec-conformance]` (the kernel's default when
  `--dimensions` is not given), and the run passes that list to every evaluate order as
  `dimensions`. The judge's own rule is that an explicit list overrides its auto-enable rules, so
  `test-surface-conformance` (any UC with a Test Surface), `completeness` (any UC with Invariants)
  and the always-on `tdd-surface` never become active in an orchestrated run. The default has been
  in place since the kernel got one entry point. Measured on the consumer: 101 criterion verdicts
  across seven exported runs, all 101 `spec-conformance`, over specs whose use cases all carry a
  Test Surface. The L4 block does say so ("not evaluated: tdd-surface, integration, completeness,
  test-surface-conformance"), but the EVAL row of the phase table promises spec- plus
  test-surface-conformance.

  It stayed hidden because a PASS has named every Test Surface row since the per-row rule shipped,
  so those rows are graded, but under `spec-conformance` and its threshold rather than their own.
  The dimension's contract also covers recording probed rows as QA's negative space, and no
  dimension grades that tasks exist or that each scope has a companion test.

  The fix is a choice for the PO, because turning dimensions on can turn today's PASSes into FAILs.
  Recommended: the kernel resolves the active set from the spec at compile time, using the same
  rules the judge states, and writes the resolved list to the ledger. The set is then a derived,
  ledgered fact, not a default nobody chose. The other option is to stop passing a list and let the
  judge resolve it, which leaves the set unrecorded.

  **Closed when:** an evaluate order compiled over a spec whose use cases carry a Test Surface names
  `test-surface-conformance` without `--dimensions`, the ledger records the resolved set, and a
  fixture pins both.

- **HD-070 · A relaunched closed run re-signs its planning gates before it reopens.** Filed
  2026-09-29 from the consumer's reopen soak.

  The run was killed mid-BUILD, closed `aborted` at 11:54:41, relaunched and shipped. The reopen
  worked as designed. The ledger moved the abort to `prior_closes`, but only at 11:59:08, when the
  first `building` status write took the close back. Before that, the fast-forward crossed L1a,
  L1a.5 and L1b again (11:58:22–11:59:04), so three sign-offs sit inside the window where the
  run's own record says it is closed. The Decisions table then lists each of those gates twice, with
  nothing to tell a second launch from a double sign-off (the pattern the L4 fix removed for the
  ship gate). Nothing was built over the closed run and no worker was dispatched in the window.
  The canary dispatch and a fast-forwarded Orient were the only traffic. So this is a ledger
  defect, not an enforcement one. An interactive relaunch would ask the PO to re-sign three reviews
  of artifacts that did not change.

  **Closed when:** a relaunch over a closed run reopens it before its first gate resolves, and a gate
  row carries the launch it belongs to, or a relaunch that fast-forwards a gate reuses that gate's
  row from the same run. A fixture drives an abort → relaunch → the first gate.

- **HD-051 · A build leg can forge a concurrently-live sibling's WorkResult.** Filed 2026-09-24 by
  the acceptance pass on the attestation freeze; narrowed and re-measured 2026-09-25.

  The window is smaller than it was. A build order now freezes the whole run trace and carves out
  what the leg authors — its own result, its task files, the discovery ledger, its spikes — so a
  leg can no longer write a result for an order that is not live at all, nor any of the kernel's
  records. What remains is exactly the concurrent case: while a sibling's order is live, that
  sibling's contract claims its own result path, and the guard fires on a tool call without knowing
  which leg made it. Driven with two live build orders: the write lands.

  This is a limit of the primitive, not a missing glob. The hook sees a path and a working
  directory; nothing in a `Write` identifies the dispatch behind it, so an exception granted to one
  order answers for anyone while both are live. Two ways out, and both move the pen rather than
  widen the list: have `reduce ingest` write the envelope from what the leg hands it, so no leg
  writes into `results/` at all; or give the ingest step the chain it already has the material for,
  so a row nobody minted fails verification wherever it is read.

  **Closed when:** a leg writing a result for an order that is not its own is refused WITH a sibling
  order concurrently live, while its own result still lands, and a fixture drives both.

This file stays short on purpose. It is a queue, not an archive.
