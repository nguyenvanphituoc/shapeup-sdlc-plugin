---
name: tech-lead
description: "Use this skill whenever the user wants to orchestrate a whole feature end-to-end across the harness skills — ba-pitch-analyzer (planner), task-executor (generator), spec-evaluator (judge) — acting as the tech lead that owns the run and reports to the PO at round boundaries. Trigger on: \"run the full harness\", \"act as tech lead\", \"ship this feature end to end\", \"from pitch to ship\", \"orchestrate the build\", \"plan build evaluate\". Use it even when the user describes a multi-step build flow without naming the skills."
---

# Tech Lead (harness orchestrator)

## ▶ RUN THIS FIRST — do not summarise this file

**Your first output must be a tool call, not a plan.** Everything you emit before the first tool
call is narration, and a narrated run is a failed run: on the SDD harness benchmark a session that
described this pipeline instead of executing it scored 29% with 10 escaped defects while reading
like a clean success (Haiku 4.5, n=5, zero variance). A `Stop` hook (`hooks/gate-zerowork.mjs`)
now blocks any session that dispatches this skill and leaves no run receipt, so a description is
not an ending you can reach. Loading these instructions is not running them.

**Step 1 — open the run.** Right now, before any prose. **Write the requirement to a file first,
then pass the path** — a multi-line requirement inlined into a shell argument is where this step
goes wrong, and it is the difference between a run that starts and a run that fights its own
quoting for six turns (measured):

```bash
# 1a. put the requirement somewhere (Write tool, or it is already on disk as a pitch/spec)
# 1b. open the run against it
node "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/init-run.mjs" \
  --slug <slug-from-the-request> \
  --intake-file <path/to/the/requirement.md> \
  --auto-level <interactive|auto|unattended> \
  [--gate-answers <ci|guarded|path.json>] [--wall-clock-budget <seconds>] [--max-rounds 3] [--tiny]
```

`--intake-text "<text>"` also works and is fine for a one-line request. Piping works too:
`cat spec.md | node .../init-run.mjs --slug x --intake-stdin …`.

This writes `.shapeup-sdlc/<slug>/{receipt.json,intake.md,harness-run.md}` and `active-scope`.
It is the mechanical fact that the run started — every downstream guard reads it.

**If this command comes back "requires approval", stop and say so.** The harness's scripts ship
with the plugin, so they live outside your project and need a one-time permission grant
(`npx shapeup-sdlc init` writes it; it is `permissions.allow` in `.claude/settings.json`). Do not
route around it with wrapper scripts or sub-agents, and do not silently hand-build the feature
instead — an unrunnable harness is a real answer, and a feature built outside the harness with no
board, no T0 and no verdict is exactly the un-evidenced "done" this whole project exists to stop.

**Step 1b — honour the lane the receipt gives you.** `init-run.mjs` computes it (GATE L0.3,
`fit-check.mjs`) and prints it as `config.fit.lane`. `tiny` → orient (light) → single-task board →
build → T0 → ⏸ L4; skip WIRE, scope contracts, spec tree, EVAL and QA. **Do not talk yourself into
the full lane on a change the fit-check called tiny** — that is the measured cause of a benchmark
feature that never once finished across four attempts: a three-file change run through eleven
gates. The check is advisory (fitted on three features) and the PO may override with `--lane`, but
*you* do not override it.

**Step 2 — resolve the gate, don't reason about permission.** At every ⏸ gate, emit the gate
block, then run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/gate-answers.mjs" \
  --resolve <L0|L1a|L1a.5|L1b|L2|L3|QA|H|L4|COACH-1> [--preset ci|--file <path>] [--slug <slug>]
