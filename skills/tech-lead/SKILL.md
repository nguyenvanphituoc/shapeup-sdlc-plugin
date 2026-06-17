---
name: tech-lead
description: "Use this skill whenever the user wants to orchestrate a whole feature end-to-end across the harness skills — ba-pitch-analyzer (planner), task-executor (generator), spec-evaluator (judge) — acting as the tech lead that owns the run and reports to the PO at round boundaries. Trigger on: \"run the full harness\", \"act as tech lead\", \"ship this feature end to end\", \"from pitch to ship\", \"orchestrate the build\", \"plan build evaluate\", and Vietnamese \"điều phối\", \"chạy full pipeline\", \"tự build feature này từ pitch tới ship\". Use it even when the user describes a multi-step build flow without naming the skills. Faithful to the long-running harness pattern: PLAN once, BUILD all tasks, then run the evaluator EXACTLY ONCE per build round (never per task), looping on FAIL until PASS or max-rounds. Keeps a round ledger, stays thin (delegates, never reimplements the sub-skills), and supports interactive / --auto / --unattended levels for local vs headless CI runs."
---

# Tech Lead (harness orchestrator)

The conductor over the build-phase skills. It does not orient, plan, build, or judge itself —
it **sequences** the skills that do, decides what happens at each round boundary, and surfaces
decisions to you (the PO) at gates. Think of it as the senior engineer running the board, not
a fifth worker.

```
orient (scout)  →  ba-pitch-analyzer (planner)  →  task-executor (generator)  →  spec-evaluator (judge)
   ORIENT (7)         MAP SCOPES (8)                    BUILD (9, loop)               EVALUATE (once)
```

**Building only — the scope boundary.** This orchestrator owns the Shape Up **Building phase
(steps 7–11)**: Orient → Map Scopes → Build Vertically → Report → Stop & Ship. **Shaping (1–4),
Betting (5), and Kick-off (6) are PO-personal and upstream** — you hand over an already-shaped,
already-bet pitch with full authority. The tech lead does **zero** shaping or planning-authority
work; its intake is a *kicked-off pitch*, not a raw idea. (See `docs/research/shapeup-harness-redesign.md` D0/D1.)

**Orient before Map-Scopes — why `ba` runs second.** Faithful to the roadmap, the team gets
**no pre-divided tasks at kick-off**; it **Orients first (7), then Maps the Scopes (8)**. So the
`orient` Scout runs before `ba-pitch-analyzer`, and `ba`'s board is **reality-born** from the
Scout's code-surface map + discovered-task seed rather than imagined up front.

**The load-bearing rule — why this skill exists.** The evaluator runs **exactly once per
build round, only after the task board is 100% done.** Never per task. This is the V2
harness lesson: a single end-of-round QA pass is far cheaper than grading every sprint, and
just as effective once the generator is capable. The tech lead is the component that
enforces this timing — the sub-skills can't, because none of them sees the whole board.

**Orchestrator discipline — three invariants that must hold at every gate:**

1. **Gate block first.** Every gate emits the canonical `⏸ GATE LN — Title` block (exactly as shown in each gate section) before any narrative. Conversational output without the block is not a gate — it's a note.
2. **Confirmation before crossing.** In interactive/--auto mode, the tech lead does not proceed past a gate until the PO explicitly confirms. Emit the block, state what comes next, then stop and wait. Never auto-proceed.
3. **Thin at L3 FAIL.** When listing bugs, name the scope (task ID + failed Done-when criterion). Do NOT prescribe fix options or root cause hypotheses — that belongs to the implementer. The tech lead routes, it does not diagnose.

> **Round loop, stop conditions, r=1 vs r>1 semantics** → `references/round-protocol.md`
> **How each sub-skill is invoked + handoff files** → `references/delegation.md`
> **Run ledger format + Hill report** → `references/ledger-schema.md`

