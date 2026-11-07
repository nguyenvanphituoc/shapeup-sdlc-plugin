---
name: building
description: "Use this skill whenever the user wants to ship a kicked-off Shape Up pitch end to end — orient, plan, build, evaluate, hunt, cut, ship — as the tech lead who drives the run in this session and sits at every gate with the PO. Trigger on: \"ship this feature\", \"run the harness\", \"build from this pitch\", \"from pitch to ship\", \"run the full harness\", \"orchestrate the build\", \"resume the run\". Also covers its sub-commands: translate a non-English pitch to English (intake), decide when to stop with the census and cut list (GATE H, \"hammer this down to must-haves\"), and file ship feedback or seed the knowledge base from the project or the platform docs (the retro, \"coach this feedback\", \"scan the project for guidelines\"). DEFAULT: /ship <pitch>. Use it even when the user describes a multi-step build flow without naming the skills."
---

# Building — the loop that drives a run

## ▶ RUN THIS FIRST — do not summarise this file

**Your first output is a tool call, not a plan.** Narrating the pipeline reads like a clean run and
leaves defects behind it. The Stop hook blocks a session that reached this skill and left no run
receipt; loading these instructions is not running them.

You drive the run. The kernel decides what comes next; you do it, then ask again. **Never advance on
your own account of what you did — advance on a kernel exit code or on `probe next`'s JSON.**

