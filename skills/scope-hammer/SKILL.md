---
name: scope-hammer
description: "Use this skill whenever a Shape Up build run reaches its stop condition — the circuit breaker (round budget or a scope's attempt budget) trips, or all scopes finish and it's time to decide when to stop (step 11) — and needs a must-have census, a baseline-anchored cut list, and a ship verdict. Trigger on: \"scope hammer\", \"hammer this down to must-haves\", \"decide when to stop\", \"cut list vs baseline\", \"circuit breaker tripped, what do we ship\", \"compare against the baseline not the ideal\", \"GATE H\", \"census the open items\". Also triggers on tech-lead's GATE H at SHIP. Takes must-have/nice-to-have census (QA findings, discovered tasks, advisor-protocol overflow flags, inner-breaker hammer proposals), compares the resulting product to the pitch's baseline (what customers live with today, not a perfect ideal), and returns a cut list + ship verdict. Never fixes code and never overrides the PO — cuts are proposals, promotion/shipping is a human call."
---

# Scope Hammer (GATE H — Decide When to Stop)

The mechanism behind Shape Up step 11: as the appetite/round budget runs out, cut back on
perfectionist ambitions by comparing the *actual* product to the **baseline** — what customers
live with today — not to a hypothetical perfect version. "Better than the baseline" is good
enough to ship; "not as good as I imagined" is not a reason to keep building.

**Why this is its own skill, not tech-lead prose.** GATE H census pulls from several sources
that accumulate over a whole run (QA findings, discovered-task ledger, advisor-protocol budget
overflows, per-scope inner-breaker trips) — a genuinely separate synthesis step from
orchestration. Splitting it out keeps `tech-lead` thin (it dispatches, this skill decides what
survives the hammer) and gives the census/cut-list/verdict logic one owner instead of being
re-derived inline at every SHIP.

---

## When this fires

```
1. All scopes reach FINISHED on the hill (design spec B2) → normal stop, post-QA-hunt.
2. Outer circuit breaker trips: round_budget reaches 0 with scopes still uphill/downhill.
3. Inner circuit breaker trips: a scope's attempt_budget (default 5) is exhausted without a
   T0-green result → queued as a hammer PROPOSAL (design spec Blueprint A `hammer_proposals`),
   judged here rather than immediately blocking the round.
```
Any of the three routes to this skill; the difference is only what's in the census (case 1 has
no unresolved scopes; cases 2/3 do, and those become explicit CUT or CARRY candidates below).

---

## Workflow

```
INPUT: run's finished/unfinished scopes + baseline + census sources
          │
⏸ GATE H0 │  Census ──────────────► collect every open item, classify must-have / nice-to-have
          │
⏸ GATE H1 │  Baseline Comparison ──► for each unresolved must-have, is the product still
          │                          better than the baseline without it?
          │
⏸ GATE H2 │  Cut List & Verdict ───► propose cuts (PO confirms), ship / carry-to-next-cycle verdict
          │
✅ Done   └─► cut list + verdict handed to tech-lead SHIP; PO owns the final call
```

---

## GATE H0 — Census

**Purpose:** Gather every open item into one list before judging any of them. Never judge
piecemeal — a partial view produces a wrong cut.

```
H0.1  Unresolved scopes (breaker cases only):
        - uphill/downhill scopes when round_budget hit 0 → CARRY candidates (their own hill
          phase + open unknowns, from hill/<scope-id>.yml)
        - scopes with hammer_proposals (attempt_budget exhausted) → CARRY candidates, tagged
          with the T0 failure that stalled them (from the last red t0/verdicts/*.json)
H0.2  QA findings (qa-edge-hunter's hunt-report.md, when present) — all `~` by default.
H0.3  Discovered-task ledger entries still open (discovery/ledger.md, `[+]`/`~` unresolved).
H0.4  advisor-protocol budget-overflow flags (auto-resolved ESCALATEs logged for GATE H review).
H0.5  Classify every item: MUST-HAVE (the pitch's core problem is unsolved without it) vs
      NICE-TO-HAVE (`~`, improves but doesn't block the core promise). Default to NICE-TO-HAVE
      unless the item traces directly to a pitch boundary or a scope's business_goal — a
      generous must-have list defeats the point of hammering.
```

**GATE H0 Output:**
```
⏸ GATE H0 — Census
Must-have (unresolved)  : [N] — [list, each with source: scope | QA | discovered | advisor-overflow]
Nice-to-have (~)        : [M]
Carry candidates        : [scopes still uphill/downhill, or exhausted attempt budget]
```

---

## GATE H1 — Baseline Comparison

**Purpose:** The trade-off algorithm from step 11 — compare to the baseline (status quo the
customer suffers through today), never to a perfect ideal.

```
H1.1  Resolve the baseline: docs/shapeup-sdlc/<slug>/shaping/baseline.md if present (written at
      shaping time, design spec Blueprint F — first-class, not a pitch footnote). Absent →
      degrade honestly: read the pitch's problem statement as the implicit baseline and flag
      "baseline not first-class — comparison is approximate" in the report. Do not invent one.
H1.2  For each MUST-HAVE item from H0: "with this item cut/carried, is the shipped product
      still strictly better than the baseline for the pitch's core problem?"
        YES → safe to cut/carry — demote to a cut-list candidate anyway (H2 still asks the PO).
        NO  → this one item blocks shipping as-is; it is not hammer-cuttable. Options are:
              fix it now (one more focused attempt, not a full extra round) or the run
              genuinely fails the appetite — escalate to PO honestly, do not ship anyway.
H1.3  NICE-TO-HAVE items never block H1 — they are cut-list candidates by construction.
```

