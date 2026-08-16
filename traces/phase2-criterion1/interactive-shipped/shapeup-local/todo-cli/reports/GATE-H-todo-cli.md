---
type: gate-h-report
feature: todo-cli
worker: scope-hammer
run_id: todo-cli-20260816T084725Z-ddb6d292
generated_at: 2026-08-16
redo_of: this file's prior version, generated when the order payload carried `qa_findings: 0`
  because the QA edge hunt had never actually dispatched (harness defect, filed
  shapeup/knowledge-base/harness-defects.md HD-001..HD-004). That version's "SHIP now, 2-item
  cut list" verdict is superseded by this one — same run, same round-2 EVAL PASS, now with the
  QA hunt's real 10-finding output folded into the census.
breaker: none (normal stop — round budget fully spent: EVAL PASS at round 2 of 2; QA edge hunt
  ran post-PASS, outside the build loop, per architecture)
baseline: approximate — shapeup/todo-cli/shaping/baseline.md does not exist; using idea.md's
  problem statement as the implicit baseline ("developers keep todos in their head and lose
  them" — the do-nothing status quo is no CLI at all, not a perfect todo tool)
---

# GATE H — Census, Baseline Comparison, Cut List — todo-cli (redone against real QA output)

## GATE H0 — Census

**Unresolved scopes:** none. Both `scope-cli-core` and `scope-integration-test` are T0-green
at round 2 (7/7 and 1/1 fixtures, 0 regressions) and EVAL passed FEATURE todo-cli at round 2
with 0 bugs, 31/31 criteria (`.shapeup/todo-cli/evaluation/EVAL-FEATURE-todo-cli.md`). The
round budget (`max_rounds: 2`) is fully spent — round 2 was used to close the `$TODO_STORE`
Test Surface gap (TS-INV-05) and reconfirm PASS, not held in reserve. `hammer_proposals` is
empty in this order's payload — no attempt-budget breaker fired.

Bookkeeping note (unchanged from the prior pass, still not a product gap): both
`shapeup/todo-cli/hill/*.yml` files still read `phase: DOWNHILL_EXECUTION` rather than
`FINISHED`, despite round-2 EVAL PASS on both scopes. Carried forward as a hygiene item.

**QA findings — 10, all real** (`.shapeup/todo-cli/qa/hunt-report.md`, ledger section
`## Discovered — todo-cli/hunt`). Every finding carries a live repro; QA-001, QA-002, QA-004
and QA-009 were independently reproduced by the tech lead before this dispatch. Treated as
confirmed, not re-litigated. Classification below is mine (H0.5), scoped strictly to what the
pitch's own language makes load-bearing — not a general "would be nice to fix" pass.

**Discovered-task ledger — pre-existing items** (unchanged from the prior pass):
1–4, 6. `[ORIENT]`/`[GATE-L1a.5]` items — all resolved, confirmed PASS in EVAL (corrupted-store
   handling, wrong-shape-JSON path, 1-based index semantics, default store path, TS-INV-05
   coverage of the unset-`$TODO_STORE` fallback).
5. `[ORIENT]` Atomic-write approach as a code-level note — still open, filed `~` at filing time,
   not black-box assertable, reconcile confirmed no re-fold needed. Genuinely nice-to-have.

### QA-item classification (H0.5)

Default is NICE-TO-HAVE unless an item traces directly to a pitch boundary. The pitch makes two
things explicitly load-bearing, in its own words: (a) "must behave sanely at the edges …
because a CLI that crashes on a typo is worse than no CLI" — a general no-raw-crashes bar, not
limited to the three named examples; and (b) `$TODO_STORE` "must come from `$TODO_STORE` when
set … a real constraint, not a detail … a CLI that cannot be sandboxed cannot be verified."

| Finding | Crashes? (uncaught traceback) | Collides with named pitch language | Classification |
|---|---|---|---|
| QA-001 BrokenPipeError on `list \| head` | Yes | (a) — ordinary shell composition (`\| head`, `\| less`) is common CLI usage, not a contrived setup; a raw traceback here is exactly "crashes on a typo is worse than no CLI" | **MUST-HAVE** |
| QA-002 empty/whitespace `<text>` accepted | No | Domain-model's own "non-empty enforced" claim, but not a named pitch edge, no data loss, no crash — trivially fixable by the user with `rm` | NICE-TO-HAVE |
| QA-003 leading-`-` text collides with argparse | No (clean exit 2, just confusing wording) | UX polish, not a crash; documented workaround (`--`) exists | NICE-TO-HAVE |
| QA-004 empty-string `$TODO_STORE` silently falls back | No, but silently writes to the developer's real `~/.todo.json` | (b) directly — an explicitly-set `$TODO_STORE` not honored verbatim is the exact constraint the pitch calls "not a detail"; also undermines the pitch's own sandboxing/verifiability claim | **MUST-HAVE** |
| QA-005 raw tracebacks on store-path I/O errors (missing dir, is-a-dir, unwritable) | Yes | (a) directly — a mistyped/misconfigured store path is close to the paradigm "typo" case the pitch names; three distinct raw tracebacks, none go through the app's own `error: …` path | **MUST-HAVE** |
| QA-006 symlinked store gets replaced, orphaning target | No | Requires deliberately symlinking the store file — not ordinary use, no named pitch language covers it | NICE-TO-HAVE |
| QA-007 read-only (444) store offers no protection | No | Requires deliberate `chmod`; no named pitch language; silent permission downgrade is a hygiene issue, not a crash or data loss | NICE-TO-HAVE |
| QA-008 concurrent adds race, silently lose items (17/20) | No | No-gos list ("no sync, no server") reads as implicit single-writer scope; requires 20 simultaneous backgrounded processes — not ordinary single-developer terminal use. QA's own report suggests this should become an explicit Non-Go next cycle, not a silent gap | NICE-TO-HAVE (flag for explicit Non-Go decision) |
| QA-009 `"done": "false"` string displays as done | No | Only reachable via a hand-edited store (the app itself never writes a string here); adjacent to "corrupted store" in spirit but the app's own write path can't produce it, and it's not a crash | NICE-TO-HAVE (flagged: sharpest single finding of the hunt, confirmed by TL — recommend priority in next cycle even though not must-have) |
| QA-010 missing key in list element → raw `KeyError` | Yes | (a) directly — a genuine extension of the pitch's own named "corrupted store file" edge case (element-shape corruption, not just root-shape); a raw crash | **MUST-HAVE** |

### GATE H0 Output
```
Must-have (unresolved)  : 4 — QA-001, QA-004, QA-005, QA-010 (all crash-or-pitch-boundary items,
                              per collision table above)
Nice-to-have (~)        : 7 — QA-002, QA-003, QA-006, QA-007, QA-008, QA-009 (QA hunt)
                              + atomic-write code note (ledger #5, pre-existing)
Carry candidates        : none (no scope uphill/downhill, no attempt-budget overflow)
```

## GATE H1 — Baseline Comparison

Baseline is approximate (no `shaping/baseline.md`): idea.md's own problem statement —
developers currently keep todos in their head and lose them; the do-nothing baseline is *no
CLI at all*, not a hypothetically perfect one.

**Round budget is fully spent** (2 of 2 rounds used; round 2 closed the `$TODO_STORE` Test
Surface gap and reconfirmed PASS). QA ran post-PASS, outside the build loop, per the harness's
own architecture — these findings cannot trigger "one more focused attempt" inside this run;
any fix now would be a new build cycle, not a continuation of this one.

For each MUST-HAVE item: with it left unresolved, is the shipped `add`/`list`/`done`/`rm`
binary still strictly better than "keep it in your head"?

- **QA-001** (BrokenPipeError on `list | head`) — YES. Plain `todo list` (the overwhelmingly
  common invocation) is unaffected; only composition with a fast-closing reader triggers it,
  and no data is lost or corrupted when it does.
- **QA-004** (empty-string `$TODO_STORE` falls back silently) — YES. A developer who never sets
  `$TODO_STORE=""` never hits this; the affected surface is scripts/wrappers that compute an
  empty value, and even then the failure mode is "extra items land in the real default store,"
  not data loss. Still strictly better than tracking nothing at all.
- **QA-005** (raw tracebacks on store-path I/O errors) — YES. These trigger only on a
  misconfigured/inaccessible store path (missing parent dir, path is a directory, unwritable
  dir) — the common `~/.todo.json` default path never hits any of the three. A scary traceback
  once is still recoverable and still strictly better than no tool.
- **QA-010** (missing-key `KeyError` crash) — YES. Only reachable via a hand-crafted or
  corrupted-at-the-element-level store; the app's own write path never omits a required key.

**None of the four fail H1.2.** Each is genuinely a "must-have" against the pitch's own
language — a raw crash or a broken load-bearing constraint — but none makes the shipped product
worse than the baseline of no CLI at all. Per H1.2, all four are technically cut-list-eligible;
H2 treats them differently from the true nice-to-haves below precisely because of that pitch-
language collision, rather than letting the must-have/nice-to-have distinction evaporate at the
baseline-comparison step.

The seven true nice-to-haves (QA-002, 003, 006, 007, 008, 009, atomic-write note) never block
H1 by construction (H1.3) — none traces to a pitch boundary or a scope's business_goal.

### GATE H1 Output
```
Ship-blocking items: none
```

## GATE H2 — Cut List & Verdict

```
Baseline      : approximate — idea.md problem statement (shaping/baseline.md absent)
Ship-blocking : none

Proposed cuts — true nice-to-have (7 + 1 pre-existing):
  - QA-002 empty/whitespace <text> accepted — source: QA hunt (~) — safe: no data loss, no
    crash, trivially correctable by the user (`rm`).
  - QA-003 leading-'-' text collides with argparse — source: QA hunt (~) — safe: clean exit 2,
    documented `--` workaround exists.
  - QA-006 symlinked store orphans its target on first write — source: QA hunt (~) — safe:
    requires deliberately symlinking the store, not ordinary use.
  - QA-007 read-only (444) store offers no real protection — source: QA hunt (~) — safe:
    requires deliberate chmod, no crash, no silent data loss.
  - QA-008 concurrent adds race and silently drop items — source: QA hunt (~) — safe for a
    single-developer terminal tool under normal use; recommend the PO make this an explicit
    Non-Go next cycle rather than leaving it silent (per the hunt report's own suggestion).
  - QA-009 "done":"false" string shows as done — source: QA hunt (~) — safe: only reachable via
    a hand-edited store; flagged as the sharpest single finding of the hunt and confirmed by
    the tech lead — recommend high priority in the next cycle despite the nice-to-have call.
  - Atomic-write approach as an explicit wiring-map code note — source: discovery ledger #5 (~)
    — safe: not black-box assertable, already reconcile-confirmed no re-fold needed.

Proposed cuts — must-have per pitch language, but pass H1.2 (not baseline-blocking):
  - QA-001 BrokenPipeError traceback on `list | head` — source: QA hunt, TL-confirmed — crash,
    collides with "a CLI that crashes … is worse than no CLI," but plain `list` is unaffected.
  - QA-004 empty-string $TODO_STORE silently falls back — source: QA hunt, TL-confirmed —
    collides directly with the pitch's explicit $TODO_STORE constraint; affects only callers
    that compute an empty value, and only pollutes rather than loses data.
  - QA-005 raw tracebacks on store-path I/O errors — source: QA hunt — crash, collides with the
    pitch's crash-avoidance language; triggers only off the default happy-path store location.
  - QA-010 missing-key KeyError crash on list/rm — source: QA hunt — crash, an extension of the
    pitch's own named "corrupted store file" edge case; only reachable via a hand-corrupted
    store element.
  These four are NOT true nice-to-haves — they are carried forward as high-priority raw ideas,
  not lumped in with the seven above, because they trace directly to explicit pitch boundary
  language. The round budget for this run is fully spent (2 of 2), so none can be fixed inside
  this run; they belong at the top of the next cycle's Betting Table, not silently dropped.

Carry-forward : hill/*.yml phase metadata correction (DOWNHILL_EXECUTION → FINISHED) —
    bookkeeping only, not product scope.

Verdict       : SHIP now — no item fails the baseline comparison. The shipped binary is
    strictly better than "developers keep todos in their head and lose them" even with all ten
    QA findings outstanding. Ship with an explicit, non-hidden gap list: 4 pitch-boundary
    must-haves (QA-001, QA-004, QA-005, QA-010) prioritized for the very next cycle, 7
    true nice-to-haves carried debt-free to the discovery ledger as raw ideas.
```

Ask (max 1, per protocol): "Confirm this cut list? (approve all / list ids to keep / none)."
Everything not kept by the PO is carried to the discovery ledger as raw ideas — the four
pitch-boundary items flagged for priority, the seven true nice-to-haves flagged as optional
hardening. Scope-hammer does not set `status: done` and does not ship — that decision, and the
explicit acknowledgment of the four-item known-gap list in the ship report, belongs to
tech-lead/PO at GATE H2 / L4.