Every kernel command below is run exactly as written, on ONE line (a grant matches a single-line
command; a `\`-continued one comes back "requires approval"). If a kernel command
comes back "requires approval", stop and say so — the scripts need a one-time grant
(`npx shapeup-sdlc init`); never route around it or hand-build the feature.

## Rules

1. **ASK, DON'T ASSUME.** Collect the intake explicitly (`resources/intake.md`); put every gate to the
   PO with a recommendation first. Never invent an answer the PO did not give.
2. **SIMPLEST FIRST.** The smallest change that satisfies the pitch.
3. **NON-REGRESSION.** Never touch what already works.
4. **THE KERNEL DECIDES THE NEXT STEP.** Run `probe next`, do what it returns, run it again.

## Step 0 — open the run

Resolve the intake and open it as `resources/intake.md` says: language check (a non-English pitch is made
English by you, right there: `<name>.en.md` and the glossary, and the run opens on the copy), the L0 collect-list,
`init run` — with every switch the operator typed, because it writes the launch record in the same act
as the receipt and refuses a model below the floor (exit 3 = a run is already open: its record is kept,
mark the relaunch with `probe resume --slug <slug> --mark-relaunch` and go to the loop with `--restart`),
the shared `project-profile.md`, and the L0 gate. `--tiny` is no longer served: say so, and run the full
loop with the pitch's appetite small.

## The loop

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" probe next --slug <slug> [--restart]
```

Add `--restart` on the first call of a fresh session: an order the dead session left unanswered is dead
work, not work in flight. Surface every string in `warnings`. Then act on `kind`:

| `kind` | Do |
|---|---|
| `dispatch` | Run each `pre`, then `compile`. Spawn ONE sub-agent (model: `model`) told to invoke `Skill(<skill>) --order "<order_path>"` plus `note`, and to return a one-line summary. When it returns run `ingest` — add `--tokens-total <N> --usage-source agent-tool-result` when the result reported a total, and nothing when it did not; never estimate one — then each `then`. A failed `compile`, or a sub-agent that dies, runs `on_fail_close` and stops. A refused `ingest` is not a stop: ask again — the kernel sends the worker back once with the refusal, then stops with the real reason. |
| `plan` | One planning substep, done HERE — no sub-agent. Unless `order_open`, run `open`: it stamps the write fence (`payload.step`, `payload.mode`, `payload.feature`, `payload.spec_folder`, `payload.kb_rules_paths`). Read `resource` (`section` says where) and `guidance`; write ONLY what `produces` names, never outside the substep's substrate between `open` and `close`. Run each of `checks` (fix a red, run it again; `advisory` never stops). Run `close`, then ask again. A `close` over no artifact is recorded, not retried — the next step names what is missing. |
| `stop` | The census, done HERE — no sub-agent. Run each `pre` (it records a refusal), then each command in `probes` (owner, requirements, one attempts probe per proposal scope) and cite what they print for every ownership, exhaustion and requirement claim. Read `resource` (`section` says where), compare against the BASELINE and never the ideal, write the census to `produces.path` with its `required` fields, run `close`. A refused census comes back once, with the reason in `note`; a second refusal is a stop. |
| `build` | For every scope in `release`, in ONE message, spawn a sub-agent (model: `model`) for that scope exactly as for `dispatch`, using the item's own `compile`, `order_path`, `note` and `ingest` (usage flags included). When they return, ask again. |
| `command` | Run `pre`, then `command`; exit codes in `ok_exits` (default `[0]`) pass; any other runs `on_fail_close` when present. Then each `then`. |
| `gate` | See below. |
| `wait` | Nothing may open until an in-flight scope returns. Ask again once one does. |
| `need` | Something outside the kernel is missing (`need`). Create it with the PO (the profile: `resources/intake.md`), then ask again. |
| `terminal` | Run `close_command`, report `status` and `reason`. `shipped` goes on to the retro (`retro`: `resources/retro.md`) — run `retro.gate`, its GATE COACH-1 command, FIRST, before asking for feedback. Stop. |
| `done` | Nothing to resume. Say so. |

A `pre` or `then` entry marked `advisory` is a projection: run it, log a failure, never stop on it.

**A sub-agent is told only its skill, its order and its note.** It does not receive the run's history,
the other scopes, or your reading of the plan; the order is the whole brief.

### Gates

A gate pauses the run for the PO. Run each `pre`, print `block` verbatim, then run `command`:

- **exit 0** — crossed. The decision is in the output and the kernel ledgered it; ask again.
- **exit 4** — the answer set has no answer. Put `block` to the PO in `resources/gates.md`'s shape —
  the decisions in `valid_decisions`, your recommendation first, one question — wait, then run
  `answer_command` with `<decision>` replaced by what the PO chose. That records the source `PO (live)`.
- **exit 5** — the set aborts here. Run `abort_close`, report, stop.

Never answer a gate yourself in an `interactive` or `auto` run, and never use `answer_command` unless the
PO gave that decision in this session. An unattended run resolves through its answer set alone.

## What the kernel keeps for you

You do not count attempts, track rounds, remember which gate was crossed, decide whether a verdict is
fit to stand, or re-dispatch a phase that already left its artifact: each is a branch of `probe next`.
A phase sent back once is sent back by the kernel's own step, with the reason in `note`; a second
refusal is a stop, not a third try. If a step looks wrong, do not improvise past it — report it as a
suspected harness defect and stop.

**A write the substrate does not cover is denied while an order is live.** Between `compile` and
`ingest` of a build order you write nothing yourself; between `open` and `close` of a plan order you write
only what the substep produces.

## Sub-commands

`/ship` with none runs the whole loop. A sub-command does one activity of it, from the same kernel steps:
`plan` (`/scopes`, `/wire`) — the planning substeps; `stop` (`/hammer`) — the census, over the run in hand when
`probe next` hands a `kind: stop` step, and otherwise a report of the step the run is at; `retro` (`/retro`,
`/retro --scan`, `/retro --research <stack>`) — `resources/retro.md`, `retro-scan.md`, `retro-research.md`;
`intake <path>…` (`--check` writes nothing) — the language gate alone, `resources/intake.md` §2.

## Resume

`/ship` again over an open run is the resume: Step 0 finds the receipt, the loop reads artifacts on
disk and nothing else. A closed run that did not ship is reopened on the record by the loop's first
step; one that shipped reports `done`.

> **Intake, language check and translation, profile, the launch record** → `resources/intake.md`
> **Planning: how a substep runs, requirements; the spec, wiring and scope formats** → `resources/plan.md` and its `plan-*.md` siblings
> **Which knowledge-base file is read where, and under what name a rule is filed** → `resources/guidance.md`
> **How to put a gate to the PO, and what to have read first** → `resources/gates.md`
> **What a round is; the attempt loop; why the loop stops where it does** → `resources/rounds.md`
> **The census, the baseline comparison, the cut list (GATE H)** → `resources/stop.md`
> **After a ship: feedback, the retro gate, `--scan`, `--research`** → `resources/retro.md`, `retro-scan.md`, `retro-research.md`
