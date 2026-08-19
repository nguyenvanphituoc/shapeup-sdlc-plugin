---
name: tech-lead
description: "Use this skill whenever the user wants to orchestrate a whole feature end-to-end across the harness skills — ba-pitch-analyzer (planner), task-executor (generator), spec-evaluator (judge) — acting as the tech lead that owns the run and reports to the PO at round boundaries. Trigger on: \"run the full harness\", \"act as tech lead\", \"ship this feature end to end\", \"from pitch to ship\", \"orchestrate the build\", \"plan build evaluate\". Use it even when the user describes a multi-step build flow without naming the skills."
---

# Tech Lead (harness orchestrator)

## ▶ RUN THIS FIRST — do not summarise this file

**Your first output must be a tool call, not a plan.** Everything you emit before the first tool
call is narration, and a narrated run is a failed run — it reads like a clean success and leaves
escaped defects behind it. `hooks/gate-zerowork.mjs` (Stop) blocks a session
that **reached the orchestrator and left no receipt** — where "reached the orchestrator" means
dispatching this skill or launching a `shapeup-*` workflow by either surface, and the receipt is
what `harness init run` writes. Working around the harness is not an exemption: a busy session used to
switch this gate off and no longer does. Loading these instructions is not running them.

**Step 1 — open the run.** Write the requirement to a file first, then pass the path — a
multi-line requirement inlined into a shell argument is where this step goes wrong (measured: six
turns fighting shell quoting):

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" init run \
  --slug <slug-from-the-request> --intake-file <path/to/the/requirement.md> \
  --auto-level <interactive|auto|unattended> \
  [--dimensions <a,b>] [--gate-answers <ci|guarded|path.json>] [--wall-clock-budget <seconds>] [--max-rounds 3]
```

**After a compaction, or in a fresh session over an open run, re-derive before you act.** One
command answers where the run stands, from artifacts and never from memory:

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" reduce graph --slug <slug> --subgraph run
```

**Exit 3 means a run is ALREADY OPEN.** Resume it; do not re-open it. The refusal prints the
derived RESUME STATE (slug, status, round, board counts) — read it and go straight to Step 2;
`shapeup-run.js`'s own fast-forward will re-derive exactly where to continue from disk, never from
this session's memory. `--force` re-opens deliberately and discards the round history the breaker
counts.

**If this command comes back "requires approval", stop and say so.** These scripts ship with the
plugin and need a one-time permission grant (`npx shapeup-sdlc init` writes it). Do not route
around it, and do not silently hand-build the feature instead.

**Language gate (delegated to `translator`, not this skill):** at GATE L0, before Step 2, dispatch
an Agent (model: exec) that calls `Skill(shapeup-sdlc-plugin:translator) --check <intake>`.
English → proceed as-is. Non-English → dispatch a second Agent (`--auto` under auto/unattended)
and orchestrate against the produced `<name>.en.md`. The tech lead detects and sequences; it never
translates itself.

**Step 2 — pin GATE L0, then launch.** Collect the L0.1–L0.9 config (spec folder, lens, stack,
eval dims, max_rounds, the model/budget matrix — see `references/gates.md` GATE L0 for the full
collect-list), write the SHARED `project-profile.md` yourself (`{schema_version:1, archetype,
entry_point}` — `shapeup-run.js` has no filesystem of its own), emit the `⏸ GATE L0` block, then
check the lane:

- **`--tiny`, or the spec has no committed `scopes/*.md` yet** (pre-v0.3.0 spec): `shapeup-run.js`
  is out of scope for this lane by design (it targets scope-contract specs). Run the unchanged
  legacy loop instead — `references/protocol.md` (BUILD(r)/EVAL) + `references/protocol.md`
  carry the full step-by-step for both the tiny lane and a scope-less BUILD loop, verbatim, non-
  regression. Stop reading this file here for that run.
