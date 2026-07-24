---
name: tech-lead
description: "Use this skill whenever the user wants to orchestrate a whole feature end-to-end across the harness skills — ba-pitch-analyzer (planner), task-executor (generator), spec-evaluator (judge) — acting as the tech lead that owns the run and reports to the PO at round boundaries. Trigger on: \"run the full harness\", \"act as tech lead\", \"ship this feature end to end\", \"from pitch to ship\", \"orchestrate the build\", \"plan build evaluate\". Use it even when the user describes a multi-step build flow without naming the skills."
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
work; its intake is a *kicked-off pitch*, not a raw idea. (Per the Shape Up redesign decision record, D0/D1.)

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

**State ownership (the harness rule — D6, mechanically closed in v1.0).** Workers are
stateless; the orchestrator layer is the **sole writer of ALL run-state**. Every worker
receives a structured **WorkOrder** envelope (`.shapeup-sdlc/<slug>/orders/`, compiled by
`compile-order.mjs`) and returns a **WorkResult** envelope (`results/`); the deterministic
`ingest-result.mjs` performs every shared-state write — board status, AC ticks, unblock
propagation, discovery-ledger appends, verdict bookkeeping. No worker writes `run-state.md`,
`tasks/_index.md`, or the ledger anymore — everything a worker used to write into shared
files, it now returns as data. The tech lead owns `harness-run.md` — rounds, gate decisions,
Hill positions, verdicts, `discovered_rounds`, config, language record. The board
(`tasks/_index.md`, LOCAL root — v3.2) is **execution truth** maintained exclusively through
ingest.

