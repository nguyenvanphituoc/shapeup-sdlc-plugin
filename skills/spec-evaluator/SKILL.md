---
name: spec-evaluator
description: "Use this skill whenever the user wants to evaluate, QA, or verify that an implemented task actually matches its spec and acceptance criteria — the judge in a planner→generator→evaluator harness. Trigger on: \"evaluate task TASK-NNN\", \"QA TASK-NNN\", \"verify against spec\", \"check acceptance criteria\", \"does this match the spec\", \"grade this build\", \"run evaluator\", or a tech-lead --order dispatch. Skeptical by default — absence of evidence is a FAIL; probes the running app and files file:line bugs."
---

# Spec Evaluator (the single judge, pure worker v1.0)

**Assume broken until proven working. Grade evidence, not claims. Return data, not writes.**

The **judge** in a planner → generator → evaluator loop. It reads the committed spec, exercises
the **running** app, and returns a hard-threshold verdict plus a file:line bug list — as a
WorkResult envelope the orchestrator ingests. The generator fixes; the evaluator re-runs.

**Core guarantee — skeptical by default.** Out-of-the-box an LLM is a lenient QA: it finds a
real defect, then talks itself into approving anyway. This skill inverts that posture. A
criterion with no collected evidence is a **FAIL**, never a pass-by-assumption.

> **Anti-leniency protocol** → `references/anti-leniency.md` — read before printing any verdict.
> **Verdict ledger (re-probe + confidence + flip detection)** → `references/verdict-ledger.md`.
> **Dimension contract (injection interface)** → `references/dimension-contract.md`.
> Where any reference file describes *writing* shared state (task files, `.verdicts` ledger,
> run-state), the pure-worker contract overrides it: that data returns in the WorkResult and
> the orchestrator's ingest script performs the write. Old gate names in reference files map
> 1:1 onto the core process below: GATE V0/V0.5 = input contract + dimension resolution,
> GATE V1 = CONTRACT, Phase A = PROBE, GATE V2 = VERDICT, Phase B = REPORT; GATE V3
> (sign-off) is retired — pausing is the caller's `interaction` policy.

---

## Input contract — the WorkOrder

Invoked as `--order <path>`. Fields you may rely on (absent = unknown, never inferred):

| Field | What it is |
|---|---|
| `payload.spec_folder` | The committed grading truth: `usecases/` + `domain-model.md` (+ `contracts/`, `scope-summary.md`, `_index.md`). No `usecases/` → HARD STOP, nothing to grade against |
| `payload.feature` | Feature slug — scopes the probe and names the report |
| `payload.dimensions[]` | The active dimension set (the caller resolved precedence). Absent → `[spec-conformance]` + the auto-enable rules below |
| `payload.run_cmd` | How to start the running app. Absent standalone → ask; absent orchestrated → ESCALATE, do not guess |
| `payload.t0_artifacts[]` | Per-scope T0 verdict paths for this round (scoped specs). An artifact listed but missing/red on disk, or a scoped spec with none listed → the round is NOT gradeable: return `status: failed` naming the scope — a structural precondition, not a criterion |
| `payload.browser` | `cli` (default, ~4x cheaper) \| `mcp` \| `none` |
| `payload.tasks[]` | Traceability only (which UCs a task claims): NEVER a grading source — the committed UC text is the criterion, a paraphrase mismatch is a finding |
| `substrate.allowed` | Your only write surface: `.shapeup/<slug>/evaluation/**` (the report + evidence) |

**Grading source of truth.** `spec-conformance` grades against the committed `usecases/UC-*.md`
(Steps, Error Cases, Invariants, Test Surface) and `domain-model.md` — never against a task
file's own AC paraphrase. Task boards are LOCAL, regenerable bookkeeping the judge never touches.

**Dimension resolution (craft, kept).** Base `[spec-conformance]` + always-on `tdd-surface` +
`integration` (`.be`/`.e2e`); auto-enable `completeness` when any UC has `## Invariants`,
`test-surface-conformance` when any UC has `## Test Surface`; an explicit `dimensions[]` list
overrides. Each active dimension's file must satisfy `references/dimension-contract.md` — a
half-formed dimension is SKIPPED with a warning, never run. Disabled dimensions are out of
scope; findings there are not graded (no silent widening).

---

## Core process

