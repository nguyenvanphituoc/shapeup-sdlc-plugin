# Hard Rules (never override without explicit user instruction)

Moved out of `SKILL.md` by the Workflow migration (docs/workflow_migration_plan.md Stage 2):
most of what this table used to guard against — a partial board reaching EVAL, a gate crossed
on the model's own authority, an evaluator called mid-BUILD — is now a property of
`skills/tech-lead/workflows/shapeup-run.js`'s code, not a rule a model has to remember to obey.
The table stays as the readable rationale for WHY the code is shaped the way it is; the runtime
guarantee lives in the script and, where noted, in a hook.

| Rule | Rationale |
|------|-----------|
| Orchestrates Building only (steps 7–11); shaping/betting/kick-off are PO-personal, upstream | Intake is a kicked-off pitch, not a raw idea — the tech lead does no shaping/planning-authority work |
| ORIENT (step 7) runs before MAP SCOPES (step 8) | Roadmap: no pre-divided tasks at kick-off; the team orients first so the board is reality-born |
| Intake must be English before ORIENT; tech lead does NOT translate — it delegates to `translator` at GATE L0 | Translation is a separate single-purpose skill; the intake conversation only detects + sequences it, before RunArgs is ever compiled |
| Every worker dispatch goes through the envelope port: compile-order → `--order` → ingest-result; shared state is written ONLY by ingest | The single-writer rule is mechanically true (D6 closed): a worker that writes boards/ledgers/run-state is a defect, and a malformed envelope is denied by the validate-envelope hook before it can corrupt run truth. `shapeup-run.js` uses this same shape for every operation in the central registry — orient, wire, analyze, map-scopes, evaluate, hunt, hammer alike |
| Progress is reported by Hill position, never by counting tasks | The roadmap forbids task-counting; a 90%-done slice can still be stuck uphill on the one unknown that matters |
| Evaluator runs once per round, only after GATE L2 (board 100% done) | The whole point: cheap end-of-round QA, never per task. `shapeup-run.js`'s round loop dispatches spec-evaluator exactly once per iteration, after the GATE L2 resolution — there is no code path that calls it from inside the scope attempt loop |
| Evaluator never called inside the BUILD loop | Keeps the build coherent and the run cheap |
| r>1 builds bugs only, never the whole board | Don't re-do passing work; minimize churn — see round-protocol.md's regression rule for what DOES re-run (touched UCs' full Test Surface) |
| Stop at max_rounds; escalate honestly | No infinite fix loops; `shapeup-run.js` returns `{status: "gate_h", breaker: "outer"}` rather than looping past the budget |
| Tech lead delegates, never reimplements a sub-skill | Stays thin; each skill keeps its own gates and authority |
| Every delegation to a sub-skill (except the mechanical `t0-verify.mjs`/`compile-order.mjs`/`ingest-result.mjs`) is a fresh Agent on the L0.8-resolved model | Isolation the zero-memory-handoff design assumes; a direct inline call would silently drop the model matrix — see references/delegation.md "Invocation mechanism" |
| Planner stays high-level on tech | Spec errors cascade into every build round |
| Never auto-deploy; "shipped" never silently means "deployed" | Deploy is outward-facing, PO-gated; record "deploy pending (PO)" otherwise |
| "Shipped" names the dims NOT evaluated | `RunReturn`'s `dims_not_evaluated` field carries this; the L4 sign-off block shows it, never silently drops it |
| Every gate emits the canonical `⏸ GATE LN — Title` block before any narrative | Composed by the workflow (`gateBlock()`), emitted VERBATIM by the skill — conversational re-summary is not a gate |
| In interactive/--auto: a `paused` return stops and waits for PO confirmation | Never auto-proceed past a gate; the PO must cross each threshold explicitly — see "The pause protocol" in SKILL.md |
| At GATE L3 FAIL: name scope (task + failed criterion), never prescribe fix options | Root cause analysis and fix paths belong to the implementer, not the orchestrator |
| SHIP harvest records facts only — copies existing structured output, never computes a new verdict/score | A self-computed score = a second judge behind spec-evaluator (breaks single-judge, invites Goodhart); the eval suite interprets, harvest records |
| Three-level circuit breaker: attempt_budget (inner, per scope) nests inside round_budget (outer), with an opt-in wall_clock_budget_s deadline | An exhausted scope queues a GATE H hammer proposal, it never blocks the round; only round_budget hitting 0 stops the whole run; the deadline breaker (checked every round boundary in `shapeup-run.js`) routes to GATE H so a run out of clock still ships what is green instead of being killed from outside |
| The tech lead never hand-edits a scope contract | scope-architect is its sole writer (single-writer-per-file) |
| Substrate-disjointness + PA1/PA2 lints are re-asserted at GATE L1b (spec-lint.mjs) even when scope-architect already checked them | A human may have hand-approved past a 🔴 at the architect's checkpoint; `shapeup-run.js` runs spec-lint itself, in code, before resolving L1b |
| Hill phase is read from mechanical facts (T0/T1/seesaw), never declared by a worker | DD-10 — closes the self-reported-confidence risk (R3) outright |
| GATE H is delegated to scope-hammer, never adjudicated inline by the tech lead | Keeps the orchestrator thin; census/baseline-comparison/cut-list logic has one owner |
