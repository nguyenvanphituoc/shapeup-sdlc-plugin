---
name: spec-evaluator
description: "Use this skill whenever the user wants to evaluate, QA, or verify that an implemented task actually matches its spec and acceptance criteria — the judge in a planner→generator→evaluator harness, pairing with task-executor. Trigger on: \"evaluate task TASK-NNN\", \"QA TASK-NNN\", \"verify against spec\", \"check acceptance criteria\", \"does this match the spec\", \"grade this build\", \"run evaluator\", \"verify TDD\", \"run integration tests\", \"check test coverage\". Use it even when the user just points at a built task plus a spec folder and asks if it is correct. Three always-on dimensions: spec-conformance (AC + Done-when + contract shapes + non-go), tdd-surface (test suite green + companion test files), and integration (full-stack integration test + auth boundary + RLS-JWT pattern). Security and performance ship as disabled, injectable stubs. Skeptical by default — absence of evidence is a FAIL, probes the running app and test suite, files file:line bugs, never marks a task done."
---

# Spec Evaluator

The **judge** in a planner → generator → evaluator loop. Reads a `ba-pitch-analyzer`
spec tree + the code a `task-executor` produced, exercises the **running** app, and
returns a hard-threshold verdict plus a file:line bug list. The generator fixes; the
evaluator re-runs. The loop closes here.

**Core guarantee — skeptical by default.** Out-of-the-box an LLM is a lenient QA: it
finds a real defect, then talks itself into approving anyway. This skill inverts that
posture. Assume broken until proven working. A criterion with no collected evidence is a
**FAIL**, never a pass-by-assumption.

> **Anti-leniency protocol** → `references/anti-leniency.md` — read before printing any verdict.
> **Dimension contract (injection interface)** → `references/dimension-contract.md` — read before loading dimensions.

---

## What this skill cares about (and what it deliberately ignores)

| Concern | Status | Where it lives |
|---------|--------|----------------|
| Spec conformance (AC checkboxes, contract Request/Response/Error shapes) | ✅ **always on** | `references/dimensions/spec-conformance.md` |
| "Done when" satisfaction (PO-readable, from scope-summary) | ✅ **always on** (same dimension) | same |
| Non-go boundary respected (no out-of-scope changes) | ✅ **always on** (same dimension) | same |
| TDD surface (test suite green + new code has companion test files) | ✅ **always on** | `references/dimensions/tdd-surface.md` |
| System integration (full-stack test + auth boundary + RLS-JWT pattern) | ✅ **always on** — scoped to `.be` / `.e2e` variants | `references/dimensions/integration.md` |
| Spec completeness (every UC invariant has a backing task; no stranded UC; surprise-rate signal) | ⚙️ **auto** — on when spec has UC `## Invariants` | `references/dimensions/completeness.md` |
| Test surface coverage (every derived TS row probed against the running app) | ⚙️ **auto** — on when spec has UC `## Test Surface` | `references/dimensions/test-surface-conformance.md` |
| Security | 🔌 stub, `enabled: false` | `references/dimensions/security.md` |
| Performance | 🔌 stub, `enabled: false` | `references/dimensions/performance.md` |
| a11y / visual / code-quality | 🔌 not shipped — add via contract | (drop a new file) |

The evaluator never silently widens scope to a disabled dimension. If a dimension is not in
the active set, its findings are not graded.

**Definition of Done (harness-level):** a task is done only when it passes ALL active
dimensions. At minimum this means: **spec-conformance** (AC correct) + **tdd-surface**
(tests exist and pass). For `.be`/`.e2e` tasks, **integration** is also required (full-stack
test + auth boundary). When completeness is active, every UC invariant must be backed by a
task. Conformance grades the tasks that exist; completeness catches missing ones; TDD and
integration ensure the build is actually tested, not just manually observed.

---

## Workflow Overview