**Central domain registry.** Every record type and payload field that crosses a skill
boundary is defined exactly once in `skills/tech-lead/schemas/domain.schema.json` — the
envelope schemas (`work-order.schema.json`, `work-result.schema.json`) only `$ref` it. The
registry annotates each entity's tier (SHARED/LOCAL), location, sole writer, and readers,
carries the machine-readable ERD (`x-erd`), and maps which payload fields each worker may
rely on (`x-payload-by-worker`). A new cross-boundary field is added THERE first (structural
test #24 enforces the map's consistency); a skill inventing its own undeclared field is a
defect — the orchestrator, not the worker, owns the vocabulary.

**Two ledgers, split by promotion timing (addendum §F.3, only when scope contracts exist).**
`harness-run.md` stays the LOCAL (`.shapeup-sdlc/<slug>/`, gitignored) full run trace — it can
be rebuilt or lost without consequence. A second, committed `round-ledger.md`
(`docs/shapeup-sdlc/<slug>/round-ledger.md`, SHARED, Tier A) holds only what must survive a
crash or a `.shapeup-sdlc/` wipe: the resolved model/budget matrix (L0.8/L0.9) and the
**Decisions** table — every advisor-protocol ESCALATE answer, promoted the instant it's given,
never batched to round close. The tech lead is still the sole writer of both; `round-ledger.md`
is simply the subset that must never live only in a session or a gitignored file. No scope
contracts → `round-ledger.md` is not written; `harness-run.md`'s existing "Decisions log" is
the only ledger, exactly as in v0.2.6.

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
▶ WIRE ✚  │  delegate → solution-architect (`wire`, step 7.5) ──► wiring-map.json: per-UC engine
  (7.5)   │  → seam → entry-point call site → affordance (vs project-profile entry_point).
⏸ L1a.5 ✚ │  Wiring Review ─────────► each UC has a declared seam (no engine orphaned). Spine-only.
          │
▶ MAP     │  delegate → ba-pitch-analyzer (step 8), orient-informed ──► spec tree +
  SCOPES  │  tasks/_index.md (the board). `ba` consumes orient/ artifacts, does not re-scan.
  (8)     │
⏸ GATE L1b│  Board Review ──────────► review board: slices, spine, ~ nice-to-haves, deps,
          │                          scope. PO sign-off BEFORE any code is written.
          │
▶ BUILD r │  per dispatch: compile-order → task-executor(--order) → ingest-result ──► code
  (9)     │  r=1: build ALL ready tasks.   r>1: build ONLY the bugs from last EVAL.
          │  Discoveries return in each WorkResult; ingest appends them to the ledger →
          │  a reconcile order (ba-pitch-analyzer) routes back to GATE L1b, then BUILD resumes.
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

At GATE L0 the tech lead dispatches an Agent (model: exec — see references/delegation.md
"Invocation mechanism") that calls `Skill(shapeup-sdlc-plugin:translator) --check <intake>`:
- **English** → proceed straight to ORIENT against the original.
- **non-English** → dispatch a second Agent (model: exec) that calls
  `Skill(shapeup-sdlc-plugin:translator) <intake>` (pass `--auto` under `--auto`/`--unattended`),
  then orchestrate against the produced `<name>.en.md` copies. Record the translator pass in
  the ledger.

The tech lead's job stays orchestration faithful to Shape Up: kicked-off pitch → ORIENT →
MAP SCOPES → BUILD rounds → single end-of-round EVAL → SHIP. Language normalization is
upstream and out of scope here.

---

## GATE L0 — Intake & Run Config

Pin the run config once, up front (pitch source, language gate, appetite, workspace roots, lens, stack, eval dims, max_rounds, auto level, the L0.8 model/budget matrix, L0.9 attempt_budget); emit the `⏸ GATE L0` block, wait for PO confirm (proceed under `--unattended`), don't start ORIENT until confirmed.
→ **Playbook (collect list L0.1–L0.9 + gate-output block):** `references/gates.md` — GATE L0.

---

## ORIENT (step 7) — delegate to orient (the Scout)

Building opens with Orient, not planning: dispatch `orient` (model: exec) to read real code + spike the scary parts, writing the four `orient/` artifacts that are the orient → ba contract.
→ **Playbook (invoke line, artifacts, ledger record):** `references/gates.md` — ORIENT.

---

## GATE L1a — Orient Review

First Hill read (area-level): render the 🗻 Hill from `hill-signal.md`, print code-surface headline + spiked area + result + riskiest unknowns, ask ≤2; don't enter MAP SCOPES until Orient is accepted.
→ **Playbook:** `references/gates.md` — GATE L1a.

---

## WIRE (step 7.5) + traceability spine ✚ — delegate to solution-architect

Spine-only (self-skips on a legacy spec): you write `project-profile.json` at L0; `solution-architect` (`wire`) is the sole writer of `wiring-map.json`; `ba` writes the `requirements.md` registry (`coverage`); `trace-lint` runs ADVISORY at L1b. ⏸ GATE L1a.5: confirm each UC has a declared seam before slicing.
→ **Playbook (PROFILE/WIRE/COVERAGE/trace-lint steps):** `references/gates.md` — WIRE / L1a.5.

---

## MAP SCOPES (step 8) — delegate to ba-pitch-analyzer (orient-informed)

Two orders, two workers, one step: `ba-pitch-analyzer` (`analyze`) writes the spec tree + board from the orient artifacts (no re-scan); `scope-architect` (`map-scopes`) is the sole writer of the committed `scopes/*.json` contracts. Keep the planner ambitious on scope, high-level on tech.
→ **Playbook (both compile-order lines, faithful/deviation notes):** `references/gates.md` — MAP SCOPES.

---

## GATE L1b — Board Review (Plan Acceptance)

PO sees the shape before any code — scope cut/confirmed here (cheap now, expensive later): on a scoped spec the PO reviews the SHARED plan (usecases + `scopes/*.json` + scope-summary), never the LOCAL board; bootstrap a missing board via a generate-board order; re-assert disjointness + PA1/PA2 (`spec-lint.mjs`); order scopes riskiest-first; ask ≤2; don't enter BUILD until accepted.
→ **Playbook (bootstrap check, scoped/legacy reads, disjointness assertion):** `references/gates.md` — GATE L1b.

---

## BUILD round r — compile order → dispatch → ingest result → verify

**The pipeline sub-layer (pure-skill architecture v1.0).** Every dispatch to a worker is four
mechanical calls — the WorkOrder/WorkResult envelopes are the harness's canonical port, and
the two pipeline scripts (not the workers) own all shared-state reads/writes. Path note: bare
`scripts/compile-order.mjs`-style paths live in THIS skill's directory (resolve them against
this SKILL.md's location — in a plugin install, `${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/`);
`skills/<name>/`-prefixed paths resolve from the plugin root. Both ship with the skills tree
on every distribution channel.

```
a. COMPILE  node scripts/compile-order.mjs …        → .shapeup-sdlc/<slug>/orders/<id>.json
b. DISPATCH Agent (model: exec) — fresh subagent, the zero-memory-handoff boundary:
            Skill(shapeup-sdlc-plugin:task-executor) --order <order path>
            The worker implements, then writes its WorkResult envelope to
            .shapeup-sdlc/<slug>/results/<same id>.json (its output contract). It writes NO
            board/ledger/run-state files itself.
c. INGEST   node scripts/ingest-result.mjs <result path>
            → ticks AC boxes, flips task/board status, appends the Execution Log, propagates
              unblocks, appends discoveries to the ledger, queues any ESCALATEs — schema-
              validated, deterministic, the single writer of shared state (D6, closed).
d. VERIFY   (scope contracts only) node scripts/t0-verify.mjs …
```

A `validate-envelope.mjs` PreToolUse hook denies any dispatch whose `--order` file is missing
or schema-invalid — a malformed order never reaches a worker.

**No scope contracts (pre-v0.3.0 spec, or a scope-less run):**
```
r = 1 (first build):
  Loop until compile-order --next reports no ready task (board all ✅):
    a. node scripts/compile-order.mjs --next --slug <slug> [--test-cmd "<cmd>"]
    b. dispatch (fresh Agent, model: exec): Skill(shapeup-sdlc-plugin:task-executor) --order <path>
    c. node scripts/ingest-result.mjs .shapeup-sdlc/<slug>/results/<id>.json
  SPIKE tasks resolve first (they block; compile-order's dependency check enforces the order).

  Discovered Tasks:
  ingest-result appends any discoveries[] to the ledger. When the board finishes with new
  ledger entries, compile a reconcile order for the planner:
    node scripts/compile-order.mjs --operation reconcile --slug <slug>
      --worker ba-pitch-analyzer --payload '{"discovered_ledger": ".shapeup-sdlc/<slug>/discovery/ledger.md"}'
  dispatch it, ingest its result, then route back to GATE L1b (Board Review) for PO approval
  before resuming BUILD on the newly generated tasks.

r > 1 (fix build, after a FAIL):
  Input = the bug list in evaluation/EVAL-FEATURE-<slug>.md from the previous EVAL.
  Build ONLY those bugs: per bug,
    node scripts/compile-order.mjs --task <id> --slug <slug> --operation fix
      --payload '{"bugs": [<the bug entries for this task>]}'
  then dispatch + ingest as above. Do NOT re-run the whole board. Do NOT touch passing areas.
```
Record per task in the ledger: task id, status, files touched (all read from the WorkResult).

**Scope contracts present — the isolated attempt loop (design spec §3.5/§5.1, Blueprint A):**
```
For each scope in the L1b sequence (riskiest-first), not yet FINISHED:
  0. checkout(branch-of-scope)  — branch-per-scope isolation (PA3/PA5). Write the pointer
     .shapeup-sdlc/active-scope = {slug, scope_id} — this is what the PreToolUse sandbox
     hook reads to enforce the scope's allowed_file_substrate on every Edit/Write this round.

  for attempt in 1..attempt_budget (L0.9, default 5):
    a. node scripts/compile-order.mjs --scope docs/shapeup-sdlc/<slug>/scopes/<id>.json
         --round <N> --attempt <M> [--test-cmd "<cmd>"]
       → orders/r<N>-a<M>.json: scope contract + this scope's tasks + ledger decisions
         (round-ledger.md, promoted answers) + last attempt's digested errors (AEGIS triples,
         read from the previous T0 artifact). NO prior-attempt chat history goes in
         (zero-memory handoff, PA6) — the script can only compile facts, which is the point.
    b. dispatch Agent (model: exec) — a fresh subagent, this IS the zero-memory-handoff
       boundary: Skill(shapeup-sdlc-plugin:task-executor) --order <path>
    c. node scripts/ingest-result.mjs .shapeup-sdlc/<slug>/results/r<N>-a<M>.json
       Escalates queued by ingest → dispatch Agent (model: exec):
       Skill(shapeup-sdlc-plugin:advisor-protocol) --ledger round-ledger.md
       --escalate <block> [--unattended]; persist the answer immediately (it must survive
       the next attempt's fresh context — compile-order reads it back from the ledger).
       Cap: 3/scope/round (advisor-protocol's own budget).
    d. t0 = run `node scripts/t0-verify.mjs <scope-contract> --round <N> --attempt <M>
       --seesaw-registry .shapeup-sdlc/<slug>/seesaw/registry.json`
       → writes .shapeup-sdlc/<slug>/t0/verdicts/r<N>-a<M>.json (the artifact spec-evaluator
         will require a citation to at GATE L2/EVAL).
    e. t0 overall=green            → break the attempt loop; this scope reaches
                                      DOWNHILL_EXECUTION (hill derivation, see GATE L2 below).
       t0 overall=red, regression  → a FINISHED scope's fixture broke (seesaw caught it, PA5).
                                      `git stash push -u -m "t0-rollback-r<N>-a<M>"` (never a
                                      hard discard — the stash preserves the diff for review),
                                      then retry this attempt.
       t0 overall=red, own fixture → loop to the next attempt; compile-order picks the
                                      `discovered_tasks` triples out of this T0 artifact and
                                      folds them into the next order's digested_errors.
  if the loop exhausted attempt_budget without green:
    → inner circuit breaker tripped. Do NOT block the round. Queue a hammer PROPOSAL
      (scope_id + last t0 artifact + reason) for GATE H. Move to the next scope in sequence.

Discovered Tasks (unchanged mechanism, now scope-aware):
  If a scope's discoveries don't fit its own substrate, compile a remap order for the
  scope-architect (sole writer of scope contracts):
    node scripts/compile-order.mjs --operation remap --slug <slug>
      --worker scope-architect --payload '{"discovered_ledger": ".shapeup-sdlc/<slug>/discovery/ledger.md"}'
  dispatch + ingest — it may extend a scope or propose a new one; it never silently widens a
  substrate. Route back to GATE L1b for the delta before resuming.
```
Record per attempt in `harness-run.md` (LOCAL): scope_id, attempt, t0 overall, files touched.
Record per scope in the committed `round-ledger.md` (SHARED, Tier A) the moment it settles:
final hill phase this round + any ESCALATE decisions (design spec addendum F.3 — a decision
made must survive a crash, so it is promoted immediately, not batched to round close).

---

## GATE L2 — Build Round Complete

**Purpose:** The single most important gate — it is the **only** thing that unlocks the
evaluator. No evaluation runs while any task is unbuilt.

> **Runtime-enforced (not honor-system).** A `PreToolUse` hook (`hooks/gate-l2.mjs`) hard-blocks
> the once-per-round EVAL delegation (`spec-evaluator --single-pass`/`--feature`, no `--task`) when
> `tasks/_index.md` is not fully green — the deny message names the unfinished tasks. You still emit
> the gate block below for the PO; the hook is the backstop that makes "never EVAL on a partial
> board" a precondition the model cannot talk past. Per-task evals (`--task`) are intentionally not
> gated.

```
L2.1  Read tasks/_index.md. Assert: every task status = done (board fully green).
      → If any task is ready/in-progress/blocked: BUILD is not complete. Return to BUILD.
        Never proceed to EVAL on a partial board. (The L2 hook enforces this.)
L2.2  Tech-lead judgment call (surface, default = run eval):
      Is this feature within what the model builds reliably solo (trivial CRUD, tiny scope)?
      If clearly yes, offer to SKIP evaluation this run (--no-eval) — the evaluator is not a
      fixed yes/no; it earns its cost when work sits beyond easy solo capability.
      Default: run the single eval pass.
L2.3  T0 completeness pre-check (scope contracts only — avoids a wasted EVAL dispatch that
      spec-evaluator's own GATE V0.7 would hard-stop anyway): every scope reaching this round
      boundary as DOWNHILL_EXECUTION or FINISHED must have a t0/verdicts/r<N>-*.json with
      overall=green. A scope only present as a hammer PROPOSAL (attempt_budget exhausted) is
      fine — it's not claiming done, it's queued for GATE H.
L2.4  Hill derivation (mechanical facts only, DD-10 — scope contracts only; falls back to the
      open-unknowns heuristic in references/ledger-schema.md "Hill report" when no contracts
      exist). Per scope, from this round's t0 artifact + the latest spec-evaluator verdict +
      seesaw result — never self-reported by any worker:
        UPHILL_UNKNOWN     open_unknowns > 0 in the ledger for this scope
        UPHILL_SOLVED       unknowns = 0, no T0-green attempt recorded yet this run
        DOWNHILL_EXECUTION  ≥1 T0-green attempt; T1 PASS or seesaw still pending
        FINISHED            T1 PASS AND seesaw green AND merged to main
      Write/update hill/<scope-id>.yml (committed shard, single-writer = whoever holds that
      scope's branch — addendum Δ2) and regenerate hill-chart.md from all shards.
```

**GATE L2 Output:**
```
⏸ GATE L2 — Build Round [r] Complete
Board        : [N]/[N] tasks ✅
T0           : [n/a | [k]/[k] touched scopes T0-green]
Ready to EVAL: yes
Eval plan    : spec-evaluator --feature [slug] --single-pass   (dims: [spec-conformance])
```
Emit this block, then **stop and wait for PO confirmation** (interactive/--auto) before delegating to spec-evaluator. This is the PO's last chance to cut scope or skip eval (`--no-eval`) before the evaluator runs — make that explicit. Under --unattended, proceed.

---

## EVAL round r — delegate to spec-evaluator (ONCE)

```
Compile the eval order (pins spec folder, feature, dimensions, run command, T0 artifacts):
  node scripts/compile-order.mjs --operation evaluate --slug <slug>
    --worker spec-evaluator --round <r>
    --payload '{"dimensions": ["spec-conformance"], "run_cmd": "<cmd>",
                "t0_artifacts": [<per-scope t0/verdicts paths from GATE L2.3>]}'
Invoke via Agent (model: eval — see references/delegation.md "Invocation mechanism") ONE
feature-level pass over the whole running app:
  Skill(shapeup-sdlc-plugin:spec-evaluator) --order <path>
  (the legacy `--spec <path> --feature <slug> --single-pass` form still works standalone;
   the GATE L2 hook gates both shapes)
The evaluator exercises the running feature against ALL acceptance criteria + Done-when,
writes ONE evaluation/EVAL-FEATURE-<slug>.md (verdict + bug list) + its WorkResult. Then
ingest: node scripts/ingest-result.mjs .shapeup-sdlc/<slug>/results/evaluate-r<r>.json
— ingest appends the verdict ledger lines and un-ticks refuted AC boxes; the judge itself
never touches the board and never sets status: done.
Record in ledger: eval duration, verdict, bug count.
```
This is the single point where the evaluator runs in a round. It is not called per task,
not called inside the BUILD loop, not called before GATE L2.

---

## GATE L3 — Verdict & Loop

Render the 🗻 Hill report (slice-level, never a task count) + read the EVAL verdict. PASS → first PASS (unless `--no-qa`) delegates the QA Edge Hunt then SHIP; subsequent PASS runs `--recheck` on promoted items then SHIP. FAIL → print bugs by task/severity (name scope, never prescribe fixes), ask ≤1 to approve a bug-only BUILD r+1, stop + escalate if r+1 > max_rounds. Emit the `⏸ GATE L3` block.
→ **Playbook (PASS/FAIL scripts + gate-output block):** `references/gates.md` — GATE L3.

---

## SHIP (step 11) — close out

S.0 GATE H is delegated to `scope-hammer` (Shape Up's "Decide When to Stop") — census, baseline comparison, cut list + verdict; the tech lead records the PO decision and performs the close, never ships on its own. Then confirm board green + PASS, assert checklist hygiene, print the summary (incl. dims NOT evaluated), never auto-deploy, harvest one facts-only metrics row.
→ **Playbook (S.0–S.6):** `references/gates.md` — SHIP.

---

## GATE L4 — Ship Sign-Off

Emit the `⏸ GATE L4` sign-off block (feature state, rounds, verdict + dims not evaluated, QA status, ledger), ask ≤1; substantive PO feedback → auto-delegate `coach` (its own GATE COACH-1); then output the final `✅ [slug] …` line.
→ **Playbook (sign-off block + coach hand-off):** `references/gates.md` — GATE L4.

---

## Invocation

`/tech-lead --pitch <shaping.md> --spec <spec/> --lens standard` for an interactive run; `--auto` (pause only at L1a/L1b/L3/L4), `--unattended` (headless/CI), `--from build` (resume), `--no-eval`/`--no-qa` to skip passes.
→ **Full invocation examples + the complete flag table:** `references/invocation.md`.

---

## Hard Rules (never override without explicit user instruction)

| Rule | Rationale |
|------|-----------|
| Orchestrates Building only (steps 7–11); shaping/betting/kick-off are PO-personal, upstream | Intake is a kicked-off pitch, not a raw idea — the tech lead does no shaping/planning-authority work |
| ORIENT (step 7) runs before MAP SCOPES (step 8) | Roadmap: no pre-divided tasks at kick-off; the team orients first so the board is reality-born |
| Intake must be English before ORIENT; tech lead does NOT translate — it delegates to `translator` at GATE L0 | Translation is a separate single-purpose skill; orchestrator only detects + sequences |
| Tech lead is the SOLE WRITER of run-state (`harness-run.md`); workers get run metadata as args | Stateless workers, one stateful orchestrator — don't fragment run-state across worker files; protects `--from` resume |
| Every worker dispatch goes through the envelope port: compile-order → `--order` → ingest-result; shared state is written ONLY by ingest | The single-writer rule is mechanically true (D6 closed): a worker that writes boards/ledgers/run-state is a defect, and a malformed envelope is denied by the validate-envelope hook before it can corrupt run truth |
| Progress is reported by Hill position, never by counting tasks | The roadmap forbids task-counting; a 90%-done slice can still be stuck uphill on the one unknown that matters |
| Discovered tasks are reconciled and reviewed | Discoveries land in the ledger via ingest; dispatch a reconcile order (ba-pitch-analyzer) and route back to GATE L1b; do not ignore them |
| Evaluator runs once per round, only after GATE L2 (board 100% done) | The whole point: cheap end-of-round QA, never per task |
| Evaluator never called inside the BUILD loop | Keeps the build coherent and the run cheap |
| r>1 builds bugs only, never the whole board | Don't re-do passing work; minimize churn |
| Stop at max_rounds; escalate honestly | No infinite fix loops; the PO decides next |
| Tech lead delegates, never reimplements a sub-skill | Stays thin; each skill keeps its own gates and authority |
| Every delegation to a sub-skill (except the mechanical `t0-verify.mjs`) goes through the `Agent` tool on the L0.8-resolved model, never a direct `Skill` call from the tech lead's own turn | A direct `Skill` call runs inline on the orchestrator's own model — it silently drops the model matrix (nothing left to route) and the zero-memory-handoff isolation task-executor's isolated attempt loop already assumes; see references/delegation.md "Invocation mechanism" |
| Planner stays high-level on tech | Spec errors cascade into every build round |
| Never auto-deploy; "shipped" never silently means "deployed" | Deploy is outward-facing, PO-gated; record "deploy pending (PO)" otherwise |
| "Shipped" names the dims NOT evaluated | Prevents reading a spec-only PASS as fully verified |
| Every gate emits the canonical `⏸ GATE LN — Title` block before any narrative | Conversational output is not a gate; the block is the handoff contract |
| In interactive/--auto: emit the gate block, then stop and wait for PO confirmation | Never auto-proceed past a gate; the PO must cross each threshold explicitly |
| At GATE L3 FAIL: name scope (task + failed criterion), never prescribe fix options | Root cause analysis and fix paths belong to the implementer, not the orchestrator |
| Max questions per gate: L0/L1a/L1b = 2; L3/L4 = 1 | Gates are pauses, not interrogations; excess questions shift authority to the wrong role |
| SHIP harvest records facts only — copies existing structured output, never computes a new verdict/score | A self-computed score = a second judge behind spec-evaluator (breaks single-judge, invites Goodhart); the eval suite interprets, harvest records |
| Two-level circuit breaker: attempt_budget (inner, per scope) nests inside round_budget (outer) | An exhausted scope queues a GATE H hammer proposal, it never blocks the round — only round_budget hitting 0 stops the whole run |
| The tech lead never hand-edits a scope contract | scope-architect is its sole writer (single-writer-per-file, addendum C4); a substrate-expansion is routed through advisor-protocol → a scope-architect remap order |
| Substrate-disjointness + PA1/PA2 lints are re-asserted at GATE L1b (spec-lint.mjs) even when scope-architect already checked them | A human may have hand-approved past a 🔴 at the architect's checkpoint; the orchestrator's own gate is the last line before BUILD starts writing |
| Hill phase is read from mechanical facts (T0/T1/seesaw), never declared by a worker | DD-10 — closes the self-reported-confidence risk (R3) outright |
| ESCALATE answers promote to the committed round-ledger the instant they're given | Zero-memory handoff means a decision kept only in a session vanishes with the next attempt's fresh context |
| GATE H is delegated to scope-hammer, never adjudicated inline by the tech lead | Keeps the orchestrator thin; census/baseline-comparison/cut-list logic has one owner |
| GATE L1b reviews the SHARED plan (usecases/scopes), never the LOCAL task board; a missing local board is bootstrapped via a generate-board order, never treated as a blocker | `tasks/` is a LOCAL, gitignored, regenerable execution-planning artifact (v3.2) — the PO gate and grading both moved to the committed spec it was derived from |

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
