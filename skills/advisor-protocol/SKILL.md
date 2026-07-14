---
name: advisor-protocol
description: "Use this skill whenever a harness worker (task-executor, scope-architect) hits a decision it cannot make alone during Build Vertically — a design decision, a spec ambiguity, or a request to write outside its scope's substrate — and needs it adjudicated under a budget instead of guessed or asked ad hoc. Trigger on: \"escalate this decision\", \"ESCALATE\", \"adjudicate this ambiguity\", \"ask the advisor\", \"substrate expansion request\", \"resolve this design decision within budget\", \"how many escalations does this scope have left\". Also triggers when tech-lead needs to answer a worker's structured ESCALATE return during a build round. Defines the ESCALATE grammar (kind/question/options), the per-scope-per-round budget (default 3), precedent reuse so the same question is never asked twice in a run, and persistence of every answer to the committed round-ledger so it survives a zero-memory context reset. Does not design, build, or judge — it is the advisor, not a fifth worker."
---

# Advisor Protocol (ESCALATE grammar + budgets)

The mechanism behind Shape Up's "advisor, not micromanager" posture (design spec v1.1 DD-1,
DD-8). A worker mid-attempt hits something it genuinely cannot decide alone — not "what should
I name this variable" (that's Principle A, resolved silently or at the worker's own gate), but
a decision whose wrong guess is expensive: a design trade-off the spec left open, a spec
ambiguity that changes behavior, or a file the worker needs to touch outside its scope's
`allowed_file_substrate`. Instead of guessing or opening an unbounded chat with the PO, the
worker emits one structured `ESCALATE` return and this skill adjudicates it.

**Why this exists as its own skill, not inline PO chat.** Zero-memory handoff (design spec
§3.6) means every attempt gets a *fresh* context — no chat history. An answer given once must
survive every future reset for that scope. This skill is what turns a transient Q&A into a
persisted decision: it writes the answer to the round-ledger (committed, Tier A) the moment
it's made, and every future brief for that scope reads it back. Escalation memory lives in
files, not in chat (DD-8).

---

## The ESCALATE grammar

A worker never asks a free-form question mid-attempt. It returns a structured block and stops
work on the blocked AC/file until an answer comes back:

```yaml
ESCALATE:
  scope_id: cart-creation
  round: 2
  attempt: 3
  kind: design-decision | spec-ambiguity | substrate-expansion
  question: "Contract leaves cart-total rounding unspecified — round half-up or banker's rounding?"
  options: ["round half-up (matches existing order-total code)", "banker's rounding (matches contract's other money fields)"]
  default_if_silent: "round half-up"     # optional — see --unattended below
```

Three kinds, three different resolution paths (below). `default_if_silent` is optional — a
worker proposes it when it has a reasonable, low-risk fallback; the advisor is never forced to
accept it.

---

## Budget

