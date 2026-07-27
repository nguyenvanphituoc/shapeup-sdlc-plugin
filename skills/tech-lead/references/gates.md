# Tech-Lead Gate Playbooks

The full collect-lists, gate-output blocks, and delegation scripts for every gate and delegation
step, extracted from `SKILL.md` (progressive disclosure). **Read the relevant section when you
reach that gate** — `SKILL.md` carries the workflow spine, the build/eval loop, and the hard
rules; this file carries the step-by-step playbooks. The L2/L4 gates stay hook-enforced regardless
of where the prose lives.

Order matches the run: GATE L0 → ORIENT → GATE L1a → WIRE/L1a.5 → MAP SCOPES → GATE L1b →
(BUILD → GATE L2 → EVAL, in SKILL.md) → GATE L3 → SHIP → GATE L4.

---

## GATE L0 — Intake & Run Config

**Purpose:** Pin everything the run needs once, up front, so the loop never has to guess.

```
Collect (explicit — never inferred):
  L0.1  Kicked-off pitch source: path to a shaping.md / pitch.md (already shaped + bet by PO).
          Not a raw idea — shaping (1-4) / betting (5) / kick-off (6) are PO-personal, upstream.
  L0.1a Language gate: Agent (model: exec) → Skill(shapeup-sdlc-plugin:translator) --check <intake>.
          English      → use intake as-is.
          non-English  → Agent (model: exec) → Skill(shapeup-sdlc-plugin:translator) <intake>
                         (--auto under auto/unattended), then use the produced <name>.en.md as
                         the ORIENT/MAP-SCOPES input. Log in ledger.
  L0.1b Appetite: read the `appetite` field from the pitch's YAML frontmatter (set by /shapeup).
          Surface it in the gate output. Use it to:
            - Contextualise the scope at L1b (right-size cuts to the budget).
            - Anchor max_rounds suggestion: 1-week → 2 rounds, 2-week → 3, 6-week → 4.
          If appetite is missing or "TBD (uncapped)": flag as a risk and note it in the ledger;
          proceed, but the PO should set scope expectations manually at GATE L1b.
  L0.2  Workspace roots (both keyed off <slug>, set here and threaded to every worker as args):
          - SHARED  docs/shapeup-sdlc/<slug>/  — durable source + deliverable (committed):
              shaping/ (from /shapeup), spec/ (where ba-pitch-analyzer writes the spec tree:
              _index, domain-model, usecases/, contracts/, scopes/, scope-summary.md — NOT tasks/)
          - LOCAL   .shapeup-sdlc/<slug>/      — run-trace (hidden, gitignorable):
              harness-run.md (this ledger), digest, orient/, evaluation/, qa/,
              discovery/ledger.md, orders/ + results/ (the envelope port), tasks/ (the task
              board, v3.2 — regenerable via a generate-board order on any machine)
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
  L0.8  Model & budget resolution (addendum Blueprint F, four layers, highest precedence
        first) — resolve ONCE here, record the resulting matrix in the ledger header:
          /ship flags  →  .claude/settings.local.json (per-member, Tier C)  →
          .claude/settings.json (team defaults, committed)  →  skill-shipped defaults
        Env knobs read at this layer: SHAPEUP_ORCH_MODEL, SHAPEUP_EXEC_MODEL,
        SHAPEUP_EVAL_MODEL, SHAPEUP_QA_MODEL, SHAPEUP_ATTEMPT_BUDGET (default 5),
        SHAPEUP_DIGESTER_MODEL (default "script" — aegis-digest.mjs's regex pass; falls
        back to a Haiku dispatch only when the digester reports unrecognized log formats).
        A requested model unavailable on the member's plan → degrade to the next tier down,
        record the degrade in the ledger (R2 — invariants are code paths, so adherence
        survives even when the model tier doesn't).
  L0.9  attempt_budget: the INNER circuit breaker (design spec DD-9), nested inside
        max_rounds (the OUTER breaker, unchanged, L0.6). Default 5 — the number of T0 verify
        attempts a single scope gets inside one round before its attempt loop trips and
        queues a hammer PROPOSAL for GATE H rather than blocking the round. Only meaningful
        when the spec folder has scope contracts; a spec with none skips the attempt loop
        entirely and BUILD behaves exactly as in v0.2.6 (task-executor --next, no T0/seesaw).
```

