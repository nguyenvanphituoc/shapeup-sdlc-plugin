# Stop — decide when to stop (GATE H)

The census is yours: `probe next` hands it out as a `kind: stop` step, you do it in this context — no
sub-agent — and the kernel reads one file to know it is done. The bar is Shape Up's own: as the budget runs
out, cut perfectionist ambition by comparing the product to the **baseline** — what customers live with
today — **never to a hypothetical ideal**. "Better than the baseline" is good enough to ship; "not as good as
I imagined" is not a reason to keep building. You propose; the PO decides.

## When the step arrives

```
1. The loop ended well (a PASS, or a not-evaluated round) and QA is done — the normal stop.
2. The outer breaker tripped: round_budget spent, or the opt-in wall-clock budget — scopes may still be open.
3. A scope exhausted its attempt_budget without a green T0 — queued as a proposal (`inputs.hammer_proposals`),
   judged here instead of blocking the round.
```

The step's `inputs` carry what the run knows: `qa_findings`, `hammer_proposals`, `green_scopes`, `breaker`
(null on the normal stop). Case 1 has no unresolved scopes; cases 2 and 3 do, and each becomes an explicit
CUT or CARRY candidate below.

## Census

Gather every open item into one list before judging any of them. A partial view produces a wrong cut.

**Every claim cites a probe.** The step's `probes` field holds the exact commands; run them as written.

| Claim | Command | Rule |
|---|---|---|
| "no scope owns X" / "X is scope Y's" | `probes.owner` (add `--path <p>` for one path) | Ownership is **derived** from the contracts, never remembered. `writers: []` is an unowned seam; `missing` lists seams the wiring names that are not on disk — owned but never written. A census that narrated ownership from memory once told the PO no scope owned a directory a committed contract listed in plain sight. |
| a pitch clause the run never showed working | `probes.requirements` | Take its `no evidence` rows; each is a census item carrying its source clause (`REQ-12 ← shaping.md R12`). A `cut` row is an answer the PO already gave — not an item. An inconsistency row is reported for reconciliation, never counted as evidence and never promoted as a finding. No registry on disk → this input is empty. |
| "scope S exhausted its attempts" | `probes.attempts` (one command per proposal scope) | Exhaustion is **derived**, never read off a verdict file: a compiled order and a T0 verdict are both writable by the scope being judged. An attempt counts only when a dispatch receipt AND a leg row or a WorkResult attest it. Exit 1 = tripped. The round loop's own breaker reads the same derivation, so the census and the breaker cannot disagree. |

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
human-readable report, to the path in `produces.path` (`.shapeup/<slug>/reports/hammer-census.json`):

```json
{ "schema_version": 1, "verdict": "ship-now | ship-after-fixes | cannot-ship",
  "cut_list": ["…"], "ship_blocking": ["…"], "breaker": "outer | inner | deadline | null", "baseline": "<path or null>" }
```

`ship_blocking` is non-empty exactly when the verdict is `cannot-ship`. **GATE L4's resolver reads this file —
and nothing else — before it lets any answer set say `ship`:** a census that lives only in your printed blocks
cannot be read by a gate. Still a proposal: the file grants nothing.

Then run `close` (`reduce ingest --close-census`). It checks the file against the shape above — readable
JSON, a verdict from the three, a `cut_list` array — and exits 1, naming the reason, when it is not. **A census
the kernel refuses is sent back once**: the next step re-emits with the reason in `note`; a second refusal
stops the run with what was refused. A missing file is not a refusal, just the same step again.

A write the fence refuses names a live order: a dead session left a dispatch open. That is dead work, not yours to
answer — say so to the PO (`init run --force` answers every open order and discards the round history; only the PO
asks for it).

## What never changes

| Rule | Why |
|---|---|
| Compare to the baseline, never to a perfect ideal | the actual trade-off algorithm of the stop step |
| Default classification is NICE-TO-HAVE | a generous must-have list defeats the point |
| A MUST-HAVE that fails the comparison is never cut silently | the one case where the census refuses to make the run look shippable |
| Cuts are proposals; the PO confirms every one | the census never overrides the human at the ship gate |
| Every ownership, exhaustion and requirement claim cites its probe | derived from the contracts and the attested records, never from what the report remembers |
| You never set `status: done`, deploy, or ship | the loop closes a run only after GATE L4 is crossed; the judge, the doer and the census stay separate acts |
| Guidance never decides a gate | a knowledge-base rule may add a question to the H block, never an answer; there is no `stop` knowledge-base file — the census's claims come from probes |