**≤3 ESCALATEs per scope per round** (design spec §3.3). Counted per `scope_id` + `round`, reset
each new round. The budget exists so a struggling scope surfaces as *stuck* (routed to the
hill's stuck-split rule, ≥3 rounds at the same position → forced scope-architect split order) rather than
draining PO attention one question at a time.

```
1st–3rd ESCALATE this scope/round → adjudicate normally (below).
4th+                              → do NOT ask again. Apply the most conservative resolution
                                     (narrowest scope, no substrate expansion, closest precedent)
                                     and flag it as a GATE-H hammer proposal: "scope exceeded its
                                     escalation budget — question N unresolved, applied [X]".
                                     The worker's attempt continues with that resolution.
```

Exceeding budget is never a hard stop — Build Vertically must keep moving; it's a signal that
this scope needs GATE H's attention, not a excuse to freeze the round.

---

## Adjudication (in order — cheapest resolution wins)

```
1. Precedent check (free, no PO time):
   Search this run's round-ledger.md "Decisions" section (this scope AND sibling scopes) and
   docs/shapeup-sdlc/knowledge-base/*.md for an already-answered question that is the same or a
   clear superset of this one. Found → reuse verbatim, log "resolved by precedent: [ref]",
   do NOT count against budget (a repeat question is a zero-memory artifact, not a new decision).

2. kind: substrate-expansion:
   Never silently approved. Present the requested path(s) + why the worker says it needs them.
   PO/TL approves → dispatch a scope-architect remap order to add the path to the scope contract's
   `shared_substrate` (never hand-edit the contract — `ba` is its sole writer, F.5). PO/TL
   declines → worker re-plans within its existing substrate; log the decline as a decision too
   (prevents re-asking).

3. kind: design-decision | spec-ambiguity, interactive/--auto:
   Print the ESCALATE block verbatim + budget remaining for this scope/round. Ask (max 1):
   pick an option / provide a different answer / defer to default_if_silent if offered.
   Never answer on the PO's behalf — a wrong silent guess here is exactly what zero-memory
   handoff makes expensive to unwind later.

4. --unattended (no PO available):
   default_if_silent present → apply it, log "auto-resolved (default, unattended)".
   No default offered → apply the most conservative option (narrowest scope / least
   irreversible) and flag it as a GATE-H hammer proposal for PO review before ship — the
   run must not block, but an unattended guess is never allowed to hide from the PO forever.
```

---

## Persistence — the decision must survive a reset

The instant an ESCALATE is answered (any path above), append one row to the run's committed
`round-ledger.md` "Decisions" section — never batch it for later, never keep it only in the
current session (a crash before the next promotion point would lose it):

```
| Round | Scope | Kind | Question | Answer | Resolved by |
|-------|-------|------|----------|--------|-------------|
| 2 | cart-creation | design-decision | cart-total rounding | round half-up | PO (interactive) |
```

Every subsequent isolated brief for that scope (task-executor's zero-memory handoff, design
spec §3.6) includes the full decisions table for its `scope_id` — this is how an answer given
once in round 2 is still known in round 5's fresh-context attempt without replaying any chat
history.

---

## Envelope contract — the domain layer

Orchestrated, this skill is dispatched like every worker: a **WorkOrder** in (`--order <path>`,
operation `adjudicate`), a **WorkResult** out. The standalone flags below map 1:1 onto the
payload fields registered for this worker in the central domain registry
(`skills/tech-lead/schemas/domain.schema.json`, `x-payload-by-worker`):

| Payload field | Standalone flag | Meaning |
|---|---|---|
| `payload.ledger` | `--ledger` | The run's committed `round-ledger.md` — every answer persists here |
| `payload.escalate` | `--escalate` | The worker's ESCALATE block to adjudicate (the `EscalateBlock` grammar above) |
| `payload.scope_id` | `--scope` | The scope the budget is counted against |
| `payload.round` | `--round` | The round the budget/decision is counted against |

The WorkResult may carry only `files_touched`, `artifacts`, `assumptions`, `deviations`
(`x-result-by-worker`): the adjudicated Decision itself persists to the committed round-ledger,
never to the envelope, so it survives every zero-memory reset.

---

## Invocation

```bash
# Adjudicate one ESCALATE return from a worker (typical: tech-lead calls this mid-round)
/advisor-protocol --ledger docs/shapeup-sdlc/checkout-vnpay/round-ledger.md --escalate '<ESCALATE yaml>'

# Check remaining budget for a scope this round (worker or tech-lead, before emitting ESCALATE)
/advisor-protocol --budget --scope cart-creation --round 2 --ledger docs/shapeup-sdlc/checkout-vnpay/round-ledger.md

# Headless run — no PO available; apply defaults / conservative fallback, flag the rest for GATE H
/advisor-protocol --unattended --ledger ... --escalate '<ESCALATE yaml>'
```

### Flags
| Flag | Effect |
|------|--------|
| `--ledger <path>` | The run's committed `round-ledger.md` (decisions persist here) |
| `--escalate <yaml\|path>` | The worker's ESCALATE block to adjudicate |
| `--budget --scope <id> --round <N>` | Report remaining ESCALATE budget for a scope this round, no adjudication |
| `--unattended` | No PO available — apply defaults/conservative fallback per rule 4 above |

---

## Hard Rules (never override without explicit user instruction)

| Rule | Rationale |
|------|-----------|
| A worker never guesses a design decision or spec ambiguity silently | The whole point of ESCALATE — wrong silent guesses are the expensive failure mode zero-memory handoff amplifies |
| Substrate-expansion is never auto-approved | PA3 (cross-scope contamination) exists precisely because agents self-justify "just this once" writes |
| Budget is ≤3/scope/round; exceeding it never blocks the round | Signals a stuck scope to GATE L2's stuck-split rule instead of freezing Build Vertically |
| Every answer is persisted to the committed round-ledger the instant it's given | Zero-memory handoff means the *only* place a decision survives is a file, not a session |
| Precedent reuse never counts against budget | A repeat question is a zero-memory artifact, not a new decision — don't penalize the worker for context loss |
| An unattended conservative resolution is always flagged for GATE H | An automated guess must stay visible to the PO before ship, never silently absorbed |
| This skill never designs, builds, or judges | Advisor, not a fifth worker — it adjudicates, it does not decide scope or verify code |

---

## Changelog
| Version | Date | Changes |
|---------|------|---------|
| 0.2 | 2026-07-14 | **Domain-layer alignment.** Documented the envelope contract: orchestrated dispatch is WorkOrder in (`--order`) / WorkResult out like every worker; standalone flags map 1:1 onto the payload fields registered in the central domain registry (`domain.schema.json` `x-payload-by-worker`), and output fields follow `x-result-by-worker`. No behavior change. |
| 0.1 | 2026-07-12 | Initial release (design spec v1.1 §3.3/§4.5, DD-1/DD-8). ESCALATE grammar (kind/question/options/default_if_silent); ≤3/scope/round budget with GATE-H overflow flagging; four-path adjudication (precedent → substrate-expansion via `ba --remap` → interactive ask → unattended default/conservative); persistence to the committed round-ledger so decisions survive zero-memory resets. |