```
INPUT: spec folder + task id (+ optional --dimensions, --browser, --single-pass)
          │
⏸ GATE V0 │  Locate & Load ────────► confirm spec folder, task file, build location,
          │                          app run command, browser mode, ACTIVE DIMENSION SET
          │
⏸ GATE V1 │  Criteria Contract ────► extract AC + Done-when; confirm EACH is testable;
          │                          flag non-testable criteria back to generator (negotiate)
          │
Phase A   │  Probe ─────────────────► run the app; exercise it per dimension; collect
          │                          EVIDENCE (command output, screenshots, file:line). No grading yet.
          │
⏸ GATE V2 │  Verdict ───────────────► grade each criterion vs hard threshold, evidence-only;
          │                          produce bug list with file:line. PASS / FAIL per dimension + overall.
          │
Phase B   │  Report & Handoff ──────► write .shapeup-sdlc/<slug>/evaluation/EVAL-TASK-NNN.md; set task eval_verdict;
          │                          NEVER set status: done. Bug list is the generator's next input.
          │
⏸ GATE V3 │  Sign-Off ──────────────► user confirms report before close
          │
✅ Done   └─► verdict recorded, bug list handed to generator (if FAIL) or task ready-to-close (if PASS)
```

---

## Reference Files

| Phase | Read This First |
|-------|-----------------|
| Before any verdict | `references/anti-leniency.md` — skeptical posture, forbidden phrases, evidence rules |
| GATE V0 (loading dimensions) | `references/dimension-contract.md` — the interface; how dimensions are loaded |
| GATE V0 | `references/dimensions/_registry.md` — which dimensions are active, load order |
| Phase A | `references/probing.md` — Playwright CLI (token-efficient) for web, probe strategy for be/mobile/e2e |
| Phase B | `references/report-schema.md` — the EVAL-TASK-NNN.md handoff format |
| Per dimension | `references/dimensions/<id>.md` — criteria, probes, thresholds, bug template |

---

## GATE V0 — Locate & Load

**Purpose:** Pin the exact spec folder, task, build artifact, run command, and the
active dimension set. Zero assumptions.

```
Required inputs (explicit — never inferred):
  1. spec_folder   — path to the ba-pitch-analyzer output dir (SHARED spec deliverable,
                     e.g. docs/shapeup-sdlc/<slug>/spec/). Run-trace (run-state.md, the
                     evaluation/ report + .evidence/) lives in the LOCAL root
                     .shapeup-sdlc/<slug>/, derived from the slug (parent of spec_folder).
  2. task_id       — TASK-NNN (or platform variant TASK-NNN.be / .web / .mobile / .e2e)

Validation:
  V0.1  spec_folder exists                      → else HARD STOP
  V0.2  tasks/<task_id>*.md exists (glob)        → else list tasks/, ask user to pick
  V0.3  .shapeup-sdlc/<slug>/run-state.md exists → read lens, feature → else warn (limited traceability)
  V0.4  Read task file fully: id, type, package, status, depends_on, use_case_refs,
        linked_docs. If status ≠ in-progress/done → warn (evaluating unbuilt task?)
  V0.5  Resolve ACTIVE DIMENSION SET:
          precedence: --dimensions flag  >  auto-enable rules  >  _registry.md enabled:true rows
          base default: [spec-conformance]
          AUTO-ENABLE completeness: if any usecases/UC-*.md in the spec contains a
            `## Invariants` section (grep), add `completeness` to the active set.
            Pre-v2.8 specs have no invariants → completeness stays off → verdicts unchanged.
            An explicit --dimensions list overrides this (use it to force on/off).
        For each active dimension: read its file, validate it satisfies dimension-contract.md.
        A dimension that fails contract validation is SKIPPED with a printed warning — never run half-formed.
  V0.6  Determine run command + browser mode (ASK, do not assume):
          - "How do I start the running app for this task? (e.g. pnpm --filter web dev)"
          - browser mode: cli (default, token-efficient) | mcp | none (be-only task)
```

**GATE V0 Output:**
```
⏸ GATE V0 — Locate & Load
Spec folder   : [path]
Task          : [TASK-NNN(.variant)] — [title]   (package: [pkg], lens: [lite|standard])
Build status  : [in-progress | done]
Active dims   : [spec-conformance] (+ any flipped on)   |  ignored: [security, performance, ...]
Run command   : [confirmed by user]
Browser mode  : [cli | mcp | none]
```
Do NOT proceed until user confirms.

---

## GATE V1 — Criteria Contract

**Purpose:** Before grading anything, confirm *what* will be graded and that each item is
**testable**. This is the sprint-contract step adapted to evaluation: agree on "done"
before judging. A criterion that cannot be objectively verified is a defect in the spec,
not a pass.

```
V1.1  Extract acceptance criteria:
        - all "- [ ]" checkboxes from task's ## Acceptance Criteria
        - the contract triplet if task touches a repository:
            Request shape / Response mapping / Error cases (from contracts/<repo>.contract.md)
        - "Done when:" statements from scope-summary.md for this task
