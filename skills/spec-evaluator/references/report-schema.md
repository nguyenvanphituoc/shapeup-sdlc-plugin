# Report Schema — `evaluation/EVAL-<task_id>.md`

The handoff file. Communication between judge and doer is by file: the evaluator writes
this, the generator (`task-executor`) reads the bug list as its next input. Keep it
actionable enough that the generator never has to ask a follow-up question.

## Frontmatter
```yaml
---
type: eval-report
feature: [slug]
task: TASK-NNN(.variant)
verdict: pass | fail
dimensions_run: [spec-conformance]      # the active set this run
dimensions_ignored: [security, performance]
bug_count: [N]
browser_mode: cli | mcp | none
evaluator: spec-evaluator v0.1
eval_at: [ISO date]
linked_docs: ["[[tasks/TASK-NNN-slug]]", "[[scope-summary]]"]
---
```

## Body sections (in order)

### 1. Verdict line
```
OVERALL: FAIL — spec-conformance failed (1 AC, 1 non-go breach). 2 bugs. Ignored: security, performance.
```

### 2. Per-dimension criteria table
One block per dimension run. N/A criteria shown as N/A, never PASS.
```
## spec-conformance — FAIL  (threshold: all-pass)
| id | criterion | verdict | evidence |
|----|-----------|---------|----------|
| SC-AC | every AC passes | ❌ FAIL | AC2 Pay click throws — apps/web/checkout/Pay.tsx:84 |
| SC-DONE-WHEN | "User pays successfully" | ❌ FAIL | redirect to /success never fires (see AC2) |
| SC-REQ | request matches contract | ✅ PASS | curl 200, fields match #Request |
| SC-RES | response mapping | ✅ PASS | field-by-field match to #Response |
| SC-ERR | error cases handled | ✅ PASS | 400/409/422 all returned as documented |
| SC-NONGO | non-go respected | ❌ FAIL | modified packages/shared/auth — out of scope |
| SC-LAYER | no layer leak | ✅ PASS | — |
```

### 2b. Verdict stability (verdict-ledger.md)
After the dimension tables. Reports re-probe/confidence outcomes and any cross-run flips read from
`.verdicts-<task_id>.jsonl`. On the first run, state there is no history yet (the ledger is still
written, as the baseline).
```
## Verdict stability (run 3)
- ⚠ AC4 — FLIP PASS→FAIL vs run 2, no code change to checkout → judge non-deterministic here; confidence low. Re-run before trusting.
- AC2 — stable FAIL across runs 1–3 (confidence high).
- Stability: 6/7 criteria stable this round.
```
The per-dimension tables (§2) carry a `confidence` column when this is active.

### 3. Bug list
One entry per FAIL, using the failing dimension's bug template. This is the generator's
worklist.
```
## Bugs
### BUG-1 — critical
criterion: SC-AC / SC-DONE-WHEN
location: apps/web/checkout/Pay.tsx:84
repro: navigate /checkout → fill card → click "Pay"
expected: POST /payments fires, redirect to /success (Done when: "User pays successfully")
actual: console TypeError: onPay is not a function; no network call; stays on /checkout
fix_hint: onPay prop not passed from CheckoutPage; wire handler → Pay button

### BUG-2 — minor
criterion: SC-NONGO
location: apps/api/shared/auth.ts:12
repro: git diff --stat
expected: task touches apps/web only (## Non-go: do not change auth)
actual: auth.ts modified (added a field); revert or move to a separate task
```

### 4. Next action
A single explicit handoff line the orchestrator/generator acts on.
```
## Next action
→ Generator: re-run `task-executor --spec <path> --task TASK-NNN` to fix BUG-1, BUG-2,
  then re-run `spec-evaluator` on the same task. Do not close until verdict: pass.
```
For a PASS:
```
## Next action
→ TASK-NNN is verified against [spec-conformance]. Safe for task-executor GATE E close.
  (Note: security, performance were NOT evaluated this run.)
```

## Rules
- The report never sets `status: done` on the task — it sets `eval_verdict` only.
- A PASS report still names the dimensions that were *not* run, so "verified" is never read
  as "verified for everything."
- Every bug is self-contained: location + repro + expected/actual, no external context needed.