---

## GATE H2 — Cut List & Verdict

**Purpose:** Turn H0+H1 into a decision, owned by the PO — this skill proposes, it never cuts
unilaterally.

```
⏸ GATE H2 — Cut List & Verdict
Baseline      : [docs/shapeup-sdlc/<slug>/shaping/baseline.md | approximate — pitch problem statement]
Ship-blocking : [none | list of MUST-HAVE items that fail H1.2 — these are NOT cuttable]
Proposed cuts : [N nice-to-have + N cuttable must-have, each: item — source — one-line why safe]
Carry-forward : [scopes/items proposed for the next cycle's raw-idea list, debt-free]
Verdict       : [SHIP now | SHIP after fixing ship-blocking items | CANNOT SHIP — escalate to PO]
```
Ask (max 1): "Confirm this cut list? (approve all / list ids to keep / none)". PO can keep any
proposed cut — this skill never overrides that. On confirm, everything NOT kept becomes:
- Nice-to-haves + safe must-have cuts → carried to the discovery ledger as raw ideas
  (debt-free — never silently dropped, never silently promoted back into scope).
- Ship-blocking items (if any survived because PO overrode SHIP anyway) → logged explicitly
  as a known gap in the ship report, never hidden.

Authority boundary: this skill produces the proposal; `tech-lead` records the PO's decision in
the round-ledger and performs the actual SHIP close. Scope-hammer does not write status: done,
does not deploy, and does not itself decide to ship — same judge/doer separation as the rest of
the harness (this is neither the generator nor the evaluator).

---

## Envelope contract — the domain layer

Orchestrated, this skill is dispatched like every worker: a **WorkOrder** in (`--order <path>`,
operation `hammer`), a **WorkResult** out. The standalone flags below map 1:1 onto the payload
fields registered for this worker in the central domain registry
(`skills/tech-lead/schemas/domain.schema.json`, `x-payload-by-worker`):

| Payload field | Standalone flag | Meaning |
|---|---|---|
| `payload.feature` | `--slug` | The feature slug (resolves scopes/, hill/, ledger paths) |
| `payload.baseline` | `--baseline` | `shaping/baseline.md` — comparison anchor (absent → the pitch's problem statement, flagged approximate) |
| `payload.breaker` | `--breaker` | `outer` \| `inner` — which circuit breaker fired (absent = normal stop) |
| `payload.scope_id` | `--scope` | With `--breaker inner`, the scope whose attempt budget was exhausted |

The WorkResult may carry only `files_touched`, `artifacts`, `assumptions`, `deviations`
(`x-result-by-worker`): the census, cut list, and ship verdict live in the report artifact as a
**proposal** — promotion and shipping stay a human call, never envelope data ingest acts on.

---

## Invocation

```bash
# Normal stop — all scopes FINISHED, after QA hunt
/scope-hammer --slug checkout-vnpay --baseline docs/shapeup-sdlc/checkout-vnpay/shaping/baseline.md

# Circuit breaker tripped — some scopes still open
/scope-hammer --slug checkout-vnpay --breaker outer   # round_budget exhausted
/scope-hammer --slug checkout-vnpay --breaker inner --scope cart-creation   # attempt_budget exhausted

# Headless — no PO available; still refuses to auto-ship a ship-blocking item
/scope-hammer --slug checkout-vnpay --unattended
```

### Flags
| Flag | Effect |
|------|--------|
| `--slug <name>` | The run's feature slug (resolves scopes/, hill/, ledger paths) |
| `--baseline <path>` | Explicit baseline doc (default: `shaping/baseline.md`, else approximate) |
| `--breaker outer\|inner` | Which circuit breaker triggered this call (changes H0.1 census scope) |
| `--scope <id>` | With `--breaker inner`, the scope whose attempt budget was exhausted |
| `--unattended` | No PO available — still HARD STOPS rather than auto-shipping a ship-blocking item |

---

## Hard Rules (never override without explicit user instruction)

| Rule | Rationale |
|------|-----------|
| Compare to the baseline, never to a perfect ideal | Step 11's actual trade-off algorithm — "better than what customers live with today" is the bar |
| Default classification is NICE-TO-HAVE unless traced to a pitch boundary or business_goal | A generous must-have list defeats the point of hammering |
| A MUST-HAVE that fails H1.2 is never cut silently | The one case where scope-hammer refuses to make the run "look" shippable |
| Cuts are proposals; the PO confirms every one | This skill never overrides the human at the ship gate |
| Cut items are carried to the discovery ledger, never silently dropped | Cool-down must stay debt-free — an idea deferred is still recorded |
| Never sets status: done, never deploys, never ships unilaterally | Judge/doer/advisor separation holds even at the very last gate |
| An overridden ship-blocking item is logged explicitly in the ship report | "Shipped" must never quietly mean "shipped with a known must-have gap" |