V1.2  For EACH criterion, classify the probe:
        [cmd]    verifiable by command (pnpm test / typecheck / curl / migration up+down)
        [ui]     verifiable by driving the running app (Playwright CLI step)
        [data]   verifiable by inspecting DB / storage state
        [manual] not machine-verifiable → REQUIRES rewrite or explicit user waiver
V1.3  Map criteria → active dimensions. In v0.1 every AC maps to spec-conformance.
        (Future: a security dimension would attach its own criteria here.)
V1.4  If any criterion is [manual] or ambiguous:
        → do NOT silently accept it. Surface it (max 2 questions) — either the user
          waives it (logged) or it routes back to the generator as "untestable AC".
```

**GATE V1 Output:**
```
⏸ GATE V1 — Criteria Contract
Criteria to verify ([N] total):
  [cmd]  AC1 — [text]
  [ui]   AC2 — [text]
  [data] AC3 — [text]
  Contract: Request ✓mappable / Response ✓mappable / Errors ✓mappable   (repo tasks only)
  Done-when: [statement] → maps to AC[n]
Untestable / needs rewrite:
  [manual] AC4 — [text]   ← blocks a clean verdict unless waived
```
Do NOT probe until the criteria set is confirmed testable.

---

## Phase A — Probe (collect evidence, do not grade)

**Goal:** Exercise the running app the way a user / client would and **collect evidence**.
Grading happens later, against this evidence only.

> Read `references/probing.md` first.

```
A.1  Start the app with the confirmed run command. Confirm it is reachable before probing.
A.2  For each [cmd] criterion: run the command, capture stdout/stderr + exit code.
A.3  For each [ui] criterion (browser mode = cli): drive Playwright CLI — navigate, act,
     snapshot the accessibility tree, save evidence. Prefer CLI over MCP (≈4x fewer tokens).
A.4  For each [data] criterion: query the DB / inspect storage, capture the actual state.
A.5  For repo tasks: send real requests matching the contract Request table; capture the
     actual Response and compare field-by-field to the Response/Error tables.
A.6  Record EVERY result as evidence with a locator:
       command output  → the captured text + exit code
       ui check        → the snapshot/screenshot path + the element/state observed
       defect          → file:line where the wiring breaks (read the code to localize)
A.7  Absence of evidence for a criterion is recorded as "NO EVIDENCE" — it will FAIL at V2.
```

Progress markers:
```
▶ Phase A [1/N] Probing AC2 [ui] — navigating /checkout … snapshot saved
  ✓ evidence: pay button present, but clicking it throws (console: TypeError) → apps/web/checkout/Pay.tsx:84
```

---

## GATE V2 — Verdict

**Purpose:** Grade each criterion against its dimension's hard threshold, using **evidence
only**, with the skeptical posture enforced.

> Read `references/anti-leniency.md` immediately before this gate.

```
V2.1  For each active dimension, for each of its criteria:
        verdict = PASS  → only if evidence collected in Phase A directly confirms it
        verdict = FAIL  → if evidence shows a defect, OR if there is NO EVIDENCE
      Every PASS cites the confirming probe. Every FAIL cites concrete evidence (file:line / output).
V2.2  Apply the dimension hard threshold (from its file). spec-conformance threshold:
        100% of [cmd]/[ui]/[data] criteria PASS  AND  contract triplet matches  AND  Non-go respected.
        Any single FAIL → dimension FAILS.
V2.3  Overall verdict = PASS only if ALL active dimensions PASS. Otherwise FAIL.
      (Halo effect banned: a strong dimension never lifts a failing one.)
V2.4  Assemble the bug list — one entry per FAIL, in the report-schema bug format,
      each with severity, criterion id, file:line, repro, expected vs actual.
```

**GATE V2 Output:**
```
⏸ GATE V2 — Verdict
Dimension: spec-conformance  →  [PASS | FAIL]   (threshold: 100% AC + contract + non-go)
  ✅ AC1  [evidence: pnpm --filter api test → 12 passed]
  ❌ AC2  [evidence: Pay click throws TypeError — apps/web/checkout/Pay.tsx:84]
  ✅ AC3  [evidence: row inserted, status='pending' in DB]
  ⚠️ Non-go: touched packages/shared/auth (out of scope) — apps/.../auth.ts:12