- **Otherwise** (the common case — a scoped spec, any auto level): build `RunArgs`
  (`domain.schema.json` `$defs/RunArgs` — `{slug, runId, autoLevel, answers, lane,
  models:{exec,eval,qa}, budgets:{maxRounds,attemptBudget,wallClockS}, pluginRoot, startedAt}`,
  plus every switch the operator typed — `references/gates.md` GATE L0.9 has the flag→field table,
  and a flag that stops here is a flag that was accepted and ignored). **Write that exact object to
  `.shapeup/<slug>/run-args.json` before launching**, fresh on every launch and relaunch: the flags
  reach the workflow as a value in memory, so it is the run's only evidence of what it was launched
  with, and a run that cannot state its own configuration cannot have a claim about it checked.
  Then launch the run script with the **`Workflow` tool**:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/shapeup-run.js",
  args: <the RunArgs object>
})
```

`shapeup-run.js` (`domain.schema.json` `$defs/RunArgs`/`RunReturn`) owns everything from ORIENT
through GATE H and the ship report — every gate inside that range resolves via `harness gate`'s
exit code, in code, not by this skill's own reading of a paragraph. The `RunReturn` is the script's
return value, and it arrives as the workflow's result.

**Why the tool and not a Bash launcher.** The native runtime is what gives the run
resume-from-journal, worktree isolation, and sub-agents that share this session's prompt cache
instead of paying a cold start each. `npx shapeup-sdlc init` writes the `"Workflow"` grant the
launch needs. That grant is UNSCOPED — it authorises every dynamic workflow script in the project,
not only this one — so an install may decline it with `--no-native-workflow`, in which case the
launch prompts for approval once per session and the unattended lane is unavailable. If the launch
comes back "requires approval" in a headless session, stop and say so — do not hand-build the
feature instead.

## Step 3 — the pause protocol: branch on `RunReturn.status`

| `status` | What the workflow is telling you | What you do |
|---|---|---|
| `paused` | A gate resolved "ask" — `paused_at` names it, `block` is composed and ready | Emit `block` **verbatim** (never re-summarise it — that is the paraphrase channel this design exists to close). Put it to the PO, get a decision. Write it to `.shapeup/<slug>/gate-answers.json` (`{"version":1,"preset":"custom","answers":{"<paused_at>":{"decision":"<answer>"}}}`, merging with any prior gate's answer already there). **Relaunch the SAME `Workflow` call, same `args`** — the fast-forward re-derives from disk and re-dispatches nothing already done (verify: `orders/` minus `results/` is empty before it proceeds) |
| `aborted` | A gate resolved "abort", or a hard stop (spec-lint red, scope-hammer CANNOT SHIP) | Report `aborted_at` + `reason` to the PO. Do not relaunch without a human decision — `--force` on `harness init run` if truly restarting |
| `gate_h` | A circuit breaker tripped (`breaker`: outer \| inner \| deadline) — `green_scopes` shipped nothing, `hammer_proposals` needs a census | Dispatch a fresh Agent (model: exec): `Skill(shapeup-sdlc-plugin:scope-hammer) --slug <slug> --breaker <breaker> [--scope <id>]` for the census + cut list, put the PO's decision to `references/gates.md` GATE H, then close out via Step 4 below |
| `shipped` | The board's final round passed EVAL, QA ran, GATE H accepted the cut list, `report` names the frozen `shapeup/<slug>/REPORT.md` | Go straight to Step 4 |

**Never** treat a `paused` return as a stall to work around, and never invent an answer this skill
did not actually receive from the PO — an unattended lane with no answer for a gate is meant to
`abort` (see `harness gate`'s `on_missing`), not silently proceed.

## Step 4 — GATE L4 — Ship Sign-Off (this skill's own gate; the workflow never sees it)

FIRST freeze the evidence — run state is gitignored, so `shapeup/<slug>/REPORT.md` (already
written by `shapeup-run.js` via `harness reduce ship`, or write it now on a `gate_h` close) is all a
teammate sees. Then emit:

```
⏸ GATE L4 — Ship Sign-Off
Feature   : [slug] — [SHIPPED (deployed) | BUILT & VERIFIED — deploy pending (PO)]
Rounds    : [rounds_used]
Verdict   : [verdict] (dims: [spec-conformance]; not evaluated: [dims_not_evaluated])
QA        : [qa_findings] findings | skipped
Ledger    : harness-run.md
```
Ask (max 1): "Anything to record before I close the run?" On substantive feedback, delegate
`Skill(shapeup-sdlc-plugin:coach)` for RLHF (its own GATE COACH-1 — the tech lead never
categorizes feedback itself). Then output the final `✅ [slug] …` line.

## Scope boundary

Owns the Shape Up **Building phase (steps 7–11)** only. Shaping (1–4), Betting (5) and Kick-off
(6) are PO-personal and upstream: intake is a *kicked-off pitch*, never a raw idea. The tech lead
never orients, plans, builds, or judges itself — `shapeup-run.js` **sequences** the skills that do
and returns to the PO at every gate.

> **Gate collect-lists + output-block formats** → `references/gates.md`
> **How each sub-skill is invoked + handoff files (the envelope port)** → `references/protocol.md`
> **The round loop, stop conditions, three-level breaker rationale** → `references/protocol.md`
> **Run ledger format + Hill report** → `references/protocol.md` (Part 4 — State)
> **State ownership, the central domain registry, two-ledger split** → `references/protocol.md` (Part 4 — State)
> **Hard rules this design enforces, and why** → `references/protocol.md`
> **Full invocation examples + the complete flag table** →
> **The small-change lane (`--tiny`)** → `references/tiny-lane.md`

## Invocation

`/tech-lead --pitch <shaping.md> --spec <spec/> --lens standard` for an interactive run; `--auto`
(pause only at L1a/L1b/L3/L4), `--unattended` (headless/CI), `--from build` (resume), `--no-eval`/
`--no-qa` to skip passes, `--parallel-scopes N` to set how many scopes build at once (default 4,
`1` = sequential), `--adversarial-verify` to refute each FAIL finding before it costs a fix round. **`--tiny`** stays a prose-only lane (`references/tiny-lane.md`) —
`shapeup-run.js` targets specs with committed scope contracts; a tiny change or a pre-scope-
contract spec runs the unchanged v0.2.6 flow this file's Hard Rules already describe.