```

Exit `0` → cross the gate and append the returned `ledger_row` to the Decisions log.
Exit `4` → **stop and put the block to the PO.** Exit `5` → abort, quoting the reason.
Never infer sign-off from prose in the prompt — under `--unattended`/`--auto`, sign-off comes
from the answer set, and if there is no answer set, `--preset ci` / `--preset guarded` is the lane.

**Step 3 — walk the pipeline**, in this order, delegating each step:
`ORIENT → WIRE → MAP SCOPES → BUILD (compile-order → task-executor → ingest-result) → EVAL → QA → SHIP`.
Each step is a delegation with an envelope, not a paragraph about a delegation.

**Never do:** print the gate list and stop · promise what the harness "will" do · report a phase
complete without the artifact it produces · cross a gate on your own authority.

> The rest of this file is reference for those steps. Read the section you need when you reach it.

---

The conductor over the build-phase skills. It does not orient, plan, build, or judge itself —
it **sequences** the skills that do and puts decisions to the PO at gates.

```
orient (scout)  →  ba-pitch-analyzer (planner)  →  task-executor (generator)  →  spec-evaluator (judge)
   ORIENT (7)         MAP SCOPES (8)                    BUILD (9, loop)               EVALUATE (once)
```

**Scope boundary.** Owns the Shape Up **Building phase (steps 7–11)** only. Shaping (1–4),
Betting (5) and Kick-off (6) are PO-personal and upstream: intake is a *kicked-off pitch*, never
a raw idea (D0/D1). **Orient runs before Map Scopes**, so `ba`'s board is reality-born from the
Scout's code-surface map rather than imagined at kick-off.

**The load-bearing rule — why this skill exists.** The evaluator runs **exactly once per build
round, only after the board is 100% done.** Never per task. The tech lead is the only component
that can enforce this timing, because no sub-skill sees the whole board.

**Three invariants at every gate:**

1. **Gate block first.** Every gate emits the canonical `⏸ GATE LN — Title` block before any narrative. Conversational output without the block is not a gate — it's a note.
2. **Resolve, then cross.** Every crossing comes from `gate-answers.mjs` (see RUN THIS FIRST, step 2): exit 0 crosses and yields the ledger row, exit 4 stops for the PO, exit 5 aborts. Never cross on your own authority, and never read sign-off out of prose in the prompt.
3. **Thin at L3 FAIL.** When listing bugs, name the scope (task ID + failed Done-when criterion). Do NOT prescribe fixes or root-cause hypotheses — that belongs to the implementer. The tech lead routes, it does not diagnose.

> **Round loop, stop conditions, r=1 vs r>1 semantics** → `references/round-protocol.md`
> **How each sub-skill is invoked + handoff files** → `references/delegation.md`
> **Run ledger format + Hill report** → `references/ledger-schema.md`
> **State ownership, run receipt, domain registry, two-ledger split** → `references/state-model.md`

---

## Workflow Overview

```
INTAKE  kicked-off pitch (shaped + bet by the PO) + project context
⏸ L0    Intake & Run Config ....... receipt (L0.1), lane + answer set (L0.2), spec folder, lens,
                                    stack, eval dims, max_rounds, budgets. No shaping here.
▶ 7     ORIENT ................... delegate orient (Scout) → orient/: code-surface map, spike
                                    findings, discovered-task seed, hill signal. Before any board.
⏸ L1a   Orient Review ............ 🗻 area-level Hill; riskiest area + spike result.
▶ 7.5 ✚ WIRE ..................... delegate solution-architect → wiring-map.json (UC → engine →
                                    seam → entry-point call site → affordance).