**State ownership (the harness rule).** Workers are stateless; the orchestrator is the **sole
writer of run-state**. The tech lead owns `harness-run.md` — rounds, gate decisions, Hill
positions, verdicts, `discovered_rounds`, config, language record — and passes what a worker
needs (e.g. `feature`, `discovered_rounds`) **down as args**. Workers keep only their own
product-idempotency key (e.g. `ba`'s `pitch_hash` in its `_index.md`) and emit domain
artifacts; they do not own the run. The board (`tasks/_index.md`) stays with the
planner/generator as **execution truth** (the tech lead reads it). See D6 in the redesign doc.

---

## Workflow Overview

```
INTAKE: kicked-off pitch (shaped + bet, by the PO) + project context
          │
⏸ GATE L0 │  Intake & Run Config ──► spec folder target, lens, stack, eval dimensions,
          │                          max_rounds, auto level   (no shaping/planning here)
          │
▶ ORIENT  │  delegate → orient (Scout, step 7) ──► .shapeup-sdlc/<slug>/orient/: code-surface map,
  (7)     │  spike findings, discovered-task seed, hill signal. Runs BEFORE any board exists.
          │
⏸ GATE L1a│  Orient Review ─────────► 🗻 area-level Hill (what's uphill/unknown going in).
          │                          Confirm the riskiest area + spike result before mapping.
          │
▶ MAP     │  delegate → ba-pitch-analyzer (step 8), orient-informed ──► spec tree +
  SCOPES  │  tasks/_index.md (the board). `ba` consumes orient/ artifacts, does not re-scan.
  (8)     │
⏸ GATE L1b│  Board Review ──────────► review board: slices, spine, ~ nice-to-haves, deps,
          │                          scope. PO sign-off BEFORE any code is written.
          │
▶ BUILD r │  delegate → task-executor (loop --next until board all ✅) ──► code
  (9)     │  r=1: build ALL ready tasks.   r>1: build ONLY the bugs from last EVAL.
          │  If new tasks discovered → /ba-pitch-analyzer --tasks-only --from-discovered
          │  reconciles them, routes back to GATE L1b, and resumes BUILD.
          │
⏸ GATE L2 │  Build Round Complete ──► confirm EVERY task status=done (board green).
          │                          THIS is the precondition that unlocks evaluation.
          │
▶ EVAL r  │  delegate → spec-evaluator --feature <slug> --single-pass ──► ONE verdict + bugs
          │  Runs once over the whole running feature. Never invoked inside BUILD.
          │
⏸ GATE L3 │  Verdict & Loop ────────► 🗻 Hill report (slice-level) + verdict.
          │                          PASS → SHIP.  FAIL → show bugs, approve fix → BUILD r+1
          │                          (stop if max_rounds hit → escalate to PO)
          │
▶ SHIP    │  scope-hammer vs baseline + deploy truth; final summary, traceability
  (11)    │
⏸ GATE L4 │  Ship Sign-Off ─────────► PO confirms before close
          │
✅ Done   └─► feature shipped, ledger closed, verdict: PASS
```

---

## Precondition — English-only intake (delegated to `translator`)

The whole harness (`ba-pitch-analyzer`, `task-executor`, `spec-evaluator`) is English-only
end to end and HARD-FAILs on anything else. The tech lead does **not** translate — that is a
separate single-purpose concern owned by the **`translator`** skill. The orchestrator only
*detects* the gap and *sequences* the translator before PLAN; it never does the translation
itself.

At GATE L0 the tech lead runs `/translator --check <intake>`:
- **English** → proceed straight to ORIENT against the original.
- **non-English** → run a full `/translator <intake>` pass first (pass `--auto` under
  `--auto`/`--unattended`), then orchestrate against the produced `<name>.en.md` copies.
  Record the translator pass in the ledger.

The tech lead's job stays orchestration faithful to Shape Up: kicked-off pitch → ORIENT →
MAP SCOPES → BUILD rounds → single end-of-round EVAL → SHIP. Language normalization is
upstream and out of scope here.

---

## GATE L0 — Intake & Run Config

**Purpose:** Pin everything the run needs once, up front, so the loop never has to guess.

```
Collect (explicit — never inferred):
  L0.1  Kicked-off pitch source: path to a shaping.md / pitch.md (already shaped + bet by PO).
          Not a raw idea — shaping (1-4) / betting (5) / kick-off (6) are PO-personal, upstream.
  L0.1a Language gate: run /translator --check <intake>.
          English      → use intake as-is.
          non-English  → run /translator <intake> (--auto under auto/unattended), then
                         use the produced <name>.en.md as the ORIENT/MAP-SCOPES input. Log in ledger.
  L0.1b Appetite: read the `appetite` field from the pitch's YAML frontmatter (set by /shapeup).
          Surface it in the gate output. Use it to:
            - Contextualise the scope at L1b (right-size cuts to the budget).
            - Anchor max_rounds suggestion: 1-week → 2 rounds, 2-week → 3, 6-week → 4.
          If appetite is missing or "TBD (uncapped)": flag as a risk and note it in the ledger;
          proceed, but the PO should set scope expectations manually at GATE L1b.
  L0.2  Workspace roots (both keyed off <slug>, set here and threaded to every worker as args):
          - SHARED  docs/shapeup-sdlc/<slug>/  — durable source + deliverable (committed):
              shaping/ (from /shapeup), spec/ (where ba-pitch-analyzer writes the spec tree)
          - LOCAL   .shapeup-sdlc/<slug>/      — run-trace (hidden, gitignorable):
              harness-run.md (this ledger), run-state.md, digest, orient/, evaluation/, qa/,
              discovery/ledger.md
          spec_folder = docs/shapeup-sdlc/<slug>/spec/ (the deliverable arg passed to ba/eval/exec)
  L0.3  lens: lite | standard | cross-context   (passed to planner at step 8)
  L0.4  stack hint (e.g. "pnpm, Next 16 web :3000") — aims orient's code-surface sweeps + run commands
  L0.5  eval dimensions: default [spec-conformance]; only add if user asks
  L0.6  max_rounds: default 3, appetite-informed (see L0.1b)
  L0.7  auto level:
          interactive (default) — pause at every L-gate; sub-skills keep their own gates
          --auto                 — sub-skills run unattended (--auto); tech lead still pauses
                                   at L1a/L1b (orient+plan), L3 (verdict), L4 (ship)
          --unattended           — auto-confirm all L-gates too; stop only on PASS,
                                   max_rounds, or hard error (for headless / Agent SDK / CI)
```

**GATE L0 Output:**
```
⏸ GATE L0 — Intake & Run Config
Feature      : [slug]   (kicked-off pitch: [path])
Intake lang  : [English | translated via /translator → <name>.en.md]
Appetite     : [~1 week | ~2 weeks | ~6 weeks | ⚠️ missing — scope uncapped]
Spec folder  : [path]   (lens: [lite|standard])
Eval dims    : [spec-conformance]   max_rounds: [N, appetite-informed]   auto: [interactive|auto|unattended]
Run commands : [web: ... | api: ... | mobile: ...]
```
Do NOT start ORIENT until confirmed (interactive/auto). Under --unattended, proceed.

---

## ORIENT (step 7) — delegate to orient (the Scout)

The Shape Up Building phase opens with **Orient, not planning**: the team reads the real code
and spikes the scary parts *before* any board exists, so the board comes out reality-born.

```
Invoke: /orient --pitch <intake> --spec <path> --stack "<hint>" [--auto]
Owns:   its own GATE O-A/O-B; runs straight through under --auto.
Writes: .shapeup-sdlc/<slug>/orient/ → code-surface.md, spike-<area>.md, discovered-seed.md, hill-signal.md.
Record in ledger: orient duration + the spiked area + spike result (resolved | SPIKE-UNRESOLVED).
```
The four artifacts are the **orient → ba contract**: `ba` (step 8) consumes them instead of
re-scanning the codebase. Pass `--auto` only when the run level is `--auto`/`--unattended`.

---

## GATE L1a — Orient Review

**Purpose:** PO sees where the pitch lands in real code and what's still unknown — *before*
committing to a scope map. This is the first Hill read (area-level — slices don't exist yet).

```
Read .shapeup-sdlc/<slug>/orient/. Render the 🗻 Hill from hill-signal.md (see ledger-schema.md "Hill report"):
  - each suspected area → uphill (open unknowns) | crest (approach proven by the spike) | downhill
Print: the code-surface headline (where it lands), the spiked area + result, the riskiest
       open unknowns going into mapping.
Ask (max 2): is the riskiest area the right one to have spiked? any unknown that must be
             resolved (another spike) before we map scopes?
```
Do NOT enter MAP SCOPES until Orient is accepted.

---

## MAP SCOPES (step 8) — delegate to ba-pitch-analyzer (orient-informed)

```
Invoke the planner with the pitch + lens + orient artifacts as input. Let it own its own
gates (1–7); pass --auto only if the run auto level is --auto/--unattended.
Hand it: .shapeup-sdlc/<slug>/orient/code-surface.md (so Phase 1 ingest consumes the map, does not re-scan)
         .shapeup-sdlc/<slug>/orient/discovered-seed.md (so Phase 6 task gen starts from reality)
         .shapeup-sdlc/<slug>/orient/spike-<area>.md (feeds Phase 1b feasibility / contracts)
Output expected: spec_folder populated with _index, domain-model, usecases/, contracts/,
tasks/TASK-NNN*.md, tasks/_index.md (board), scope-summary.md.
Record in ledger: planner duration + task count.
```
Faithful note: keep the planner ambitious on scope but high-level on tech — do not push it
to over-specify implementation. Errors baked into the spec cascade into every build round.
Honest deviation: `ba` is heavier than Shape Up's light "map scopes" bucketing — that extra
upfront spec-traceability is a deliberate trade for an LLM builder (redesign doc D8), not
"pure Shape Up". State it; don't pretend otherwise.

---

## GATE L1b — Board Review (Plan Acceptance)

**Purpose:** PO sees the shape of the work before a single line of code. This is where scope
is cut or confirmed — cheap here, expensive later.

```
Read tasks/_index.md. Print:
  - task count by package/variant (.shared / .be / .web / .mobile / .e2e)
  - layer distribution (Layer 1→6) and the critical dependency path
  - any SPIKE tasks (third-party feasibility) that block others
  - scope-summary "Done when" headline statements
Ask (max 2): scope cuts? lens correct? any SPIKE to resolve before build?
  Scope-hammer framing: reference the appetite from the pitch
  (e.g. "Given a ~1-week appetite, which of these scopes feels right-sized?").
  Also surface any rabbit holes identified in the pitch — they flag where scope
  may expand unexpectedly if not cut now. A scope cut here is cheap; after
  BUILD round 1 it's expensive.
```
Do NOT enter BUILD until the board is accepted.

---

## BUILD round r — delegate to task-executor

```
r = 1 (first build):
  Loop:  /task-executor --spec <path> --next   (executes lowest-priority ready task)
         repeat until tasks/_index.md shows every task ✅ done (no ready/blocked left)
  task-executor keeps its GATE A–E per task; pass --auto-close under --auto/--unattended.
  SPIKE tasks resolve first (they block). Respect dependency/layer order — the board enforces it.

  Discovered Tasks:
  If task-executor logs raw discovered tasks during the build (P3.7), the build loop pauses
  after the current tasks are done. Run:
  /ba-pitch-analyzer --tasks-only --from-discovered .shapeup-sdlc/<slug>/discovery/ledger.md
  This reconciles them into new tasks and invariants, updates tasks/_index.md, and increments
  discovered_rounds. Route back to GATE L1b (Board Review) for PO approval, then loop back
  to resume building the newly generated tasks.

r > 1 (fix build, after a FAIL):
  Input = the bug list in evaluation/EVAL-FEATURE-<slug>.md from the previous EVAL.
  Build ONLY those bugs. For each bug: re-open the affected task (status → in-progress),
  run task-executor --task <id> --force scoped to the bug's fix, re-close.
  Do NOT re-run the whole board. Do NOT touch passing areas.
```
Record per task in the ledger: task id, status, files touched.

---

## GATE L2 — Build Round Complete

**Purpose:** The single most important gate — it is the **only** thing that unlocks the
evaluator. No evaluation runs while any task is unbuilt.

```
L2.1  Read tasks/_index.md. Assert: every task status = done (board fully green).
      → If any task is ready/in-progress/blocked: BUILD is not complete. Return to BUILD.
        Never proceed to EVAL on a partial board.
L2.2  Tech-lead judgment call (surface, default = run eval):
      Is this feature within what the model builds reliably solo (trivial CRUD, tiny scope)?
      If clearly yes, offer to SKIP evaluation this run (--no-eval) — the evaluator is not a
      fixed yes/no; it earns its cost when work sits beyond easy solo capability.
      Default: run the single eval pass.
```

**GATE L2 Output:**
```
⏸ GATE L2 — Build Round [r] Complete
Board        : [N]/[N] tasks ✅
Ready to EVAL: yes
Eval plan    : spec-evaluator --feature [slug] --single-pass   (dims: [spec-conformance])
```
Emit this block, then **stop and wait for PO confirmation** (interactive/--auto) before delegating to spec-evaluator. This is the PO's last chance to cut scope or skip eval (`--no-eval`) before the evaluator runs — make that explicit. Under --unattended, proceed.

---

## EVAL round r — delegate to spec-evaluator (ONCE)

```
Invoke ONE feature-level pass over the whole running app:
  /spec-evaluator --spec <path> --feature <slug> --single-pass --dimensions <active>
The evaluator exercises the running feature against ALL acceptance criteria + Done-when
across every task, and writes ONE evaluation/EVAL-FEATURE-<slug>.md (verdict + bug list).
It never sets status: done — that authority stays with task-executor / the tech lead.
Record in ledger: eval duration, verdict, bug count.
```
This is the single point where the evaluator runs in a round. It is not called per task,
not called inside the BUILD loop, not called before GATE L2.

---

## GATE L3 — Verdict & Loop

```
Render the 🗻 Hill report (slice-level) from the board + open unknowns — NOT a task count.
  Per slice → uphill (unknowns open) | crest (approach proven, spine renders) | downhill
  (only known work left) | done (clickable-done). See references/ledger-schema.md "Hill report".
  Roadmap rule: progress is reported by hill position, never by "N/M tasks done".

Read EVAL-FEATURE-<slug>.md verdict.

PASS:
  → first PASS of the run AND not --no-qa:
      delegate ▶ QA EDGE HUNT → /qa-edge-hunter (pure worker; see round-protocol
      "QA edge hunt"). Args: spec folder, EVAL report path, ledger path, app URL.
      Its GATE Q0/Q1 pauses surface here. Output: `~` findings → .shapeup-sdlc/<slug>/discovery/ledger.md
      + .shapeup-sdlc/<slug>/qa/hunt-report.md. No verdict — the run's verdict stays this EVAL's PASS.
      → then proceed to SHIP (triage of QA findings happens at SHIP S.0/GATE L4).
  → subsequent PASS (a promoted-findings fix round): /qa-edge-hunter --recheck on the
    promoted items only, then SHIP.
  → --no-qa or skill absent: proceed straight to SHIP; ledger records `qa: skipped`.

FAIL:
  → print the bug list grouped by task/severity. For each bug: task ID + failed Done-when criterion + repro.
    DO NOT prescribe fix options or root cause hypotheses — that is the implementer's job.
    The tech lead names scope; the implementer diagnoses and fixes.
  → ask (max 1): approve fixing these in BUILD round r+1? (or cut scope / waive a bug)
  → if r+1 > max_rounds: STOP. Escalate to PO with the residual bug list — do not loop
    forever. The harness reports honestly that it hit its round budget.
  → else: go to BUILD round r+1 (bug-only).
```

**GATE L3 Output:**
```
⏸ GATE L3 — Verdict (round [r])
🗻 Hill    : S1-spine 🔽 downhill · S2-filters ⛰️ crest · S3-export 🔼 uphill
Verdict   : [PASS | FAIL]   bugs: [N]   (rounds used: [r]/[max])
Decision  : [SHIP | re-build bugs in round r+1 | escalate: max rounds hit]
```
The Hill is the progress narrative; the board's `N/N ✅` is execution substrate (it gates
EVAL at L2), never the headline. Slices come from `ba`'s board; if slice IDs aren't present
yet (D3 deferred), report at task-group level and note the fallback in the ledger.

---

## SHIP (step 11) — close out

```
S.0  QA triage (when qa/hunt-report.md exists — this IS Shape Up's "Decide When to Stop"):
     print findings grouped by lens, each `~` by default with severity-hint. Ask (max 1):
     "Promote any to must-have? (ids / none)". Scope-hammer framing: compare to BASELINE
     (what customers live with today), not to the ideal.
       - none → all stay `~` in the ledger; ship debt-free, findings = raw ideas for a
         future cycle.
       - ids → fix round r+1 for those items only (round-protocol "QA edge hunt" loop).
       - The tech lead never promotes on its own; promotion is a PO/TL human call.
S.1  Confirm board green + latest eval verdict = PASS.
S.1b Checklist-hygiene assert: `grep -c "^- \[ \]" <spec>/tasks/TASK-*.md` → every count
     must be 0 on a shipping board. An unchecked AC box on a done task means either an
     unverified criterion (real gap — back to BUILD/EVAL) or a doc-update miss
     (task-executor P3.1 / spec-evaluator B.2b skipped — route back to the owning skill
     to tick/flag; the tech lead does not tick boxes itself). Do not SHIP past a non-zero
     count without logging the reason in the ledger.
S.2  Print a feature summary: tasks shipped, rounds used, final verdict, dims evaluated
     (and explicitly: dims NOT evaluated, so "shipped" is never read as "verified for all").
S.3  Point to the traceability: tasks/_index.md (all ✅) + EVAL-FEATURE-<slug>.md (PASS) +
     harness-run.md (the round ledger).
S.4  task-executor's GATE E remains the formal per-task close; the tech lead confirms the
     feature-level close.
S.5  Deploy truth — "done means deployed", honestly. Building stops at "built & verified";
     deployment is an outward-facing action gated to the PO. Either:
       - PO says yes → run the project deploy (docs/infra/DEPLOYMENT.md) and record "deployed".
       - otherwise → record "built & verified — deploy pending (PO)".
     NEVER auto-deploy; "shipped" must never silently mean "deployed".
     (Baseline-anchored scope-hammering at ship time is redesign-doc D5 — deferred; for now,
      `ba`'s Appetite Guard covers overflow and cuts go to synthesis "Hammered Out".)
S.6  Harvest one signal row → append to `docs/shapeup-sdlc/metrics.jsonl` (committed, SHARED root).
     Copy fields that ALREADY exist as structured output (run-state, final EVAL report,
     discovery ledger, qa/hunt-report, breadboard B5). Two hard rules:
       1. Harvest only fields that already exist at ship time — never evaluate something new.
       2. Record facts, never compute a new verdict (no `run_quality_score` — that would be
          a second judge behind spec-evaluator). The eval suite interprets; harvest records.
     `final_audit_score` is COPIED from the EVAL report, never re-graded.
     → full field list + row template: references/ledger-schema.md "Harvest row".
```

---

## GATE L4 — Ship Sign-Off

```
⏸ GATE L4 — Ship Sign-Off
Feature   : [slug] — [SHIPPED (deployed) | BUILT & VERIFIED — deploy pending (PO)]
Rounds    : [r] (build+eval cycles)
Verdict   : PASS (dims: [spec-conformance]; not evaluated: [security, performance])
QA        : [hunt done — N findings, M promoted+fixed, rest ~ | skipped (--no-qa) | n/a (pre-QA spec)]
Ledger    : harness-run.md
```
Question (max 1): "Anything to record before I close the run? (y/n)"
On confirm → `✅ [slug] [shipped & deployed | built & verified, deploy pending] — [r] rounds, verdict PASS.`

---

## Invocation

```bash
# Full build run from a kicked-off pitch, interactive (pause at every L-gate)
/tech-lead --pitch docs/shapeup-sdlc/checkout-vnpay/shaping/shaping.md --spec docs/shapeup-sdlc/checkout-vnpay/spec/ --lens standard

# Sub-skills unattended, tech lead pauses only at orient / plan / verdict / ship
/tech-lead --pitch ... --spec ... --auto

# Headless for CI (Agent SDK): auto-confirm all gates, stop on PASS / max_rounds / error
/tech-lead --pitch ... --spec ... --unattended --max-rounds 3

# Resume an existing run — start from a build-phase step
/tech-lead --spec docs/shapeup-sdlc/checkout-vnpay/spec/ --from build

# Skip evaluation for a trivial feature (tech-lead judgment / PO override)
/tech-lead --pitch ... --spec ... --no-eval
```

### Flags
| Flag | Effect |
|------|--------|
| `--pitch <path>` | Kicked-off pitch (shaped + bet by PO) — input to ORIENT then MAP SCOPES |
| `--spec <path>` | Spec folder (orient/ + planner output + ledger location) |
| `--lens lite\|standard\|cross-context` | Passed to ba-pitch-analyzer at step 8 |
| `--auto` | Sub-skills run unattended; tech lead pauses at L1a/L1b/L3/L4 |
| `--unattended` | Auto-confirm all L-gates (headless / CI) |
| `--max-rounds N` | BUILD→EVAL cycles before escalating (default 3) |
| `--from orient\|plan\|build\|eval` | Resume an in-progress run at a build-phase step |
| `--no-eval` | Skip the evaluation pass this run (trivial feature) |
| `--no-qa` | Skip the post-PASS /qa-edge-hunter pass (ledger records `qa: skipped`) |
| `--dimensions <list>` | Eval dimensions (default spec-conformance) |

---

## Hard Rules (never override without explicit user instruction)

| Rule | Rationale |
|------|-----------|
| Orchestrates Building only (steps 7–11); shaping/betting/kick-off are PO-personal, upstream | Intake is a kicked-off pitch, not a raw idea — the tech lead does no shaping/planning-authority work |
| ORIENT (step 7) runs before MAP SCOPES (step 8) | Roadmap: no pre-divided tasks at kick-off; the team orients first so the board is reality-born |
| Intake must be English before ORIENT; tech lead does NOT translate — it delegates to `translator` at GATE L0 | Translation is a separate single-purpose skill; orchestrator only detects + sequences |
| Tech lead is the SOLE WRITER of run-state (`harness-run.md`); workers get run metadata as args | Stateless workers, one stateful orchestrator — don't fragment run-state across worker files; protects `--from` resume |
| Progress is reported by Hill position, never by counting tasks | The roadmap forbids task-counting; a 90%-done slice can still be stuck uphill on the one unknown that matters |
| Discovered tasks are reconciled and reviewed | If new tasks are discovered during BUILD, run /ba-pitch-analyzer --tasks-only --from-discovered and route back to GATE L1b; do not ignore them |
| Evaluator runs once per round, only after GATE L2 (board 100% done) | The whole point: cheap end-of-round QA, never per task |
| Evaluator never called inside the BUILD loop | Keeps the build coherent and the run cheap |
| r>1 builds bugs only, never the whole board | Don't re-do passing work; minimize churn |
| Stop at max_rounds; escalate honestly | No infinite fix loops; the PO decides next |
| Tech lead delegates, never reimplements a sub-skill | Stays thin; each skill keeps its own gates and authority |
| Planner stays high-level on tech | Spec errors cascade into every build round |
| Never auto-deploy; "shipped" never silently means "deployed" | Deploy is outward-facing, PO-gated; record "deploy pending (PO)" otherwise |
| "Shipped" names the dims NOT evaluated | Prevents reading a spec-only PASS as fully verified |
| Every gate emits the canonical `⏸ GATE LN — Title` block before any narrative | Conversational output is not a gate; the block is the handoff contract |
| In interactive/--auto: emit the gate block, then stop and wait for PO confirmation | Never auto-proceed past a gate; the PO must cross each threshold explicitly |
| At GATE L3 FAIL: name scope (task + failed criterion), never prescribe fix options | Root cause analysis and fix paths belong to the implementer, not the orchestrator |
| Max questions per gate: L0/L1a/L1b = 2; L3/L4 = 1 | Gates are pauses, not interrogations; excess questions shift authority to the wrong role |
| SHIP harvest records facts only — copies existing structured output, never computes a new verdict/score | A self-computed score = a second judge behind spec-evaluator (breaks single-judge, invites Goodhart); the eval suite interprets, harvest records |

---

## Faithful-to-harness checklist (what this encodes from the long-running harness design)
- Building-phase only (7–11); shaping/betting/kick-off upstream with the PO.
- Orient before planning → `orient` Scout (step 7) feeds a reality-born board.
- Planner once, ambitious scope, high-level tech → delegated to ba-pitch-analyzer (step 8).
- Generator works through tasks; build round is one coherent pass → task-executor loop.
- Evaluator is a single end-of-round pass, not per sprint → enforced at GATE L2/EVAL.
- Rounds: BUILD r → EVAL r → BUILD r+1 (bugs) → EVAL r+1 … → PASS.
- Judge ≠ doer: evaluator issues verdict; generator/lead own closure.
- Files as handoff: spec tree + EVAL-FEATURE report + harness-run ledger.
- Simplicity: the orchestrator is thin; the evaluator is skippable for trivial work
  (the component earns its cost when the task is beyond easy solo capability).

---

## Changelog
| Version | Date | Changes |
|---------|------|---------|
| 0.10 | 2026-06-18 | **Automated Discovered Tasks.** If new tasks are logged in `.shapeup-sdlc/<slug>/discovery/ledger.md` during the BUILD loop, automatically run `/ba-pitch-analyzer --tasks-only --from-discovered` at a build round boundary to reconcile them. Then, route back to GATE L1b for PO review before resuming the build loop. Added matching hard rule. |
| 0.9 | 2026-06-18 | **Two-root workspace.** L0.2 now sets two roots off `<slug>` and threads them to workers: SHARED `docs/shapeup-sdlc/<slug>/` (shaping/ + spec/, committed) and LOCAL `.shapeup-sdlc/<slug>/` (run-trace: harness-run.md, run-state, orient/, evaluation/, qa/, discovery/ledger.md — hidden, gitignorable). `harness-run.md` moves to the LOCAL root; the harvest feed moves to `docs/shapeup-sdlc/metrics.jsonl` in the SHARED root (the one committed report surface; no gitignore carve-out needed). spec_folder = `docs/shapeup-sdlc/<slug>/spec/`. |
| 0.8 | 2026-06-17 | SHIP gains S.6 harvest: append one fact-only signal row → `docs/shapeup-sdlc/metrics.jsonl` (committed in the SHARED root; the LOCAL `.shapeup-sdlc/` run-trace is gitignored). Fields copied from existing structured output (run-state, final EVAL report, discovery ledger, qa/hunt-report, breadboard B5) with `slice_count` as normalizer; `schema_version: 1` for forward-compat. Two hard rules: harvest only fields that already exist at ship; record facts, never compute a new verdict (no second judge behind spec-evaluator). Feeds tier-3 e2e benchmark only. Schema + row template in references/ledger-schema.md "Harvest row". |
| 0.7 | 2026-06-16 | GATE L0: appetite read from pitch frontmatter; appetite surfaced in gate output; max_rounds appetite-informed (1-week→2, 2-week→3, 6-week→4); missing appetite flagged as scope risk. GATE L1b: scope cut framing references appetite + rabbit holes from pitch. |
| 0.6 | 2026-06-11 | QA-meeting Bước 1c + QA wiring. Regression rule (round-protocol): EVAL(r>1) scope = fixed bugs + FULL Test Surface re-run of every touched UC (untouched UCs not re-probed; pre-surface specs degrade honestly to bug-criteria-only with a coverage note). New ▶ QA EDGE HUNT step: first PASS → delegate /qa-edge-hunter (pure worker, no verdict, `~` findings → ledger + qa/hunt-report.md); triage at new SHIP S.0 = Shape Up "Decide When to Stop" (baseline-anchored scope hammer; promotion is a human call, never the tech lead's); promoted findings → fix round → eval --single-pass → qa --recheck (promoted items only). `--no-qa` flag; GATE L4 reports QA status. QA never runs on a FAIL round. |
| 0.5 | 2026-06-11 | SHIP gains S.1b checklist-hygiene assert: zero unchecked AC boxes on a shipping board (`grep -c "^- \[ \]" tasks/TASK-*.md`); non-zero → route to the owning skill (executor ticks at GATE D per its v1.2, judge un-ticks/flags per evaluator v0.4) — the tech lead never ticks boxes itself. Closes the canvas-usability close-out gap (51 boxes unchecked on a shipped board). |
| 0.4 | 2026-06-10 | **Shape Up redesign SPINE** (`docs/research/shapeup-harness-redesign.md`). D0: scope narrowed to the Building phase (steps 7–11); shaping/betting/kick-off are PO-personal; intake is a kicked-off pitch. D2: new ▶ ORIENT step (step 7) delegates to the `orient` Scout before planning + GATE L1a Orient Review; `ba` (PLAN) repositioned to MAP SCOPES (step 8), orient-informed; old GATE L1 split into L1a/L1b. D4: 🗻 Hill report at round boundaries (L1a area-level, L3 slice-level) — progress reported by hill position, board demoted to execution substrate (never the headline). D6: tech lead is the sole writer of run-state (`harness-run.md`); workers receive run metadata as args. SHIP gains a deploy-truth step (PO-gated; never auto-deploy). |
| 0.2 | 2026-06-10 | Clarified precondition: specs must be English before PLAN (downstream skills HARD-FAIL on non-English). Tech lead does NOT translate — translation is a separate single-purpose skill upstream of orchestration. Orchestrator stays focused on Shape Up flow. |
| 0.1 | 2026-06-08 | Initial orchestrator. GATE L0–L4 round gates. Single end-of-round evaluation enforced at GATE L2. Bug-only re-build rounds. Max-rounds escalation. Interactive / --auto / --unattended levels. Resume + --no-eval. |