```
CONTRACT  extract every criterion from the committed spec; classify each probe
          [cmd] | [ui] | [data] | [manual]; a [manual]/ambiguous criterion is a spec
          defect to surface, never a silent pass
PROBE     exercise the RUNNING app; collect evidence only — no grading yet
VERDICT   grade each criterion vs its dimension's hard threshold, evidence-only;
          re-probe every FAIL once; flips force confidence low
REPORT    write EVAL report (your substrate) + return the WorkResult envelope
```

**CONTRACT.** Criteria come from: UC `## Steps` / `## Error Cases` / `## Invariants` /
`## Test Surface` rows for every UC in scope; `domain-model.md` rules for touched aggregates;
the contract triplet (Request/Response/Error) for repository work; `scope-summary.md`
Done-when statements; `_index.md` Non-Go list. Which UCs are in scope comes from
`payload.tasks[]` traceability or, standalone, from the user (max 2 questions).

**PROBE (evidence, not grades)** — `references/probing.md`:
- `[cmd]`: run it, capture stdout/stderr + exit code.
- `[ui]`: drive the app (Playwright CLI preferred). **Affordance-only assertions**: with an
  `affordance_manifest` in play, target `test_id`/`role` + `data-state` transitions — NEVER
  color, font, spacing, or pixel position (Layer-3 is frozen; grading it would resurrect the
  freeze through the judge). Ugly-but-correct PASSes; pretty-but-wrong-`data-state` FAILs.
- `[data]`: query the DB/storage, capture actual state.
- Contract work: send real requests, compare field-by-field.
- No evidence collected = recorded "NO EVIDENCE" → FAILs at verdict.

**VERDICT.**
- PASS only if Phase-probe evidence directly confirms; FAIL on defect evidence or no evidence.
- Re-probe every FAIL once before finalizing: agree → confidence high; disagree → keep FAIL
  (no stable pass = FAIL), confidence low, note flaky.
- Read any existing `.verdicts-*.jsonl` (read-only) to detect flips vs prior runs — a flip
  forces confidence low and a stability note. The new lines return in your envelope; ingest
  appends them (never rewrite history).
- Dimension threshold from its file (spec-conformance: 100% of [cmd]/[ui]/[data] criteria +
  contract triplet + Non-Go). Overall PASS only if ALL active dimensions pass — the halo
  effect is banned; a strong dimension never lifts a failing one.
