# Ledger Schema — `harness-run.md`

The tech lead's run record. One per feature, lives in the LOCAL run-trace root
`.shapeup-sdlc/<slug>/harness-run.md` (hidden, gitignorable — it is ephemeral run-state,
not a shared deliverable). It is the structured
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
spec_folder: [path to SHARED spec deliverable, e.g. docs/shapeup-sdlc/<slug>/spec/]
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

---

## Harvest row — `metrics.jsonl` (written at SHIP)

`harness-run.md` is ephemeral run-state — needed live for `--from` resume, the
FAIL-loop, and QA reconcile; worthless after ship. At SHIP the tech-lead **harvests**
the durable-mineable *signals* out of it into one append-only row:

```
docs/shapeup-sdlc/metrics.jsonl        # one row = one e2e run; COMMITTED (tracked)
```

Path note: the per-slug local run dirs `.shapeup-sdlc/[slug]/` are gitignored wholesale
(`.shapeup-sdlc/`), but `metrics.jsonl` lives at the root of the **shared** workspace
`docs/shapeup-sdlc/` and stays **tracked** — it is the one committed report surface, the
durable signal feed that survives the gitignored run-trace. `schema_version` makes a
v2.1 row readable by later skill versions.

### Two hard rules (same discipline as the Test Surface: *derived, never invented*)
1. **Harvest only fields that already exist as structured output at ship time.** If a
   field forces the tech-lead to *evaluate something new* → reject (judgment in disguise).
2. **Harvest records facts, never computes a new verdict.** A self-computed
   `run_quality_score` would be a second judge behind `spec-evaluator` → breaks the
   single-judge rule and invites Goodhart. The eval suite *interprets* downstream;
   harvest *records*.

Scope: the harvest feeds **only tier-3 (e2e pipeline benchmark)**. Tier-1
(trigger-evals) and tier-2 (per-skill functional, golden fixtures) run on isolated
fixtures and do not consume it.

### Row schema (one JSON object per line)
| Field | Existing source (copied, never re-graded) | Signal |
|---|---|---|
| `schema_version` | constant `1` | forward-compat |
| `feature_slug` | run-state frontmatter | identity |
| `terminal_state` | run-state final: `shipped` / `circuit_broken` / `abandoned` | circuit-breaker outcome |
| `round_count` | round table | effort-to-PASS |
| `final_audit_score` | final EVAL report (copied, not re-graded) | conformance |
| `surprise_count` | `.shapeup-sdlc/<slug>/discovery/ledger.md` | shaping quality — scope drift |
| `spike_unresolved_count` | `SPIKE-UNRESOLVED` markers at bet | shaping quality — open risk into bet |
| `scope_cut_count` | `~` items cut at SHIP S.0 | appetite pressure / scope hammer |
| `qa_findings` | `.shapeup-sdlc/<slug>/qa/hunt-report.md` + triage → `{total, promoted, held}` | edge quality |
| `slice_count` | breadboard B5 (≤9) | **normalizer / denominator** |
| `sources` | path/wikilink to each source artifact | auditability |

- `slice_count` is the **denominator**: `round_count=4` on a 2-slice feature is alarming,
  on a 9-slice feature is normal. Without it, e2e comparisons are apples-to-oranges.
  Enables `round-per-slice`, `surprise-per-slice`.
- `spike_unresolved_count` + `surprise_count` measure two of the three downhill
  conditions (open-risk-remaining, scope-drift-from-breadboard). A good shaping run
  drives both toward 0 — measured from the build trace, no manual grading.
- **Rejected fields:** `time_spent` / velocity (no clock; Shape Up forbids counting hours
  — `round_count` is the legitimate effort proxy) and `run_quality_score` (second judge).

### Row template
```json
{"schema_version":1,"feature_slug":"checkout-vnpay","terminal_state":"shipped","round_count":2,"final_audit_score":"PASS","surprise_count":3,"spike_unresolved_count":0,"scope_cut_count":1,"qa_findings":{"total":5,"promoted":1,"held":4},"slice_count":4,"sources":["docs/shapeup-sdlc/checkout-vnpay/shaping/shaping.md","docs/shapeup-sdlc/checkout-vnpay/shaping/breadboard.md",".shapeup-sdlc/checkout-vnpay/evaluation/EVAL-FEATURE-checkout-vnpay.md"]}
```
