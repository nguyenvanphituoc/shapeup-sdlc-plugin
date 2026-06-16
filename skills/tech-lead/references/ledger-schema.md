# Ledger Schema — `harness-run.md`

The tech lead's run record. One per feature, lives in the spec folder. It is the structured
artifact that carries state across rounds and across sessions (so `--from` can resume), and
the PO's audit of how the feature was built.

**The tech lead is the sole writer of this file** (redesign doc D6). It is the authoritative
run-state for the whole build phase — rounds, gate decisions, Hill positions, verdicts,
`discovered_rounds`, config, language record. Workers never write here; the tech lead passes
them what they need (`feature`, `spec`, `stack`, `discovered_rounds`) as args. The board
(`tasks/_index.md`) remains the planner/generator's execution truth that the tech lead reads.

## Frontmatter
```yaml
---
type: harness-run
feature: [slug]
spec_folder: [path]
lens: lite | standard | cross-context
eval_dimensions: [spec-conformance]
max_rounds: 3
auto_level: interactive | auto | unattended
status: orienting | mapping | building | evaluating | shipped | escalated
final_verdict: ~ | pass | fail | not-evaluated
rounds_used: [N]
discovered_rounds: [N]
deploy: ~ | deployed | pending-po
started_at: [ISO]
closed_at: ~ | [ISO]
---
```

## Round table (the spine)
Mirrors the long-running harness cost table — one row per phase, so you can see where time
and tokens go and that EVAL is cheap relative to BUILD.

```
## Rounds
| Phase            | Round | Result            | Duration | Notes |
|------------------|-------|-------------------|----------|-------|
| Orient           | —     | spiked VNPay seam | 18 min   | spike resolved; 9 discovered tasks seeded |
| Map Scopes       | —     | 14 tasks, 5 layers| 5 min    | orient-informed; 1 SPIKE (VNPay) |
| Build            | 1     | 14/14 ✅          | 2 h 10 m | all tasks closed |
| Eval             | 1     | FAIL — 3 bugs     | 9 min    | EVAL-FEATURE-checkout-vnpay.md |
| Build            | 2     | 3 bugs fixed      | 22 min   | bug-only re-build |
| Eval             | 2     | PASS              | 8 min    | verdict pass |
| Ship             | —     | built & verified  | —        | dims: spec-conformance; deploy pending (PO) |
```

## Hill report (the progress narrative — NOT task counts)
The roadmap forbids reporting progress by counting tasks: a 90%-done slice can still be stuck
uphill on the one unknown that matters. So the tech lead reports each slice's **position on
the hill**, derived mechanically from open unknowns. Render it at every round boundary
(area-level at GATE L1a — before slices exist; slice-level from GATE L1b onward).

```
## Hill — round 1
| Slice        | Position    | Derived from |
|--------------|-------------|--------------|
| S1-spine     | 🔽 downhill | spike closed + spine render-AC passed (crest crossed); 2 known tasks left |
| S2-filters   | 🔼 uphill   | SPIKE-003 open: pagination approach unproven |
| S3-export    | 🔼 uphill   | contract ⏳ TBD: file-format field |
```

Position triggers:
- 🔼 **Uphill** — open SPIKE / `⏳ TBD` contract / unresolved discovered task / approach unproven.
- ⛰️ **Crest** — all unknowns resolved AND a concrete board fact (the spine slice's render-AC passes).
- 🔽 **Downhill** — only known work remains, no open unknowns.
- ✅ **Done** — slice clickable-done.

Source: `orient/hill-signal.md` (area-level, at L1a) then the board + open SPIKE/contract state
(slice-level, L1b onward). If slice IDs aren't on the board yet (D3 deferred), report at
task-group level and note the fallback here.

## Decisions log
Every L-gate decision, for traceability.
```
## Decisions
- GATE L1a: Orient accepted; spiked VNPay seam (resolved); S2-filters flagged uphill.
- GATE L1b: PO accepted board; cut "guest checkout" task to phase 2.
- GATE L2 (r1): board green; ran eval (feature not trivial).
- GATE L3 (r1): FAIL → approved bug-only round 2.
- GATE L3 (r2): PASS → ship.
- GATE L4: built & verified; deploy pending (PO); closed.
```

## Bug carry-over (when FAIL)
Links the current round's bug list so the next BUILD round has its worklist.
```
## Open bugs (round 1 → fix in round 2)
→ see evaluation/EVAL-FEATURE-checkout-vnpay.md
- BUG-1 critical SC-DONE-WHEN apps/web/checkout/Pay.tsx:84
- BUG-2 major   SC-ERR     apps/api/payments/handler.ts:51
- BUG-3 minor   SC-NONGO   apps/api/shared/auth.ts:12
```

## Escalation block (only if max_rounds hit without PASS)
```
## Escalation
Rounds used: 3/3 — still FAIL. Residual bugs: [N].
Recommendation: [cut scope of feature X | accept minor bugs | extend max_rounds with PO approval].
Decision owner: PO.
```

## Rules
- The ledger is append-mostly: each round adds rows, never rewrites history.
- `status` + `final_verdict` are the resume anchors for `--from`.
- A `not-evaluated` final verdict (from `--no-eval`) is recorded plainly — never silently
  upgraded to `pass`.