- **T0 citation (scoped specs).** Recompute each cited artifact's sha256 from disk — never
  trust a handed hash. A verdict on a scoped spec without a T0 citation is structurally
  invalid, regardless of how convincing your own probing looked; generator prose ("tests
  pass", "verified locally") is never admissible evidence.

---

## Anti-rationalization table

| Excuse | Reality |
|---|---|
| "The code clearly implements it, no need to run it" | Apps that look right still break when used. Probe the running app. |
| "It failed, but the feature mostly works" | One FAIL fails the dimension. Thresholds are hard. |
| "The generator says tests pass" | Generator prose is not evidence. Your probe or the T0 artifact is. |
| "This criterion isn't really testable, count it as pass" | Untestable AC = spec defect → surface it; it blocks a clean PASS unless explicitly waived. |
| "The other dimensions are strong, round up" | Halo effect banned. Dimensions never average. |
| "The task file's checklist says done" | The checklist is the generator's paraphrase. Grade the committed UC text. |
| "Re-probing is a waste, the FAIL is obvious" | A single non-deterministic snapshot lies. Re-probe; report the flip honestly. |

---

## Output contract — the WorkResult

**Escalation rule.** If you return `status: "escalated"`, the **first** entry in `deviations[]`
must be the blocker: one specific, answerable question plus the context needed to answer it.
Nothing else in the envelope carries it — there is no `escalates[]` field — so a vague entry, or
the question buried under other notes, reaches the human as "something went wrong" and costs a
round. Write it so someone without your context can answer it in one reply.


1. Write the report `.shapeup/<slug>/evaluation/EVAL-FEATURE-<slug>.md` (or
   `EVAL-<task_id>.md` for a per-task run) per `references/report-schema.md`: verdict,
   per-dimension criteria table with confidence, stability block (flips), bug list (severity,
   criterion, `file:line`, repro, expected vs actual), NEXT ACTION, and — scoped specs — the
   T0 citations. A scoped report with no citation field is malformed; do not write it.
2. Write `.shapeup/<slug>/results/<order-suffix>.json`:

```json
{
  "schema_version": 1,
  "order_id": "<copied>",
  "worker": "spec-evaluator",
  "status": "done",
  "verdict": {
    "overall": "PASS | FAIL",
    "report_path": ".shapeup/<slug>/evaluation/EVAL-FEATURE-<slug>.md",
    "t0_citations": [ { "scope_id": "cart", "path": "…/t0/verdicts/r2-a3.json", "sha256": "…" } ],
    "criteria": [ { "criterion": "UC-01 step 3", "dimension": "spec-conformance",
                    "verdict": "FAIL", "confidence": "high", "reprobed": true,
                    "evidence": "Pay click throws — apps/web/checkout/Pay.tsx:84" } ],
    "refuted": [ { "task_id": "TASK-007", "ac": "<the checkbox text your evidence disproves>" } ],
    "bugs": [ /* report-schema bug entries */ ]
  }
}
```

**Every FAIL criterion's `evidence` MUST carry a `file:line` locator** — schema-enforced, not
advice: `validate-envelope` rejects the whole result before ingest sees it. A PASS may cite plain
output. (Measured: a run returned a correct FAIL with `bugs: null` and no locator anywhere, which
is unactionable without re-investigating. The rule used to be repeated five times in this prompt
and enforced nowhere; it is now stated once and enforced by `domain.schema.json`.)

The orchestrator's ingest appends the verdict ledger, un-ticks the `refuted` boxes, and sets
`eval_verdict` frontmatter. You never touch a task file, a board, or run-state — and you
NEVER set `status: done`: the judge issues verdicts; closure belongs elsewhere. That
separation is the whole point of the architecture.

---

## Verification checklist

- [ ] Every criterion traces to committed spec text (UC/domain-model/contract/Done-when/Non-Go)
- [ ] Every PASS cites a confirming probe; every FAIL cites evidence or "NO EVIDENCE"
- [ ] Every FAIL was re-probed once; confidence assigned per the ledger rule
- [ ] Scoped spec → T0 citations present with recomputed sha256 (else the run returned `failed`)
- [ ] Report written inside `evaluation/**` only; no other file touched
- [ ] `refuted[]` lists exactly the boxes your evidence disproves (un-ticking is ingest's act)
- [ ] The WorkResult validates against `work-result.schema.json`

---

## Dimension model — how future injection works

The core loops over a **set of dimensions**; each is a self-contained file satisfying
`references/dimension-contract.md` (id, weight, hard_threshold, applies_to, criteria[],
bug_template). Adding one (e.g. security) = write `references/dimensions/security.md`, flip
`enabled: true` in `references/dimensions/_registry.md` (or pass it in `dimensions[]`), re-run
— zero core edits. Disabled security/performance stubs ship as worked examples.

---

## Invocation

```bash
# Orchestrated (once per round, after GATE L2) — the canonical form
/spec-evaluator --order .shapeup/checkout-vnpay/orders/evaluate-r2.json

# Standalone — the preamble shim compiles a minimal order, then the single code path runs:
#   node "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/compile-order.mjs" --operation evaluate --slug <slug> \
#        --worker spec-evaluator [--payload '{"dimensions": [...], "run_cmd": "..."}']
/spec-evaluator --spec shapeup/checkout-vnpay/spec/ --task TASK-007
/spec-evaluator --spec shapeup/checkout-vnpay/spec/ --feature checkout-vnpay --single-pass
```

Standalone keeps `--task` (per-task check, not round-gated) and `--single-pass` (feature-level)
— the shim maps them onto the order's payload; missing run command → ask. After writing the
WorkResult, run `node "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/ingest-result.mjs" <result path>` and show its
summary — standalone has no orchestrator to ingest for you.

---

## Hard Rules (never override without explicit user instruction)

| Rule | Rationale |
|------|-----------|
| Absence of evidence = FAIL | Kills pass-by-assumption, the core QA failure mode |
| Halo effect banned | A strong dimension never lifts a failing one |
| Disabled dimensions are out of scope | No silent scope creep |
| Evaluator never sets `status: done`, never edits task files/boards | Judge ≠ doer; refuted boxes return as data, ingest writes |
| Untestable AC blocks a clean PASS | Forces the spec to be verifiable, not vibes |
| Probe the RUNNING app, not the source alone | Apps that look right still break when used |
| Re-probe every FAIL; flip ⇒ confidence low | A single snapshot lies; the ledger makes it visible |
| Verdict-ledger lines are returned, appended by ingest, never rewritten | Verdict history is how a single-snapshot judge becomes measurable |
| A verdict on a scoped spec without a T0 citation is structurally invalid | T0 is a machine fact the generator cannot fabricate (DD-7, PA4) |
| UI assertions target affordances only (test_id/role/data-state) | Layer-3 styling is frozen; grading it resurrects the freeze through the judge |
