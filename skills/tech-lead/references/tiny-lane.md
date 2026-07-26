# The tiny lane (`--tiny`) — lane contract

An 8-gate pipeline for a one-file fix is indefensible, and pretending otherwise teaches users
to bypass the harness entirely. `--tiny` is the honest right-sizing: the full lane's ceremony
scales down, its *verification floor* does not.

```
⏸ L0 (fit-check) → ▶ orient (light) → ▶ build (1–2 tasks) → T0 verify → ⏸ L4 (sign-off)
```

## What changes vs. the full lane

| | Full lane | Tiny lane |
|---|---|---|
| WIRE / wiring map | gate L1a.5 | **skipped** |
| Scope contracts | scope-architect | **skipped** |
| Spec tree | full DDD tree + board | **single-task board**, compiled directly |
| EVAL | once per round | **skipped** (`--no-eval` implied) |
| QA | post-PASS hunt | **skipped** (`--no-qa` implied) |
| Coach retro | post-L4 | **skipped** |
| Interactive gates | L0 L1a L1a.5 L1b L2 L3 L4 | **L0 + L4 only** |

## What is kept, non-negotiable

- **The envelope port.** The build is still a compile-order → task-executor(`--order`) →
  ingest-result dispatch. Tiny never means "just edit the file inline".
- **T0 verification.** A tiny change still proves itself by running — never by claim. If there
  is no runnable check at all, that is a fit-check failure, not a reason to skip T0.
- **The safety-spine and sandbox hooks.** Machine guards do not scale down.
- **The discovery ledger.** `lane: tiny` is recorded, so a later reader knows exactly what was
  NOT checked (no EVAL verdict, no QA charter, no wiring assertion).

## The L0 fit-check (mandatory — this is the lane's own gate)

Tiny fits when **all** of these hold:

- the change touches ≤ ~2 files;
- no new domain concept;
- no new dependency;
- no new user-facing flow (changed copy/behavior inside an existing flow is fine).

If the pitch fails any of those, SAY SO and recommend the full lane. Proceed tiny anyway only
on the PO's explicit confirmation, and record the override in the ledger. The tiny lane must
never become the way around the gates — it is for changes where the gates would have nothing
to say.

## Mid-build escalation

If the change turns out not to be tiny while building — a discovery lands that needs a new
task, a substrate expansion is requested, T0 needs a fixture that doesn't exist — STOP and
escalate to the PO with a recommendation to restart in the full lane, carrying the orient
output and the ledger forward. Do not grow the tiny lane in place.