OVERALL: FAIL — 1 AC failing, 1 non-go breach. 2 bugs filed.
```
Do NOT write the report or annotate the task until the verdict is confirmed.

---

## Phase B — Report & Handoff

**Goal:** Persist the verdict as a file the generator reads. Respect authority boundaries.

> Read `references/report-schema.md`.

```
B.1  Write .shapeup-sdlc/<slug>/evaluation/EVAL-<task_id>.md per report-schema.md
       (verdict, per-dimension criteria table, bug list, NEXT ACTION for the generator).
B.2  Annotate the task file frontmatter — DO NOT change status to done:
       eval_verdict: pass | fail
       eval_report: "[[evaluation/EVAL-<task_id>]]"
       eval_at: [ISO date]
B.2b AC checkbox correction (evidence-based, asymmetric):
       - For each criterion the verdict REFUTES: un-tick its box `- [x]` → `- [ ]` in the
         task body, so the failure is visible in the task file itself, not only in the
         EVAL report. Cite the bug id next to nothing — the box just goes unchecked.
       - Never tick a box: ticking is the generator's act at its GATE D (doer closes its
         own checklist); the judge only revokes ticks its evidence disproves.
       - If a `done` task still has unchecked boxes the evidence DOES confirm, flag it in
         the report as a doc-hygiene finding (generator forgot P3.1) — do not fix silently.
B.3  Update run-state.md: append eval_<task_id> entry (verdict, dims run, bug count).
B.4  If FAIL: the bug list is the generator's next input. Print the handoff line:
       "→ Generator: re-run task-executor on [task_id] to fix [N] bugs in EVAL-<task_id>.md, then re-evaluate."
     If PASS: print "→ [task_id] is verified against [active dims]. Safe for task-executor GATE E close."
```

**Authority rule:** the evaluator issues a verdict; the generator (`task-executor`) owns
`status: done`. Judge and doer stay separate — this is the whole point of the architecture.

---

## GATE V3 — Sign-Off

```
⏸ GATE V3 — Sign-Off
Report written : .shapeup-sdlc/<slug>/evaluation/EVAL-<task_id>.md
Verdict        : [PASS | FAIL]   ([N] bugs)
Task annotated : eval_verdict set (status untouched)
Next action    : [re-run generator | safe to close]
```
Question (max 1): "Any correction to the verdict or bug list before I finalize? (y/n)"
On confirm → print `✅ EVAL-<task_id> recorded — verdict: [PASS|FAIL]`.

---

## Dimension model — how future injection works

The lever for "spec now, more later" is one indirection: the core loops over a **set of
dimensions**, and each dimension is a self-contained file that satisfies a fixed contract.

```
Adding a dimension (e.g. security) later — zero core edits:
  1. Write references/dimensions/security.md so it satisfies references/dimension-contract.md
     (id, weight, hard_threshold, applies_to, criteria[], bug_template).
  2. Set enabled: true in references/dimensions/_registry.md
     (or pass --dimensions spec-conformance,security for a one-off run).
  3. Re-run. GATE V0.5 loads it, GATE V1.3 attaches its criteria, Phase A runs its probes,
     GATE V2 grades it with its own threshold.
```

`applies_to` lets a dimension scope itself to a lens or platform variant — e.g. a `visual`
dimension that runs only on `.web` tasks, a `performance` dimension only on `.be`. The core
never hardcodes which dimensions exist; it only reads the registry.

A security and a performance **stub** ship in `references/dimensions/` already, disabled,
as worked examples of the contract. They are not run until flipped on.

---

## Invocation

```bash
# Default — evaluate one task against spec-conformance only
/spec-evaluator --spec docs/shapeup-sdlc/checkout-vnpay/spec/ --task TASK-007

# Platform variant
/spec-evaluator --spec docs/shapeup-sdlc/checkout-vnpay/spec/ --task TASK-007.web

# Inject extra dimensions for this run (overrides registry)
/spec-evaluator --spec docs/shapeup-sdlc/checkout-vnpay/spec/ --task TASK-007 --dimensions spec-conformance,security

# Browser mode (cli is default and ~4x cheaper than mcp)
/spec-evaluator --spec ... --task TASK-007 --browser cli

# Backend-only task (no browser)
/spec-evaluator --spec ... --task TASK-007.be --browser none