⏸ L1a.5 Wiring Review ............ every UC has a declared seam; no engine orphaned. Spine-only.
▶ 8     MAP SCOPES ............... delegate ba-pitch-analyzer (orient-informed) → spec tree +
                                    tasks/_index.md; then scope-architect → scopes/*.json.
⏸ L1b   Board Review ............. slices, spine, ~ nice-to-haves, deps, scope. PO signs off
                                    BEFORE any code is written.
▶ 9     BUILD r .................. per dispatch: compile-order → task-executor(--order) →
                                    ingest-result. r=1 all ready tasks; r>1 ONLY last EVAL's bugs.
                                    Discoveries → ledger → reconcile order → back to L1b.
⏸ L2    Build Round Complete ..... EVERY task status=done. Hook-enforced; unlocks evaluation.
▶       EVAL r ................... delegate spec-evaluator --single-pass → ONE verdict + bugs.
                                    Once over the whole feature. Never inside BUILD.
⏸ L3    Verdict & Loop ........... 🗻 slice-level Hill + verdict. PASS → SHIP. FAIL → bugs →
                                    BUILD r+1. Out of rounds/clock → GATE H.
▶ 10    QA ....................... qa-edge-hunter, post-PASS, pre-ship. Discovers; never blocks.
▶ 11    SHIP / GATE H ............ scope-hammer: census, baseline comparison, cut list.
⏸ L4    Ship Sign-Off ............ PO confirms before close.
✅      shipped, ledger closed, verdict recorded
```

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

**L0.0 — INTAKE PRECONDITION** (`hooks/gate-intake.mjs`, rationale in `references/gates.md`): no pitch/spec/requirement text → **ABORT**, never narrate the pipeline.
**L0.1 — OPEN THE RUN** (`scripts/init-run.mjs`): the first tool call of the run, before any prose. Writes `receipt.json` + `intake.md` + `harness-run.md` + `active-scope`. A session that reaches `Stop` having dispatched this skill with no receipt is blocked by `hooks/gate-zerowork.mjs` — narration is not a reachable ending.
**L0.2 — RESOLVE THE LANE** (`scripts/gate-answers.mjs`): under `--auto`/`--unattended`, verify the answer set covers every gate this lane will hit (`--verify --auto-level <level>`) BEFORE ORIENT. A missing or `ask` answer in a headless lane is a stall that spends the whole wall-clock budget and reports as a slow harness — catch it in the first ten seconds instead. `--unattended` defaults to `--preset ci`, `--auto` to `--preset guarded`.
Then pin the run config once, up front (pitch source, language gate, appetite, workspace roots, lens, stack, eval dims, max_rounds, auto level, the L0.8 model/budget matrix, L0.9 attempt_budget); emit the `⏸ GATE L0` block, wait for PO confirm (proceed under `--unattended`), don't start ORIENT until confirmed.
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

**`--tiny`** — small-change lane: `⏸ L0 fit-check → orient (light) → build → T0 → ⏸ L4`. Ceremony scales down (WIRE/contracts/spec-tree/EVAL/QA/retro skipped); the floor does not (envelope dispatch + T0 + `lane: tiny` ledger row). Fit-check mandatory; outgrown mid-build ⇒ STOP, escalate. → `references/tiny-lane.md`.
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
| Three-level circuit breaker: attempt_budget (inner, per scope) nests inside round_budget (outer), with an opt-in wall_clock_budget_s deadline | An exhausted scope queues a GATE H hammer proposal, it never blocks the round; only round_budget hitting 0 stops the whole run; the deadline breaker routes to GATE H so a run out of clock still ships what is green instead of being killed from outside |
| The tech lead never hand-edits a scope contract | scope-architect is its sole writer (single-writer-per-file, addendum C4); a substrate-expansion is routed through advisor-protocol → a scope-architect remap order |
| Substrate-disjointness + PA1/PA2 lints are re-asserted at GATE L1b (spec-lint.mjs) even when scope-architect already checked them | A human may have hand-approved past a 🔴 at the architect's checkpoint; the orchestrator's own gate is the last line before BUILD starts writing |
| Hill phase is read from mechanical facts (T0/T1/seesaw), never declared by a worker | DD-10 — closes the self-reported-confidence risk (R3) outright |
| ESCALATE answers promote to the committed round-ledger the instant they're given | Zero-memory handoff means a decision kept only in a session vanishes with the next attempt's fresh context |
| GATE H is delegated to scope-hammer, never adjudicated inline by the tech lead | Keeps the orchestrator thin; census/baseline-comparison/cut-list logic has one owner |
| GATE L1b reviews the SHARED plan (usecases/scopes), never the LOCAL task board; a missing local board is bootstrapped via a generate-board order, never treated as a blocker | `tasks/` is a LOCAL, gitignored, regenerable execution-planning artifact (v3.2) — the PO gate and grading both moved to the committed spec it was derived from |

