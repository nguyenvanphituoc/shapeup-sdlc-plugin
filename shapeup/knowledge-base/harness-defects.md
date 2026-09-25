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
| HD-068 | the reachability oracle cannot walk the consumer's language, and reports `checked: true` with every engine unreachable | P1 |
| HD-067 | the board's `covers:` clauses are instructed and not enforced — a regenerated board can carry none, and the matrix then reads no evidence for everything | P2 |
| HD-027 | two harness rules collide, and the collision hard-aborts a run at L1b | P1 |
| HD-021 | a per-scope "it compiles" fixture can be green while the scope's code is unreachable | P3 |
| HD-051 | a build leg can forge a CONCURRENTLY-LIVE sibling's WorkResult — narrowed, and the guard cannot see who writes | P2 |
| HD-023 | workspace trust discards the grant in a fresh clone | outside the plugin |
| HD-024 | the auto-mode classifier blocks the courier's calls | outside the plugin |
| HD-025 | two run geometries this checkout cannot reach | process |

## Defects

- **HD-068 · The reachability oracle cannot walk the consumer's language, and says it checked.**
  Measured 2026-09-25 against the live consumer's own trace reports, both features.

  `reachableFrom` resolves an import by trying the path as written and then appending each of
  `.js .mjs .cjs .jsx .ts .tsx`. The consumer is an ArkTS project: its modules are `.ets`, and one
  `.ets` importing another resolves to nothing. Driven from the profile's own `entry_point`, the
  reachable set is **2 files** — the entry itself and the single `.ts` it imports — out of 40 `.ets`
  sources in the app.

  Every engine the wiring map names is therefore reported unreachable, and the oracle says so with
  `checked: true, pass: false`: `about-screen` 6 of 6, `find-my-todos` 3 of 3, one `UC-UNREACHABLE`
  red apiece. A check that is red for every input on a stack carries no information, and this one
  does worse than carry none — it claims to have looked. The reports are advisory, so nothing was
  blocked; what was produced is nine findings that read like evidence and are an artefact of the
  extension list.

  Two other stacks would fail the same way (`.vue`, `.svelte`), and any stack whose imports are not
  relative paths (bare module specifiers, path aliases, `@kit.*`) already resolves to nothing here —
  which is why the entry file's four imports yielded one edge.

  **Closed when:** the walker either resolves the stack's own module extensions — taken from the
  project profile, which already declares the stack — or reports `checked: false` with the reason,
  so "cannot be walked here" stops being spelled the same way as "nothing reaches the entry point".

- **HD-067 · The board's `covers:` clauses are instructed and not enforced.** Measured 2026-09-25
  across two consecutive runs of one pitch, same spec, same plugin line.

  The `board` operation's own brief says to regenerate the board "every acceptance criterion
  carrying its `(covers: REQ-…)` clause". One run's board carried **thirty** such clauses and its
  frozen report read `4/11 PASS`; the next run's board carried **zero**, and the report read
  `0/11 PASS · 7 no evidence` over a run whose static criteria passed exactly as before. Nothing
  went red in between: L1b's `REQ-UNCOVERED` is satisfied by the scope contract's own
  `covers: [REQ-…]` list, which is a different mechanism from the one the matrix reads, so a board
  with no clauses at all crosses the gate.

  So the harness has two bars for one question. The gate asks "does anything in the plan claim this
  requirement" and a scope claim answers it; the projection asks "did a criterion a judge graded
  cover it" and only an AC clause answers that. A plan can satisfy the first and be silent to the
  second, and the difference is invisible until the report prints "no evidence" for everything.

  The instruction is not the fix: a worker carries no lesson across a dispatch, and this one was
  followed on Tuesday and not on Wednesday. Candidate shapes, unranked: warn at L1b when a registry
  exists and the board carries no `covers:` clause at all, naming what the matrix will read; have
  `reduce ingest` refuse a board result whose tasks carry none while a registry exists; or make the
  scope-claim path feed the matrix too, so the two bars become one.

  **Closed when:** a board with no `covers:` clause cannot reach BUILD unremarked while a
  requirements registry is on disk, and a fixture drives both boards — one with clauses, one
  without — through the same gate.