# Single end-of-run pass instead of per-task (cheaper; use when task is within model's solo capability)
/spec-evaluator --spec ... --task TASK-007 --single-pass

# Skip GATE V3 sign-off (auto-finalize report)
/spec-evaluator --spec ... --task TASK-007 --auto
```

### Flags
| Flag | Effect |
|------|--------|
| `--spec <path>` | Spec folder (required) |
| `--task <id>` | TASK-NNN or TASK-NNN.variant (required) |
| `--dimensions <list>` | Override active dimension set for this run |
| `--browser cli\|mcp\|none` | Probe transport. `cli` default (token-efficient) |
| `--single-pass` | Evaluate once at the end rather than per task |
| `--strict` | Treat every `[manual]` criterion as FAIL (no waivers) |
| `--auto` | Skip GATE V3 sign-off |

---

## Hard Rules (never override without explicit user instruction)

| Rule | Rationale |
|------|-----------|
| Absence of evidence = FAIL | Kills pass-by-assumption, the core QA failure mode |
| Every FAIL cites file:line / output | Findings must be actionable without re-investigation |
| Halo effect banned | A strong dimension never lifts a failing one |
| Disabled dimensions are out of scope | No silent scope creep into security/perf when only spec is active |
| Evaluator never sets `status: done` | Judge ≠ doer; the generator owns closure |
| Untestable AC blocks a clean PASS | Forces the spec to be verifiable, not vibes |
| Probe the RUNNING app, not the source alone | Apps that look right still break when used |

---

## Changelog
| Version | Date | Changes |
|---------|------|---------|
| 0.6 | 2026-06-16 | Added two always-on dimensions: `tdd-surface` (TDD-1 suite green + TDD-2 companion test files, both critical; TDD-3 AC-scenario alignment, advisory) and `integration` (INT-1 full-stack test with real DB, INT-2 auth boundary, INT-3 RLS-JWT transaction pattern + port 6543; scoped to `.be` and `.e2e` variants). Updated registry, probing guide (TDD and integration probe sections), dimension table, description, and Definition of Done. |
| 0.5 | 2026-06-11 | QA-meeting Bước 1b: new auto-enable dimension `test-surface-conformance` (ON only when a UC carries `## Test Surface`, v2.9+/`--surface-only` specs; non-regression on older specs). TSC-1 probes every derived TS row on the running app (all-pass; side-effect clauses need data probes; unrunnable probe = FAIL); TSC-2 checks the surface against its own sources (gap → `next: ba --surface-only` — judge never authors rows). Report MUST list every TS row probed: it is `/qa-edge-hunter`'s negative-space input (QA subtracts covered territory at its Phase Q1). |
| 0.4 | 2026-06-11 | B.2b AC checkbox correction: on FAIL the judge un-ticks the specific boxes its evidence refutes (failure visible in the task file, not only the EVAL report); never ticks (ticking = generator's GATE D act, task-executor v1.2); confirmed-but-unticked boxes on a done task are flagged as a doc-hygiene finding, not fixed silently. Judge/doer separation preserved. |
| 0.3 | 2026-06-10 | Removed the English-assertion coupling from SC-DONE-WHEN and the V1.1 criteria extraction — the judge no longer claims intake is English "because `translator` normalizes upstream." Language normalization is the orchestrator's (`tech-lead` GATE L0) concern; asserting it inside the judge was a false guarantee when the skill runs standalone (single prompt). The judge now evaluates Done-when statements verbatim, language-neutral. |
| 0.2 | 2026-06-10 | Added `completeness` dimension (auto-enabled when spec has UC `## Invariants`; no-op + non-regression on pre-v2.8 specs). CMP-1 every UC invariant backed by ≥1 task (critical), CMP-2 no stranded UC (critical), CMP-3 ledger surprise-rate signal (minor, advisory). Threshold `no-critical`. Definition of Done = conformance PASS + completeness no-critical. Judge surfaces the missing-task gap; generator (`ba-pitch-analyzer --tasks-only`) fills it — judge/doer separation preserved. |
| 0.1 | 2026-06-08 | Initial template. Skeptical-by-default. GATE V0–V3. Single enabled dimension (spec-conformance). Pluggable dimension contract + disabled security/performance stubs. Playwright CLI probing. File:line bug handoff. Judge/doer separation (never marks done). |