**L0.0 — intake precondition (before any other L0 collection):**
```
resolve intake from, in order:
  1. --pitch <path>            (a shaping/pitch file on disk)
  2. --spec <folder>           (an existing spec tree)
  3. <intake> requirement text passed to the skill
none resolvable  ->  ABORT. Print the ✋ NO INTAKE block from SKILL.md and stop.
                     Do NOT emit the GATE L0 block. Do NOT list downstream gates.
                     Do NOT describe the pipeline that "will" run.
```
An orchestrator with no spec has nothing to orchestrate. Narrating the gate list in that state
produces output that reads exactly like a successful run and contains no work — measured at 29%
acceptance, n=3, on the benchmark. Fail loudly instead.

**GATE L0 Output:**
```
⏸ GATE L0 — Intake & Run Config
Feature      : [slug]   (kicked-off pitch: [path])
Intake lang  : [English | translated via /translator → <name>.en.md]
Appetite     : [~1 week | ~2 weeks | ~6 weeks | ⚠️ missing — scope uncapped]
Spec folder  : [path]   (lens: [lite|standard])
Eval dims    : [spec-conformance]   max_rounds: [N, appetite-informed]   auto: [interactive|auto|unattended]
Run commands : [web: ... | api: ... | mobile: ...]
Model matrix : orch=[model] exec=[model] eval=[model] qa=[model] digester=[script|haiku]  (source: [flags|settings.local|settings.json|default])
Budgets      : round_budget=[N] (outer)   attempt_budget=[N] (inner, per scope)
```
Do NOT start ORIENT until confirmed (interactive/auto). Under --unattended, proceed.

---

## ORIENT (step 7) — delegate to orient (the Scout)

The Shape Up Building phase opens with **Orient, not planning**: the team reads the real code
and spikes the scary parts *before* any board exists, so the board comes out reality-born.