- **HD-027 · Two harness rules collide, and the collision hard-aborts a run at L1b.** Promoted from
  a consumer register (`proj-harmony-os-sample`, filed there as `HD-1`, 2026-09-21). `harness init
  run` normalizes the pitch into the **gitignored** run tier at `.shapeup/<slug>/intake.md`, and
  that is the path `ba-pitch-analyzer` is handed and actually reads. `requirements.md` is a
  **committed** artifact, and spec-lint's `TIER-DIRECTION` rule forbids a committed file from
  naming a `.shapeup/` path — correctly, because the path dangles on every other clone. A worker
  that cites its real source produces a registry its own lint reds.

  Measured in run `find-my-todos-20260921T142815Z-b80de580`, unattended lane: ORIENT, ANALYZE,
  WIRE and MAP SCOPES all completed — 25 agent dispatches, ~28 minutes, ~1.17M subagent tokens —
  and the run then aborted at GATE L1b on a single `TIER-DIRECTION` red, over one sentence of
  provenance prose: *"Atomic requirement clauses extracted from `.shapeup/find-my-todos/intake.md`."*
  The abort lands after the whole planning stretch is already paid for, and on the unattended lane
  there is no human present to spend ten seconds fixing a sentence.

  **Why this is not a rule for `ba-pitch-analyzer` alone.** A rule telling the analyzer "never
  write a `.shapeup/` path into a committed file" would suppress this one instance, but the
  analyzer still has no *correct* path to name — it does not necessarily know which committed
  artifact the intake was copied from (`shaping.md`, a `pitch.md`, or a `--breadboard`-named file
  elsewhere). The fix belongs upstream of the worker's prose, not in guidance to it.

  Also measured: the craft docs teach the rule more narrowly than the lint enforces it —
  `skills/ba-pitch-analyzer/references/doc-schemas.md` stated tier-direction purely in wikilink
  terms (`never [[tasks/...]]`), while the lint reds *any* line naming a `.shapeup/` path. A
  worker following only the docs had no way to know a plain provenance sentence would red.

  **Closed when:** the taught rule and the enforced rule state the same constraint — a committed
  doc may not name a `.shapeup/` path in any form, wikilink or bare prose — and a `coverage`
  dispatch over a pitch staged in the run tier produces a `requirements.md` clean of
  `TIER-DIRECTION` findings, driven end to end rather than inferred from the worker's prose.

  **Half of that is done; the half that keeps this entry open is evidence, not code.** The taught
  and enforced rules agree (pinned by a guard), and since 3.7.1-rc.4 the collision is no longer
  writable at all — the write is refused at the boundary with the offending token quoted back, so a
  worker cannot produce the file that reds. What has still never been driven is the end-to-end leg
  the criterion asks for: a real `coverage` dispatch over a pitch staged in the run tier, producing
  a `requirements.md` with no `TIER-DIRECTION` findings. That is a consumer run, not a fixture, and
  it is deliberately the last thing holding this row open.

  **Measured 2026-09-23 on the consumer, rc.5 installed from the marketplace — the collision fired
  and the run did not notice.** A fresh pitch (`about-screen`), a real run, planning dispatched for
  real. At 07:17:11 the analyzer tried to write a committed `spec/_index.md` citing the breadboard
  by its staged run-tier path — the exact HD-027 shape, from a different worker and a different
  artifact than the one that was taught. The write was refused. At 07:17:29 the same worker wrote a
  committed file that linted clean, and four more clean committed writes followed at 07:17:46,
  07:18:07, 07:18:14. One denial, eighteen seconds, no retry loop; across the whole run the guard
  answered thirteen times, twelve of them permits carrying a rule.

  That settles the recovery question, which was the real risk in fronting a gate with a hook — a
  guard that denies correctly but wedges the run would be worse than the L1b abort it replaces. It
  does NOT settle this entry: the run was killed by the launcher's background-wait ceiling with
  ANALYZE in flight, so no `requirements.md` ever completed a full planning phase end to end. The
  registry it did write cites the pitch by section name and names no gitignored path, which is
  the outcome this entry asks for — from the coverage dispatch alone, not from the whole leg.

- **HD-021 · A per-scope "it compiles" fixture can be green while the scope's code is unreachable.** Measured
  on a stack whose build compiles only what the entry point reaches: three scopes were T0-green on an
  `assembleHap` fixture while their own files did not compile, and the errors surfaced only when a
  fourth scope wired the screens in — a scope that may not write those files. The round build gate
  (3.3.0) is what caught it, which is the design working; what is missing is attribution, and that
  lands on the same two entries above. Filed as craft, not mechanism: a scope's build fixture proves
  nothing until the scope's code is reachable, and the knowledge base is where that rule belongs.

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
