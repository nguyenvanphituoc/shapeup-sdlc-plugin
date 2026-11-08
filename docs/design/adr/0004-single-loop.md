# ADR-0004 — One loop in the session, in place of one workflow launch

| | |
|---|---|
| **Status** | Accepted — by the PO, 2026-11-07, before activity A1 started. The loop stands; the `probe next` it ran over was removed by [ADR-0006](0006-engine-removed.md) |
| **Date** | 2026-11-07 |
| **Decision** | The run is driven by one loop skill, `building`, in the operator's own session, over a kernel verb `probe next` that derives the next step from artifacts on disk. The Workflow-runtime launch, the courier sub-agents, the preflight canary and the relaunch protocol are retired. Four worker skills remain. |
| **Supersedes** | [`03-system-design.md` §3.5](../03-system-design.md) — "one workflow launch, not a turn-by-turn drive" |
| **Affects** | `skills/tech-lead/`, the planning and stop-phase worker skills, `kernel/probe/resume.mjs`, `kernel/init/`, `kernel/compile.mjs`, `kernel/schemas/`, `hooks/`, `bin/lib/grant.mjs`, the shipped `AGENTS.md` block |
| **Ships as** | 4.0.0 — a breaking change: skills, commands and a hook consumers know by name are removed |

## Context

The run was moved into a Workflow script so that a killed session loses nothing and a gate pause is
a return value. The script has no shell and cannot pause for a person, so two costs followed, both
countable from the shipped tree:

- every kernel command the script needs is run by a sub-agent whose only job is to type it and relay
  the exit code (51 call sites against 11 worker dispatch sites);
- every gate ends the launch, so an interactive run is relaunched at each gate, and each relaunch
  re-runs preflight and re-derives its position (`probe resume`, 1,161 lines).

The guards that exist to make that survivable — the fast-forward, the launch and return contract, the
staged copy of the script, the unscoped `Workflow` grant — carry no behaviour of their own. The
guards that matter (the substrate fence, the tier rule, single writer, receipts, T0) are kernel
subcommands and hooks and do not depend on who spawns the sub-agents.

## Decision

Eight decisions, the first four taken by the PO in the first round, the last four confirmed against
the constraints check.

1. **The four worker names stay:** `orient`, `task-executor`, `spec-evaluator`, `qa-edge-hunter`.
   Planning, the stop phase, retro and intake become activities of the loop, not workers.
2. **Planning folds at once.** `coverage → analyze → wire → map-scopes` run in the loop's context as
   one `plan` activity, with `verify spec` between the steps.
3. **`hill-chart` is untouched**, so `reduce graph` and `reduce hill` stay. *(Superseded by ADR-0005: `reduce graph` was removed and the chart renders from the hill shards.)*
4. **Intake stays as a resource** of the loop and still writes the English copy and the glossary.
5. **The loop is a thin skill over `probe next`.** The state machine stays in code: the verb returns
   the next step, its exact command and any gate block, from the artifact predicates; the "sent back
   once" post-conditions are branches of the verb. The loop skill keeps the line ratchet it replaces,
   at its new path and with the same number.
6. **The model floor moves into the kernel**, read at `init run`; a launch record (`noEval`, the
   dials, the run id) stays because the ship report refuses to freeze a PASS for a run launched with
   no evaluation.
7. **Planning keeps a write fence:** one `plan` operation survives as a fence-only order. `compile`
   stamps the planning substrate, no sub-agent runs, `reduce ingest` closes it. Without a live
   order a planning write is allowed, which was measured.
8. **Release as 4.0.0, with this record written first.** The installer stops adding the `Workflow`
   grant and deletes nothing from a user's settings.

## Consequences

- A gate is answered in the session that reached it. Resume is `/ship` again: the loop reads
  artifacts and nothing else.
- A run spawns only workers, so every agent has a row in the export. The leg row gains nullable
  tokens and cost.
- The loop's own writes are fenced only while a live order covers them. The loop never edits between
  `compile` and `reduce ingest` of a build order.
- The session, not a script, is the orchestrator, so narration is a risk the script did not carry.
  The answer is that every phase advance reads a kernel exit code, and the Stop hook still blocks a
  session that opened a run and left no receipt.
- Prompt-cache sharing between the script's sub-agents and the session is lost; the token column
  makes the cost measurable.

## What would change this decision

- A dated run of the loop on the archived small pitch costing more tokens per shipped scope than the
  fan-out arm, by more than the courier savings explain: keep the Workflow launch for the build
  phase only, with the loop around it.
- A loss at a planning handoff in the requirements-to-criteria table: `wire` and `map-scopes` return
  to sub-agents and the `plan` resource stays.
- A denial from a hook this change deletes, on a live run: that hook moves back to keep.
- The Workflow runtime gaining a shell or a pause that does not end the launch.
- A post-condition the script holds that `probe next` cannot carry: it gets a stated home and the
  ratchet is argued on the record, never weakened.

## Working record to retire when this ships

The v4 folder is the working record (ADR-0002): `README.md`, `requirements.md`, `analysis/`,
`review-2026-11-07-single-loop.md`, `proposal-2026-11-07-activity-layout.md`,
`constraints-2026-11-07.md`, `plan-2026-11-07-single-loop.md`, and the before-and-after page under
`docs/visualize/`. They are removed in the release commit, as the earlier plans were.