```
Invoke via Agent (model: exec — see references/delegation.md "Invocation mechanism"):
        Skill(shapeup-sdlc-plugin:orient) --pitch <intake> --spec <path> --stack "<hint>" [--auto]
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

## WIRE (step 7.5) + traceability spine ✚ — delegate to solution-architect

**Active only when the spine is in use** — on a legacy spec skip it; `trace-lint` self-skips every arm whose artifact is absent (non-regression).

```
1. PROFILE (you write it at L0 — compile-order stays pipeline-blind): SHARED project-profile.json
   = {schema_version:1, archetype, entry_point}. archetype ∈ {client-only-game|web-service|
   mobile|library|data-pipeline}; entry_point is the reachability seam (a game's main.js is NOT a
   service's src/server.ts). Validate the enum — a typo must fail, not silently disable the check.
2. WIRE — compile-order --operation wire --slug <slug> (worker→solution-architect), payload
   {project_profile}. Sole writer of committed wiring-map.json (per-UC engine → seam → entry-point
   call site → affordance). ⏸ GATE L1a.5: confirm each UC has a declared seam before slicing.
3. COVERAGE (folds into MAP SCOPES) — compile-order --operation coverage → ba writes the SHARED
   requirements.md registry (atomic REQ clauses, frozen ids).
4. trace-lint — node skills/tech-lead/scripts/trace-lint.mjs --slug <slug>. ADVISORY at L1b:
   covers-closure (every covered REQ named by ≥1 AC's covers:) + reachability (every UC engine
   reaches entry_point). Promote to --gate only once covers: is populated.
```

---

## MAP SCOPES (step 8) — delegate to ba-pitch-analyzer (orient-informed)

```
Two orders, two workers, one step (both model: exec — see references/delegation.md):
1. ANALYZE + BOARD — compile-order --operation analyze --slug <slug> --worker ba-pitch-analyzer
     --payload '{"pitch": "<path>", "lens": "<lens>", "orient_dir": ".shapeup-sdlc/<slug>/orient/"}'
   dispatch: Skill(shapeup-sdlc-plugin:ba-pitch-analyzer) --order <path>. The order hands it
   code-surface.md (Phase-1 ingest consumes the map, does not re-scan), discovered-seed.md
   (task gen starts from reality), spike-<area>.md (feasibility/contracts).
   Output expected: spec_folder populated with _index, domain-model, usecases/, contracts/,
   scope-summary.md (all SHARED/committed) + tasks/TASK-NNN*.md, tasks/_index.md (board)
   written to the LOCAL root .shapeup-sdlc/<slug>/tasks/ (v3.2) + a WorkResult → ingest.
2. MAP SCOPES — compile-order --operation map-scopes --slug <slug> --worker scope-architect
   dispatch: Skill(shapeup-sdlc-plugin:scope-architect) --order <path>. Sole writer of the
   committed scopes/<scope-id>.json contracts (import-graph slicing, substrate whitelists,
   affordance manifest, fixtures, PA1/PA2 — mechanically linted by spec-lint.mjs).
Record in ledger: planner duration + task count + scope count.
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

**v3.2 (local-tasks-architecture):** on a spec with
scope contracts, the PO reviews the SHARED, committed plan — `usecases/_index.md` +
`scopes/*.json` + `scope-summary.md`'s Done-when headlines — never the LOCAL task board
(`tasks/_index.md`, gitignored, per-machine run-trace). Implementation-level task detail stays
hidden at this gate by design; the PO signs off on the UCs covered and how they're cut into
scopes, not a line-by-line task list. A pre-v0.3.0 spec (no scope contracts) has no scope
board to substitute for — this gate still reads `tasks/_index.md` directly, unchanged from
v0.2.6 (non-regression).

**Bootstrap check (local tasks board) — run BEFORE the read below, always:**
```
`.shapeup-sdlc/<slug>/tasks/_index.md` missing AND `docs/shapeup-sdlc/<slug>/spec/usecases/`
exists → a teammate (or a `--from build` resumed run) has the SHARED spec via git but no LOCAL
task board on this machine — `.shapeup-sdlc/` is gitignored and never travels with a branch.
compile-order --operation generate-board --slug <slug> --worker ba-pitch-analyzer, then
Agent (model: exec): Skill(shapeup-sdlc-plugin:ba-pitch-analyzer) --order <path> + ingest —
regenerates the board from the committed usecases/domain-model/scopes. Record the bootstrap in
the ledger. No-op on a fresh r=1 run (MAP SCOPES just wrote the board on this same machine) or
any machine that already has one — this only fires for the second-developer / resumed-run case.
```

```
Scope contracts present:
  Read usecases/_index.md + scopes/*.json (scope-board.md) + scope-summary.md. Print:
    - UC count + actors (usecases/_index.md)
    - scope board: scope_id, topology_type, substrate file count (scopes/*.json / scope-board.md)
    - any SPIKE blockers (scope-summary.md)
    - scope-summary "Done when" headline statements
No scope contracts (pre-v0.3.0, unchanged from v0.2.6):
  Read tasks/_index.md (LOCAL root). Print:
    - task count by package/variant (.shared / .be / .web / .mobile / .e2e)
    - layer distribution (Layer 1→6) and the critical dependency path
    - any SPIKE tasks (third-party feasibility) that block others
    - scope-summary "Done when" headline statements

Substrate-disjointness assertion (design spec §5.1 Blueprint A, only when
docs/shapeup-sdlc/<slug>/scopes/*.json exist — scope-architect's lint pass already ran;
this is the orchestrator's own re-confirmation before committing to a build sequence):
  - Run `node skills/ba-pitch-analyzer/scripts/spec-lint.mjs --slug <slug>`: DISJOINT (a file in two
    scopes' `allowed_file_substrate` without BOTH declaring it `shared_substrate` — PA3
    waiting to happen), PA1 (directory-aligned scope), PA2 (size cap). Any red → HARD STOP,
    route a remap order to scope-architect before BUILD — a human may have hand-approved
    past a 🔴 at the architect's own checkpoint.
  - Lock the build SEQUENCE riskiest-first: order scopes by open-unknowns count (from
    hill/<scope-id>.yml if present, else the orient hill signal), not by file count or
    alphabetical — Shape Up's "solve in the right sequence" (step 10).

Ask (max 2): scope cuts? lens correct? any SPIKE to resolve before build?
  Scope-hammer framing: reference the appetite from the pitch
  (e.g. "Given a ~1-week appetite, which of these scopes feels right-sized?").
  Also surface any rabbit holes identified in the pitch — they flag where scope
  may expand unexpectedly if not cut now. A scope cut here is cheap; after
  BUILD round 1 it's expensive.
```
Do NOT enter BUILD until the board is accepted.

---

## GATE L3 — Verdict & Loop

```
Render the 🗻 Hill report (slice-level) — NOT a task count. Scope contracts present → read
  committed hill/<scope-id>.yml shards (mechanical phases from GATE L2.4, DD-10). No contracts →
  fall back to the board + open-unknowns heuristic (uphill/crest/downhill/done). See
  references/ledger-schema.md "Hill report". Roadmap rule unchanged either way: progress is
  reported by hill position, never by "N/M tasks done".

Read EVAL-FEATURE-<slug>.md verdict.

PASS:
  → first PASS of the run AND not --no-qa:
      delegate ▶ QA EDGE HUNT → Agent (model: qa — see references/delegation.md
      "Invocation mechanism"): Skill(shapeup-sdlc-plugin:qa-edge-hunter) (pure worker; see
      round-protocol "QA edge hunt"). Args: spec folder, EVAL report path, ledger path, app URL.
      Its GATE Q0/Q1 pauses surface here. Output: `~` findings → .shapeup-sdlc/<slug>/discovery/ledger.md
      + .shapeup-sdlc/<slug>/qa/hunt-report.md. No verdict — the run's verdict stays this EVAL's PASS.
      → then proceed to SHIP (triage of QA findings happens at SHIP S.0/GATE L4).
  → subsequent PASS (a promoted-findings fix round): Agent (model: qa):
    Skill(shapeup-sdlc-plugin:qa-edge-hunter) --recheck on the promoted items only, then SHIP.
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
S.0  GATE H — delegate to scope-hammer (this IS Shape Up's "Decide When to Stop", step 11):
     Invoke via Agent (model: exec — see references/delegation.md "Invocation mechanism"):
       Skill(shapeup-sdlc-plugin:scope-hammer) --slug <slug> --baseline <shaping/baseline.md if present>
             [--breaker outer]   when round_budget hit 0 with scopes still open
             [--breaker inner --scope <id>]   once per queued hammer proposal (attempt_budget
                                              exhausted scopes accumulated during BUILD)
             (no --breaker flag)              normal stop — all scopes FINISHED, post-QA-hunt
     Feeds it: qa/hunt-report.md findings (when present), discovery/ledger.md open items,
               advisor-protocol budget-overflow flags, the hammer-proposal queue from BUILD.
     Reads back: its GATE H0/H1/H2 output — census, baseline comparison, cut list + verdict.
     Authority: scope-hammer proposes; the tech lead records the PO's decision in
       round-ledger.md and performs the actual close (S.1 onward). It never ships on its own.
       - Cut list confirmed → all cuts carried to discovery/ledger.md as raw ideas (debt-free).
       - Verdict = CANNOT SHIP (a must-have item failed H1.2) → do NOT proceed to S.1; escalate
         to PO honestly with scope-hammer's ship-blocking list, same spirit as a max-rounds
         escalation.
     Pre-v0.3.0 spec (no scope contracts) → scope-hammer still runs; H0's only census sources
       are QA + discovery ledger (no scope/attempt-budget inputs), equivalent to the old inline
       triage this step used to do.
S.1  Confirm board green + latest eval verdict = PASS.
S.1b Checklist-hygiene assert: `grep -c "^- \[ \]" .shapeup-sdlc/<slug>/tasks/TASK-*.md` →
     every count must be 0 on a shipping board. An unchecked AC box on a done task means
     either an unverified criterion (real gap — back to BUILD/EVAL) or an ingest miss (the
     WorkResult's ac_results never covered it — re-run ingest-result on that result, or route
     back to the owning worker for a corrected result; the tech lead does not tick boxes
     itself). Do not SHIP past a non-zero count without logging the reason in the ledger.
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
S.6  Harvest one signal row → append to `docs/shapeup-sdlc/metrics/<machine-id>.jsonl`
     (committed, SHARED root; sharded per machine so concurrent runs never merge-conflict on
     one file — addendum Δ3; an aggregate view is `cat docs/shapeup-sdlc/metrics/*.jsonl`).
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
Question (max 1): "Anything to record before I close the run? (y/n) or provide feedback for the next sprint."
On confirm:
- If the PO provides substantive feedback (not just 'y' or empty) → automatically delegate via Agent (model: exec — see references/delegation.md "Invocation mechanism"): Skill(shapeup-sdlc-plugin:coach) with the provided feedback for RLHF. The coach runs its own GATE COACH-1 to have the PO categorize each rule, then files it under the responsible skill in `docs/shapeup-sdlc/knowledge-base/<skill>.md` (committed → team-shared). Coachable skills: `task-executor`, `ba-pitch-analyzer`, `qa-edge-hunter`; each reads its own file at the top of its next run. The tech lead does not categorize the feedback itself — that is the coach's gate, by design (no assumptions).
- Then output → `✅ [slug] [shipped & deployed | built & verified, deploy pending] — [r] rounds, verdict PASS.`

---

