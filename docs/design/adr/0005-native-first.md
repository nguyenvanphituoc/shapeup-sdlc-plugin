# ADR-0005 — Native first: what the second cut removed, what it kept, and why

| | |
|---|---|
| **Status** | Proposed — written by the session that executed the native-first plan; the PO decides |
| **Date** | 2026-11-08 |
| **Decision** | Where the host (Claude Code) provides a mechanism, the plugin uses it and drops its own; where the plugin's script is a witness the host cannot be, or the engine of the loop, it stays. |
| **Supersedes** | decision 3 of [ADR-0004](0004-single-loop.md) — "`hill-chart` is untouched, so `reduce graph` and `reduce hill` stay" |
| **Affects** | `agents/`, `hooks/`, `kernel/reduce/`, `kernel/report/`, `kernel/verify/`, `kernel/probe/`, `skills/hill-chart/`, `skills/building/` |

## Context

4.0.0 moved the run into the operator's session and left 18.7 k lines of kernel and hooks, 21.9 k lines of structural tests and ten
hook registrations around it. Two questions were open: how much of that does a current host make unnecessary, and which parts exist
because a model cannot be its own witness. The analyses `03` and `04` of the working record classify every module and map each job
to a native mechanism; the plan and its execution record say what was done and what was refused.

## Decision

1. **The four workers are plugin agents** (`agents/<worker>.md`, preloading the worker's skill). A dispatch is an `Agent` call by name.
   The receipt hook attests the agent that ran and records the tokens, duration and model the host measured; `reduce ingest` takes the
   leg row's usage from it. No session copies a figure by hand.
2. **Removed:** `reduce graph`, `report export` and its fact tables, the traceability oracle (the two requirement parsers moved to
   `lib/`), `probe stats`, the `probe digest` verb (the digester stays a library), the `Stop` hook, and `tier-guard`, whose check now
   lives in `sandbox-guard` and refuses the same write with the same words. `hill-chart` renders from the committed hill shards alone.
3. **Kept, against the plan:** `safety-spine` (it is the only record of which programs a worker ran, and a deny rule is weaker and
   cannot be verified for `rm -rf ~`); `compile`, `reduce ingest`, `reduce board` and `probe next` (the engine's inputs and outputs; the
   measurement that could remove them was not run to a verdict, and the fixture cannot see the chains the engine exists for);
   `lib/contract.mjs` and Markdown on disk (ADR-0001).
4. **Rejected:** `isolation: worktree` for build agents (the run trace is gitignored and a worktree checkout does not contain it) and
   `maxTurns` (no run says what a legitimate worker needs).

## Consequences

- A session that narrates a run instead of opening one is no longer stopped by the runtime. It was never stopped on any ledger on file.
- The reachability oracle, the run graph and the exported fact tables are gone; the round build gate's probes and the evaluator carry
  the first question, and `legs.jsonl` and `gates.jsonl` are the per-dispatch and per-gate records.
- A worker's craft is bound to its agent definition. A plugin whose agent does not preload its skill is refused at `init run`.
- The engine and the suite that pins it stay. A smaller plugin needs the engine's removal, and that needs an eval that exercises
  breakers, send-backs and concurrent scopes.
