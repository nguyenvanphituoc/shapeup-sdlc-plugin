# Stop — decide when to stop (GATE H)

The census is yours: you do it in this context — no sub-agent — and GATE L4 reads one file to know it was done. The bar is Shape Up's own: as the budget runs
out, cut perfectionist ambition by comparing the product to the **baseline** — what customers live with
today — **never to a hypothetical ideal**. "Better than the baseline" is good enough to ship; "not as good as
I imagined" is not a reason to keep building. You propose; the PO decides.

## When you do it

```
1. The loop ended well (a PASS, or a not-evaluated round) and QA is done — the normal stop.
2. The outer breaker tripped: `maxRounds` spent — scopes may still be open.
3. A scope exhausted its `attemptBudget` without a green T0 — you recorded it as a proposal; it is judged here
   instead of blocking the round.
```

What the run knows is in its files: the QA report under `.shapeup/<slug>/qa/`, the proposals you recorded, the scopes
with a green latest trial, and which breaker, if any, ended the run. Case 1 has no unresolved scopes; cases 2 and 3 do,
and each becomes an explicit CUT or CARRY candidate below.

## Census

Gather every open item into one list before judging any of them. A partial view produces a wrong cut.

**Every claim cites the file it came from.** Derive, never remember:

| Claim | Read | Rule |
|---|---|---|
| "no scope owns X" / "X is scope Y's" | the `allowed_file_substrate` and `shared_substrate` of every `<spec>scopes/*.md`, and the paths `<spec>wiring-map.md` names | Ownership is what the contracts say. A path no contract lists is an unowned seam; a path the wiring names that is not on disk is owned but never written. A census that narrated ownership from memory once told the PO no scope owned a directory a committed contract listed in plain sight. |
| a pitch clause the run never showed working | `<spec>requirements.md`, and the verdict's criteria with their `covers:` anchors | A requirement with no passing criterion is a census item carrying its source clause (`REQ-12 ← shaping.md R12`). A clause the PO marked `CUT (PO-approved)` is an answer already given, not an item. No registry on disk → none. |
| "scope S exhausted its attempts" | `<run>/t0/trials.jsonl` and `<run>/receipts/dispatch.jsonl` | Count the scope's attempts that have a dispatch receipt AND a result. A compiled order and a T0 verdict are both writable by the scope being judged, so neither counts alone. |

Then collect, from the run's own records:

- Unresolved scopes (breaker cases): uphill/downhill scopes when the round budget hit 0, and scopes with a
  proposal — **carry candidates**, each with its hill phase and open unknowns from `hill/<scope-id>.yml`.
- QA findings: `.shapeup/<slug>/qa/` report when present — all `~` by default.
- Discovered-ledger entries still open (`.shapeup/<slug>/discovery/ledger.md`, `[+]` / `~` unresolved).
- Requirements with no PASS evidence (above).

**Classify every item.** MUST-HAVE: the pitch's core problem is unsolved without it. NICE-TO-HAVE (`~`): improves
but does not block the core promise. **Default to NICE-TO-HAVE** unless the item traces directly to a pitch
boundary or a scope's `business_goal` — a generous must-have list defeats the point of hammering.

```
⏸ GATE H0 — Census
Must-have (unresolved)  : [N] — [list, each with source: scope | QA | discovered | requirement | advisor-overflow]
Nice-to-have (~)        : [M]
Carry candidates        : [scopes still uphill/downhill, or exhausted attempt budget]
```

## Baseline comparison

1. Resolve the baseline: `shapeup/<slug>/shaping/baseline.md` when present (written at shaping time, first-class).
   Absent → degrade honestly: read the pitch's problem statement as the implicit baseline and say
   "baseline not first-class — comparison is approximate" in the report. **Do not invent one.**
2. For each MUST-HAVE: "with this item cut or carried, is the shipped product still strictly better than the
   baseline for the pitch's core problem?"
   - YES → safe to cut or carry; it is a cut-list candidate anyway (the PO is still asked).
   - NO → this item blocks shipping as it stands and is **not hammer-cuttable**. Fix it now (one more focused
     attempt, not a full extra round) or the run genuinely fails the appetite: say so, do not ship anyway.
3. NICE-TO-HAVE items never block; they are cut-list candidates by construction.

## Cut list and verdict

```
⏸ GATE H2 — Cut List & Verdict
Baseline      : [shapeup/<slug>/shaping/baseline.md | approximate — pitch problem statement]
Ship-blocking : [none | MUST-HAVE items that fail the comparison — NOT cuttable]
Proposed cuts : [N nice-to-have + N cuttable must-have, each: item — source — one-line why safe]
Carry-forward : [scopes/items proposed for the next cycle's raw-idea list, debt-free]
Verdict       : [SHIP now | SHIP after fixing ship-blocking items | CANNOT SHIP — escalate to PO]
```

The PO confirms every cut ("approve all / list ids to keep / none"); you never override a kept item. Whatever
is not kept is carried to the discovery ledger as a raw idea — debt-free, never silently dropped, never
silently promoted back into scope. A ship-blocking item the PO overrides is logged as a known gap in the ship
report, never hidden.

## The census file — what the step is done on

Write the census as data (shape `HammerCensus` in the kernel's domain registry), beside the
human-readable report, to `.shapeup/<slug>/reports/hammer-census.json`:

```json
{ "schema_version": 1, "verdict": "ship-now | ship-after-fixes | cannot-ship",
  "cut_list": ["…"], "ship_blocking": ["…"], "breaker": "outer | inner | deadline | null", "baseline": "<path or null>" }
```

`ship_blocking` is non-empty exactly when the verdict is `cannot-ship`. **GATE L4's resolver reads this file —
and nothing else — before it lets any answer set say `ship`:** a census that lives only in your printed blocks
cannot be read by a gate. Still a proposal: the file grants nothing.

Read it back before you cross GATE H: readable JSON, a verdict from the three, a `cut_list` array, and `ship_blocking`
non-empty exactly when the verdict is `cannot-ship`. A census that fails that read is yours to fix now; do not cross the gate over it.

The ship report, written after GATE H and before GATE L4, has its own file: `resources/ship/report.md`.

## What never changes

| Rule | Why |
|---|---|
| Compare to the baseline, never to a perfect ideal | the actual trade-off algorithm of the stop step |
| Default classification is NICE-TO-HAVE | a generous must-have list defeats the point |
| A MUST-HAVE that fails the comparison is never cut silently | the one case where the census refuses to make the run look shippable |
| Cuts are proposals; the PO confirms every one | the census never overrides the human at the ship gate |
| Every ownership, exhaustion and requirement claim cites its file | derived from the contracts and the receipts, never from what the report remembers |
| You never set `status: done`, deploy, or ship | the run closes only after GATE L4 is crossed — `order close --status shipped` refuses without this run's `ship` row; the judge, the doer and the census stay separate acts |
| Guidance never decides a gate | a knowledge-base rule may add a question to the H block, never an answer; there is no `stop` knowledge-base file — the census's claims come from files |
